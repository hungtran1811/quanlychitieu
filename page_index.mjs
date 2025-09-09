// page_index.mjs
import { auth } from "./firebase.mjs";
import { bindAuthUI, signInGoogle, signOutNow, isAdmin } from "./auth.mjs";
import { db, collection, addDoc, serverTimestamp, onAuthStateChanged, query, where, orderBy, limit, onSnapshot, doc, deleteDoc, getDocs } from "./firebase.mjs";
import { fmt, monthKeyFromDate, renderUserChips, uidSelected } from "./utils.mjs";

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
  const cont = document.getElementById("participants");
  renderUserChips(cont, users, currentUid);
}

onAuthStateChanged(auth, (user) => {
  if (user) initParticipants(user.uid);
});

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
    ownerId: user.uid,
    amount, category, note,
    participants: parts,
    splitMode: "equal",
    status: "pending",
    monthKey: monthKeyFromDate(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const share = Math.round((amount / parts.length) * 100) / 100;
  const batch = [];
  for (const uid of parts) {
    if (uid === user.uid) continue;
    batch.push(addDoc(collection(db, "splits"), {
      expenseId: expRef.id,
      payerId: user.uid,
      debtorId: uid,
      shareAmount: share,
      status: "pending",
      monthKey: monthKeyFromDate(),
      createdAt: serverTimestamp(),
    }));
  }
  await Promise.all(batch);
  e.target.reset();
  alert("Đã tạo khoản chi (pending). Admin sẽ duyệt.");
});

const body = document.getElementById("myExpenses");
let unsubMine = null;
function listenMyExpenses() {
  const user = auth.currentUser;
  if (!user || !body) return;
  if (unsubMine) unsubMine();
  const q = query(collection(db, "expenses"),
    where("ownerId", "==", user.uid),
    orderBy("createdAt", "desc"),
    limit(100));
  unsubMine = onSnapshot(q, (snap) => {
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
    if (confirm("Hủy khoản chi đang chờ duyệt?")) {
      await deleteDoc(doc(db, "expenses", id));
    }
  }
});

let unsubOwe1 = null, unsubOwe2 = null;
function listenTotals() {
  const user = auth.currentUser;
  if (!user) return;
  const mk = monthKeyFromDate();
  unsubOwe1 = onSnapshot(
    query(collection(db, "splits"), where("debtorId", "==", user.uid), where("status","==","approved"), where("monthKey","==",mk)),
    (snap) => {
      let sum = 0; snap.forEach(d => { sum += d.data().shareAmount || 0; });
      document.getElementById("iOwe").textContent = fmt.format(sum);
      const they = Number(document.getElementById("theyOwe").textContent.replace(/\./g,""))||0;
      document.getElementById("balance").textContent = fmt.format(they - sum);
    }
  );
  unsubOwe2 = onSnapshot(
    query(collection(db, "splits"), where("payerId", "==", user.uid), where("status","==","approved"), where("monthKey","==",mk)),
    (snap) => {
      let sum = 0; snap.forEach(d => { sum += d.data().shareAmount || 0; });
      document.getElementById("theyOwe").textContent = fmt.format(sum);
      const iowe = Number(document.getElementById("iOwe").textContent.replace(/\./g,""))||0;
      document.getElementById("balance").textContent = fmt.format(sum - iowe);
    }
  );
}
onAuthStateChanged(auth, () => listenTotals());
