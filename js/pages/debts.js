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

    <div class="stats3" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:10px 0 14px">
      <div class="stat"><div class="label">Bạn nợ</div><div id="s-you" class="val">0</div></div>
      <div class="stat"><div class="label">Người khác nợ bạn</div><div id="s-they" class="val">0</div></div>
      <div class="stat"><div class="label">Chênh lệch ròng</div><div id="s-net" class="val accent">0</div></div>
    </div>

    <div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <h3 style="margin:0 0 6px">Bạn nợ</h3>
        <div id="list-you" class="list"></div>
      </div>
      <div>
        <h3 style="margin:0 0 6px">Người khác nợ bạn</h3>
        <div id="list-they" class="list"></div>
      </div>
    </div>

    <div class="muted small" style="margin-top:10px">Đã cập nhật lúc <span id="last-upd">—</span></div>
  </div></section>`;

  const $ = (id) => document.getElementById(id);
  const sYou = $("s-you"),
    sThey = $("s-they"),
    sNet = $("s-net"),
    lastUpd = $("last-upd");
  const listYou = $("list-you"),
    listThey = $("list-they");

  let users = { byUid: new Map(), byEmail: new Map() };
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

  function renderDetails(details) {
    if (!details?.length)
      return `<div class="muted small">Không có chi tiết.</div>`;
    return `
      <table class="table small">
        <thead><tr><th>Thời gian</th><th>Loại</th><th>Ghi chú</th><th>Ảnh hưởng</th><th>Số tiền</th></tr></thead>
        <tbody>
          ${details
            .map((d) => {
              const sign = d.amount < 0 ? "-" : "+";
              const type = d.kind === "payment" ? "Thanh toán" : "Khoản chi";
              const when = d.date ? whenVN(d.date) : "—";
              const effect = d.dir === "you->them" ? "Bạn → Họ" : "Họ → Bạn";
              return `<tr>
              <td>${when}</td>
              <td>${type}</td>
              <td class="small">${d.note || ""}</td>
              <td class="small">${effect}</td>
              <td>${sign} ${money(Math.abs(d.amount))}</td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;
  }

  function drawColumn(host, entries, side /* 'you' | 'they' */) {
    if (!entries.length) {
      host.innerHTML = `<div class="muted">Không có ai.</div>`;
      return;
    }
    host.innerHTML = entries
      .map(([email, v], idx) => {
        const nm = nameOf(email);
        const photo = photoOf(email);
        const total = side === "you" ? v.youOwe : v.theyOwe;
        const id = `${side}-${idx}`;
        const detailList = side === "you" ? v.detailsYou : v.detailsThey; // <-- CHỈ PHẦN CỦA MÌNH

        return `
        <div class="acc" data-acc="${id}">
          <button class="acc-hd" data-toggle="${id}">
            <img class="avatar sm" src="${
              photo ||
              "data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2228%22 height=%2228%22><rect width=%2228%22 height=%2228%22 rx=%2214%22 fill=%22%23666%22/></svg>"
            }">
            <div class="grow">
              <div class="nm">${nm}</div>
              <div class="sub muted">${email}</div>
            </div>
            <div class="amt">${money(total)}</div>
            <div class="chev">▾</div>
          </button>
          <div class="acc-bd hidden" id="bd-${id}">
            ${renderDetails(detailList)}
          </div>
        </div>`;
      })
      .join("");
  }

  // Toggle accordion
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-toggle]");
    if (!t) return;
    const id = t.getAttribute("data-toggle");
    const body = document.getElementById(`bd-${id}`);
    body?.classList.toggle("hidden");
    t.querySelector(".chev")?.classList.toggle("rot");
  });

  if (unDebts) unDebts();
  unDebts = subscribeDebtsForUser(u.email, (data) => {
    sYou.textContent = money(data.totals.youOwe);
    sThey.textContent = money(data.totals.theyOwe);
    sNet.textContent = money(data.totals.net);
    lastUpd.textContent = whenVN(data.at);

    const arr = Array.from(data.byPerson.entries());
    const youRows = arr
      .filter(([_, v]) => v.youOwe > 0)
      .sort((a, b) => b[1].youOwe - a[1].youOwe);
    const theyRows = arr
      .filter(([_, v]) => v.theyOwe > 0)
      .sort((a, b) => b[1].theyOwe - a[1].theyOwe);

    drawColumn(listYou, youRows, "you");
    drawColumn(listThey, theyRows, "they");
  });
}

export function stopDebtsRealtime() {
  if (unDebts) unDebts();
  if (unUsers) unUsers();
  unDebts = unUsers = null;
}
