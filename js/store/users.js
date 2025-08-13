import { getDb } from "./firestore.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/** Realtime: mảng user để hiển thị danh sách */
export function subscribeAllUsers(cb) {
  const db = getDb();
  const q = query(collection(db, "users"), orderBy("displayName", "asc"));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => {
      const x = d.data() || {};
      return {
        id: d.id,
        name: x.name || x.displayName || "",
        email: x.email || "",
        photoURL: x.photoURL || "",
      };
    });
    cb(rows);
  });
}

/** Realtime: Map nhanh (byEmail/byUid) để tra tên/ảnh */
export function subscribeUsersMap(cb) {
  const db = getDb();
  const q = query(collection(db, "users"), orderBy("displayName", "asc"));
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
