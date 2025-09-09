// firebase.mjs (Firebase Web SDK v10+ modular via CDN, kept lean)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, serverTimestamp, doc, getDoc, setDoc, collection, addDoc, getDocs, query, where, orderBy, limit, onSnapshot, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyA-NnpxWJL8hW1-vyCpNi7fUtQsL4NbzSA",
  authDomain: "quanlychitieu-3ce52.firebaseapp.com",
  projectId: "quanlychitieu-3ce52",
  storageBucket: "quanlychitieu-3ce52.firebasestorage.app",
  messagingSenderId: "447902402830",
  appId: "1:447902402830:web:246f2c65982224240b2f5f"
};

export const ADMIN_UID = "rVrRomrCGbPqPcrPddtBTpdcLoh2";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const Provider = new GoogleAuthProvider();

export {
  signInWithPopup, signOut, onAuthStateChanged,
  serverTimestamp,
  doc, getDoc, setDoc, collection, addDoc, getDocs, query, where, orderBy, limit, onSnapshot, updateDoc, deleteDoc
};
