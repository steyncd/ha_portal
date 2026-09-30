// Firebase app singletons for the HA Portal.
//
// Config is read from Vite env vars (VITE_FIREBASE_*) so no keys live in source.
// Real values are in `.env` (gitignored); see `.env.example` for the shape.
//
// Note: a Firebase *web* API key is a public identifier, not a secret — it ships
// in the built client bundle by design, and access is gated by Firebase Auth +
// Firestore rules + the Authorized-domains allow-list, not by hiding this value.
// Keeping it out of source just avoids secret-scanner noise. The real hardening
// is HTTP-referrer + API restrictions on the key in the Google Cloud console.
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from "firebase/firestore";

const env = import.meta.env;

/**
 * The auth domain must be the SAME ORIGIN as the page, or Safari breaks sign-in.
 *
 * Firebase's default authDomain is <project>.firebaseapp.com while this app is
 * served from helloliam-ha-dashboard.web.app. Those are different origins, so the
 * auth flow's iframe/storage is THIRD-PARTY — and Safari 16.1+, Firefox, Chrome's
 * storage partitioning and every home-screen web app block third-party storage.
 * The result is sign-in that silently fails everywhere except Chrome, which is
 * exactly what Christo saw. This is Firebase's own documented Option 1 for an app
 * hosted on a web.app subdomain:
 * https://firebase.google.com/docs/auth/web/redirect-best-practices
 *
 * Taken from location at RUNTIME rather than hard-coded, because every Firebase
 * Hosting site serves /__/auth/handler on its own domain (verified: both
 * helloliam-ha-dashboard.web.app and .firebaseapp.com return 200). So this stays
 * first-party on web.app today and on any custom domain added later, with no
 * second place to remember to change.
 *
 * The dev server is the exception — localhost:5173 has no /__/auth/handler of its
 * own, so it keeps the configured domain and signs in cross-origin as before.
 */
function sameOriginAuthDomain(): string {
  const configured = env.VITE_FIREBASE_AUTH_DOMAIN;
  if (typeof location === "undefined") return configured;
  const h = location.hostname;
  const isLocal =
    h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local") || h.endsWith(".test");
  return isLocal ? configured : location.hostname;
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: sameOriginAuthDomain(),
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error("Firebase config missing — copy .env.example to .env and fill in the values.");
}

export const app = initializeApp(firebaseConfig);

// App Check (reCAPTCHA v3) — attests requests come from the real app. Enforce
// per-service (Firestore/Storage) in the Firebase console once tokens are flowing.
if (typeof window !== "undefined" && env.VITE_RECAPTCHA_SITE_KEY) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.error("App Check init failed", e);
  }
}

export const auth = getAuth(app);

// Firestore with an IndexedDB-backed cache rather than the default memory-only
// one. Two reasons that matter here:
//
//   1. Outage resilience. Memory-only means every read needs the WAN. With
//      persistence, cached documents (chores, meal plan, prayer board, nudges)
//      still render during a power or fibre outage, and writes queue in
//      IndexedDB and flush when the connection returns.
//   2. Multi-tab. The household runs the wall tablet, phones and a desktop at
//      once; persistentMultipleTabManager lets them share one cache instead of
//      fighting over the IndexedDB lock (the older enablePersistence would fail
//      outright on the second tab).
//
// Falls back to the plain instance if persistence can't initialise — a private
// window or a browser with IndexedDB disabled must still load the app.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
})();

export const googleProvider = new GoogleAuthProvider();
