// firebase.js
// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA-NnpxWJL8hW1-vyCpNi7fUtQsL4NbzSA",
  authDomain: "quanlychitieu-3ce52.firebaseapp.com",
  projectId: "quanlychitieu-3ce52",
  storageBucket: "quanlychitieu-3ce52.firebasestorage.app",
  messagingSenderId: "447902402830",
  appId: "1:447902402830:web:246f2c65982224240b2f5f"
};

// Firebase v9 modular
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Constants
window.ADMIN_UID = "rVrRomrCGbPqPcrPddtBTpdcLoh2";
