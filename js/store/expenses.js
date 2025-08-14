// public/js/store/expenses.js
// Store for "expenses" collection — ready for Admin Overview

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
 * Tạo 1 expense đã DUYỆT (admin tạo trực tiếp, không qua queue)
 * @param {Object} p
 *  - dateISO: string ISO (new Date().toISOString())
 *  - amount: number (VND)
 *  - note: string
 *  - participantsEmails: string[]  (danh sách email cùng mua)
 *  - payerEmail: string            (email người trả)
 *  - createdBy: uid của admin
 */
export async function createExpenseApproved(p) {
  const db = getDb();
  const payload = {
    type: "expense",
    status: "approved",
    date: String(p.dateISO || new Date().toISOString()),
    amount: Number(p.amount || 0),
    note: (p.note || "").trim(),
    participantsEmails: Array.isArray(p.participantsEmails)
      ? p.participantsEmails.map((s) => String(s || "").trim()).filter(Boolean)
      : [],
    payerEmail: (p.payerEmail || "").trim(),
    createdBy: p.createdBy || null,
    createdAt: ts(),
  };

  if (!payload.amount || payload.amount <= 0)
    throw new Error("Invalid amount for expense.");
  if (!payload.payerEmail) throw new Error("payerEmail is required.");

  return await addDoc(collection(db, "expenses"), payload);
}

/**
 * Realtime: lấy N expense mới nhất (mặc định 20), sắp xếp theo date DESC.
 * Trả về hàm unsubscribe().
 */
export function subscribeRecentExpenses(cb, take = 20) {
  const db = getDb();
  const q = query(
    collection(db, "expenses"),
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
      console.error("subscribeRecentExpenses error:", err);
      cb([]);
    }
  );
}

/** Xoá 1 expense theo id (dùng trong Admin Overview) */
export async function deleteExpense(id) {
  const db = getDb();
  await deleteDoc(doc(db, "expenses", id));
}

/** Liệt kê expenses trong [startISO, endISO) — dùng cho History/Báo cáo */
export async function listExpensesInRange(startISO, endISO) {
  const db = getDb();
  const q = query(
    collection(db, "expenses"),
    where("date", ">=", String(startISO)),
    where("date", "<", String(endISO)),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Tiện ích: liệt kê theo tháng (1–12) */
export async function listExpensesByMonth(year, month1to12) {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 1);
  return listExpensesInRange(start.toISOString(), end.toISOString());
}
