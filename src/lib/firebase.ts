// Firebase app singletons for the HA Portal.
//
// These config values are the project's *public* web config (a Firebase web
// API key is public by design — access is gated by Firebase Auth + Firestore
// security rules, not by keeping this secret). Project: helloliam-ha-dashboard.
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB5v9wFlVM9SrNGlTau-d19ctKEL2A_xMc",
  authDomain: "helloliam-ha-dashboard.firebaseapp.com",
  projectId: "helloliam-ha-dashboard",
  storageBucket: "helloliam-ha-dashboard.firebasestorage.app",
  messagingSenderId: "797371865602",
  appId: "1:797371865602:web:cb5e332e182ad63b20651b",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
