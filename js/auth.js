import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect, // +++
  getRedirectResult, // +++
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

  // ➊ NHẬN KẾT QUẢ SAU KHI REDIRECT (khi user quay lại app)
  try {
    await getRedirectResult(auth);
  } catch (e) {
    /* ignore */
  }

  onAuthStateChanged(auth, (user) => {
    const isAdmin = !!user && user.uid === ADMIN_UID;
    subscribers.forEach((cb) => cb({ user, isAdmin }));
  });
})();

// ➋ CHỌN REDIRECT TRÊN MOBILE/IN-APP, POPUP TRÊN DESKTOP
export async function login() {
  const auth = getAuthInst();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const ua = navigator.userAgent || "";
  const inApp = /(FBAN|FBAV|Instagram|Zalo|Line\/|MiuiBrowser|ZFBrowser)/i.test(
    ua
  );
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);

  if (inApp || isMobile) {
    return await signInWithRedirect(auth, provider);
  }
  return await signInWithPopup(auth, provider);
}

export async function logout() {
  const auth = getAuthInst();
  return await signOut(auth);
}
export const currentUser = () => getAuthInst().currentUser;
