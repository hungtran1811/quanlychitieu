// page_index.mjs (v3) – settle-all + faster listeners
import { auth, db, collection, addDoc, serverTimestamp, onAuthStateChanged, query, where, orderBy, limit, onSnapshot, doc, deleteDoc, getDocs, updateDoc } from "./firebase.mjs";
import { bindAuthUI, signInGoogle, signOutNow } from "./auth.mjs";
import { fmt, monthKeyFromDate, renderUserChips, uidSelected, userMap } from "./utils.mjs";

bindAuthUI();
document.getElementById("btnLogin")?.addEventListener("click", signInGoogle);
document.getElementById("btnLogout")?.addEventListener("click", signOutNow);

const mk = monthKeyFromDate();
document.getElementById("monthKey").textContent = mk;

// cache users once
let _usersCache = null, _nameMap = {};
async function fetchUsersOnce() {
  if (_usersCache) return _usersCache;
  const snap = await getDocs(collection(db, "users"));
  _usersCache = snap.docs.map(d=>d.data());
  _nameMap = userMap(_usersCache);
  return _usersCache;
}

// participants for form + list for settle modal
async function initParticipants(currentUid) {
  await fetchUsersOnce();
  renderUserChips(document.getElementById("participants"), _usersCache, currentUid);
  const sel = document.getElementById("toUid");
  sel.innerHTML = "";
  Object.entries(_nameMap).forEach(([uid, name]) => {
    if (uid !== currentUid) {
      const opt = document.createElement("option"); opt.value = uid; opt.textContent = name; sel.appendChild(opt);
    }
  });
}
onAuthStateChanged(auth, (user) => { if (user) initParticipants(user.uid); });

// create expense (pending)
document.getElementById("formExpense")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert("Hãy đăng nhập");
  const amount = Number(document.getElementById("amount").value || 0);
  if (!amount || amount <= 0) return alert("Số tiền không hợp lệ");
  const category = document.getElementById("category").value.trim() || "Khác";
  const note = document.getElementById("note").value.trim();
  const parts = uidSelected("participant");
  if (parts.length === 0) return alert("Chọn ít nhất 1 người đi cùng");

  const expRef = await addDoc(collection(db, "expenses"), {
    ownerId: user.uid, amount, category, note,
    participants: parts, splitMode: "equal",
    status: "pending", monthKey: mk,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });

  const share = Math.round((amount / parts.length) * 100) / 100;
  const tasks = [];
  for (const uid of parts) {
    if (uid === user.uid) continue;
    tasks.push(addDoc(collection(db, "splits"), {
      expenseId: expRef.id, payerId: user.uid, debtorId: uid,
      shareAmount: share, status: "pending", monthKey: mk,
      createdAt: serverTimestamp(),
    }));
  }
  await Promise.all(tasks);
  e.target.reset();
  alert("Đã tạo khoản chi (pending). Admin sẽ duyệt.");
});

// my expenses (only latest 50 for speed)
let unsubMine=null;
function listenMyExpenses() {
  const user = auth.currentUser; if (!user) return;
  const tbody = document.getElementById("myExpenses");
  if (unsubMine) unsubMine();
  const qy = query(collection(db,"expenses"), where("ownerId","==",user.uid), orderBy("createdAt","desc"), limit(50));
  unsubMine = onSnapshot(qy, (snap) => {
    const frag = document.createDocumentFragment();
    snap.forEach(docu => {
      const d = docu.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="badge text-bg-${d.status==='approved'?'success':(d.status==='rejected'?'danger':'warning')}">${d.status}</span></td>
        <td>${d.category}</td>
        <td>${fmt.format(d.amount)}</td>
        <td>${(d.participants||[]).length}</td>
        <td>${d.createdAt?.toDate?.().toLocaleString("vi-VN")||"-"}</td>
        <td>${d.status==='pending'?`<button class="btn btn-sm btn-outline-danger" data-del="${docu.id}">Hủy</button>`:""}</td>`;
      frag.appendChild(tr);
    });
    tbody.innerHTML=""; tbody.appendChild(frag);
  });
}
onAuthStateChanged(auth, () => listenMyExpenses());
document.addEventListener("click", async (e)=>{
  const btn = e.target.closest("[data-del]");
  if (btn) { const id = btn.getAttribute("data-del");
    if (confirm("Hủy khoản chi đang chờ duyệt?")) await deleteDoc(doc(db,"expenses",id));
  }
});

// debt views with settle-all logic
let unsubPayer=null, unsubDebtor=null, unsubSettleIn=null, unsubSettleOut=null;
function listenDebt() {
  const user = auth.currentUser; if (!user) return;
  // splits where I am payer (they owe me)
  unsubPayer = onSnapshot(
    query(collection(db,"splits"), where("payerId","==",user.uid), where("status","==","approved"), where("monthKey","==",mk)),
    (snap) => updateTheyOwe(snap)
  );
  // splits where I am debtor (I owe)
  unsubDebtor = onSnapshot(
    query(collection(db,"splits"), where("debtorId","==",user.uid), where("status","==","approved"), where("monthKey","==",mk)),
    (snap) => updateIOwe(snap)
  );
  // approved settle-all requests (both directions)
  unsubSettleIn = onSnapshot(
    query(collection(db,"payRequests"), where("toUid","==",user.uid), where("status","==","approved"), where("monthKey","==",mk), where("settleAll","==",true)),
    (snap) => { _approvedToMe = parseSettlePairs(snap); renderDebts(); }
  );
  unsubSettleOut = onSnapshot(
    query(collection(db,"payRequests"), where("fromUid","==",user.uid), where("status","==","approved"), where("monthKey","==",mk), where("settleAll","==",true)),
    (snap) => { _approvedFromMe = parseSettlePairs(snap); renderDebts(); }
  );
}
onAuthStateChanged(auth, () => listenDebt());

let _theyOweRaw={}, _iOweRaw={}, _approvedToMe=new Set(), _approvedFromMe=new Set();
function parseSettlePairs(snap) {
  const s = new Set();
  snap.forEach(d => { const x=d.data(); const pair = [x.fromUid,x.toUid].sort().join("_"); s.add(pair); });
  return s;
}
function updateTheyOwe(snap) {
  _theyOweRaw = {};
  snap.forEach(s => { const d=s.data(); _theyOweRaw[d.debtorId]=( _theyOweRaw[d.debtorId]||0 ) + (d.shareAmount||0); });
  renderDebts();
}
function updateIOwe(snap) {
  _iOweRaw = {};
  snap.forEach(s => { const d=s.data(); _iOweRaw[d.payerId]=( _iOweRaw[d.payerId]||0 ) + (d.shareAmount||0); });
  renderDebts();
}
function pairSettled(uidA, uidB) {
  const key = [uidA, uidB].sort().join("_");
  return _approvedToMe.has(key) || _approvedFromMe.has(key);
}
function renderDebts() {
  const me = auth.currentUser?.uid; if (!me) return;
  const theyC = document.getElementById("theyOweList");
  const iC = document.getElementById("iOweList");
  theyC.innerHTML=""; iC.innerHTML="";
  // They owe me
  Object.keys(_theyOweRaw).forEach(uid => {
    const settled = pairSettled(me, uid);
    const val = settled ? 0 : _theyOweRaw[uid];
    const row = document.createElement("div");
    row.className = "d-flex justify-content-between align-items-center border rounded-3 p-2 mb-2";
    row.innerHTML = `<div>${_nameMap[uid]||uid}</div><div class="fw-semibold">${fmt.format(val)}</div>`;
    theyC.appendChild(row);
  });
  // I owe them
  Object.keys(_iOweRaw).forEach(uid => {
    const settled = pairSettled(me, uid);
    const val = settled ? 0 : _iOweRaw[uid];
    const row = document.createElement("div");
    row.className = "d-flex justify-content-between align-items-center border rounded-3 p-2 mb-2";
    row.innerHTML = `<div>${_nameMap[uid]||uid}</div>
      <div>
        <span class="fw-semibold me-2">${fmt.format(val)}</span>
        <button class="btn btn-sm btn-outline-primary" data-openreq="${uid}">Thanh toán nợ</button>
      </div>`;
    iC.appendChild(row);
  });
}

// open settle modal
let reqModal;
document.getElementById("btnOpenSettle")?.addEventListener("click", () => {
  reqModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("reqModal"));
  reqModal.show();
});
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-openreq]");
  if (btn) {
    const to = btn.getAttribute("data-openreq");
    document.getElementById("toUid").value = to;
    reqModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("reqModal"));
    reqModal.show();
  }
});

// send settle-all request
document.getElementById("btnSendReq")?.addEventListener("click", async () => {
  const user = auth.currentUser; if (!user) return alert("Hãy đăng nhập");
  const toUid = document.getElementById("toUid").value;
  const note = document.getElementById("reqNote").value.trim();
  if (!toUid) return alert("Chọn người đối ứng");
  await addDoc(collection(db,"payRequests"), {
    fromUid: user.uid, toUid, note,
    status:"pending", monthKey: mk, settleAll: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  reqModal?.hide(); document.getElementById("formRequest").reset();
});

// incoming settle-all requests for me (creditor)
let unsubIncoming=null;
function listenIncoming() {
  const user = auth.currentUser; if (!user) return;
  unsubIncoming = onSnapshot(
    query(collection(db,"payRequests"), where("toUid","==",user.uid), where("status","==","pending"), where("monthKey","==",mk), where("settleAll","==",true"), orderBy("createdAt","desc")),
    (snap) => {
      const cont = document.getElementById("incomingReqs"); cont.innerHTML="";
      snap.forEach(docu => {
        const d=docu.data();
        const tr=document.createElement("tr");
        tr.innerHTML = `<td>${_nameMap[d.fromUid]||d.fromUid}</td>
          <td>${d.note||""}</td>
          <td>${d.createdAt?.toDate?.().toLocaleString("vi-VN")||"-"}</td>
          <td>
            <button class="btn btn-sm btn-success me-1" data-approve-req="${docu.id}">Chấp nhận</button>
            <button class="btn btn-sm btn-outline-danger" data-reject-req="${docu.id}">Từ chối</button>
          </td>`;
        cont.appendChild(tr);
      });
    }
  );
}
onAuthStateChanged(auth, () => listenIncoming());

document.addEventListener("click", async (e)=>{
  const a = e.target.closest("[data-approve-req]");
  const r = e.target.closest("[data-reject-req]");
  if (a) await updateDoc(doc(db,"payRequests", a.getAttribute("data-approve-req")), { status:"approved", updatedAt: serverTimestamp() });
  if (r) await updateDoc(doc(db,"payRequests", r.getAttribute("data-reject-req")), { status:"rejected", updatedAt: serverTimestamp() });
});
