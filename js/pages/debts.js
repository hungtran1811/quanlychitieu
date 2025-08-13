import { currentUser } from "../auth.js";
import { subscribeDebtsForUser } from "../store/ledger.js";
import { subscribeUsersMap } from "../store/users.js";
import { money, whenVN } from "../utils/format.js";

let unDebts = null,
  unUsers = null;

export async function render() {
  const u = currentUser();
  if (!u?.email) {
    alert("Bạn cần đăng nhập.");
    location.hash = "#/welcome";
    return;
  }

  const root = document.getElementById("app-root");
  root.innerHTML = `
  <section class="card"><div class="inner">
    <h2>Bảng nợ</h2>

    <div class="filters">
      <select id="f-range" class="select">
        <option value="all">Tất cả thời gian</option>
        <option value="30">30 ngày gần đây</option>
        <option value="month">Tháng này</option>
      </select>
      <select id="f-person" class="select"><option value="all">Tất cả người</option></select>
    </div>

    <div class="stats3">
      <div class="stat"><div class="label">Bạn nợ</div><div id="s-you" class="val">0</div></div>
      <div class="stat"><div class="label">Người khác nợ bạn</div><div id="s-they" class="val">0</div></div>
      <div class="stat"><div class="label">Chênh lệch ròng</div><div id="s-net" class="val accent">0</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div><h3>Bạn nợ</h3><div id="list-you" class="list"></div></div>
      <div><h3>Người khác nợ bạn</h3><div id="list-they" class="list"></div></div>
    </div>

    <div class="muted small" style="margin-top:10px">Cập nhật lúc <span id="last">—</span></div>
  </div></section>`;

  const $ = (id) => document.getElementById(id);
  const sYou = $("s-you"),
    sThey = $("s-they"),
    sNet = $("s-net"),
    last = $("last");
  const listYou = $("list-you"),
    listThey = $("list-they");
  const fRange = $("f-range"),
    fPerson = $("f-person");

  // user map
  let users = { byEmail: new Map(), byUid: new Map() };
  if (unUsers) unUsers();
  unUsers = subscribeUsersMap((x) => {
    users = x;
  });

  const nameOf = (email) =>
    users.byEmail.get(String(email || "").toLowerCase())?.name ||
    email?.split("@")[0] ||
    email ||
    "—";
  const photoOf = (email) =>
    users.byEmail.get(String(email || "").toLowerCase())?.photoURL || "";

  // helper renderers
  const renderDetails = (list) => {
    if (!list?.length)
      return `<div class="muted small">Không có chi tiết.</div>`;
    return `<table class="table small"><thead><tr><th>Thời gian</th><th>Loại</th><th>Ghi chú</th><th>Ảnh hưởng</th><th>Số tiền</th></tr></thead><tbody>${list
      .map((d) => {
        const sign = d.amount < 0 ? "-" : "+";
        const type = d.kind === "payment" ? "Thanh toán" : "Khoản chi";
        const eff = d.dir === "you->them" ? "Bạn → Họ" : "Họ → Bạn";
        const when = d.date ? whenVN(d.date) : "—";
        return `<tr><td>${when}</td><td>${type}</td><td class="small">${
          d.note || ""
        }</td><td class="small">${eff}</td><td>${sign} ${money(
          Math.abs(d.amount)
        )}</td></tr>`;
      })
      .join("")}</tbody></table>`;
  };

  const drawBlock = (email, total, details, side, idx) => {
    const nm = nameOf(email),
      photo = photoOf(email),
      id = `${side}-${idx}`;
    const payBtn =
      side === "you"
        ? `<button class="btn" data-pay="${email}" title="Thanh toán người này">Thanh toán người này</button>`
        : "";
    return `<div class="acc" data-acc="${id}">
      <button class="acc-hd" data-toggle="${id}">
        <img class="avatar sm" src="${
          photo ||
          "data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2228%22 height=%2228%22><rect width=%2228%22 height=%2228%22 rx=%2214%22 fill=%22%23666%22/></svg>"
        }">
        <div class="grow"><div class="nm">${nm}</div><div class="sub muted">${email}</div></div>
        <div class="amt">${money(total)}</div><div class="chev">▾</div>
      </button>
      <div class="acc-bd hidden" id="bd-${id}">
        <div class="row" style="justify-content:space-between;align-items:center;margin:6px 0">${payBtn}<span class="muted small">Tổng: <b>${money(
      total
    )}</b></span></div>
        ${renderDetails(details)}
      </div>
    </div>`;
  };

  // event: toggle + pay link
  root.addEventListener("click", (e) => {
    const t1 = e.target.closest("[data-toggle]");
    if (t1) {
      const id = t1.getAttribute("data-toggle");
      document.getElementById(`bd-${id}`)?.classList.toggle("hidden");
      t1.querySelector(".chev")?.classList.toggle("rot");
    }
    const t2 = e.target.closest("[data-pay]");
    if (t2) {
      const to = t2.getAttribute("data-pay");
      location.hash = `#/pay-debt?to=${encodeURIComponent(to)}`;
    }
  });

  // subscribe debts with range filter (client side)
  const rangeToOpts = () => {
    const v = fRange.value;
    if (v === "all") return {};
    if (v === "30") return { start: new Date(Date.now() - 30 * 864e5) };
    if (v === "month") {
      const d = new Date();
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      return { start };
    }
    return {};
  };

  const renderData = (data) => {
    last.textContent = whenVN(data.at);
    sYou.textContent = money(data.totals.youOwe);
    sThey.textContent = money(data.totals.theyOwe);
    sNet.textContent = money(data.totals.net);

    // build select persons
    const emails = Array.from(data.byPerson.keys());
    fPerson.innerHTML =
      `<option value="all">Tất cả người</option>` +
      emails.map((e) => `<option value="${e}">${nameOf(e)}</option>`).join("");

    const entries = Array.from(data.byPerson.entries());
    const sel = fPerson.value;
    const filtered =
      sel === "all" ? entries : entries.filter(([email]) => email === sel);

    const youRows = filtered
      .filter(([_, v]) => v.youOwe > 0)
      .sort((a, b) => b[1].youOwe - a[1].youOwe);
    const theyRows = filtered
      .filter(([_, v]) => v.theyOwe > 0)
      .sort((a, b) => b[1].theyOwe - a[1].theyOwe);

    listYou.innerHTML = youRows.length
      ? youRows
          .map(([email, v], i) =>
            drawBlock(email, v.youOwe, v.detailsYou, "you", i)
          )
          .join("")
      : `<div class="muted">Không nợ ai.</div>`;
    listThey.innerHTML = theyRows.length
      ? theyRows
          .map(([email, v], i) =>
            drawBlock(email, v.theyOwe, v.detailsThey, "they", i)
          )
          .join("")
      : `<div class="muted">Không ai nợ bạn.</div>`;
  };

  let stop;
  const resub = () => {
    if (stop) stop();
    stop = subscribeDebtsForUser(u.email, renderData, rangeToOpts());
  };
  resub();

  fRange.addEventListener("change", resub);
  fPerson.addEventListener("change", () => {
    /* re-render will occur on next snapshot; quick client refresh: */
  });
}

export function stopDebtsRealtime() {
  /* handled in subscribeDebtsForUser return already */
}
