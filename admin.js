// admin.js
function guardAdmin() {
  const user = auth.currentUser;
  if (!user || user.uid !== window.ADMIN_UID) {
    alert("Bạn không có quyền truy cập trang admin.");
    window.location.href = "/index.html";
  }
}
auth.onAuthStateChanged(() => guardAdmin());

// Admin: create monthly shared house bill and split evenly for selected users
const billForm = document.getElementById("formHouseBill");
const usersSelect = document.getElementById("participants");
const billsBody = document.getElementById("billsBody");

async function loadUsers() {
  const snap = await db.collection("users").orderBy("displayName").get();
  usersSelect.innerHTML = "";
  snap.forEach(doc => {
    const d = doc.data();
    const opt = document.createElement("option");
    opt.value = d.uid;
    opt.textContent = d.displayName || d.email || d.uid;
    usersSelect.appendChild(opt);
  });
}
loadUsers();

billForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("billTitle").value.trim();
  const amount = Number(document.getElementById("billAmount").value || 0);
  const month = document.getElementById("billMonth").value; // 2025-09
  const selected = Array.from(usersSelect.selectedOptions).map(o => o.value);

  if (!title || !amount || amount <= 0 || !month || selected.length === 0) {
    return alert("Điền đầy đủ thông tin.");
  }
  const user = auth.currentUser;
  if (!user || user.uid !== window.ADMIN_UID) return alert("Không có quyền");

  const bill = {
    title, amount, month, participants: selected,
    split: "equal",
    createdBy: user.uid,
    status: "open",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const ref = await db.collection("houseBills").add(bill);
    // Optional: also create individual expense records for each user (their share)
    const share = Math.round((amount / selected.length) * 100) / 100;
    const batch = db.batch();
    selected.forEach(uid => {
      const expRef = db.collection("expenses").doc();
      batch.set(expRef, {
        userId: uid,
        type: "expense",
        category: `HouseBill:${title}`,
        amount: share,
        note: `Chia hóa đơn tháng ${month}`,
        houseBillId: ref.id,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    billForm.reset();
  } catch (err) {
    alert("Tạo hóa đơn thất bại: " + err.message);
  }
});

// Render house bills
function listenBills() {
  return db.collection("houseBills")
    .orderBy("createdAt", "desc")
    .limit(100)
    .onSnapshot(snap => {
      billsBody.innerHTML = "";
      snap.forEach(doc => {
        const d = doc.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${d.title}</td>
          <td>${d.month}</td>
          <td class="text-right">${new Intl.NumberFormat('vi-VN').format(d.amount)}</td>
          <td>${(d.participants || []).length}</td>
          <td>${d.status}</td>
          <td>
            <button class="btn-link" data-close="${doc.id}">Đóng</button>
            <button class="btn-link" data-del="${doc.id}">Xóa</button>
          </td>
        `;
        billsBody.appendChild(tr);
      });
    });
}

let unsubBills = null;
auth.onAuthStateChanged(u => {
  if (u && u.uid === window.ADMIN_UID) {
    if (unsubBills) unsubBills();
    unsubBills = listenBills();
  }
});

document.addEventListener("click", async (e) => {
  if (e.target.matches("[data-del]")) {
    const id = e.target.getAttribute("data-del");
    if (!confirm("Xóa hóa đơn và giữ lại giao dịch con (nếu có)?")) return;
    try { await db.collection("houseBills").doc(id).delete(); }
    catch (err) { alert(err.message); }
  }
  if (e.target.matches("[data-close]")) {
    const id = e.target.getAttribute("data-close");
    try {
      await db.collection("houseBills").doc(id).set({ status: "closed", updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (err) {
      alert(err.message);
    }
  }
});
