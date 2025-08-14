// public/js/pages/admin-overview.js
// Admin Overview — tạo Expense/Payment trực tiếp (duyệt ngay), gợi ý chips, realtime list

import { currentUser } from "../auth.js";
import { ADMIN_UID } from "../config.js";
import { money, whenVN } from "../utils/format.js";
import { toast } from "../utils/toast.js";

import { subscribeAllUsers } from "../store/users.js";

import {
  createExpenseApproved,
  subscribeRecentExpenses,
  deleteExpense,
} from "../store/expenses.js";

import {
  createPaymentApproved as createPaymentApprovedFn, // <-- alias để tránh trùng tên
  subscribeRecentPayments,
  deletePayment,
} from "../store/payments.js";

// ====== module state ======
let unsubUsers = null;
let unsubExp = null;
let unsubPay = null;
let allUsers = [];
let emailMap = new Map(); // email(lower) -> user
let onDocClick = null; // để removeEventListener khi stop()

// ====== helpers ======
const fmt = (n) => (Number(n) || 0).toLocaleString("vi-VN");
const prettyName = (email) => {
  if (!email) return "—";
  const u = emailMap.get(String(email).toLowerCase());
  return u?.displayName || email;
};

function rebuildEmailMap() {
  emailMap = new Map();
  (allUsers || []).forEach((u) => {
    const key = (u.email || "").toLowerCase().trim();
    if (key) emailMap.set(key, u);
  });
}

function bindSuggest(inputEl, panelEl) {
  function render() {
    const q = (inputEl.value || "").toLowerCase().trim();
    const list = (allUsers || [])
      .filter(
        (u) =>
          (u.displayName || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q)
      )
      .slice(0, 8);

    if (!q || list.length === 0) {
      panelEl.innerHTML = "";
      panelEl.style.display = "none";
      return;
    }
    panelEl.style.display = "flex";
    panelEl.innerHTML = list
      .map(
        (u) => `
      <button type="button" class="chip" data-email="${u.email || ""}">
        <span class="chip-title">${
          u.displayName || u.email || "Người dùng"
        }</span>
        <span class="chip-sub">${u.email || ""}</span>
      </button>`
      )
      .join("");

    panelEl.querySelectorAll(".chip").forEach((c) => {
      c.addEventListener("click", () => {
        inputEl.value = c.dataset.email || "";
        panelEl.innerHTML = "";
        panelEl.style.display = "none";
        inputEl.focus();
      });
    });
  }

  inputEl.addEventListener("input", render);
  inputEl.addEventListener("focus", render);
  inputEl.addEventListener("blur", () =>
    setTimeout(() => (panelEl.style.display = "none"), 150)
  );

  return () => {
    inputEl.removeEventListener("input", render);
    inputEl.removeEventListener("focus", render);
  };
}

// ====== render ======
export async function render() {
  const me = currentUser();
  if (!me || me.uid !== ADMIN_UID) {
    alert("Chỉ admin mới truy cập được trang này.");
    location.hash = "#/welcome";
    return;
  }

  const root = document.getElementById("app-root");
  const todayISO = new Date().toISOString().slice(0, 10);

  root.innerHTML = `
  <section class="card"><div class="inner">
    <h2>Admin • Tổng quan</h2>
    <p class="muted small" style="margin-top:-6px">
      Tạo <strong>khoản chi</strong> & <strong>thanh toán</strong> trực tiếp (duyệt ngay), không cần request.
    </p>

    <div class="row" style="gap:16px;align-items:flex-start;flex-wrap:wrap;margin-top:8px">
      <!-- EXPENSE FORM -->
      <div style="flex:1 1 380px;min-width:320px">
        <h3 style="margin:0 0 8px">Tạo khoản chi (Expense)</h3>
        <form id="form-exp" class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label>Ngày</label>
            <input id="exp-date" type="date" value="${todayISO}" required>
          </div>
          <div>
            <label>Số tiền (VND)</label>
            <input id="exp-amount" type="number" min="1" required>
          </div>
          <div style="grid-column:1/-1">
            <label>Ghi chú</label>
            <input id="exp-note" type="text" placeholder="vd. Siêu thị, đồ ăn...">
          </div>
          <div style="grid-column:1/-1">
            <label>Những người cùng mua (emails, phẩy)</label>
            <input id="exp-participants" type="text" placeholder="a@gmail.com, b@gmail.com">
          </div>
          <div style="grid-column:1/-1">
            <label>Người trả (email)</label>
            <input id="exp-payer" type="email" placeholder="nếu trống sẽ lấy email của admin">
            <div id="exp-payer-suggest" class="chip-suggest"></div>
          </div>
          <div style="grid-column:1/-1">
            <button class="btn primary" type="submit">Tạo khoản chi</button>
          </div>
        </form>
      </div>

      <!-- PAYMENT FORM -->
      <div style="flex:1 1 380px;min-width:320px">
        <h3 style="margin:0 0 8px">Tạo thanh toán (Payment)</h3>
        <form id="form-pay" class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label>Ngày</label>
            <input id="pay-date" type="date" value="${todayISO}" required>
          </div>
          <div>
            <label>Số tiền (VND)</label>
            <input id="pay-amount" type="number" min="1" required>
          </div>
          <div style="grid-column:1/-1">
            <label>Ghi chú</label>
            <input id="pay-note" type="text" placeholder="vd. chuyển khoản...">
          </div>
          <div>
            <label>Người trả (from)</label>
            <input id="pay-from" type="email" required>
            <div id="pay-from-suggest" class="chip-suggest"></div>
          </div>
          <div>
            <label>Người nhận (to)</label>
            <input id="pay-to" type="email" required>
            <div id="pay-to-suggest" class="chip-suggest"></div>
          </div>
          <div style="grid-column:1/-1">
            <button class="btn primary" type="submit">Tạo thanh toán</button>
          </div>
        </form>
      </div>
    </div>

    <hr style="border-color:rgba(255,255,255,.08);margin:14px 0" />

    <div class="row" style="gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div style="flex:1 1 460px;min-width:340px">
        <h3 style="margin:0 0 8px">Expense gần đây</h3>
        <table class="table table-hover">
          <thead>
            <tr><th>Thời gian</th><th>Ghi chú</th><th>Số tiền</th><th>Người trả</th><th>Người cùng</th><th></th></tr>
          </thead>
          <tbody id="tbody-exp">
            <tr><td colspan="6" class="muted">Đang tải…</td></tr>
          </tbody>
        </table>
      </div>

      <div style="flex:1 1 460px;min-width:340px">
        <h3 style="margin:0 0 8px">Payment gần đây</h3>
        <table class="table table-hover">
          <thead>
            <tr><th>Thời gian</th><th>Ghi chú</th><th>Số tiền</th><th>Từ → Đến</th><th></th></tr>
          </thead>
          <tbody id="tbody-pay">
            <tr><td colspan="5" class="muted">Đang tải…</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div></section>`;

  // ===== users realtime -> chips
  unsubUsers && unsubUsers();
  unsubUsers = subscribeAllUsers((rows) => {
    allUsers = rows || [];
    rebuildEmailMap();
  });

  // bind chips
  bindSuggest(
    document.getElementById("exp-payer"),
    document.getElementById("exp-payer-suggest")
  );
  bindSuggest(
    document.getElementById("pay-from"),
    document.getElementById("pay-from-suggest")
  );
  bindSuggest(
    document.getElementById("pay-to"),
    document.getElementById("pay-to-suggest")
  );

  // ===== submit EXPENSE
  document.getElementById("form-exp").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const meNow = currentUser(); // phòng khi auth đổi
      const dateISO = new Date(
        document.getElementById("exp-date").value
      ).toISOString();
      const amount = Number(document.getElementById("exp-amount").value || 0);
      const note = (document.getElementById("exp-note").value || "").trim();
      const participants = (
        document.getElementById("exp-participants").value || ""
      )
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const payer = (
        document.getElementById("exp-payer").value ||
        meNow?.email ||
        ""
      ).trim();

      if (!amount || amount <= 0) return alert("Số tiền không hợp lệ.");

      await createExpenseApproved({
        dateISO,
        amount,
        note,
        participantsEmails: participants,
        payerEmail: payer,
        createdBy: meNow?.uid || null,
      });
      toast(`Đã tạo expense ${money(amount)}₫`);
      e.target.reset();
      document.getElementById("exp-date").value = todayISO;
    } catch (err) {
      console.error(err);
      alert("Không tạo được Expense: " + (err?.message || "Lỗi không rõ"));
    }
  });

  // ===== submit PAYMENT
  document.getElementById("form-pay").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const meNow = currentUser();
      const dateISO = new Date(
        document.getElementById("pay-date").value
      ).toISOString();
      const amount = Number(document.getElementById("pay-amount").value || 0);
      const note = (document.getElementById("pay-note").value || "").trim();
      const from = (document.getElementById("pay-from").value || "").trim();
      const to = (document.getElementById("pay-to").value || "").trim();
      if (!amount || amount <= 0) return alert("Số tiền không hợp lệ.");
      if (!from || !to) return alert("Cần nhập đủ from/to.");
      if (from.toLowerCase() === to.toLowerCase())
        return alert("From và To không thể là cùng một người.");

      await createPaymentApprovedFn({
        // dùng alias
        dateISO,
        amount,
        note,
        fromEmail: from,
        toEmail: to,
        createdBy: meNow?.uid || null,
      });
      toast(`Đã tạo payment ${money(amount)}₫`);
      e.target.reset();
      document.getElementById("pay-date").value = todayISO;
    } catch (err) {
      console.error(err);
      alert("Không tạo được Payment: " + (err?.message || "Lỗi không rõ"));
    }
  });

  // ===== realtime lists
  unsubExp && unsubExp();
  unsubPay && unsubPay();

  unsubExp = subscribeRecentExpenses((rows) => {
    const tb = document.getElementById("tbody-exp");
    if (!rows || rows.length === 0) {
      tb.innerHTML = `<tr><td colspan="6" class="muted">Chưa có dữ liệu.</td></tr>`;
      return;
    }
    tb.innerHTML = rows
      .map((r) => {
        const participants = (r.participantsEmails || [])
          .map(prettyName)
          .join(", ");
        return `
        <tr>
          <td class="small muted">${whenVN(r.date)}</td>
          <td class="small">${r.note || ""}</td>
          <td>${fmt(r.amount)}</td>
          <td class="small">${prettyName(r.payerEmail)}</td>
          <td class="small">${participants}</td>
          <td><button class="btn" data-del-exp="${r.id}">Xoá</button></td>
        </tr>`;
      })
      .join("");
  });

  unsubPay = subscribeRecentPayments((rows) => {
    const tb = document.getElementById("tbody-pay");
    if (!rows || rows.length === 0) {
      tb.innerHTML = `<tr><td colspan="5" class="muted">Chưa có dữ liệu.</td></tr>`;
      return;
    }
    tb.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td class="small muted">${whenVN(r.date)}</td>
        <td class="small">${r.note || ""}</td>
        <td>${fmt(r.amount)}</td>
        <td class="small">${prettyName(r.fromEmail)} → ${prettyName(
          r.toEmail
        )}</td>
        <td><button class="btn" data-del-pay="${r.id}">Xoá</button></td>
      </tr>`
      )
      .join("");
  });

  // ===== delete handlers (gắn 1 lần / trang)
  onDocClick = async (e) => {
    const b1 = e.target.closest("[data-del-exp]");
    const b2 = e.target.closest("[data-del-pay]");
    try {
      if (b1) {
        if (confirm("Xoá expense này?"))
          await deleteExpense(b1.getAttribute("data-del-exp"));
      }
      if (b2) {
        if (confirm("Xoá payment này?"))
          await deletePayment(b2.getAttribute("data-del-pay"));
      }
    } catch (err) {
      console.error(err);
      alert("Không xoá được: " + (err?.message || "Lỗi không rõ"));
    }
  };
  document.addEventListener("click", onDocClick);
}

// ====== stop (cleanup) ======
export function stop() {
  unsubUsers && unsubUsers();
  unsubExp && unsubExp();
  unsubPay && unsubPay();
  unsubUsers = unsubExp = unsubPay = null;

  if (onDocClick) {
    document.removeEventListener("click", onDocClick);
    onDocClick = null;
  }
}
