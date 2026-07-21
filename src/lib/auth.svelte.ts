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

  init() {
    onAuthStateChanged(auth, (u) => {
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
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
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
