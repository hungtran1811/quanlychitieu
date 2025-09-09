// page_admin.mjs — v3.3 FULL
// + Live preview tiền nhà (tổng & share real-time)
// + Normalize splits on approve (đảm bảo chia đều)
// + Tab Tổng quan công nợ (netting theo tháng)

import { auth } from "./firebase.mjs";
import { bindAuthUI, signOutNow, isAdmin } from "./auth.mjs";
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs, addDoc, serverTimestamp, getDoc } from "./firebase.mjs";
import { fmt, renderUserChips, monthKeyFromDate } from "./utils.mjs";

bindAuthUI();
document.getElementById("btnLogout")?.addEventListener("click", signOutNow);

auth.onAuthStateChanged((u) => {
  if (!u || !isAdmin(u)) {
    alert("Bạn không có quyền truy cập Admin"); window.location.href = "./index.html";
  } else {
    loadPendingExpenses();
    initHouseForm();
    loadSettleRequests();
    initOverview();
  }
});

// ---- expenses approvals (with split normalization)
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

async function normalizeAndApproveSplits(expenseId){
  const expSnap = await getDoc(doc(db, "expenses", expenseId));
  if (!expSnap.exists()) return;
  const exp = expSnap.data();
  const payerId = exp.ownerId;
  const monthKey = exp.monthKey;
  const parts = Array.isArray(exp.participants)? exp.participants.filter(uid => uid && uid !== payerId) : [];
  const people = parts.length || 1;
  const share = Math.round((Number(exp.amount||0) / people) * 100) / 100;

  const spSnap = await getDocs(query(collection(db,"splits"), where("expenseId","==", expenseId)));
  const byDebtor = {};
  spSnap.forEach(d => { const x=d.data(); byDebtor[x.debtorId] = { id:d.id, ...x }; });

  const tasks = [];
  for (const debtorId of parts){
    if (!byDebtor[debtorId]){
      tasks.push(addDoc(collection(db,"splits"), {
        expenseId: expenseId, payerId, debtorId,
        shareAmount: share, status: "pending", monthKey,
        createdAt: serverTimestamp()
      }));
    } else if (byDebtor[debtorId].shareAmount !== share){
      tasks.push(updateDoc(doc(db,"splits", byDebtor[debtorId].id), { shareAmount: share }));
    }
  }
  await Promise.all(tasks);

  // approve all splits of this expense
  const afterSnap = await getDocs(query(collection(db,"splits"), where("expenseId","==", expenseId)));
  await Promise.all(afterSnap.docs.map(d => updateDoc(doc(db,"splits", d.id), { status:"approved", updatedAt: serverTimestamp() })));
}

document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-approve-exp]"); const r = e.target.closest("[data-reject-exp]");
  if (a) {
    const id = a.getAttribute("data-approve-exp");
    try { await normalizeAndApproveSplits(id); await updateDoc(doc(db, "expenses", id), { status:"approved", updatedAt: serverTimestamp() }); }
    catch(err){ alert("Duyệt lỗi: "+(err?.message||err)); }
  }
  if (r) {
    const id = r.getAttribute("data-reject-exp");
    await updateDoc(doc(db, "expenses", id), { status:"rejected", updatedAt: serverTimestamp() });
    const spSnap = await getDocs(query(collection(db,"splits"), where("expenseId","==", id)));
    await Promise.all(spSnap.docs.map(d => updateDoc(doc(db, "splits", d.id), { status:"rejected", updatedAt: serverTimestamp() })));
  }
});

// ---- House tab (live preview)
function numberVN(x){ return fmt.format(Math.max(0, Math.round(Number(x)||0))); }

async function initHouseForm() {
  const users = await getDocs(collection(db, "users")).then(s=>s.docs.map(d=>d.data()));
  renderUserChips(document.getElementById("houseParticipants"), users);
  document.getElementById("btnAddExtra")?.addEventListener("click", addExtraRow);
  document.getElementById("formHouse")?.addEventListener("submit", submitHouse);

  // live preview handlers
  ["elecOld","elecNew"].forEach(id => document.getElementById(id).addEventListener("input", updatePreview));
  document.getElementById("houseParticipants").addEventListener("change", updatePreview);
  document.getElementById("extraCollapse").addEventListener("input", (e)=>{
    if (e.target && e.target.matches("input")) updatePreview();
  });
  updatePreview();
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
  row.querySelector("[data-remove]").addEventListener("click", ()=> { row.remove(); updatePreview(); });
}
function getSelectedMembers(){
  return Array.from(document.querySelectorAll("#houseParticipants input[name='participant']:checked")).map(i=>i.value);
}
function calcPreview(){
  const eOld = Number(document.getElementById("elecOld").value || 0);
  const eNew = Number(document.getElementById("elecNew").value || 0);
  const parts = getSelectedMembers();
  const people = parts.length || 1;

  let extraSum = 0; document.querySelectorAll("#extras .row input[placeholder='Số tiền']").forEach(i => {
    const v = Number(i.value || 0); if (v>0) extraSum += v;
  });

  const electric = Math.max(0,(eNew - eOld)) * 3800;
  const water = 100000 * people;
  const trashWifi = 150000;
  const total = electric + water + trashWifi + extraSum;
  const share = Math.round((total/people)*100)/100;
  return { electric, water, trashWifi, extraSum, total, share };
}
function updatePreview(){
  const r = calcPreview();
  document.getElementById("pvElectric").textContent = numberVN(r.electric);
  document.getElementById("pvWater").textContent = numberVN(r.water);
  document.getElementById("pvTrashWifi").textContent = numberVN(r.trashWifi);
  document.getElementById("pvExtras").textContent = numberVN(r.extraSum);
  document.getElementById("pvTotal").textContent = numberVN(r.total);
  document.getElementById("pvShare").textContent = numberVN(r.share);
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
  const parts = getSelectedMembers();
  const peopleCount = parts.length;
  if (!month || peopleCount===0) return alert("Điền tháng và chọn thành viên");

  let extraSum = 0; document.querySelectorAll("#extras .row input[placeholder='Số tiền']").forEach(i => { const v=Number(i.value||0); if (v>0) extraSum += v; });
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
  updatePreview();
}

// ---- Settle requests (unchanged)
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

// ---- Tổng quan công nợ (netting theo tháng)
function initOverview(){
  const ov = document.getElementById("ovMonth");
  const mk = monthKeyFromDate();
  ov.value = mk;
  document.getElementById("btnRefreshOverview").addEventListener("click", ()=> buildOverview(ov.value));
  buildOverview(ov.value);
}
async function buildOverview(monthKey){
  const tbody = document.getElementById("overviewBody");
  tbody.innerHTML = "<tr><td colspan='3' class='text-muted'>Đang tải…</td></tr>";

  const s1 = await getDocs(query(collection(db,"splits"), where("status","==","approved"), where("monthKey","==",monthKey)));
  const map = new Map();
  s1.forEach(docu=>{
    const d = docu.data();
    const A = d.debtorId, B = d.payerId, amt = Number(d.shareAmount||0);
    const [lo, hi] = [A,B].sort();
    const key = lo+"_"+hi;
    if (!map.has(key)) map.set(key, {lo, hi, val:0});
    const rec = map.get(key);
    if (A===lo) rec.val += amt; else rec.val -= amt;
  });

  const rows = [];
  for (const {lo,hi,val} of map.values()){
    if (Math.abs(val) < 1e-6) continue;
    if (val > 0){
      rows.push({debtor: lo, payer: hi, amount: val});
    } else {
      rows.push({debtor: hi, payer: lo, amount: -val});
    }
  }
  rows.sort((a,b)=> b.amount - a.amount);

  const users = await getDocs(collection(db,"users")).then(s=>s.docs.map(d=>d.data()));
  const name = {}; users.forEach(u=> name[u.uid] = (u.displayName||u.email||u.uid));

  if (!rows.length){
    tbody.innerHTML = "<tr><td colspan='3' class='text-muted'>Không có công nợ trong tháng này.</td></tr>";
    return;
  }
  tbody.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td style="width:35%">${name[r.debtor]||r.debtor}</td>
      <td style="width:35%">${name[r.payer]||r.payer}</td>
      <td style="width:30%" class="text-end">${fmt.format(r.amount)}</td>`;
    tbody.appendChild(tr);
  });
}
