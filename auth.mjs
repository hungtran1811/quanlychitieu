// auth.mjs — v1.1 auth helpers with UI toggle
import { auth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, db, doc, setDoc, getDoc } from "./firebase.mjs";

// Admin UID (owner)
const ADMIN_UID = "rVrRomrCGbPqPcrPddtBTpdcLoh2";
export function isAdmin(u){ return u && u.uid === ADMIN_UID; }

export async function signInGoogle(){
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  const u = res.user;
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()){
    await setDoc(ref, {
      uid: u.uid,
      displayName: u.displayName || u.email || "User",
      email: u.email || "",
      photoURL: u.photoURL || "",
      createdAt: Date.now()
    });
  }
}

export function bindAuthUI(){
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  const btnAdmin = document.getElementById("btnAdmin");
  const elName = document.getElementById("userName");

  onAuthStateChanged(auth, (u)=>{
    if (u){
      if (elName) elName.textContent = u.displayName || u.email || "Bạn";
      if (btnLogin) btnLogin.style.display = "none";
      if (btnLogout) btnLogout.style.display = "inline-block";
      if (btnAdmin) btnAdmin.style.display = isAdmin(u) ? "inline-block" : "none";
    } else {
      if (elName) elName.textContent = "";
      if (btnLogin) btnLogin.style.display = "inline-block";
      if (btnLogout) btnLogout.style.display = "none";
      if (btnAdmin) btnAdmin.style.display = "none";
    }
  });
}

export async function signOutNow(){ await signOut(auth); window.location.reload(); }
