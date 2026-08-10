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
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
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
