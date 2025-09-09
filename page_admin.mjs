// simple admin (same as v3 core features)
import { auth } from "./firebase.mjs";
import { bindAuthUI, signOutNow, isAdmin } from "./auth.mjs";
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs, addDoc, serverTimestamp } from "./firebase.mjs";
import { fmt } from "./utils.mjs";

bindAuthUI();
document.getElementById("btnLogout")?.addEventListener("click", signOutNow);

auth.onAuthStateChanged((u) => {
  if (!u || !isAdmin(u)) {
    alert("Bạn không có quyền truy cập Admin"); window.location.href = "./index.html";
  } else {
    loadPendingExpenses();
    loadSettleRequests();
  }
});

const pendingBody = document.getElementById("pendingBody");
function loadPendingExpenses() {
  const qy = query(collection(db, "expenses"), where("status","==","pending"), orderBy("createdAt","desc"));
  onSnapshot(qy, (snap) => {
    pendingBody.innerHTML = "";
    snap.forEach((docu) => {
      const d = docu.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="badge text-bg-secondary">${d.ownerId.slice(0,6)}</span></td>
        <td>${d.category}</td>
        <td>${fmt.format(d.amount)}</td>
        <td>${(d.participants||[]).length}</td>
        <td>${d.createdAt?.toDate?.().toLocaleString("vi-VN") || "-"}</td>
        <td>
          <button class="btn btn-sm btn-success me-1" data-approve-exp="${docu.id}">Duyệt</button>
          <button class="btn btn-sm btn-outline-danger" data-reject-exp="${docu.id}">Từ chối</button>
        </td>`;
      pendingBody.appendChild(tr);
    });
  });
}
document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-approve-exp]"); const r = e.target.closest("[data-reject-exp]");
  if (a) {
    const id = a.getAttribute("data-approve-exp");
    await updateDoc(doc(db, "expenses", id), { status: "approved", updatedAt: serverTimestamp() });
    const spSnap = await getDocs(query(collection(db,"splits"), where("expenseId","==", id)));
    const tasks = spSnap.docs.map(d => updateDoc(doc(db, "splits", d.id), { status: "approved", updatedAt: serverTimestamp() }));
    await Promise.all(tasks);
  }
  if (r) {
    const id = r.getAttribute("data-reject-exp");
    await updateDoc(doc(db, "expenses", id), { status: "rejected", updatedAt: serverTimestamp() });
    const spSnap = await getDocs(query(collection(db,"splits"), where("expenseId","==", id)));
    const tasks = spSnap.docs.map(d => updateDoc(doc(db, "splits", d.id), { status: "rejected", updatedAt: serverTimestamp() }));
    await Promise.all(tasks);
  }
});

const reqBody = document.getElementById("reqBody");
function loadSettleRequests() {
  const qy = query(collection(db,"payRequests"), where("status","==","pending"), where("settleAll","==",true), orderBy("createdAt","desc"));
  onSnapshot(qy, (snap) => {
    reqBody.innerHTML="";
    snap.forEach(docu=>{
      const d=docu.data();
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${d.fromUid.slice(0,6)}</td>
        <td>${d.toUid.slice(0,6)}</td>
        <td>${d.monthKey}</td>
        <td>${d.note||""}</td>
        <td>${d.createdAt?.toDate?.().toLocaleString("vi-VN")||"-"}</td>
        <td>
          <button class="btn btn-sm btn-success me-1" data-approve-pay="${docu.id}">Chấp nhận</button>
          <button class="btn btn-sm btn-outline-danger" data-reject-pay="${docu.id}">Từ chối</button>
        </td>`;
      reqBody.appendChild(tr);
    });
  });
}
document.addEventListener("click", async (e)=>{
  const a = e.target.closest("[data-approve-pay]");
  const r = e.target.closest("[data-reject-pay]");
  if (a) await updateDoc(doc(db,"payRequests", a.getAttribute("data-approve-pay")), { status:"approved", updatedAt: serverTimestamp() });
  if (r) await updateDoc(doc(db,"payRequests", r.getAttribute("data-reject-pay")), { status:"rejected", updatedAt: serverTimestamp() });
});
