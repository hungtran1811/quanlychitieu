import { getDb } from "./firestore.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/** Danh sách user (để render grid/list) */
export function subscribeAllUsers(cb) {
  const db = getDb();
  const q = query(collection(db, "users"), orderBy("displayName"));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => {
      const x = d.data() || {};
      return {
        uid: d.id,
        name: x.name || x.displayName || "",
        email: x.email || "",
        photoURL: x.photoURL || "",
      };
    });
    cb(rows);
  });
}

/** Map nhanh byEmail/byUid để tra tên trong bảng */
export function subscribeUsersMap(cb) {
  const db = getDb();
  const q = query(collection(db, "users"), orderBy("displayName"));
  return onSnapshot(q, (snap) => {
    const byEmail = new Map();
    const byUid = new Map();
    snap.forEach((d) => {
      const x = d.data() || {};
      const rec = {
        uid: d.id,
        name: x.name || x.displayName || "",
        email: x.email || "",
        photoURL: x.photoURL || "",
      };
      if (rec.email) byEmail.set(rec.email.toLowerCase(), rec);
      byUid.set(rec.uid, rec);
    });
    cb({ byEmail, byUid });
  });
}
