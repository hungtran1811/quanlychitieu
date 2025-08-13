import { subscribeAllUsers } from "../store/users.js";
import { listExpensesByMonth } from "../store/expenses.js";
import { listPaymentsByMonth } from "../store/payments.js";
import { money, whenVN } from "../utils/format.js";

let unsub = null;

export async function render() {
  const root = document.getElementById("app-root");
  root.innerHTML = `
  <section id="page-users" class="card">
    <div class="inner">
      <h2>Thành viên</h2>
      <p class="muted small" style="margin:-4px 0 10px">Danh bạ realtime các tài khoản đã đăng nhập.</p>
      <div id="user-grid" class="user-grid">
        <div class="muted">Đang tải…</div>
      </div>
    </div>
  </section>`;

  const grid = document.getElementById("user-grid");
  if (unsub) unsub();
  unsub = subscribeAllUsers((arr) => {
    if (!arr.length) {
      grid.innerHTML = `<div class="muted">Chưa có người dùng.</div>`;
      return;
    }
    grid.innerHTML = arr
      .map(
        (u) => `
      <button class="user-card" data-uid="${u.uid}" data-email="${
          u.email || ""
        }">
        <img class="avatar-lg" src="${
          u.photoURL || ""
        }" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22><rect rx=%2224%22 width=%2248%22 height=%2248%22 fill=%22%23666%22/></svg>'" alt="">
        <div class="user-info">
          <div class="user-name">${u.name || "(không tên)"}</div>
          <div class="user-email">${u.email || "—"}</div>
        </div>
        <span class="chev">›</span>
      </button>
    `
      )
      .join("");
  });

  // mở quick preview người dùng (tháng hiện tại)
  grid.addEventListener("click", async (e) => {
    const card = e.target.closest(".user-card");
    if (!card) return;
    await previewUser(
      card.querySelector(".user-name")?.textContent || "",
      card.dataset.email || ""
    );
  });
}

async function previewUser(name, email) {
  const root = document.getElementById("app-root");
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const [expenses, payments] = await Promise.all([
    listExpensesByMonth(y, m),
    listPaymentsByMonth(y, m),
  ]);

  // các giao dịch trong tháng có liên quan tới user này
  const rows = [
    ...expenses
      .filter(
        (x) =>
          x.payerEmail === email || (x.participantsEmails || []).includes(email)
      )
      .map((x) => ({
        kind: "expense",
        when: x.date,
        note: x.note || "",
        amount: +x.amount || 0,
        role: x.payerEmail === email ? "Người trả" : "Người cùng chi",
      })),
    ...payments
      .filter((p) => p.fromEmail === email || p.toEmail === email)
      .map((p) => ({
        kind: "payment",
        when: p.date,
        note: p.note || "",
        amount: +p.amount || 0,
        role: p.fromEmail === email ? "Đã trả" : "Đã nhận",
      })),
  ]
    .sort((a, b) => new Date(b.when) - new Date(a.when))
    .slice(0, 10);

  const totalE = rows
    .filter((r) => r.kind === "expense")
    .reduce((s, x) => s + x.amount, 0);
  const totalP = rows
    .filter((r) => r.kind === "payment")
    .reduce((s, x) => s + x.amount, 0);

  root.innerHTML = `
  <section id="page-users" class="card">
    <div class="inner">
      <div class="row" style="justify-content:space-between;align-items:center">
        <h2>${name}</h2>
        <button class="btn" id="back-users">← Quay lại</button>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="label">Expense (tháng này)</div>
          <div class="value">${money(totalE)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Payment (tháng này)</div>
          <div class="value">${money(totalP)}</div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table table-hover sticky">
          <thead><tr>
            <th>Thời gian</th><th>Loại</th><th>Chi tiết</th><th>Số tiền</th><th>Vai trò</th>
          </tr></thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (r) => `
              <tr>
                <td>${whenVN(r.when)}</td>
                <td><span class="pill ${
                  r.kind === "payment" ? "pill-pay" : "pill-exp"
                }">${r.kind}</span></td>
                <td class="small">${r.note}</td>
                <td>${money(r.amount)}</td>
                <td class="small">${r.role}</td>
              </tr>
            `
                    )
                    .join("")
                : `<tr><td colspan="5" class="muted">Chưa có giao dịch liên quan.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  </section>`;

  document.getElementById("back-users").addEventListener("click", render);
}

export function stopUsersRealtime() {
  if (unsub) unsub();
  unsub = null;
}
