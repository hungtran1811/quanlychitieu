import { getDb } from "./firestore.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/** Lấy payments trong [startISO, endISO) – các record đã duyệt */
export async function listPaymentsInRange(startISO, endISO) {
  const db = getDb();
  const q = query(
    collection(db, "payments"),
    where("date", ">=", startISO),
    where("date", "<", endISO)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Lấy payments theo tháng (1–12) */
export async function listPaymentsByMonth(year, month1to12) {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 1);
  return listPaymentsInRange(start.toISOString(), end.toISOString());
}
