// auth.mjs — basic auth helpers
import { auth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, db, doc, setDoc, getDoc } from "./firebase.mjs";

// Admin UID (owner)
const ADMIN_UID = "rVrRomrCGbPqPcrPddtBTpdcLoh2";
export function isAdmin(u){ return u && u.uid === ADMIN_UID; }

export async function signInGoogle(){
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  // Ensure user record exists
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
  onAuthStateChanged(auth, (u)=>{
    const elName = document.getElementById("userName");
    if (elName){ elName.textContent = u ? (u.displayName || u.email || "Bạn") : ""; }
    const btnAdmin = document.getElementById("btnAdmin");
    if (btnAdmin){ btnAdmin.style.display = u && isAdmin(u) ? "inline-block" : "none"; }
  });
}

export async function signOutNow(){ await signOut(auth); window.location.reload(); }
