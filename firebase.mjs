// firebase.mjs — Firebase v10 modular
// Replace with your real config if needed (already set below).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyA-NnpxWJL8hW1-vyCpNi7fUtQsL4NbzSA",
  authDomain: "quanlychitieu-3ce52.firebaseapp.com",
  projectId: "quanlychitieu-3ce52",
  storageBucket: "quanlychitieu-3ce52.firebasestorage.app",
  messagingSenderId: "447902402830",
  appId: "1:447902402830:web:246f2c65982224240b2f5f"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
  collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp
};
