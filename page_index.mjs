// page_index.mjs
import { auth, db, collection, addDoc, serverTimestamp, onAuthStateChanged, query, where, orderBy, limit, onSnapshot, doc, deleteDoc, getDocs, updateDoc } from "./firebase.mjs";
import { bindAuthUI, signInGoogle, signOutNow, isAdmin } from "./auth.mjs";
import { fmt, monthKeyFromDate, renderUserChips, uidSelected, userMap } from "./utils.mjs";

bindAuthUI();
document.getElementById("btnLogin")?.addEventListener("click", signInGoogle);
document.getElementById("btnLogout")?.addEventListener("click", signOutNow);

const monthLabel = document.getElementById("monthKey");
monthLabel.textContent = monthKeyFromDate();

async function fetchUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => d.data());
}

async function initParticipants(currentUid) {
  const users = await fetchUsers();
  renderUserChips(document.getElementById("participants"), users, currentUid);

  const sel = document.getElementById("toUid");
  sel.innerHTML = "";
  const map = userMap(users);
  Object.entries(map).forEach(([uid, name]) => {
    if (uid !== currentUid) {
      const opt = document.createElement("option"); opt.value = uid; opt.textContent = name; sel.appendChild(opt);
    }
  });
}

onAuthStateChanged(auth, (user) => { if (user) initParticipants(user.uid); });

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
    status: "pending", monthKey: monthKeyFromDate(),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });

  const share = Math.round((amount / parts.length) * 100) / 100;
  const tasks = [];
  for (const uid of parts) {
    if (uid === user.uid) continue;
    tasks.push(addDoc(collection(db, "splits"), {
      expenseId: expRef.id, payerId: user.uid, debtorId: uid,
      shareAmount: share, status: "pending", monthKey: monthKeyFromDate(),
      createdAt: serverTimestamp(),
    }));
  }
  await Promise.all(tasks);
  e.target.reset();
  alert("Đã tạo khoản chi (pending). Admin sẽ duyệt.");
});

const body = document.getElementById("myExpenses");
let unsubMine = null;
function listenMyExpenses() {
  const user = auth.currentUser;
  if (!user || !body) return;
  if (unsubMine) unsubMine();
  const qy = query(collection(db, "expenses"), where("ownerId", "==", user.uid), orderBy("createdAt", "desc"), limit(100));
  unsubMine = onSnapshot(qy, (snap) => {
    body.innerHTML = "";
    snap.forEach(docu => {
      const d = docu.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="badge text-bg-${d.status==='approved'?'success':(d.status==='rejected'?'danger':'warning')}">${d.status}</span></td>
        <td>${d.category}</td>
        <td>${fmt.format(d.amount)}</td>
        <td>${(d.participants||[]).length}</td>
        <td>${d.createdAt?.toDate?.().toLocaleString("vi-VN") || "-"}</td>
        <td>${d.status==='pending'?`<button class="btn btn-sm btn-outline-danger" data-del="${docu.id}">Hủy</button>`:""}</td>
      `;
      body.appendChild(tr);
    });
  });
}
onAuthStateChanged(auth, () => listenMyExpenses());

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del]");
  if (btn) {
    const id = btn.getAttribute("data-del");
    if (confirm("Hủy khoản chi đang chờ duyệt?")) await deleteDoc(doc(db, "expenses", id));
  }
});

let unsub1=null, unsub2=null, unpayIn=null;
async function listenDebtViews() {
  const user = auth.currentUser; if (!user) return;
  const mk = monthKeyFromDate();
  const users = await fetchUsers(); const nameMap = userMap(users);

  unsub1 = onSnapshot(
    query(collection(db,"splits"), where("payerId","==",user.uid), where("status","==","approved"), where("monthKey","==",mk)),
    async (snap) => {
      const byDebtor = {};
      snap.forEach(s => {
        const d = s.data();
        byDebtor[d.debtorId] = (byDebtor[d.debtorId]||0) + (d.shareAmount||0);
      });
      const paySnap = await getDocs(query(collection(db,"payRequests"), where("toUid","==",user.uid), where("status","==","approved"), where("monthKey","==",mk)));
      const paid = {};
      paySnap.forEach(p => { const d=p.data(); paid[d.fromUid]=(paid[d.fromUid]||0)+(d.amount||0); });
      const cont = document.getElementById("theyOweList");
      cont.innerHTML = "";
      Object.keys(byDebtor).forEach(uid => {
        const outstanding = Math.max(0, Math.round((byDebtor[uid] - (paid[uid]||0))*100)/100);
        const row = document.createElement("div");
        row.className = "d-flex justify-content-between align-items-center border rounded-3 p-2 mb-2";
        row.innerHTML = `<div>${nameMap[uid]||uid}</div><div class="fw-semibold">${fmt.format(outstanding)}</div>`;
        cont.appendChild(row);
      });
    }
  );

  unsub2 = onSnapshot(
    query(collection(db,"splits"), where("debtorId","==",user.uid), where("status","==","approved"), where("monthKey","==",mk)),
    async (snap) => {
      const byPayer = {};
      snap.forEach(s => {
        const d=s.data();
        byPayer[d.payerId]=(byPayer[d.payerId]||0)+(d.shareAmount||0);
      });
      const paySnap = await getDocs(query(collection(db,"payRequests"), where("fromUid","==",user.uid), where("status","==","approved"), where("monthKey","==",mk)));
      const paid = {}; paySnap.forEach(p=>{const d=p.data(); paid[d.toUid]=(paid[d.toUid]||0)+(d.amount||0); });
      const cont = document.getElementById("iOweList");
      cont.innerHTML = "";
      Object.keys(byPayer).forEach(uid => {
        const outstanding = Math.max(0, Math.round((byPayer[uid] - (paid[uid]||0))*100)/100);
        const row = document.createElement("div");
        row.className = "d-flex justify-content-between align-items-center border rounded-3 p-2 mb-2";
        row.innerHTML = `<div>${nameMap[uid]||uid}</div>
          <div>
            <span class="fw-semibold me-2">${fmt.format(outstanding)}</span>
            <button class="btn btn-sm btn-outline-primary" data-openreq="${uid}" data-amount="${outstanding}">Yêu cầu trả nợ</button>
          </div>`;
        cont.appendChild(row);
      });
    }
  );

  unpayIn = onSnapshot(
    query(collection(db,"payRequests"), where("toUid","==",user.uid), where("status","==","pending"), orderBy("createdAt","desc")),
    (snap) => {
      const cont = document.getElementById("incomingReqs"); cont.innerHTML="";
      snap.forEach(docu => {
        const d = docu.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${nameMap[d.fromUid]||d.fromUid}</td>
          <td>${fmt.format(d.amount)}</td>
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
onAuthStateChanged(auth, () => listenDebtViews());

let reqModal;
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-openreq]");
  if (btn) {
    const to = btn.getAttribute("data-openreq");
    const amount = Number(btn.getAttribute("data-amount")||0);
    const sel = document.getElementById("toUid");
    sel.value = to;
    document.getElementById("reqAmount").value = amount;
    reqModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("reqModal"));
    reqModal.show();
  }
});

document.getElementById("btnSendReq")?.addEventListener("click", async () => {
  const user = auth.currentUser; if (!user) return alert("Hãy đăng nhập");
  const toUid = document.getElementById("toUid").value;
  const amount = Number(document.getElementById("reqAmount").value||0);
  const note = document.getElementById("reqNote").value.trim();
  if (!toUid || amount<=0) return alert("Chọn người nhận và số tiền hợp lệ");
  await addDoc(collection(db,"payRequests"), {
    fromUid: user.uid, toUid, amount, note,
    status: "pending", monthKey: monthKeyFromDate(),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  reqModal?.hide();
  document.getElementById("formRequest").reset();
});

document.addEventListener("click", async (e)=>{
  const a = e.target.closest("[data-approve-req]");
  const r = e.target.closest("[data-reject-req]");
  if (a) {
    await updateDoc(doc(db,"payRequests", a.getAttribute("data-approve-req")), { status:"approved", updatedAt: serverTimestamp() });
  }
  if (r) {
    await updateDoc(doc(db,"payRequests", r.getAttribute("data-reject-req")), { status:"rejected", updatedAt: serverTimestamp() });
  }
});
