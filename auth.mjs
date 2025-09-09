// auth.mjs – cache-first, minimal DOM work
import { auth, Provider, signInWithPopup, signOut, onAuthStateChanged, db, doc, getDoc, setDoc, serverTimestamp, ADMIN_UID } from "./firebase.mjs";

export function isAdmin(user) { return user && user.uid === ADMIN_UID; }

export async function signInGoogle() {
  try { await signInWithPopup(auth, Provider); }
  catch (e) { alert("Đăng nhập thất bại: " + e.message); }
}

export async function signOutNow() {
  try { await signOut(auth); } catch (e) { alert("Đăng xuất lỗi: " + e.message); }
}

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const base = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    role: isAdmin(user) ? "admin" : "user",
    updatedAt: serverTimestamp(),
  };
  if (!snap.exists()) {
    await setDoc(ref, { ...base, createdAt: serverTimestamp() }, { merge: true });
  } else {
    await setDoc(ref, base, { merge: true });
  }
}

export function bindAuthUI() {
  const authed = document.querySelectorAll("[data-authed]");
  const guest = document.querySelectorAll("[data-guest]");
  const adminEls = document.querySelectorAll("[data-admin]");
  const name = document.getElementById("userName");
  const avatar = document.getElementById("userAvatar");

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await ensureUserDoc(user);
      authed.forEach(e => e.classList.remove("d-none"));
      guest.forEach(e => e.classList.add("d-none"));
      if (name) name.textContent = user.displayName || user.email;
      if (avatar) avatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName||user.email)}`;
      adminEls.forEach(e => isAdmin(user) ? e.classList.remove("d-none") : e.classList.add("d-none"));
    } else {
      authed.forEach(e => e.classList.add("d-none"));
      guest.forEach(e => e.classList.remove("d-none"));
      adminEls.forEach(e => e.classList.add("d-none"));
    }
  });
}
