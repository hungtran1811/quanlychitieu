import { currentUser } from "../auth.js";
import { subscribeDebtsForUser } from "../store/ledger.js";
import { subscribeUsersMap } from "../store/users.js";
import { createPaymentRequest } from "../store/requests.js";
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
    <h2>Thanh toán nợ</h2>
    <p class="muted" style="margin:6px 0 14px">
      Chọn các khoản bạn đang nợ <em>(theo từng người)</em> → hệ thống sẽ tự cộng tổng và gửi <b>yêu cầu thanh toán</b> đến người đó (admin sẽ duyệt).
    </p>
    <div id="pay-groups" class="grid" style="gap:14px"></div>
    <div class="muted small" style="margin-top:8px">Cập nhật realtime từ expenses/payments đã duyệt.</div>
  </div></section>`;

  const wrap = document.getElementById("pay-groups");

  let usersMap = { byEmail: new Map(), byUid: new Map() };
  if (unUsers) unUsers();
  unUsers = subscribeUsersMap((x) => {
    usersMap = x;
  });

  const getName = (email) =>
    usersMap.byEmail.get(String(email || "").toLowerCase())?.name ||
    email?.split("@")[0] ||
    email ||
    "—";
  const getPhoto = (email) =>
    usersMap.byEmail.get(String(email || "").toLowerCase())?.photoURL || "";

  const draw = (groups) => {
    const entries = Array.from(groups.byPerson.entries())
      .filter(([_, v]) => v.youOwe > 0)
      .sort((a, b) => b[1].youOwe - a[1].youOwe);

    if (!entries.length) {
      wrap.innerHTML = `<div class="muted">Bạn không nợ ai cả. 🎉</div>`;
      return;
    }

    wrap.innerHTML = entries
      .map(([email, g], idx) => {
        const nm = getName(email);
        const photo = getPhoto(email);
        const id = `p${idx}`;

        // chỉ cho tick các mục dương (khoản bạn nợ); mục âm (đã thanh toán trước đó) hiển thị xám & disabled
        const rows = (g.detailsYou || [])
          .map((d, i) => {
            const positive = d.amount > 0;
            const disabled = positive ? "" : "disabled";
            const cls = positive ? "" : 'style="opacity:.6"';
            const when = d.date ? whenVN(d.date) : "—";
            const type = d.kind === "payment" ? "Thanh toán" : "Khoản chi";
            const effect = d.dir === "you->them" ? "Bạn → Họ" : "Họ → Bạn";
            const amt = `${d.amount < 0 ? "-" : "+"} ${money(
              Math.abs(d.amount)
            )}`;
            const cb = positive
              ? `<input type="checkbox" class="sel" data-email="${email}" data-idx="${i}" />`
              : `<input type="checkbox" disabled />`;
            return `<tr ${cls}>
          <td style="width:28px">${cb}</td>
          <td>${when}</td><td>${type}</td><td class="small">${
              d.note || ""
            }</td><td class="small">${effect}</td>
          <td style="text-align:right">${amt}</td>
        </tr>`;
          })
          .join("");

        return `
      <section class="card"><div class="inner">
        <div class="row" style="justify-content:space-between;gap:12px;margin-bottom:8px">
          <div class="row" style="gap:10px">
            <img class="avatar" src="${
              photo ||
              "data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><rect width=%2240%22 height=%2240%22 rx=%2220%22 fill=%22%23666%22/></svg>"
            }">
            <div>
              <div><strong>${nm}</strong></div>
              <div class="muted small">${email}</div>
            </div>
          </div>
          <div class="row" style="gap:6px">
            <div class="muted small">Bạn đang nợ</div>
            <div style="font-weight:800">${money(g.youOwe)}</div>
          </div>
        </div>

        <table class="table small">
          <thead><tr>
            <th></th><th>Thời gian</th><th>Loại</th><th>Ghi chú</th><th>Ảnh hưởng</th><th style="text-align:right">Số tiền</th>
          </tr></thead>
          <tbody id="tb-${id}">
            ${rows}
          </tbody>
        </table>

        <div class="row" style="justify-content:space-between;margin-top:10px">
          <div class="muted small">Đã chọn: <b id="picked-${id}">0</b> • Tổng thanh toán: <b id="sum-${id}">0</b></div>
          <div class="row" style="gap:8px">
            <input type="text" id="note-${id}" placeholder="Ghi chú chuyển khoản (tuỳ chọn)" style="min-width:260px">
            <button class="btn primary" data-pay="${email}" data-id="${id}">Gửi yêu cầu thanh toán</button>
          </div>
        </div>
      </div></section>`;
      })
      .join("");
  };

  // subscribe debts realtime
  if (unDebts) unDebts();
  unDebts = subscribeDebtsForUser(u.email, draw);

  // events: tick -> update sum; click pay -> create payment request
  root.addEventListener("change", (e) => {
    const sel = e.target.closest(".sel");
    if (!sel) return;
    const id = sel.closest("section.card")?.querySelector("[data-pay]")
      ?.dataset?.id;
    if (!id) return;

    // recompute sum for this group
    const tbody = document.getElementById(`tb-${id}`);
    const picked = [...tbody.querySelectorAll(".sel:checked")];
    const sumEl = document.getElementById(`sum-${id}`);
    const countEl = document.getElementById(`picked-${id}`);

    // lấy amount từ cột cuối cùng (đã format ±) → chuyển về số
    let sum = 0;
    picked.forEach((cb) => {
      const tr = cb.closest("tr");
      const txt = tr.lastElementChild.textContent || "0";
      const raw = parseInt(txt.replace(/[^\d-]/g, ""), 10) || 0;
      sum += Math.abs(raw);
    });
    sumEl.textContent = money(sum);
    countEl.textContent = picked.length;
  });

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-pay]");
    if (!btn) return;
    const email = btn.dataset.pay;
    const id = btn.dataset.id;

    const tbody = document.getElementById(`tb-${id}`);
    const picked = [...tbody.querySelectorAll(".sel:checked")];
    if (!picked.length) return alert("Chọn ít nhất một khoản để thanh toán.");

    // cộng tổng lại giống ở trên
    let sum = 0;
    picked.forEach((cb) => {
      const tr = cb.closest("tr");
      const txt = tr.lastElementChild.textContent || "0";
      const raw = parseInt(txt.replace(/[^\d-]/g, ""), 10) || 0;
      sum += Math.abs(raw);
    });

    const note = (document.getElementById(`note-${id}`)?.value || "").trim();

    try {
      await createPaymentRequest({
        uid: currentUser().uid,
        payload: {
          amount: sum,
          toEmail: email,
          note,
          entries: picked.map((cb) => Number(cb.dataset.idx)), // tham chiếu các dòng đã chọn (client-side index)
        },
      });
      alert(`Đã gửi yêu cầu thanh toán ${money(sum)} đến ${email}.`);
      // reset selections
      picked.forEach((cb) => {
        cb.checked = false;
      });
      document.getElementById(`sum-${id}`).textContent = "0";
      document.getElementById(`picked-${id}`).textContent = "0";
      document.getElementById(`note-${id}`).value = "";
    } catch (err) {
      console.error(err);
      alert("Gửi yêu cầu thất bại: " + (err?.message || "Unknown"));
    }
  });
}

export function stopPayDebtRealtime() {
  if (unDebts) unDebts();
  if (unUsers) unUsers();
  unDebts = unUsers = null;
}
