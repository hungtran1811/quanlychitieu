import { getDb } from "./firestore.js";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export function subscribePaymentsOfMe(myEmail, onChange) {
  const db = getDb();
  const qOut = query(
    collection(db, "payments"),
    where("fromEmail", "==", myEmail),
    orderBy("date", "desc")
  );
  const qIn = query(
    collection(db, "payments"),
    where("toEmail", "==", myEmail),
    orderBy("date", "desc")
  );

  let out = [],
    inc = [];
  const emit = () => onChange({ out, in: inc });

  const u1 = onSnapshot(qOut, (snap) => {
    out = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    emit();
  });
  const u2 = onSnapshot(qIn, (snap) => {
    inc = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    emit();
  });

  return () => {
    u1();
    u2();
  };
}
