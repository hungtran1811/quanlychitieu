import { currentUser } from "../auth.js";
import { subscribeDebtsForUser } from "../store/ledger.js";
import { subscribeUsersMap } from "../store/users.js";
import { createPaymentRequest } from "../store/requests.js";
import { money, whenVN } from "../utils/format.js";

let unsubDebts = null,
  unsubUsers = null;

export async function render() {
  const me = currentUser();
  if (!me?.email) {
    alert("Bạn cần đăng nhập.");
    location.hash = "#/welcome";
    return;
  }

  const root = document.getElementById("app-root");
  root.innerHTML = `
  <section class="card"><div class="inner">
    <h2>Thanh toán nợ</h2>
    <p class="muted small">Chọn các khoản bạn đang nợ để gửi <b>yêu cầu thanh toán</b> đến từng người (admin sẽ duyệt).</p>
    <div id="groups" class="grid" style="gap:14px"></div>
  </div></section>`;

  const groups = document.getElementById("groups");

  // helpers
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const prefillTo = params.get("to");
  let users = { byEmail: new Map(), byUid: new Map() };
  if (unsubUsers) unsubUsers();
  unsubUsers = subscribeUsersMap((x) => {
    users = x;
  });
  const nameOf = (email) =>
    users.byEmail.get(String(email || "").toLowerCase())?.name ||
    email?.split("@")[0] ||
    email ||
    "—";
  const photoOf = (email) =>
    users.byEmail.get(String(email || "").toLowerCase())?.photoURL || "";

  // state container for sums (avoid reading DOM text)
  const state = new Map(); // email -> { items:[{idx, amount, date, note}], picked:Set(idx) }

  const draw = (data) => {
    const entries = Array.from(data.byPerson.entries())
      .filter(([_, v]) => v.youOwe > 0)
      .sort((a, b) => b[1].youOwe - a[1].youOwe);
    if (!entries.length) {
      groups.innerHTML = `<div class="muted">Bạn không nợ ai cả. 🎉</div>`;
      return;
    }

    groups.innerHTML = entries
      .map(([email, v], gi) => {
        const nm = nameOf(email),
          photo = photoOf(email);
        const items = (v.detailsYou || []).filter((d) => d.amount > 0); // chỉ những khoản dương (đang nợ)
        state.set(email, {
          items: items.map((d, i) => ({
            idx: i,
            amount: d.amount,
            date: d.date,
            note: d.note || "",
          })),
          picked: new Set(),
        });
        const rows = items
          .map(
            (d, i) => `
        <tr>
          <td style="width:28px"><input type="checkbox" class="cb" data-email="${email}" data-idx="${i}"></td>
          <td>${whenVN(d.date)}</td>
          <td>Khoản chi</td>
          <td class="small">${d.note || ""}</td>
          <td style="text-align:right">+ ${money(Math.abs(d.amount))}</td>
        </tr>
      `
          )
          .join("");

        const id = `g${gi}`,
          checked = prefillTo && prefillTo === email ? "data-prefill='1'" : "";
        return `
      <section class="card"><div class="inner" ${checked}>
        <div class="row" style="justify-content:space-between;gap:12px;margin-bottom:8px">
          <div class="row" style="gap:10px">
            <img class="avatar" src="${
              photo ||
              "data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><rect width=%2240%22 height=%2240%22 rx=%2220%22 fill=%22%23666%22/></svg>"
            }">
            <div><div><strong>${nm}</strong></div><div class="muted small">${email}</div></div>
          </div>
          <div class="row" style="gap:6px"><div class="muted small">Đang nợ</div><div style="font-weight:800">${money(
            v.youOwe
          )}</div></div>
        </div>
        <table class="table small"><thead><tr><th></th><th>Thời gian</th><th>Loại</th><th>Ghi chú</th><th style="text-align:right">Số tiền</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="row" style="justify-content:space-between;margin-top:10px">
          <div class="muted small">Đã chọn: <b id="picked-${id}">0</b> • Tổng: <b id="sum-${id}">0</b> • Còn lại: <b id="left-${id}">${money(
          v.youOwe
        )}</b></div>
          <div class="row" style="gap:8px">
            <input type="text" id="note-${id}" class="input" placeholder="Ghi chú chuyển khoản (tuỳ chọn)" style="min-width:260px">
            <button class="btn primary" data-send data-email="${email}" data-gid="${id}" disabled>Gửi yêu cầu</button>
          </div>
        </div>
      </div></section>`;
      })
      .join("");

    // tự mở group prefill nếu có
    const tgt = groups.querySelector("[data-prefill='1']");
    if (tgt) tgt.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (unsubDebts) unsubDebts();
  unsubDebts = subscribeDebtsForUser(me.email, draw);

  // interactions
  groups.addEventListener("change", (e) => {
    const cb = e.target.closest(".cb");
    if (!cb) return;
    const email = cb.dataset.email,
      idx = Number(cb.dataset.idx);
    const box = state.get(email);
    if (!box) return;
    if (cb.checked) box.picked.add(idx);
    else box.picked.delete(idx);

    const card = cb.closest("section.card");
    const gid = card.querySelector("[data-send]")?.dataset.gid;
    const youOweText = card
      .querySelector(".row .row div[style*='font-weight:800']")
      .textContent.replace(/[^\d]/g, "");
    const youOwe = parseInt(youOweText || "0", 10);
    let sum = 0;
    box.picked.forEach((i) => (sum += Math.abs(box.items[i].amount)));
    card.querySelector(`#picked-${gid}`).textContent = box.picked.size;
    card.querySelector(`#sum-${gid}`).textContent = money(sum);
    card.querySelector(`#left-${gid}`).textContent = money(
      Math.max(youOwe - sum, 0)
    );
    card.querySelector("[data-send]").disabled = sum <= 0 || sum > youOwe;
  });

  groups.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-send]");
    if (!btn) return;
    const email = btn.dataset.email,
      gid = btn.dataset.gid;
    const card = btn.closest("section.card");
    const note = (card.querySelector(`#note-${gid}`)?.value || "").trim();
    const box = state.get(email);
    if (!box) return;
    let sum = 0;
    const pickedIdx = Array.from(box.picked.values());
    pickedIdx.forEach((i) => (sum += Math.abs(box.items[i].amount)));
    if (!sum) return;

    try {
      await createPaymentRequest({
        uid: currentUser().uid,
        payload: { amount: sum, toEmail: email, note, entries: pickedIdx },
      });
      alert(`Đã gửi yêu cầu thanh toán ${money(sum)} đến ${email}.`);
      // reset
      card.querySelectorAll(".cb:checked").forEach((c) => (c.checked = false));
      box.picked.clear();
      card.querySelector(`#picked-${gid}`).textContent = "0";
      card.querySelector(`#sum-${gid}`).textContent = "0";
    } catch (err) {
      console.error(err);
      alert("Gửi yêu cầu thất bại: " + (err?.message || ""));
    }
  });
}

export function stopPayDebtRealtime() {
  if (unsubDebts) unsubDebts();
  if (unsubUsers) unsubUsers();
}
