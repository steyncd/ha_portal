// Web push (FCM) for the HA Portal. enablePush() prompts for permission,
// registers the service worker, gets an FCM token, and stores it in Firestore
// (pushTokens/{token}). A Cloud Function (sendPush) fans messages out to all
// stored tokens. Foreground messages surface as a toast.
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import { app, db } from "./firebase";
import { authStore } from "./auth.svelte";
import { toast } from "./toast.svelte";

const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export function pushGranted() {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export async function enablePush(): Promise<{ ok: boolean; msg: string }> {
  try {
    if (!(await isSupported())) return { ok: false, msg: "Push isn't supported in this browser" };
    if (!VAPID) return { ok: false, msg: "Missing VAPID key (VITE_FIREBASE_VAPID_KEY)" };
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, msg: "Notification permission was denied" };

    // Scope the FCM SW to its own path so it doesn't fight the PWA (Workbox) SW
    // that owns "/". getToken() binds the push subscription to THIS registration.
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/firebase-cloud-messaging-push-scope" });
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, msg: "Couldn't get a push token" };

    await setDoc(doc(db, "pushTokens", token), {
      uid: authStore.user?.uid ?? null,
      email: authStore.user?.email ?? null,
      ua: navigator.userAgent,
      ts: Date.now(),
    });

    onMessage(messaging, (payload) => {
      const n = payload.notification;
      if (n?.title || n?.body) toast.show(`${n.title ?? ""} ${n.body ?? ""}`.trim());
    });

    return { ok: true, msg: "Notifications enabled on this device" };
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  }
}
