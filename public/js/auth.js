import { upsertDirectoryEntry } from "./store/directory.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getAuthInst } from "./store/firestore.js";
import { ADMIN_UID } from "./config.js";

const subscribers = new Set();
export function onAuthChanges(cb) {
  subscribers.add(cb);
}

(async () => {
  const auth = getAuthInst();
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  onAuthStateChanged(auth, (user) => {
    const isAdmin = !!user && user.uid === ADMIN_UID;
    if (user) {
      upsertDirectoryEntry({
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
      }).catch(console.error);
    }
    subscribers.forEach((cb) => cb({ user, isAdmin }));
  });
})();

export async function login() {
  const auth = getAuthInst();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return await signInWithPopup(auth, provider);
}
export async function logout() {
  const auth = getAuthInst();
  return await signOut(auth);
}
export const currentUser = () => getAuthInst().currentUser;
