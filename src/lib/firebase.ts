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
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
