import { getDb } from "./firestore.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/** Lấy expenses trong [start,end) ISO (đã duyệt) */
export async function listExpensesInRange(startISO, endISO) {
  const db = getDb();
  // Lưu ý: nếu field 'date' là string ISO bạn đã lưu, where >= <= sẽ hoạt động.
  const q = query(
    collection(db, "expenses"),
    where("date", ">=", startISO),
    where("date", "<", endISO)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Tiện: theo tháng */
export async function listExpensesByMonth(year, month1to12) {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 1);
  return listExpensesInRange(start.toISOString(), end.toISOString());
}
