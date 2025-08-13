import { getDb, ts } from "./firestore.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* ===== Client: tạo yêu cầu ===== */
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

export async function createPaymentRequest({ uid, payload }) {
  const db = getDb();
  return await addDoc(collection(db, "requests"), {
    type: "payment",
    status: "pending",
    requestedBy: uid,
    createdAt: ts(),
    payload,
  });
}

/* ===== Client: liệt kê / subscribe yêu cầu của tôi ===== */
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

export function subscribeMyRequests(uid, cb) {
  const db = getDb();
  const q = query(
    collection(db, "requests"),
    where("requestedBy", "==", uid),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cb(rows);
  });
}

/* ===== Admin: danh sách / thay đổi trạng thái ===== */
export async function listRequestsAdmin({
  status = "pending",
  type = "all",
  take = 50,
} = {}) {
  const db = getDb();
  const wheres = [where("status", "==", status)];
  if (type !== "all") wheres.push(where("type", "==", type));
  const q = query(
    collection(db, "requests"),
    ...wheres,
    orderBy("createdAt", "desc"),
    limit(take)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function markRequestStatus(id, { status, note, adminUid }) {
  const db = getDb();
  await updateDoc(doc(db, "requests", id), {
    status,
    adminNote: note || "",
    approvedBy: adminUid || null,
    approvedAt: serverTimestamp(),
  });
}
