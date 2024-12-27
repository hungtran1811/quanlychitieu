// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDvuQ-btDdyFQ9u52mOHrq5LWwwMp8lS4I",
  authDomain: "quanlychitieu-f3822.firebaseapp.com",
  projectId: "quanlychitieu-f3822",
  storageBucket: "quanlychitieu-f3822.firebasestorage.app",
  messagingSenderId: "191039062128",
  appId: "1:191039062128:web:a6ca8486fc475ff1f0b4b5",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
