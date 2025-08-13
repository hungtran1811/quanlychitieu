import { getDb } from "./firestore.js";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export function subscribeExpensesAsPayer(payerEmail, onChange) {
  const q = query(
    collection(getDb(), "expenses"),
    where("payerEmail", "==", payerEmail),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snap) =>
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

export function subscribeExpensesWithMe(myEmail, onChange) {
  const q = query(
    collection(getDb(), "expenses"),
    where("participantsEmails", "array-contains", myEmail),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snap) =>
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}
