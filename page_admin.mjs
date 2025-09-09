// page_admin.mjs – admin can also approve settle-all requests
import { auth } from "./firebase.mjs";
import { bindAuthUI, signOutNow, isAdmin } from "./auth.mjs";
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs, addDoc, serverTimestamp } from "./firebase.mjs";
import { fmt, renderUserChips } from "./utils.mjs";

bindAuthUI();
document.getElementById("btnLogout")?.addEventListener("click", signOutNow);

auth.onAuthStateChanged((u) => {
  if (!u || !isAdmin(u)) {
    alert("Bạn không có quyền truy cập Admin"); window.location.href = "./index.html";
  } else {
    loadPendingExpenses();
    initHouseForm();
    loadSettleRequests();
  }
});

// ---- expenses approvals
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

// ---- house bill
async function initHouseForm() {
  const users = await getDocs(collection(db, "users")).then(s=>s.docs.map(d=>d.data()));
  renderUserChips(document.getElementById("houseParticipants"), users);
  document.getElementById("btnAddExtra")?.addEventListener("click", addExtraRow);
  document.getElementById("formHouse")?.addEventListener("submit", submitHouse);
}
let extraIdx = 0;
function addExtraRow() {
  const cont = document.getElementById("extras");
  const id = `ex_${extraIdx++}`;
  const row = document.createElement("div");
  row.className = "row g-2 align-items-center mb-2";
  row.innerHTML = `
    <div class="col-6"><input class="form-control" placeholder="Tên khoản (ẩn)" id="${id}_label"></div>
    <div class="col-4"><input type="number" class="form-control" placeholder="Số tiền" id="${id}_amount"></div>
    <div class="col-2"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="${id}">Xóa</button></div>`;
  cont.appendChild(row);
  row.querySelector("[data-remove]").addEventListener("click", ()=> row.remove());
}
function calcHouseTotal(eOld, eNew, peopleCount, extraSum) {
  const electric = (eNew - eOld) * 3800;
  const water = 100000 * peopleCount;
  const trashWifi = 150000;
  const total = electric + water + trashWifi + extraSum;
  return { electric, water, trashWifi, total };
}
async function submitHouse(ev) {
  ev.preventDefault();
  const month = document.getElementById("houseMonth").value;
  const eOld = Number(document.getElementById("elecOld").value || 0);
  const eNew = Number(document.getElementById("elecNew").value || 0);
  const parts = Array.from(document.querySelectorAll("input[name='participant']:checked")).map(i=>i.value);
  const peopleCount = parts.length;
  if (!month || peopleCount===0) return alert("Điền tháng và chọn thành viên");

  let extraSum = 0; document.querySelectorAll("#extras .row").forEach(r => {
    const amount = Number(r.querySelector("input[placeholder='Số tiền']").value || 0);
    if (amount>0) extraSum += amount;
  });
  const res = calcHouseTotal(eOld, eNew, peopleCount, extraSum);

  const admin = auth.currentUser;
  const expRef = await addDoc(collection(db, "expenses"), {
    ownerId: admin.uid, amount: res.total, category: `Tiền nhà ${month}`,
    note: `điện(${eNew}-${eOld}), nước(${peopleCount}), rác+wifi(150k)`,
    participants: parts, splitMode: "equal",
    status:"pending", monthKey: month, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });

  const share = Math.round((res.total/peopleCount)*100)/100;
  const tasks = [];
  for (const uid of parts) {
    if (uid === admin.uid) continue;
    tasks.push(addDoc(collection(db,"splits"), {
      expenseId: expRef.id, payerId: admin.uid, debtorId: uid, shareAmount: share,
      status:"pending", monthKey: month, createdAt: serverTimestamp()
    }));
  }
  await Promise.all(tasks);
  alert("Đã tạo khoản tiền nhà (pending). Vào tab Phê duyệt để duyệt.");
}

// ---- settle-all approvals (admin view)
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
