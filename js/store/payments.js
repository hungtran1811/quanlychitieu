// public/js/store/payments.js
// Store for "payments" collection — ready for Admin Overview & History

import { getDb, ts } from "./firestore.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/**
 * Tạo payment đã DUYỆT (admin tạo trực tiếp)
 * @param {Object} p
 *  - dateISO: string ISO
 *  - amount: number (VND)
 *  - note: string
 *  - fromEmail: string  (người trả)
 *  - toEmail: string    (người nhận)
 *  - createdBy: uid của admin
 */
export async function createPaymentApproved(p) {
  const db = getDb();
  const payload = {
    type: "payment",
    status: "approved",
    date: String(p.dateISO || new Date().toISOString()),
    amount: Number(p.amount || 0),
    note: (p.note || "").trim(),
    fromEmail: (p.fromEmail || "").trim(),
    toEmail: (p.toEmail || "").trim(),
    createdBy: p.createdBy || null,
    createdAt: ts(),
  };

  if (!payload.amount || payload.amount <= 0)
    throw new Error("Invalid amount for payment.");
  if (!payload.fromEmail || !payload.toEmail)
    throw new Error("fromEmail/toEmail is required.");
  if (payload.fromEmail.toLowerCase() === payload.toEmail.toLowerCase())
    throw new Error("From and To cannot be the same user.");

  return await addDoc(collection(db, "payments"), payload);
}

/**
 * Realtime: lấy N payment mới nhất (mặc định 20), sắp xếp theo date DESC.
 * Trả về hàm unsubscribe().
 */
export function subscribeRecentPayments(cb, take = 20) {
  const db = getDb();
  const q = query(
    collection(db, "payments"),
    orderBy("date", "desc"),
    limit(take)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cb(rows);
    },
    (err) => {
      console.error("subscribeRecentPayments error:", err);
      cb([]);
    }
  );
}

/** Xoá 1 payment theo id (dùng trong Admin Overview) */
export async function deletePayment(id) {
  const db = getDb();
  await deleteDoc(doc(db, "payments", id));
}

/** Liệt kê payments trong [startISO, endISO) — dùng cho History/Báo cáo */
export async function listPaymentsInRange(startISO, endISO) {
  const db = getDb();
  const q = query(
    collection(db, "payments"),
    where("date", ">=", String(startISO)),
    where("date", "<", String(endISO)),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Tiện ích: liệt kê theo tháng (1–12) */
export async function listPaymentsByMonth(year, month1to12) {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 1);
  return listPaymentsInRange(start.toISOString(), end.toISOString());
}
