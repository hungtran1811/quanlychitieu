import { getDb, ts } from "./firestore.js";
import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export async function upsertDirectoryEntry({
  uid,
  email,
  displayName,
  photoURL,
}) {
  const db = getDb();
  if (!uid) return;
  await setDoc(
    doc(db, "directory", uid),
    {
      uid,
      email: email || "",
      displayName: displayName || "",
      photoURL: photoURL || "",
      updatedAt: ts(),
    },
    { merge: true }
  );
}

export async function listDirectory(max = 200) {
  const db = getDb();
  const snap = await getDocs(query(collection(db, "directory"), limit(max)));
  return snap.docs.map((d) => d.data());
}
