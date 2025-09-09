// page_admin.mjs
import { auth } from "./firebase.mjs";
import { bindAuthUI, signOutNow, isAdmin } from "./auth.mjs";
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs, addDoc, serverTimestamp } from "./firebase.mjs";
import { fmt, renderUserChips, uidSelected, monthKeyFromDate } from "./utils.mjs";

bindAuthUI();
document.getElementById("btnLogout")?.addEventListener("click", signOutNow);

auth.onAuthStateChanged((u) => {
  if (!u || !isAdmin(u)) {
    alert("Bạn không có quyền truy cập Admin"); window.location.href = "./index.html";
  } else {
    loadPending();
    initHouseForm();
  }
});

async function fetchUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => d.data());
}

const pendingBody = document.getElementById("pendingBody");
let unsubPending = null;
function loadPending() {
  const qy = query(collection(db, "expenses"), where("status","==","pending"), orderBy("createdAt","desc"));
  unsubPending = onSnapshot(qy, (snap) => {
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
          <button class="btn btn-sm btn-success me-1" data-approve="${docu.id}">Duyệt</button>
          <button class="btn btn-sm btn-outline-danger" data-reject="${docu.id}">Từ chối</button>
        </td>
      `;
      pendingBody.appendChild(tr);
    });
  });
}

document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-approve]"); const r = e.target.closest("[data-reject]");
  if (a) {
    const id = a.getAttribute("data-approve");
    await updateDoc(doc(db, "expenses", id), { status: "approved", updatedAt: serverTimestamp() });
    const spSnap = await getDocs(query(collection(db,"splits"), where("expenseId","==", id)));
    const tasks = spSnap.docs.map(d => updateDoc(doc(db, "splits", d.id), { status: "approved", updatedAt: serverTimestamp() }));
    await Promise.all(tasks);
  }
  if (r) {
    const id = r.getAttribute("data-reject");
    await updateDoc(doc(db, "expenses", id), { status: "rejected", updatedAt: serverTimestamp() });
    const spSnap = await getDocs(query(collection(db,"splits"), where("expenseId","==", id)));
    const tasks = spSnap.docs.map(d => updateDoc(doc(db, "splits", d.id), { status: "rejected", updatedAt: serverTimestamp() }));
    await Promise.all(tasks);
  }
});

async function initHouseForm() {
  const users = await fetchUsers();
  renderUserChips(document.getElementById("houseParticipants"), users);
  document.getElementById("btnAddExtra").addEventListener("click", addExtraRow);
  document.getElementById("formHouse").addEventListener("submit", submitHouse);
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
    <div class="col-2"><button class="btn btn-sm btn-outline-danger" type="button" data-remove="${id}">Xóa</button></div>
  `;
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
  const parts = uidSelected("participant");
  const peopleCount = parts.length;
  if (!month || peopleCount===0) return alert("Điền tháng và chọn thành viên");

  let extraSum = 0; const extras = [];
  document.querySelectorAll("#extras .row").forEach(r => {
    const label = r.querySelector("input[placeholder='Tên khoản (ẩn)']").value.trim() || "";
    const amount = Number(r.querySelector("input[placeholder='Số tiền']").value || 0);
    if (label && amount>0) { extras.push({label, amount}); extraSum += amount; }
  });
  const res = calcHouseTotal(eOld, eNew, peopleCount, extraSum);

  document.getElementById("housePreview").style.display="block";
  document.getElementById("housePreview").innerHTML = `
    Điện: <b>${fmt.format(res.electric)}</b> – Nước: <b>${fmt.format(res.water)}</b> – Rác+Wifi: <b>${fmt.format(res.trashWifi)}</b> – Bổ sung: <b>${fmt.format(extraSum)}</b><br/>
    <b>Tổng: ${fmt.format(res.total)}</b> → Chia đều cho <b>${peopleCount}</b> người = <b>${fmt.format(Math.round(res.total/peopleCount))}</b> mỗi người. Đã tạo khoản chi (pending).
  `;

  const admin = auth.currentUser;
  const expRef = await addDoc(collection(db, "expenses"), {
    ownerId: admin.uid,
    amount: res.total,
    category: `Tiền nhà ${month}`,
    note: `điện(${eNew}-${eOld}), nước(${peopleCount}), rác+wifi(150k), extras(${extras.length})`,
    participants: parts,
    splitMode: "equal",
    status: "pending",
    monthKey: month,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const share = Math.round((res.total/peopleCount) * 100) / 100;
  const tasks = [];
  for (const uid of parts) {
    if (uid === admin.uid) continue;
    tasks.push(addDoc(collection(db, "splits"), {
      expenseId: expRef.id,
      payerId: admin.uid,
      debtorId: uid,
      shareAmount: share,
      status: "pending",
      monthKey: month,
      createdAt: serverTimestamp(),
    }));
  }
  await Promise.all(tasks);
  ev.target.reset();
}
