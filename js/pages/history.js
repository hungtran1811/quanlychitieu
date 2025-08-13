import { currentUser } from "../auth.js";
import { listExpensesByMonth } from "../store/expenses.js";
import { listPaymentsByMonth } from "../store/payments.js";
import { subscribeUsersMap } from "../store/users.js";
import { money, whenVN } from "../utils/format.js";

let users = { byEmail: new Map(), byUid: new Map() };

export async function render() {
  const me = currentUser();
  if (!me) {
    alert("Bạn cần đăng nhập.");
    location.hash = "#/welcome";
    return;
  }

  const ym = toMonthInput(new Date());
  const root = document.getElementById("app-root");
  root.innerHTML = `
  <section id="page-history" class="card">
    <div class="inner">
      <h2>Lịch sử</h2>

      <div class="filter-bar">
        <div class="field">
          <label>Tháng</label>
          <input id="f-month" type="month" value="${ym}">
        </div>
        <div class="field">
          <label>Loại</label>
          <select id="f-type">
            <option value="all">Tất cả</option>
            <option value="expense">Expense</option>
            <option value="payment">Payment</option>
          </select>
        </div>
        <button id="btn-load" class="btn">Lọc</button>
        <button id="btn-csv" class="btn">Xuất CSV</button>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="label">Tổng expense</div>
          <div class="value" id="sum-expense">0</div>
        </div>
        <div class="stat-card">
          <div class="label">Tổng payment</div>
          <div class="value" id="sum-payment">0</div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table table-hover sticky">
          <thead>
            <tr>
              <th>Thời gian</th><th>Loại</th><th>Chi tiết</th><th>Số tiền</th><th>Đối tác</th>
            </tr>
          </thead>
          <tbody id="tbody"><tr><td colspan="5" class="muted">Đang tải…</td></tr></tbody>
        </table>
      </div>
    </div>
  </section>`;

  subscribeUsersMap((x) => {
    users = x;
  });

  document.getElementById("btn-load").addEventListener("click", load);
  document.getElementById("btn-csv").addEventListener("click", exportCSV);
  await load();

  async function load() {
    const monthVal = document.getElementById("f-month").value || ym;
    const [yy, mm] = monthVal.split("-").map((n) => +n);
    const type = document.getElementById("f-type").value;

    let expenses = [],
      payments = [];
    if (type === "all" || type === "expense")
      expenses = await listExpensesByMonth(yy, mm);
    if (type === "all" || type === "payment")
      payments = await listPaymentsByMonth(yy, mm);

    const rows = [
      ...expenses.map((e) => ({
        kind: "expense",
        when: e.date,
        note: e.note || "",
        amount: +e.amount || 0,
        partner: `Trả: ${nameOf(e.payerEmail)} • Cùng: ${(
          e.participantsEmails || []
        )
          .map(nameOf)
          .join(", ")}`,
      })),
      ...payments.map((p) => ({
        kind: "payment",
        when: p.date,
        note: p.note || "",
        amount: +p.amount || 0,
        partner: `${nameOf(p.fromEmail)} → ${nameOf(p.toEmail)}`,
      })),
    ].sort((a, b) => new Date(b.when) - new Date(a.when));

    const tb = document.getElementById("tbody");
    if (!rows.length) {
      tb.innerHTML = `<tr><td colspan="5" class="muted">Không có dữ liệu.</td></tr>`;
    } else {
      tb.innerHTML = rows
        .map(
          (r) => `
        <tr>
          <td>${whenVN(r.when)}</td>
          <td><span class="pill ${
            r.kind === "payment" ? "pill-pay" : "pill-exp"
          }">${r.kind}</span></td>
          <td class="small">${r.note}</td>
          <td>${money(r.amount)}</td>
          <td class="small">${r.partner}</td>
        </tr>
      `
        )
        .join("");
    }
    document.getElementById("sum-expense").textContent = money(
      expenses.reduce((s, x) => s + (+x.amount || 0), 0)
    );
    document.getElementById("sum-payment").textContent = money(
      payments.reduce((s, x) => s + (+x.amount || 0), 0)
    );

    // cache CSV
    window.__historyRows = rows;
  }

  function exportCSV() {
    const rows = window.__historyRows || [];
    if (!rows.length) return alert("Không có dữ liệu để xuất.");
    const header = ["time", "type", "note", "amount", "partner"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          new Date(r.when).toISOString(),
          r.kind,
          csvSafe(r.note),
          r.amount,
          csvSafe(r.partner),
        ].join(",")
      );
    }
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `history_${
      document.getElementById("f-month").value || ym
    }.csv`;
    a.click();
  }

  function nameOf(email) {
    if (!email) return "—";
    const rec = users.byEmail.get(String(email).toLowerCase());
    return rec?.name || email;
  }
}

function toMonthInput(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function csvSafe(s) {
  return `"${String(s || "").replace(/\"/g, '""')}"`;
}
