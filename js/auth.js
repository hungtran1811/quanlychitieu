import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getAuthInst, getDb, ts } from "./store/firestore.js";
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

  onAuthStateChanged(auth, async (user) => {
    // Upsert users/{uid} để feed gợi ý email
    if (user) {
      try {
        await setDoc(
          doc(getDb(), "users", user.uid),
          {
            email: user.email || "",
            displayName: user.displayName || "",
            photoURL: user.photoURL || "",
            updatedAt: ts(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn("ensureUserDoc failed", e);
      }
    }
    const isAdmin = !!user && user.uid === ADMIN_UID;
    subscribers.forEach((cb) => cb({ user, isAdmin }));
  });
})();

export async function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return await signInWithPopup(getAuthInst(), provider);
}
export async function logout() {
  return await signOut(getAuthInst());
}
export const currentUser = () => getAuthInst().currentUser;
