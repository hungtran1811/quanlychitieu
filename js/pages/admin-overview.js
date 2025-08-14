// public/js/pages/admin-overview.js
import { currentUser } from "../auth.js";
import { getDb } from "../store/firestore.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import {
  createExpenseApproved,
  subscribeRecentExpenses,
  deleteExpense,
} from "../store/expenses.js";

import {
  createPaymentApproved,
  subscribeRecentPayments,
  deletePayment,
} from "../store/payments.js";

import { money } from "../utils/format.js";
import { toast } from "../utils/toast.js";

/* ---------- Users realtime để gợi ý chips ---------- */
let USERS = [];
const initialLetter = (s) => (s || "?").trim().charAt(0).toUpperCase();

// Hash đơn giản → hue (0..359) theo email để avatar có màu ổn định
function hueFrom(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) % 360;
  }
  return h;
}

function filterUsers(kw) {
  const k = (kw || "").trim().toLowerCase();
  if (!k) return USERS;
  return USERS.filter(
    (u) =>
      (u.displayName || "").toLowerCase().includes(k) ||
      (u.email || "").toLowerCase().includes(k)
  );
}

function renderChips(list, host, onPick) {
  host.innerHTML = "";
  list.slice(0, 10).forEach((u) => {
    const hue = hueFrom(u.email || u.displayName || "");
    const el = document.createElement("button");
    el.type = "button";
    el.className = "chip";
    el.innerHTML = `
      <span class="chip-avatar" style="--h:${hue}">${initialLetter(
      u.displayName || u.email
    )}</span>
      <span class="chip-text">
        <strong>${u.displayName || "—"}</strong>
        <span class="chip-sub">${u.email}</span>
      </span>
    `;
    el.addEventListener("click", () => onPick(u));
    host.appendChild(el);
  });
}

function appendEmailComma(input, email) {
  const cur = (input.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!cur.includes(email)) cur.push(email);
  input.value = cur.join(", ") + ", ";
  input.dispatchEvent(new Event("input"));
}

/* ---------- Trang Admin Overview ---------- */
export function render() {
  const root = document.getElementById("app-root");
  root.innerHTML = `
  <section class="card"><div class="inner">
    <h2 style="margin:0 0 6px">Admin • Tổng quan</h2>
    <p class="muted" style="margin:0 0 14px">Tạo khoản chi & thanh toán trực tiếp (được duyệt ngay), không cần request.</p>

    <!-- Form EXPENSE -->
    <h3 style="margin:6px 0 10px">Tạo khoản chi (Expense)</h3>
    <form id="form-ex" class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
      <div><label>Ngày</label><input id="ex-date" type="date" required /></div>
      <div><label>Số tiền (VND)</label><input id="ex-amount" type="number" min="1" step="1" placeholder="vd. 150000" required /></div>
      <div style="grid-column:1/-1"><label>Ghi chú</label><input id="ex-note" type="text" placeholder="vd. Mua đồ siêu thị" /></div>
      <div style="grid-column:1/-1">
        <label>Những người cùng mua (emails, phẩy)</label>
        <input id="ex-participants" type="text" placeholder="a@gmail.com, b@gmail.com" />
        <div id="chips-ex-participants" class="chips"></div>
      </div>
      <div style="grid-column:1/-1">
        <label>Người trả (email)</label>
        <input id="ex-payer" type="email" placeholder="mặc định là email admin nếu bỏ trống" />
        <div id="chips-ex-payer" class="chips"></div>
      </div>
      <div class="form-actions">
        <button id="btn-ex-create" class="btn primary" type="submit">Tạo khoản chi</button>
        <span id="ex-status" class="muted small"></span>
      </div>
    </form>

    <!-- Form PAYMENT -->
    <h3 style="margin:22px 0 10px">Tạo thanh toán (Payment)</h3>
    <form id="form-pm" class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
      <div><label>Ngày</label><input id="pm-date" type="date" required /></div>
      <div><label>Số tiền (VND)</label><input id="pm-amount" type="number" min="1" step="1" placeholder="vd. 150000" required /></div>
      <div style="grid-column:1/-1"><label>Ghi chú (tuỳ chọn)</label><input id="pm-note" type="text" placeholder="vd. chuyển khoản" /></div>
      <div style="grid-column:1/-1">
        <label>Người trả (from)</label>
        <input id="pm-from" type="email" placeholder="from@gmail.com" />
        <div id="chips-pm-from" class="chips"></div>
      </div>
      <div style="grid-column:1/-1">
        <label>Người nhận (to)</label>
        <input id="pm-to" type="email" placeholder="to@gmail.com" />
        <div id="chips-pm-to" class="chips"></div>
      </div>
      <div class="form-actions">
        <button id="btn-pm-create" class="btn primary" type="submit">Tạo thanh toán</button>
        <span id="pm-status" class="muted small"></span>
      </div>
    </form>

    <h3 style="margin:22px 0 10px">Expense gần đây</h3>
    <table class="table">
      <thead><tr><th>Thời gian</th><th>Ghi chú</th><th>Số tiền</th><th>Người trả</th><th>Người đi cùng</th><th></th></tr></thead>
      <tbody id="tb-expenses"><tr><td colspan="6" class="muted">Đang tải…</td></tr></tbody>
    </table>

    <h3 style="margin:16px 0 10px">Payment gần đây</h3>
    <table class="table">
      <thead><tr><th>Thời gian</th><th>Ghi chú</th><th>Số tiền</th><th>Từ → Đến</th><th></th></tr></thead>
      <tbody id="tb-payments"><tr><td colspan="5" class="muted">Đang tải…</td></tr></tbody>
    </table>
  </div></section>`;

  // Prefill date
  const toDateInput = (d) => {
    const z = new Date(d);
    z.setMinutes(z.getMinutes() - z.getTimezoneOffset());
    return z.toISOString().slice(0, 10);
  };
  const today = toDateInput(new Date());
  document.getElementById("ex-date").value = today;
  document.getElementById("pm-date").value = today;

  // Refs input & chips
  const exParticipants = document.getElementById("ex-participants");
  const exPayer = document.getElementById("ex-payer");
  const pmFrom = document.getElementById("pm-from");
  const pmTo = document.getElementById("pm-to");
  const boxExParticipants = document.getElementById("chips-ex-participants");
  const boxExPayer = document.getElementById("chips-ex-payer");
  const boxPmFrom = document.getElementById("chips-pm-from");
  const boxPmTo = document.getElementById("chips-pm-to");

  function refreshChips() {
    const cur = (exParticipants.value || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const listForParticipants = USERS.filter(
      (u) => !cur.includes((u.email || "").toLowerCase())
    );
    renderChips(listForParticipants, boxExParticipants, (u) =>
      appendEmailComma(exParticipants, u.email)
    );

    renderChips(filterUsers(exPayer.value), boxExPayer, (u) => {
      exPayer.value = u.email;
    });
    renderChips(filterUsers(pmFrom.value), boxPmFrom, (u) => {
      pmFrom.value = u.email;
    });
    renderChips(filterUsers(pmTo.value), boxPmTo, (u) => {
      pmTo.value = u.email;
    });
  }
  [exParticipants, exPayer, pmFrom, pmTo].forEach((inp) => {
    inp.addEventListener("focus", refreshChips);
    inp.addEventListener("input", refreshChips);
  });

  // Users realtime
  const db = getDb();
  onSnapshot(query(collection(db, "users"), orderBy("displayName")), (snap) => {
    USERS = snap.docs
      .map((d) => {
        const v = d.data() || {};
        return {
          displayName: v.displayName || "",
          email: v.email || "",
          photoURL: v.photoURL || "",
        };
      })
      .filter((u) => u.email);
    refreshChips();
  });

  // Submit EXPENSE
  document.getElementById("form-ex").addEventListener("submit", async (e) => {
    e.preventDefault();
    const me = currentUser();
    const amount = +document.getElementById("ex-amount").value;
    if (!amount || amount <= 0) return alert("Số tiền không hợp lệ.");

    const payload = {
      dateISO: new Date(
        document.getElementById("ex-date").value || Date.now()
      ).toISOString(),
      amount,
      note: (document.getElementById("ex-note").value || "").trim(),
      participantsEmails: (exParticipants.value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      payerEmail: (exPayer.value || me?.email || "").trim(),
      createdBy: me?.uid || null,
    };
    try {
      await createExpenseApproved(payload);
      toast(`Đã tạo expense ${money(amount)}₫`);
      document.getElementById("ex-amount").value = "";
      document.getElementById("ex-note").value = "";
      exParticipants.value = "";
      refreshChips();
    } catch (err) {
      console.error(err);
      alert(err.message || "Tạo expense thất bại.");
    }
  });

  // Submit PAYMENT
  document.getElementById("form-pm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const me = currentUser();
    const amount = +document.getElementById("pm-amount").value;
    if (!amount || amount <= 0) return alert("Số tiền không hợp lệ.");

    const payload = {
      dateISO: new Date(
        document.getElementById("pm-date").value || Date.now()
      ).toISOString(),
      amount,
      note: (document.getElementById("pm-note").value || "").trim(),
      fromEmail: (pmFrom.value || "").trim(),
      toEmail: (pmTo.value || "").trim(),
      createdBy: me?.uid || null,
    };
    if (!payload.fromEmail || !payload.toEmail)
      return alert("Chọn người trả/nhận.");
    if (payload.fromEmail.toLowerCase() === payload.toEmail.toLowerCase())
      return alert("Từ và Đến không được trùng.");

    try {
      await createPaymentApproved(payload);
      toast(`Đã tạo payment ${money(amount)}₫`);
      document.getElementById("pm-amount").value = "";
      document.getElementById("pm-note").value = "";
    } catch (err) {
      console.error(err);
      alert(err.message || "Tạo payment thất bại.");
    }
  });

  // Recent EXPENSES
  const tbodyEx = document.getElementById("tb-expenses");
  subscribeRecentExpenses((rows) => {
    if (!rows.length) {
      tbodyEx.innerHTML = `<tr><td colspan="6" class="muted">Chưa có dữ liệu.</td></tr>`;
      return;
    }
    tbodyEx.innerHTML = rows
      .map((r) => {
        const d = new Date(
          r.date || r.createdAt?.toDate?.() || Date.now()
        ).toLocaleString("vi-VN");
        const emails = (r.participantsEmails || []).join(", ");
        return `<tr>
        <td>${d}</td><td>${r.note || ""}</td><td>${money(r.amount || 0)}</td>
        <td>${r.payerEmail || ""}</td><td>${emails}</td>
        <td><button class="btn" data-del-ex="${r.id}">Xoá</button></td>
      </tr>`;
      })
      .join("");
  });
  tbodyEx.addEventListener("click", async (e) => {
    const id = e.target?.dataset?.delEx;
    if (!id) return;
    if (!confirm("Xoá expense này?")) return;
    await deleteExpense(id);
  });

  // Recent PAYMENTS
  const tbodyPm = document.getElementById("tb-payments");
  subscribeRecentPayments((rows) => {
    if (!rows.length) {
      tbodyPm.innerHTML = `<tr><td colspan="5" class="muted">Chưa có dữ liệu.</td></tr>`;
      return;
    }
    tbodyPm.innerHTML = rows
      .map((r) => {
        const d = new Date(
          r.date || r.createdAt?.toDate?.() || Date.now()
        ).toLocaleString("vi-VN");
        return `<tr>
        <td>${d}</td><td>${r.note || ""}</td><td>${money(r.amount || 0)}</td>
        <td>${r.fromEmail || ""} → ${r.toEmail || ""}</td>
        <td><button class="btn" data-del-pm="${r.id}">Xoá</button></td>
      </tr>`;
      })
      .join("");
  });
  tbodyPm.addEventListener("click", async (e) => {
    const id = e.target?.dataset?.delPm;
    if (!id) return;
    if (!confirm("Xoá payment này?")) return;
    await deletePayment(id);
  });
}

// ================================================================
