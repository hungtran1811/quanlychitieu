import { currentUser } from "../auth.js";
import { subscribeExpensesWithMe } from "../store/expenses.js";
import { createPaymentRequest } from "../store/requests.js";
import { splitEqual, normalizeGroup } from "../utils/calc.js";
import { money, whenVN } from "../utils/format.js";

let unsub = [];
let token = 0;

export async function render() {
  const u = currentUser();
  if (!u) {
    alert("Bạn cần đăng nhập.");
    location.hash = "#/welcome";
    return;
  }
  const root = document.getElementById("app-root");
  if (!root) return;
  unsub.forEach((fn) => fn());
  unsub = [];
  const t = ++token;

  root.innerHTML = `
  <section class="card"><div class="inner">
    <h2 style="margin:0 0 8px">Thanh toán nợ</h2>
    <p class="muted" style="margin:0 0 10px">Chọn người bạn đang nợ, tick các khoản muốn thanh toán (admin duyệt). Số tiền tự cộng theo các khoản đã chọn.</p>

    <div class="pay-toolbar">
      <div class="combo">
        <label class="muted small" for="creditor-input">Người nhận</label>
        <input id="creditor-input" class="combo-input" type="text" placeholder="Nhập email để tìm…" autocomplete="off"/>
        <div id="creditor-list" class="combo-list hidden"></div>
      </div>

      <div>
        <label class="muted small">Số tiền</label>
        <div id="amount-pill" class="amount-pill">0 ₫</div>
      </div>

      <div class="grow">
        <label class="muted small" for="pay-note">Ghi chú (tuỳ chọn)</label>
        <input id="pay-note" type="text" placeholder="Ví dụ: chuyển khoản"/>
      </div>

      <div class="align-end">
        <button id="btn-submit" class="btn primary" disabled>Gửi yêu cầu</button>
      </div>
    </div>

    <div id="hint" class="muted small" style="margin-top:6px">Chọn người nhận để hiện các khoản đang nợ và tick khoản muốn thanh toán.</div>

    <h3 style="margin:14px 0 8px">Các khoản bạn nợ</h3>
    <div id="debt-list" class="debt-list"><div class="debt-empty">Đang tải…</div></div>
  </div></section>`;

  // handles
  const $ = (id) => document.getElementById(id);
  const input = $("creditor-input"),
    list = $("creditor-list"),
    pill = $("amount-pill"),
    note = $("pay-note"),
    btn = $("btn-submit"),
    debtList = $("debt-list"),
    hint = $("hint");

  // state
  let withMe = [],
    itemsAll = []; // expenses với tôi (payer != tôi) -> item nợ đơn lẻ
  let creditors = []; // [{email,total}]
  let selectedCreditor = ""; // email đang chọn
  let selectedIds = new Set(); // tập id khoản được tick
  let currentSum = 0;

  // utilities
  const show = (el) => el.classList.remove("hidden");
  const hide = (el) => el.classList.add("hidden");
  const updatePill = (n) => {
    pill.textContent = money(n) + " ₫";
    btn.disabled = !(selectedCreditor && n > 0);
  };

  function computeDebtItems() {
    // Từ expensesWithMe -> list các khoản tôi nợ từng expense, mỗi dòng = share của tôi
    const me = (u.email || "").toLowerCase();
    const out = [];
    for (const e of withMe) {
      const payer = (e.payerEmail || "").toLowerCase();
      if (!payer || payer === me) continue;
      const group = normalizeGroup(
        e.participantsEmails || e.participantEmails || [],
        payer
      );
      const { share } = splitEqual(+e.amount || 0, group.length);
      out.push({
        id: e.id, // id expense
        payerEmail: payer,
        date: e.date || e.createdAt?.toDate?.() || new Date().toISOString(),
        note: e.note || e.payload?.note || "",
        total: +e.amount || 0,
        myShare: share,
      });
    }
    itemsAll = out;
    // creditors for combobox
    const map = new Map();
    for (const it of out)
      map.set(it.payerEmail, (map.get(it.payerEmail) || 0) + it.myShare);
    creditors = Array.from(map, ([email, total]) => ({ email, total })).sort(
      (a, b) => b.total - a.total
    );
  }

  // render combobox list
  function renderList(filter = "") {
    const q = (filter || "").trim().toLowerCase();
    const items = creditors
      .filter((c) => !q || c.email.includes(q))
      .slice(0, 12);
    list.innerHTML = items.length
      ? items
          .map(
            (c) =>
              `<div class="combo-item" data-email="${
                c.email
              }"><span class="avatar-dot"></span><div>${
                c.email
              }</div><div class="meta">${money(c.total)}</div></div>`
          )
          .join("")
      : `<div class="combo-empty">Không tìm thấy</div>`;
    show(list);
  }
  function pickCreditor(email) {
    selectedCreditor = email;
    input.value = email || "";
    hide(list);
    note.value = "";
    selectedIds.clear();
    currentSum = 0;
    updatePill(currentSum);
    renderDebtsForCreditor();
  }

  // render debts list (checkbox)
  function renderDebtsForCreditor() {
    if (!selectedCreditor) {
      debtList.innerHTML = `<div class="debt-empty">Chưa chọn người nhận.</div>`;
      hint.textContent = "Chọn người nhận để hiện các khoản nợ.";
      return;
    }
    const rows = itemsAll.filter((x) => x.payerEmail === selectedCreditor);
    if (!rows.length) {
      debtList.innerHTML = `<div class="debt-empty">Không có khoản nợ nào với ${selectedCreditor}.</div>`;
      hint.textContent = "";
      return;
    }
    hint.textContent = `Bạn đang nợ ${selectedCreditor} tổng ${money(
      rows.reduce((s, x) => s + x.myShare, 0)
    )} (chọn khoản để thanh toán).`;
    debtList.innerHTML = rows
      .map(
        (x) => `
      <label class="debt-row">
        <input type="checkbox" class="chk" data-id="${x.id}" data-amt="${
          x.myShare
        }"/>
        <div>
          <div class="debt-note">${x.note || "(Không ghi chú)"}</div>
          <div class="debt-meta">${whenVN(new Date(x.date))} • Tổng ${money(
          x.total
        )} • Phần bạn ${money(x.myShare)}</div>
        </div>
        <div class="debt-share">${money(x.myShare)} ₫</div>
      </label>
    `
      )
      .join("");

    // attach change listener
    debtList.querySelectorAll(".chk").forEach((ch) => {
      ch.addEventListener("change", () => {
        const val = +ch.dataset.amt || 0;
        if (ch.checked) {
          selectedIds.add(ch.dataset.id);
          currentSum += val;
        } else {
          selectedIds.delete(ch.dataset.id);
          currentSum -= val;
        }
        if (currentSum < 0) currentSum = 0;
        updatePill(currentSum);
      });
    });
  }

  // combobox events
  input.addEventListener("focus", () => renderList(input.value));
  input.addEventListener("input", () => renderList(input.value));
  list.addEventListener("click", (e) => {
    const item = e.target.closest(".combo-item");
    if (!item) return;
    pickCreditor(item.dataset.email);
  });
  document.addEventListener(
    "click",
    (e) => {
      if (!e.target.closest(".combo")) hide(list);
    },
    { capture: true }
  );

  // subscribe realtime only expenses with me
  unsub.push(
    subscribeExpensesWithMe(u.email, (rows) => {
      if (t !== token) return;
      withMe = rows;
      computeDebtItems();
      // refresh UI base on current creditor
      renderList(input.value);
      renderDebtsForCreditor();
    })
  );

  // submit
  btn.addEventListener("click", async () => {
    if (!selectedCreditor) return alert("Hãy chọn người nhận.");
    if (!selectedIds.size)
      return alert("Hãy tick ít nhất một khoản để thanh toán.");

    try {
      await createPaymentRequest({
        uid: u.uid,
        payload: {
          fromEmail: u.email,
          toEmail: selectedCreditor,
          amount: currentSum,
          note: (note.value || "").trim(),
          items: Array.from(selectedIds), // danh sách expenseId đã tick
        },
      });
      alert("Đã gửi yêu cầu thanh toán.");
      selectedIds.clear();
      currentSum = 0;
      updatePill(0);
      // giữ nguyên creditor, chỉ bỏ chọn mọi checkbox
      debtList.querySelectorAll(".chk").forEach((ch) => (ch.checked = false));
    } catch (e) {
      console.error(e);
      alert("Gửi yêu cầu thất bại: " + (e?.message || "Unknown"));
    }
  });
}

export function stopPayRealtime() {
  unsub.forEach((fn) => fn());
  unsub = [];
}
