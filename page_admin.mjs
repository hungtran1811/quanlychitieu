// page_admin.mjs — v3.4.3
// Hard-normalize: on approve, delete ALL splits of the expense, then recreate exactly for each debtor from participants.
// Guarantees: mỗi người được tick (trừ payer) có đúng 1 split với share chính xác.

import { auth } from "./firebase.mjs";
import { bindAuthUI, signOutNow, isAdmin } from "./auth.mjs";
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs, addDoc, serverTimestamp, getDoc, deleteDoc } from "./firebase.mjs";
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

// -------- Pending approvals
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

// Build per-person shares (int VND), then map to debtor->amount (exclude payer)
function mapDebtorShares(total, participantsAll, payerId){
  const n = participantsAll.length;
  const base = Math.floor(Number(total)/n);
  let rem = Number(total) - base*n;
  const perUid = {};
  // phân bổ dư theo thứ tự mảng participantsAll
  participantsAll.forEach((uid, i)=> perUid[uid] = base + (i<rem?1:0));
  const map = {};
  participantsAll.forEach(uid => { if (uid !== payerId) map[uid] = perUid[uid]; });
  return map;
}

async function approveExpense(expenseId){
  const expSnap = await getDoc(doc(db, "expenses", expenseId));
  if (!expSnap.exists()) return;
  const exp = expSnap.data();
  const payerId = exp.ownerId;
  const participantsAll = Array.isArray(exp.participants)? exp.participants.filter(Boolean): [];
  if (!participantsAll.length) throw new Error("Không có participants trong expense.");
  const debtorMap = mapDebtorShares(Math.round(Number(exp.amount||0)), participantsAll, payerId);

  // 1) XÓA sạch splits cũ của expense
  const spSnap = await getDocs(query(collection(db,"splits"), where("expenseId","==", expenseId)));
  await Promise.all(spSnap.docs.map(d => deleteDoc(doc(db,"splits", d.id))));

  // 2) TẠO lại đúng từng split theo debtorMap
  const tasks = [];
  Object.entries(debtorMap).forEach(([debtorId, amount]) => {
    tasks.push(addDoc(collection(db,"splits"), {
      expenseId: expenseId, payerId, debtorId,
      shareAmount: amount, status:"approved",
      monthKey: exp.monthKey, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
  });
  await Promise.all(tasks);

  // 3) Set expense approved
  await updateDoc(doc(db, "expenses", expenseId), { status:"approved", updatedAt: serverTimestamp() });
}

document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-approve-exp]"); const r = e.target.closest("[data-reject-exp]");
  if (a) { try { await approveExpense(a.getAttribute("data-approve-exp")); } catch(err){ alert("Duyệt lỗi: "+(err?.message||err)); } }
  if (r) {
    const id = r.getAttribute("data-reject-exp");
    await updateDoc(doc(db, "expenses", id), { status:"rejected", updatedAt: serverTimestamp() });
    const spSnap = await getDocs(query(collection(db,"splits"), where("expenseId","==", id)));
    await Promise.all(spSnap.docs.map(d => updateDoc(doc(db, "splits", d.id), { status:"rejected", updatedAt: serverTimestamp() })));
  }
});

// -------- House form (preview + create skeleton)
function numberVN(x){ return fmt.format(Math.max(0, Math.round(Number(x)||0))); }

async function initHouseForm() {
  const users = await getDocs(collection(db, "users")).then(s=>s.docs.map(d=>d.data()));
  renderUserChips(document.getElementById("houseParticipants"), users);
  document.getElementById("btnAddExtra")?.addEventListener("click", addExtraRow);
  document.getElementById("formHouse")?.addEventListener("submit", submitHouse);
  ["elecOld","elecNew"].forEach(id => document.getElementById(id).addEventListener("input", updatePreview));
  document.getElementById("houseParticipants").addEventListener("change", updatePreview);
  document.getElementById("extraCollapse").addEventListener("input", (e)=>{ if (e.target && e.target.matches("input")) updatePreview(); });
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
  let extraSum = 0; document.querySelectorAll("#extras .row input[placeholder='Số tiền']").forEach(i => { const v = Number(i.value || 0); if (v>0) extraSum += v; });
  const electric = Math.max(0,(eNew - eOld)) * 3800;
  const water = 100000 * people;
  const trashWifi = 150000;
  const total = electric + water + trashWifi + extraSum;
  const share = Math.round(total/people);
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
  const participantsAll = getSelectedMembers();
  const peopleCount = participantsAll.length;
  if (!month || peopleCount===0) return alert("Điền tháng và chọn thành viên");

  let extraSum = 0; document.querySelectorAll("#extras .row input[placeholder='Số tiền']").forEach(i => { const v=Number(i.value||0); if (v>0) extraSum += v; });
  const res = calcHouseTotal(eOld, eNew, peopleCount, extraSum);

  const admin = auth.currentUser;
  const expRef = await addDoc(collection(db, "expenses"), {
    ownerId: admin.uid, amount: res.total, category: `Tiền nhà ${month}`,
    note: `điện(${eNew}-${eOld}), nước(${peopleCount}), rác+wifi(150k)`,
    participants: participantsAll, splitMode: "equal",
    status:"pending", monthKey: month, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });

  // tạo skeleton splits (0đ) cho mỗi debtor ≠ admin — sẽ được recreate chuẩn khi duyệt
  const debtors = participantsAll.filter(uid => uid !== admin.uid);
  await Promise.all(debtors.map(uid => addDoc(collection(db,"splits"), {
    expenseId: expRef.id, payerId: admin.uid, debtorId: uid, shareAmount: 0,
    status:"pending", monthKey: month, createdAt: serverTimestamp()
  })));
  alert("Đã tạo khoản tiền nhà (pending). Vào tab Phê duyệt để duyệt.");
  updatePreview();
}

// -------- Pay requests (giữ nguyên)
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

// -------- Overview + CRUD (giữ nguyên từ 3.4.2, modal CSS xử lý center/scroll)
function initOverview(){
  const ov = document.getElementById("ovMonth");
  const mk = monthKeyFromDate();
  ov.value = mk;
  document.getElementById("btnRefreshOverview").addEventListener("click", ()=> buildOverview(ov.value));
  buildOverview(ov.value);
}

let _nameCache = {};
async function getNameMap(){
  if (Object.keys(_nameCache).length) return _nameCache;
  const users = await getDocs(collection(db,"users")).then(s=>s.docs.map(d=>d.data()));
  users.forEach(u=> _nameCache[u.uid] = (u.displayName||u.email||u.uid));
  return _nameCache;
}

async function buildOverview(monthKey){
  const tbody = document.getElementById("overviewBody");
  tbody.innerHTML = "<tr><td colspan='4' class='text-muted'>Đang tải…</td></tr>";

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

  const names = await getNameMap();
  if (!rows.length){
    tbody.innerHTML = "<tr><td colspan='4' class='text-muted'>Không có công nợ trong tháng này.</td></tr>";
    return;
  }
  tbody.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td style="width:30%">${names[r.debtor]||r.debtor}</td>
      <td style="width:30%">${names[r.payer]||r.payer}</td>
      <td style="width:25%" class="text-end">${fmt.format(r.amount)}</td>
      <td style="width:15%" class="text-end">
        <button class="btn btn-sm btn-outline-primary" data-open-pair="${r.debtor}|${r.payer}|${monthKey}">Chi tiết</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

let pairModalInstance = null;
document.addEventListener("click", async (e)=>{
  const btn = e.target.closest("[data-open-pair]");
  if (!btn) return;
  const [debtor, payer, monthKey] = btn.getAttribute("data-open-pair").split("|");
  await openPairModal(debtor, payer, monthKey);
});

async function openPairModal(debtor, payer, monthKey){
  const names = await getNameMap();
  const title = document.getElementById("pairTitle");
  if (title) title.textContent = `${names[debtor]||debtor} ↔ ${names[payer]||payer} • Tháng ${monthKey}`;
  const body = document.getElementById("pairBody"); body.innerHTML = "<tr><td colspan='7'>Đang tải…</td></tr>";

  const [sAB, sBA] = await Promise.all([
    getDocs(query(collection(db,"splits"), where("monthKey","==",monthKey), where("debtorId","==",debtor), where("payerId","==",payer))),
    getDocs(query(collection(db,"splits"), where("monthKey","==",monthKey), where("debtorId","==",payer), where("payerId","==",debtor)))
  ]);
  const rows = [];
  sAB.forEach(d=> rows.push({id:d.id, ...d.data()}));
  sBA.forEach(d=> rows.push({id:d.id, ...d.data()}));
  if (!rows.length){ body.innerHTML = "<tr><td colspan='7' class='text-muted'>Không có split chi tiết.</td></tr>"; }
  else {
    body.innerHTML = "";
    rows.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><code>${r.expenseId.slice(0,6)}</code></td>
        <td>${r.monthKey}</td>
        <td>${names[r.debtorId]||r.debtorId}</td>
        <td>${names[r.payerId]||r.payerId}</td>
        <td><input type="number" step="1000" min="0" class="form-control form-control-sm" value="${r.shareAmount}" data-edit-amount="${r.id}"></td>
        <td>${r.status}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-success me-1" data-save-split="${r.id}">Lưu</button>
          <button class="btn btn-sm btn-outline-danger" data-del-split="${r.id}">Xóa</button>
        </td>`;
      body.appendChild(tr);
    });
  }
  const el = document.getElementById("pairModal");
  if (typeof bootstrap !== "undefined") {
    pairModalInstance = bootstrap.Modal.getOrCreateInstance(el);
    pairModalInstance.show();
  }
}

document.addEventListener("click", async (e)=>{
  const save = e.target.closest("[data-save-split]");
  const del = e.target.closest("[data-del-split]");
  if (save){
    const id = save.getAttribute("data-save-split");
    const input = document.querySelector(`[data-edit-amount='${id}']`);
    const val = Number(input.value||0);
    if (val<0) return alert("Số tiền không hợp lệ");
    await updateDoc(doc(db,"splits", id), { shareAmount: val, updatedAt: serverTimestamp() });
    save.disabled = true; setTimeout(()=> save.disabled=false, 300);
  }
  if (del){
    const id = del.getAttribute("data-del-split");
    if (!confirm("Xóa split này?")) return;
    await deleteDoc(doc(db,"splits", id));
    del.closest("tr")?.remove();
  }
});
