import { getDb, ts } from "./firestore.js";
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/** Tạo request thêm khoản chi */
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

/** Load 1 lần */
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

/** NEW: realtime subscribe — trả về hàm hủy */
export function subscribeMyRequests(uid, onChange) {
  const db = getDb();
  const q = query(
    collection(db, "requests"),
    where("requestedBy", "==", uid),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    onChange(rows);
  });
}

/** NEW: tạo request thanh toán nợ */
export async function createPaymentRequest({ uid, payload }) {
  const db = getDb();
  return await addDoc(collection(db, "requests"), {
    type: "payment",
    status: "pending",
    requestedBy: uid,
    createdAt: ts(),
    payload, // { fromEmail, toEmail, amount, note, items? }
  });
}
