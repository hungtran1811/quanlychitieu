// Firebase initialization using window.__FIREBASE_CONFIG__ loaded from config/firebase.config.js
if (!window.__FIREBASE_CONFIG__) {
  throw new Error("Firebase config missing. Please edit public/config/firebase.config.js");
}

firebase.initializeApp(window.__FIREBASE_CONFIG__);
const auth = firebase.auth();

// Export to global for other modules
window.firebaseApp = firebase;
window.auth = auth;
window.ADMIN_UID = window.__ADMIN_UID__ || null;
