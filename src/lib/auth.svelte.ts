// Google sign-in gate for the HA Portal.
//
// The app is gated behind Firebase Auth (Google). Only the emails in
// ALLOWED_EMAILS get in — anyone else who signs in with a valid Google
// account lands on a "not authorised" screen. Add family members here.
import { auth, googleProvider } from "./firebase";
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

export const ALLOWED_EMAILS = [
  "christosteyn@cloudbadger.com",
  "steyncd@gmail.com",
  // add family members' Google emails here
];

const allowed = (email: string | null) =>
  !!email && ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());

type AuthStatus = "loading" | "signedout" | "denied" | "ready";

class AuthStore {
  user = $state<User | null>(null);
  status = $state<AuthStatus>("loading");
  error = $state("");

  /** Wire the auth listener once, at app start. */
  init() {
    onAuthStateChanged(auth, (u) => {
      this.user = u;
      if (!u) this.status = "signedout";
      else this.status = allowed(u.email) ? "ready" : "denied";
    });
  }

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
}

export const authStore = new AuthStore();
