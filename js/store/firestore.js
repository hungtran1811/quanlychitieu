import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { firebaseConfig } from "../config.js";

// Khởi tạo NGAY khi module được import (đảm bảo auth/db có sẵn cho auth.js)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const getApp = () => app;
export const getAuthInst = () => auth;
export const getDb = () => db;
export const ts = () => serverTimestamp();
