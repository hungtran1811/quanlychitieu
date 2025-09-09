// page_admin.mjs — Admin: approve requests + house & overview
import { auth, db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs, addDoc, serverTimestamp, getDoc, deleteDoc } from "./firebase.mjs";
import { bindAuthUI, signOutNow, isAdmin } from "./auth.mjs";
import { fmt, monthKeyFromDate, makeUserPicker } from "./utils.mjs";

bindAuthUI();
document.getElementById("btnLogout")?.addEventListener("click", signOutNow);

auth.onAuthStateChanged((u) => {
  if (!u || !isAdmin(u)) { alert("Bạn không có quyền Admin"); window.location.href = "./index.html"; return; }
  loadPending();
  initHouse(u.uid);
  initOverview();
});

// ----- Pending approvals (normalize and approve)
const pendingBody = document.getElementById("pendingBody");
function loadPending(){
  const qy = query(collection(db, "expenses"), where("status","==","pending"), orderBy("createdAt","desc"));
  onSnapshot(qy, (snap)=>{
    pendingBody.innerHTML = "";
    snap.forEach(docu=>{
      const d = docu.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><span class="badge text-bg-secondary">${d.ownerId.slice(0,6)}</span></td>
        <td>${d.category}</td>
        <td>${fmt.format(d.amount)}</td>
        <td>${(d.participants||[]).length}</td>
        <td>${d.createdAt?.toDate?.().toLocaleString("vi-VN")||""}</td>
        <td>
          <button class="btn btn-sm btn-success me-1" data-approve="${docu.id}">Duyệt</button>
          <button class="btn btn-sm btn-outline-danger" data-reject="${docu.id}">Từ chối</button>
        </td>`;
      pendingBody.appendChild(tr);
    });
  });
}

async function rebuildSplitsAndApprove(expenseId){
  const expSnap = await getDoc(doc(db,"expenses", expenseId));
  if (!expSnap.exists()) return;
  const exp = expSnap.data();
  const payerId = exp.ownerId;
  const parts = (exp.participants||[]).filter(Boolean);
  if (parts.length===0) throw new Error("No participants");
  // per-person shares (int VND; remainder to first users)
  const n = parts.length + 1; // include payer for sharing?
  // spec: request từ user -> chia đều cho những người được chọn (không gồm payer?)
  // Ở đây: chia đều TRÊN DANH SÁCH ĐƯỢC CHỌN; mỗi người nợ payer toàn bộ phần của họ.
  const base = Math.floor(Number(exp.amount)/parts.length);
  let rem = Number(exp.amount) - base*parts.length;
  const map = {}; // debtor -> amount
  parts.forEach((uid,i)=> map[uid] = base + (i<rem?1:0));

  // wipe old splits
  const sp = await getDocs(query(collection(db,"splits"), where("expenseId","==", expenseId)));
  await Promise.all(sp.docs.map(d=> deleteDoc(doc(db,"splits", d.id))));
  // create new splits (approved)
  await Promise.all(Object.entries(map).map(([debtorId,amt])=> addDoc(collection(db,"splits"), {
    expenseId: expenseId, payerId, debtorId, shareAmount: amt, status: "approved",
    monthKey: exp.monthKey, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  })));
  await updateDoc(doc(db,"expenses", expenseId), { status:"approved", updatedAt: serverTimestamp() });
}

document.addEventListener("click", async (e)=>{
  const a = e.target.closest("[data-approve]"); const r = e.target.closest("[data-reject]");
  if (a){ try{ await rebuildSplitsAndApprove(a.getAttribute("data-approve")); }catch(err){ alert(err.message||err); } }
  if (r){
    const id = r.getAttribute("data-reject");
    await updateDoc(doc(db,"expenses", id), { status:"rejected", updatedAt: serverTimestamp() });
  }
});

// ----- House: admin is payer; directly create approved debts for selected members
let housePicker = null;
async function initHouse(adminUid){
  // build picker
  const usersSnap = await getDocs(collection(db,"users"));
  const users = usersSnap.docs.map(d=>d.data());
  housePicker = makeUserPicker(document.getElementById("housePicker"), users, adminUid, {selectSelf:false});
  document.getElementById("btnAddExtra").addEventListener("click", addExtraRow);
  document.getElementById("formHouse").addEventListener("submit", (ev)=> submitHouse(ev, adminUid));
  ["elecOld","elecNew"].forEach(id => document.getElementById(id).addEventListener("input", updatePreview));
  document.getElementById("extraCollapse").addEventListener("input", (e)=>{ if (e.target && e.target.matches("input")) updatePreview(); });
  updatePreview();
}

function addExtraRow(){
  const cont = document.getElementById("extras");
  const row = document.createElement("div");
  row.className = "row g-2 align-items-center mb-2";
  const rid = Math.random().toString(36).slice(2,7);
  row.innerHTML = `<div class="col-6"><input class="form-control" placeholder="Tên khoản (ẩn)" id="l_${rid}"></div>
    <div class="col-4"><input type="number" class="form-control" placeholder="Số tiền" id="a_${rid}"></div>
    <div class="col-2"><button class="btn btn-sm btn-outline-danger" type="button" data-remove>✕</button></div>`;
  cont.appendChild(row);
  row.querySelector("[data-remove]").addEventListener("click", ()=>{ row.remove(); updatePreview(); });
}

function calcHouse(){
  const eOld = Number(document.getElementById("elecOld").value||0);
  const eNew = Number(document.getElementById("elecNew").value||0);
  const parts = housePicker ? housePicker.values() : [];
  let extra = 0; document.querySelectorAll("#extras input[id^='a_']").forEach(i=> extra += Number(i.value||0));
  const electric = Math.max(0, eNew - eOld) * 3800;
  const water = 100000 * parts.length;
  const trashWifi = 150000;
  const total = electric + water + trashWifi + extra;
  const share = parts.length ? Math.round(total/parts.length) : 0;
  return { parts, electric, water, trashWifi, extra, total, share };
}
function updatePreview(){
  const r = calcHouse();
  document.getElementById("pvElectric").textContent = fmt.format(r.electric);
  document.getElementById("pvWater").textContent = fmt.format(r.water);
  document.getElementById("pvTrashWifi").textContent = fmt.format(r.trashWifi);
  document.getElementById("pvExtras").textContent = fmt.format(r.extra);
  document.getElementById("pvTotal").textContent = fmt.format(r.total);
  document.getElementById("pvShare").textContent = fmt.format(r.share);
}

async function submitHouse(ev, adminUid){
  ev.preventDefault();
  const month = document.getElementById("houseMonth").value;
  const { parts, total, share } = calcHouse();
  if (!month) return alert("Chọn tháng");
  if (parts.length===0) return alert("Chọn thành viên");

  // Ghi expense để truy vết
  const exp = await addDoc(collection(db,"expenses"), {
    ownerId: adminUid, amount: total, category: `Tiền nhà ${month}`,
    note: `share=${share}`, participants: parts, splitMode:"equal",
    status:"approved", monthKey: month, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  // Tạo splits approved
  const base = Math.floor(total/parts.length); let rem = total - base*parts.length;
  await Promise.all(parts.map((uid,i)=> addDoc(collection(db,"splits"), {
    expenseId: exp.id, payerId: adminUid, debtorId: uid,
    shareAmount: base + (i<rem?1:0), status:"approved",
    monthKey: month, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  })));
  alert("Đã ghi nợ tiền nhà.");
}

// ----- Overview with CRUD
function initOverview(){
  const ov = document.getElementById("ovMonth");
  const mk = monthKeyFromDate();
  ov.value = mk;
  document.getElementById("btnRefreshOverview").addEventListener("click", ()=> buildOverview(ov.value));
  buildOverview(ov.value);
}

async function buildOverview(monthKey){
  const tbody = document.getElementById("overviewBody");
  tbody.innerHTML = "<tr><td colspan='4' class='text-muted'>Đang tải…</td></tr>";
  const users = await getDocs(collection(db,"users")).then(s=> s.docs.map(d=>d.data()));
  const name = {}; users.forEach(u=> name[u.uid] = u.displayName || u.email || u.uid);

  const s1 = await getDocs(query(collection(db,"splits"), where("status","==","approved"), where("monthKey","==",monthKey)));
  const map = new Map();
  s1.forEach(d=>{
    const x=d.data(); const A=x.debtorId, B=x.payerId, amt=Number(x.shareAmount||0);
    const [lo,hi]=[A,B].sort(); const key=lo+"_"+hi;
    if (!map.has(key)) map.set(key,{lo,hi,val:0});
    const r=map.get(key); if (A===lo) r.val += amt; else r.val -= amt;
  });

  const rows=[];
  for (const {lo,hi,val} of map.values()){
    if (Math.abs(val)<1e-6) continue;
    if (val>0) rows.push({debtor:lo,payer:hi,amount:val}); else rows.push({debtor:hi,payer:lo,amount:-val});
  }
  rows.sort((a,b)=> b.amount-a.amount);

  tbody.innerHTML = "";
  if (!rows.length){ tbody.innerHTML = "<tr><td colspan='4' class='text-muted'>Không có công nợ.</td></tr>"; return; }
  rows.forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML = `<td style="width:30%">${name[r.debtor]||r.debtor}</td>
      <td style="width:30%">${name[r.payer]||r.payer}</td>
      <td style="width:25%" class="text-end">${fmt.format(r.amount)}</td>
      <td style="width:15%" class="text-end"><button class="btn btn-sm btn-outline-primary" data-open="${r.debtor}|${r.payer}|${monthKey}">Chi tiết</button></td>`;
    tbody.appendChild(tr);
  });

  document.addEventListener("click", async (e)=>{
    const b = e.target.closest("[data-open]"); if (!b) return;
    const [debtor,payer,month] = b.getAttribute("data-open").split("|");
    openPairModal(debtor,payer,month,name);
  }, { once:true });
}

async function openPairModal(debtor,payer,monthKey,nameMap){
  const title = document.getElementById("pairTitle");
  title.textContent = `${nameMap[debtor]||debtor} ↔ ${nameMap[payer]||payer} • Tháng ${monthKey}`;
  const body = document.getElementById("pairBody");
  body.innerHTML = "<tr><td colspan='7'>Đang tải…</td></tr>";
  const [sAB, sBA] = await Promise.all([
    getDocs(query(collection(db,"splits"), where("monthKey","==",monthKey), where("debtorId","==",debtor), where("payerId","==",payer))),
    getDocs(query(collection(db,"splits"), where("monthKey","==",monthKey), where("debtorId","==",payer), where("payerId","==",debtor)))
  ]);
  const rows=[]; sAB.forEach(d=> rows.push({id:d.id, ...d.data()})); sBA.forEach(d=> rows.push({id:d.id, ...d.data()}));
  body.innerHTML = "";
  if (!rows.length){ body.innerHTML = "<tr><td colspan='7' class='text-muted'>Không có split chi tiết.</td></tr>"; }
  rows.forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML = `<td><code>${r.expenseId.slice(0,6)}</code></td>
      <td>${r.monthKey}</td>
      <td>${nameMap[r.debtorId]||r.debtorId}</td>
      <td>${nameMap[r.payerId]||r.payerId}</td>
      <td><input type="number" class="form-control form-control-sm" value="${r.shareAmount}" data-edit="${r.id}"></td>
      <td>${r.status}</td>
      <td class="text-end"><button class="btn btn-sm btn-success me-1" data-save="${r.id}">Lưu</button><button class="btn btn-sm btn-outline-danger" data-del="${r.id}">Xóa</button></td>`;
    body.appendChild(tr);
  });
  const modalEl = document.getElementById("pairModal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl); modal.show();

  document.addEventListener("click", async (e)=>{
    const s = e.target.closest("[data-save]"); const d = e.target.closest("[data-del]");
    if (s){
      const id = s.getAttribute("data-save");
      const inp = document.querySelector(`[data-edit='${id}']`);
      const val = Number(inp.value||0);
      await updateDoc(doc(db,"splits", id), { shareAmount: val, updatedAt: serverTimestamp() });
      s.disabled=true; setTimeout(()=> s.disabled=false, 300);
    }
    if (d){
      const id = d.getAttribute("data-del");
      if (!confirm("Xóa split này?")) return;
      await deleteDoc(doc(db,"splits", id));
      d.closest("tr")?.remove();
    }
  }, { once:true });
}
