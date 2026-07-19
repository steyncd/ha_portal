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

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || "Steyn Home", {
    body: n.body || "",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: (payload.data && payload.data.tag) || undefined,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
