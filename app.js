// app.js
// Utilities
const q = (sel) => document.querySelector(sel);
const qa = (sel) => Array.from(document.querySelectorAll(sel));
const fmt = new Intl.NumberFormat('vi-VN');

function getCurrentUser() { return auth.currentUser; }

// Create expense/income
q("#formExpense")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return alert("Hãy đăng nhập!");
  const type = q("#type").value; // income | expense
  const category = q("#category").value.trim();
  const amount = Number(q("#amount").value || 0);
  const note = q("#note").value.trim();

  if (!amount || amount <= 0) return alert("Số tiền không hợp lệ");
  try {
    await db.collection("expenses").add({
      userId: user.uid,
      type, category, amount, note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    e.target.reset();
  } catch (err) {
    alert("Lỗi lưu giao dịch: " + err.message);
  }
});

// Render list
const tbody = q("#tblBody");
let unsubExp = null;

function listenMyExpenses() {
  const user = getCurrentUser();
  if (!user || !tbody) return;
  if (unsubExp) unsubExp(); // cleanup

  unsubExp = db.collection("expenses")
    .where("userId", "==", user.uid)
    .orderBy("createdAt", "desc")
    .limit(100)
    .onSnapshot(snap => {
      tbody.innerHTML = "";
      let totalIn = 0, totalOut = 0;
      snap.forEach(doc => {
        const d = doc.data();
        if (d.type === "income") totalIn += d.amount;
        if (d.type === "expense") totalOut += d.amount;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${d.type}</td>
          <td>${d.category || "-"}</td>
          <td class="text-right">${fmt.format(d.amount)}</td>
          <td>${d.note || ""}</td>
          <td>${d.createdAt?.toDate?.().toLocaleString("vi-VN") || "-"}</td>
          <td><button class="btn-link" data-del="${doc.id}">Xóa</button></td>
        `;
        tbody.appendChild(tr);
      });
      q("#sumIncome").textContent = fmt.format(totalIn);
      q("#sumExpense").textContent = fmt.format(totalOut);
      q("#sumBalance").textContent = fmt.format(totalIn - totalOut);
    });
}

document.addEventListener("click", async (e) => {
  if (e.target.matches("[data-del]")) {
    const id = e.target.getAttribute("data-del");
    if (confirm("Xóa giao dịch này?")) {
      try { await db.collection("expenses").doc(id).delete(); }
      catch (err) { alert("Không thể xóa: " + err.message); }
    }
  }
});

auth.onAuthStateChanged((u) => { if (u) listenMyExpenses(); });
