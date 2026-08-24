// Google sign-in + household access control for the HA Portal.
//
// Access is data-driven from Firestore `settings/access` = { members[], owners[] }.
//   - members : may use the portal
//   - owners  : may use it AND manage the member/owner list (Admin section)
// BOOTSTRAP_OWNERS are always allowed as owners even before that doc exists, so
// the very first sign-in works and can seed the list. Keep these in sync with
// the same list in firestore.rules.
import { auth, googleProvider, db } from "./firebase";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

export const BOOTSTRAP_OWNERS = [
  "christosteyn@cloudbadger.com",
  "steyncd@gmail.com",
];

const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();

// Installed as a home-screen web app (iOS/Android standalone), the browser blocks
// the OAuth POPUP window — so signInWithPopup silently fails there. In that mode
// we use the full-page REDIRECT flow instead (completed by getRedirectResult on
// next load). Regular browser tabs keep the popup (nicer UX, no full reload).
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // iOS Safari's non-standard flag for home-screen web apps
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
type AuthStatus = "loading" | "signedout" | "denied" | "ready";

class AuthStore {
  user = $state<User | null>(null);
  status = $state<AuthStatus>("loading");
  role = $state<"owner" | "member" | "guest" | null>(null);
  members = $state<string[]>([]);
  owners = $state<string[]>([]);
  guests = $state<string[]>([]);
  guestViews = $state<string[]>([]); // allowed view ids for the signed-in guest
  guestConfig = $state<{ e: string; v: string[] }[]>([]); // per-guest views (admin view)
  error = $state("");
  #unsub: (() => void) | null = null;
  #authUnsub: (() => void) | null = null;

  init() {
    if (this.#authUnsub) return; // idempotent: a second init() must not stack a listener
    // Complete a pending redirect sign-in (the iOS-PWA path). Resolves around the
    // same time as onAuthStateChanged; surface any error to the sign-in screen.
    getRedirectResult(auth).catch((e) => { this.error = e instanceof Error ? e.message : String(e); });
    this.#authUnsub = onAuthStateChanged(auth, (u) => {
      this.user = u;
      if (this.#unsub) { this.#unsub(); this.#unsub = null; }
      if (!u) { this.status = "signedout"; this.role = null; return; }

      const email = lc(u.email);
      const boot = BOOTSTRAP_OWNERS.map(lc);

      // Live-subscribe to the access doc so Admin changes reflect immediately.
      this.#unsub = onSnapshot(
        doc(db, "settings", "access"),
        (snap) => {
          const d = (snap.data() as { members?: string[]; owners?: string[]; guests?: string[]; guestViews?: { e: string; v: string[] }[] } | undefined) ?? {};
          this.owners = d.owners ?? [];
          this.members = d.members ?? [];
          this.guests = d.guests ?? [];
          this.guestConfig = d.guestViews ?? [];
          const isOwner = boot.includes(email) || this.owners.map(lc).includes(email);
          const isMember = isOwner || this.members.map(lc).includes(email);
          const isGuest = !isMember && this.guests.map(lc).includes(email);
          this.role = isOwner ? "owner" : isMember ? "member" : isGuest ? "guest" : null;
          this.guestViews = isGuest ? ((d.guestViews ?? []).find((g) => lc(g.e) === email)?.v ?? []) : [];
          this.status = isMember || isGuest ? "ready" : "denied";
        },
        () => {
          // Can't read the doc yet (missing / rules) — fall back to bootstrap.
          const isOwner = boot.includes(email);
          this.role = isOwner ? "owner" : null;
          this.guestViews = [];
          this.status = isOwner ? "ready" : "denied";
        },
      );
    });
  }

  get isOwner() { return this.role === "owner"; }
  get isGuest() { return this.role === "guest"; }

  async signIn() {
    this.error = "";
    // Installed PWA → popups are blocked, so go straight to the redirect flow.
    if (isStandalone()) {
      try { await signInWithRedirect(auth, googleProvider); } // navigates away; returns via getRedirectResult()
      catch (e) { this.error = e instanceof Error ? e.message : String(e); }
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      // Some environments (blocked popup, in-app browsers) can't do popups even
      // in a normal tab — fall back to a full-page redirect rather than dead-end.
      const code = (e as { code?: string })?.code ?? "";
      if (["auth/popup-blocked", "auth/cancelled-popup-request", "auth/operation-not-supported-in-this-environment"].includes(code)) {
        try { await signInWithRedirect(auth, googleProvider); return; }
        catch (e2) { this.error = e2 instanceof Error ? e2.message : String(e2); return; }
      }
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  async signOut() {
    await fbSignOut(auth);
  }

  /** Update the signed-in user's display name (Firebase Auth profile). */
  async setDisplayName(name: string) {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: name.trim() });
    this.user = auth.currentUser; // nudge reactivity
  }
}

export const authStore = new AuthStore();
