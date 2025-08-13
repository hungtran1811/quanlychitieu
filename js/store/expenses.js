import { getDb } from "./firestore.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export async function getExpensesAsPayer(payerEmail, max = 200) {
  const db = getDb();
  const q = query(
    collection(db, "expenses"),
    where("payerEmail", "==", payerEmail),
    orderBy("date", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function getExpensesWithMe(myEmail, max = 200) {
  const db = getDb();
  const q = query(
    collection(db, "expenses"),
    where("participantsEmails", "array-contains", myEmail),
    orderBy("date", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}
