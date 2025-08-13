import { getDb } from "./firestore.js";
import {
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export function subscribeAllUsers(onChange) {
  return onSnapshot(collection(getDb(), "users"), (snap) => {
    const list = snap.docs
      .map((d) => {
        const x = d.data() || {};
        return {
          uid: d.id,
          email: (x.email || "").trim(),
          name: (x.displayName || "").trim(),
          photoURL: x.photoURL || "",
        };
      })
      .filter((u) => u.email);
    onChange(list);
  });
}

export function subscribeUsersMap(onChange) {
  return onSnapshot(collection(getDb(), "users"), (snap) => {
    const byUid = new Map(),
      byEmail = new Map();
    snap.forEach((d) => {
      const x = d.data() || {};
      const u = {
        uid: d.id,
        email: (x.email || "").trim(),
        name: (x.displayName || "").trim(),
        photoURL: x.photoURL || "",
      };
      byUid.set(u.uid, u);
      if (u.email) byEmail.set(u.email.toLowerCase(), u);
    });
    onChange({ byUid, byEmail });
  });
}
