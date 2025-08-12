import { getDb, ts } from "./firestore.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export async function createExpenseRequest({ uid, payload }) {
  const db = getDb();
  return await addDoc(collection(db, "requests"), {
    type: "expense",
    status: "pending",
    requestedBy: uid,
    createdAt: ts(),
    payload,
  });
}

export async function listMyRequests(uid) {
  const db = getDb();
  const q = query(
    collection(db, "requests"),
    where("requestedBy", "==", uid),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
