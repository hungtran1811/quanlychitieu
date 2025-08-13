import { currentUser } from "../auth.js";
import { getExpensesAsPayer, getExpensesWithMe } from "../store/expenses.js";
import { buildLedger } from "../utils/calc.js";
import { money } from "../utils/format.js";

export async function render() {
  const u = currentUser();
  if (!u) return alert("Bạn cần đăng nhập.");
  const root = document.getElementById("app-root");

  root.innerHTML = `
    <section class="card"><div class="inner">
      <h2>Dashboard của tôi</h2>
      <p class="muted">Tổng hợp nợ ròng từ các khoản chi đã <b>được duyệt</b> (collection <code>expenses</code>).</p>
      <div id="dash-wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:10px">
        <div>
          <h3 style="margin:0 0 8px">Bạn nợ</h3>
          <table class="table"><tbody id="tbl-iowe"><tr><td class="muted">Đang tải…</td></tr></tbody></table>
        </div>
        <div>
          <h3 style="margin:0 0 8px">Người khác nợ bạn</h3>
          <table class="table"><tbody id="tbl-oweme"><tr><td class="muted">Đang tải…</td></tr></tbody></table>
        </div>
      </div>
    </div></section>
  `;

  try {
    const [asPayer, withMe] = await Promise.all([
      getExpensesAsPayer(u.email),
      getExpensesWithMe(u.email),
    ]);
    const { iOwe, theyOweMe } = buildLedger(u.email, asPayer, withMe);

    const r1 = document.getElementById("tbl-iowe");
    const r2 = document.getElementById("tbl-oweme");

    r1.innerHTML = iOwe.length
      ? iOwe
          .map(
            (x) =>
              `<tr><td>${x.email}</td><td style="text-align:right">${money(
                x.total
              )}</td></tr>`
          )
          .join("")
      : `<tr><td class="muted">Không nợ ai.</td></tr>`;

    r2.innerHTML = theyOweMe.length
      ? theyOweMe
          .map(
            (x) =>
              `<tr><td>${x.email}</td><td style="text-align:right">${money(
                x.total
              )}</td></tr>`
          )
          .join("")
      : `<tr><td class="muted">Chưa ai nợ bạn.</td></tr>`;
  } catch (e) {
    console.error(e);
    document.getElementById(
      "tbl-iowe"
    ).innerHTML = `<tr><td class="muted">Lỗi tải dữ liệu.</td></tr>`;
    document.getElementById(
      "tbl-oweme"
    ).innerHTML = `<tr><td class="muted">Lỗi tải dữ liệu.</td></tr>`;
  }
}
