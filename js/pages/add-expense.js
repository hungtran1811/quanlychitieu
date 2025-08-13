import { currentUser } from "../auth.js";
import { createExpenseRequest } from "../store/requests.js";
import { subscribeAllUsers } from "../store/users.js";
import { money, ymd } from "../utils/format.js";
import { toast } from "../utils/toast.js";

let _unsubUsers = null;
let _usersCache = [];
let _token = 0;

export function render() {
  const root = document.getElementById("app-root");
  const today = ymd(Date.now());
  const token = ++_token;

  root.innerHTML = `
  <section class="card"><div class="inner">
    <h2>Thêm khoản chi</h2>
    <form id="form-expense" class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
      <div><label>Ngày</label><input id="f-date" type="date" value="${today}" required /></div>
      <div><label>Số tiền (VND)</label><input id="f-amount" type="number" min="1" step="1" placeholder="vd. 150000" required /></div>
      <div style="grid-column:1/-1"><label>Ghi chú</label><input id="f-note" type="text" placeholder="vd. Mua đồ siêu thị" /></div>

      <div style="grid-column:1/-1">
        <label>Những người mua cùng (emails, cách nhau dấu phẩy)</label>
        <input id="f-participants" type="text" placeholder="a@gmail.com, b@gmail.com" />
        <div id="sugg-participants" class="chipbox hidden"></div>
      </div>

      <div style="grid-column:1/-1">
        <label>Người trả tiền (email)</label>
        <input id="f-payer" type="email" placeholder="mặc định là email của bạn nếu bỏ trống" />
        <div id="sugg-payer" class="chipbox hidden"></div>
      </div>

      <div style="grid-column:1/-1" class="row">
        <button class="btn primary" type="submit">Gửi yêu cầu</button>
        <span id="req-status" class="muted small"></span>
      </div>
    </form>
  </div></section>`;

  // handles
  const form = document.getElementById("form-expense");
  const fDate = document.getElementById("f-date");
  const fAmount = document.getElementById("f-amount");
  const fNote = document.getElementById("f-note");
  const fParticipants = document.getElementById("f-participants");
  const fPayer = document.getElementById("f-payer");
  const reqStatus = document.getElementById("req-status");
  const boxPart = document.getElementById("sugg-participants");
  const boxPayer = document.getElementById("sugg-payer");

  // default payer = current user email
  const u = currentUser();
  if (u?.email && !fPayer.value) fPayer.value = u.email;

  // realtime users for chip
  if (_unsubUsers) {
    _unsubUsers();
    _unsubUsers = null;
  }
  _unsubUsers = subscribeAllUsers((rows) => {
    _usersCache = rows;
    if (token !== _token) return;
  });

  function renderChips(box, q = "") {
    const query = (q || "").trim().toLowerCase();
    const items = _usersCache
      .filter(
        (x) =>
          !query ||
          x.email.toLowerCase().includes(query) ||
          x.name.toLowerCase().includes(query)
      )
      .slice(0, 12);
    box.innerHTML = items
      .map(
        (u) =>
          `<span class="chip" data-email="${u.email}">${
            u.name || u.email
          } <small>• ${u.email}</small></span>`
      )
      .join("");
    box.classList.toggle("hidden", items.length === 0);
  }
  const hideBoxes = () => {
    boxPart.classList.add("hidden");
    boxPayer.classList.add("hidden");
  };

  // participants: gõ theo token cuối; click -> push vào list
  fParticipants.addEventListener("focus", () => renderChips(boxPart, ""));
  fParticipants.addEventListener("input", () => {
    const tokenTxt = fParticipants.value.split(",").slice(-1)[0].trim();
    renderChips(boxPart, tokenTxt);
  });
  boxPart.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const email = chip.dataset.email;
    const parts = fParticipants.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.includes(email)) parts.push(email);
    fParticipants.value = parts.join(", ");
    hideBoxes();
  });

  // payer: click -> set 1 email
  fPayer.addEventListener("focus", () => renderChips(boxPayer, ""));
  fPayer.addEventListener("input", () => renderChips(boxPayer, fPayer.value));
  boxPayer.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    fPayer.value = chip.dataset.email;
    hideBoxes();
  });

  document.addEventListener(
    "click",
    (e) => {
      if (
        !e.target.closest("#f-participants") &&
        !e.target.closest("#sugg-participants")
      )
        boxPart.classList.add("hidden");
      if (!e.target.closest("#f-payer") && !e.target.closest("#sugg-payer"))
        boxPayer.classList.add("hidden");
    },
    { capture: true }
  );

  // submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = currentUser();
    if (!user) return alert("Bạn cần đăng nhập.");
    const amount = parseInt(fAmount.value, 10);
    if (!Number.isFinite(amount) || amount <= 0)
      return alert("Số tiền không hợp lệ.");

    const payload = {
      date: new Date(fDate.value || Date.now()).toISOString(),
      note: (fNote.value || "").trim(),
      amount,
      participantEmails: (fParticipants.value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      payerEmail: (fPayer.value || "").trim() || user.email || "",
      splitMethod: "equal",
    };
    try {
      const ref = await createExpenseRequest({ uid: user.uid, payload });
      reqStatus.textContent = `Đã gửi! Mã yêu cầu: ${ref.id}`;
      toast(`Đã gửi yêu cầu ${money(amount)}₫`);
      form.reset();
      fDate.value = ymd(Date.now());
      if (user?.email) fPayer.value = user.email;
      hideBoxes();
    } catch (err) {
      console.error(err);
      alert("Gửi yêu cầu thất bại: " + (err?.message || "Unknown error"));
    }
  });
}
