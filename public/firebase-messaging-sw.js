/* Firebase Cloud Messaging service worker — handles background web-push
   notifications for the HA Portal. The config below is the project's public
   web config (safe to expose). */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB5v9wFlVM9SrNGlTau-d19ctKEL2A_xMc",
  authDomain: "helloliam-ha-dashboard.firebaseapp.com",
  projectId: "helloliam-ha-dashboard",
  storageBucket: "helloliam-ha-dashboard.firebasestorage.app",
  messagingSenderId: "797371865602",
  appId: "1:797371865602:web:cb5e332e182ad63b20651b",
});

const messaging = firebase.messaging();

// IMPORTANT: return the showNotification promise.
//
// iOS/WebKit enforces userVisibleOnly — a push handler that finishes without
// displaying a notification counts as a "silent push", and after roughly three
// offences Safari REVOKES the push subscription entirely. Not returning the
// promise lets the service worker be terminated before the notification is
// shown, which registers as exactly that offence. For the same reason there is
// deliberately no "should I show this?" branch here: every push that arrives
// gets displayed, and all filtering, quiet hours and coalescing happen
// server-side in Cloud Functions before the push is ever sent.
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const d = payload.data || {};
  return self.registration.showNotification(n.title || "Steyn Home", {
    body: n.body || "",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: d.tag || undefined,
    data: { url: d.url || d.view || "/" },
  });
});

// Focus an already-open window instead of spawning another one, and honour the
// deep link the payload asked for. Previously this always opened "/", so a
// camera or alarm alert dropped you on the home page with no context.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          if ("navigate" in w && target !== "/") w.navigate(target).catch(() => {});
          return w.focus();
        }
      }
      return clients.openWindow(target);
    }),
  );
});
