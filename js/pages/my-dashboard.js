import { currentUser } from "../auth.js";
import {
  subscribeExpensesAsPayer,
  subscribeExpensesWithMe,
} from "../store/expenses.js";
import { subscribePaymentsOfMe } from "../store/payments.js";
import { buildLedger, applyPayments, sumLedger } from "../utils/calc.js";
import { money } from "../utils/format.js";

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
    <h2 style="margin:0 0 8px">Bảng nợ</h2>
    <div class="row" style="gap:12px;flex-wrap:wrap">
      <div class="card" style="padding:12px 16px;border-radius:14px"><div class="muted small">Bạn nợ</div><div id="stat-iowe" style="font-size:20px;font-weight:700">—</div></div>
      <div class="card" style="padding:12px 16px;border-radius:14px"><div class="muted small">Người khác nợ bạn</div><div id="stat-oweme" style="font-size:20px;font-weight:700">—</div></div>
      <div class="card" style="padding:12px 16px;border-radius:14px"><div class="muted small">Chênh lệch ròng</div><div id="stat-net" style="font-size:20px;font-weight:700">—</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px">
      <div><h3 style="margin:0 0 8px">Bạn nợ</h3><table class="table"><tbody id="tbl-iowe"><tr><td class="muted">Đang tải…</td></tr></tbody></table></div>
      <div><h3 style="margin:0 0 8px">Người khác nợ bạn</h3><table class="table"><tbody id="tbl-oweme"><tr><td class="muted">Đang tải…</td></tr></tbody></table></div>
    </div>
    <div class="muted small" id="stamp" style="margin-top:8px"></div>
  </div></section>`;

  let asPayer = [],
    withMe = [],
    payOut = [],
    payIn = [];
  const recompute = () => {
    if (t !== token) return;
    const base = buildLedger(u.email, asPayer, withMe);
    const applied = applyPayments(base, payOut, payIn);
    const sums = sumLedger(applied);
    const r1 = document.getElementById("tbl-iowe"),
      r2 = document.getElementById("tbl-oweme");
    const s1 = document.getElementById("stat-iowe"),
      s2 = document.getElementById("stat-oweme"),
      sn = document.getElementById("stat-net");
    const st = document.getElementById("stamp");
    if (!r1 || !r2 || !s1 || !s2 || !sn) return;

    r1.innerHTML = applied.iOwe.length
      ? applied.iOwe
          .map(
            (x) =>
              `<tr><td>${x.email}</td><td style="text-align:right">${money(
                x.total
              )}</td></tr>`
          )
          .join("")
      : `<tr><td class="muted">Không nợ ai.</td></tr>`;
    r2.innerHTML = applied.theyOweMe.length
      ? applied.theyOweMe
          .map(
            (x) =>
              `<tr><td>${x.email}</td><td style="text-align:right">${money(
                x.total
              )}</td></tr>`
          )
          .join("")
      : `<tr><td class="muted">Chưa ai nợ bạn.</td></tr>`;

    s1.textContent = money(sums.tongBanNo);
    s2.textContent = money(sums.tongNguoiNoBan);
    sn.textContent = money(sums.net);
    sn.style.color = sums.net >= 0 ? "#00c2a8" : "#ff8e6e";
    if (st)
      st.textContent =
        "Đã cập nhật lúc " + new Date().toLocaleTimeString("vi-VN");
  };

  unsub.push(
    subscribeExpensesAsPayer(u.email, (rows) => {
      asPayer = rows;
      recompute();
    })
  );
  unsub.push(
    subscribeExpensesWithMe(u.email, (rows) => {
      withMe = rows;
      recompute();
    })
  );
  unsub.push(
    subscribePaymentsOfMe(u.email, ({ out, in: inc }) => {
      payOut = out;
      payIn = inc;
      recompute();
    })
  );
}

export function stopDashboardRealtime() {
  unsub.forEach((f) => f());
  unsub = [];
}
