// Fill your Firebase config & ADMIN_UID. Keep this file as your single source of truth.
/* global firebase */
window.P102 = window.P102 || {};
window.P102.FIREBASE = {
  ADMIN_UID: "REPLACE_WITH_YOUR_ADMIN_UID", // <-- put your admin UID here
};

//Example init (compat). Replace with your real keys and uncomment.
const firebaseConfig = {
  apiKey: "AIzaSyA-NnpxWJL8hW1-vyCpNi7fUtQsL4NbzSA",
  authDomain: "quanlychitieu-3ce52.firebaseapp.com",
  projectId: "quanlychitieu-3ce52",
  storageBucket: "quanlychitieu-3ce52.firebasestorage.app",
  messagingSenderId: "447902402830",
  appId: "1:447902402830:web:246f2c65982224240b2f5f",
};
firebase.initializeApp(firebaseConfig);
