// Replace with your real Firebase config + init. Keep file name stable.
/* global firebase */
// If you use compat SDK, ensure scripts are loaded before this file.

window.P102 = window.P102 || {};
window.P102.FIREBASE = {
  ADMIN_UID: "rVrRomrCGbPqPcrPddtBTpdcLoh2", // <-- replace with your actual admin UID
};

// Example (compat) init. Uncomment and fill your config:

const firebaseConfig = {
  apiKey: "AIzaSyA-NnpxWJL8hW1-vyCpNi7fUtQsL4NbzSA",
  authDomain: "quanlychitieu-3ce52.firebaseapp.com",
  projectId: "quanlychitieu-3ce52",
  storageBucket: "quanlychitieu-3ce52.firebasestorage.app",
  messagingSenderId: "447902402830",
  appId: "1:447902402830:web:246f2c65982224240b2f5f",
};
firebase.initializeApp(firebaseConfig);
