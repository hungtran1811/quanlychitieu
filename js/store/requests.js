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
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* ---------- USER SIDE ---------- */

// Tạo yêu cầu khoản chi
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

// Tạo yêu cầu thanh toán
export async function createPaymentRequest({ uid, payload }) {
  const db = getDb();
  // payload: { amount, toEmail, note?, entries?: number[] }
  return await addDoc(collection(db, "requests"), {
    type: "payment",
    status: "pending",
    requestedBy: uid,
    createdAt: ts(),
    payload,
  });
}

// Lấy danh sách yêu cầu của tôi (1 lần)
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

// *** REALTIME: Yêu cầu của tôi ***
export function subscribeMyRequests(uid, cb, { limitN = 100 } = {}) {
  const db = getDb();
  const q = query(
    collection(db, "requests"),
    where("requestedBy", "==", uid),
    orderBy("createdAt", "desc"),
    limit(limitN)
  );
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cb(rows);
  });
}

/* ---------- ADMIN SIDE ---------- */

// Realtime danh sách requests cho Admin
export function subscribeRequests(
  { status = "pending", type = "all", limitN = 100 },
  cb
) {
  const db = getDb();

  // base theo status
  let qBase = query(
    collection(db, "requests"),
    where("status", "==", status),
    orderBy("createdAt", "desc"),
    limit(limitN)
  );

  // thêm filter type nếu có
  if (type !== "all") {
    qBase = query(
      collection(db, "requests"),
      where("status", "==", status),
      where("type", "==", type),
      orderBy("createdAt", "desc"),
      limit(limitN)
    );
  }

  return onSnapshot(qBase, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Admin approve
export async function approveRequest({ req, adminUid }) {
  const db = getDb();
  if (!req?.id) throw new Error("invalid request");
  const reqRef = doc(db, "requests", req.id);

  if (req.type === "expense") {
    const ledger = await addDoc(collection(db, "expenses"), {
      date: req.payload?.date || new Date().toISOString(),
      amount: +req.payload?.amount || 0,
      note: req.payload?.note || "",
      participantsEmails: req.payload?.participantEmails || [],
      payerEmail: req.payload?.payerEmail || "",
      createdBy: req.requestedBy,
      approvedBy: adminUid,
      approvedAt: ts(),
      requestId: req.id,
    });
    await updateDoc(reqRef, {
      status: "approved",
      approvedAt: ts(),
      approvedBy: adminUid,
      linkedId: ledger.id,
    });
    return ledger.id;
  }

  if (req.type === "payment") {
    const ledger = await addDoc(collection(db, "payments"), {
      date: new Date().toISOString(),
      fromEmail: req.payload?.fromEmail || "",
      toEmail: req.payload?.toEmail || "",
      amount: +req.payload?.amount || 0,
      note: req.payload?.note || "",
      items: req.payload?.items || [],
      createdBy: req.requestedBy,
      approvedBy: adminUid,
      approvedAt: ts(),
      requestId: req.id,
    });
    await updateDoc(reqRef, {
      status: "approved",
      approvedAt: ts(),
      approvedBy: adminUid,
      linkedId: ledger.id,
    });
    return ledger.id;
  }

  throw new Error("unsupported type");
}

// Admin reject
export async function rejectRequest({ reqId, reason = "", adminUid }) {
  const db = getDb();
  const ref = doc(db, "requests", reqId);
  await updateDoc(ref, {
    status: "rejected",
    reason: reason || "",
    approvedAt: ts(),
    approvedBy: adminUid,
  });
}
