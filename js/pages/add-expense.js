import { currentUser } from "../auth.js";
import { createExpenseRequest } from "../store/requests.js";
import { subscribeAllUsers } from "../store/users.js";
import { money, ymd } from "../utils/format.js";
import { toast } from "../utils/toast.js";

let unUsers = null,
  users = [];

export function render() {
  const root = document.getElementById("app-root");
  const today = ymd(Date.now());
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

  const me = currentUser();
  if (me?.email && !fPayer.value) fPayer.value = me.email;

  if (unUsers) unUsers();
  unUsers = subscribeAllUsers((list) => {
    users = list;
  });

  function renderChips(box, q = "") {
    const query = (q || "").trim().toLowerCase();
    const items = users
      .filter(
        (x) =>
          !query ||
          x.name.toLowerCase().includes(query) ||
          x.email.toLowerCase().includes(query)
      )
      .slice(0, 14);

    box.innerHTML = items
      .map((u) => {
        const label = u.name || u.email.split("@")[0];
        return `<span class="chip" title="${u.email}" data-email="${u.email}">${label} <span class="sub">• chọn</span></span>`;
      })
      .join("");
    box.classList.toggle("hidden", items.length === 0);
  }
  const hideBoxes = () => {
    boxPart.classList.add("hidden");
    boxPayer.classList.add("hidden");
  };

  // Participants
  fParticipants.addEventListener("focus", () => renderChips(boxPart, ""));
  fParticipants.addEventListener("input", () => {
    const lastToken = fParticipants.value.split(",").slice(-1)[0].trim();
    renderChips(boxPart, lastToken);
  });
  boxPart.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const email = chip.dataset.email;
    const arr = fParticipants.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!arr.includes(email)) arr.push(email);
    fParticipants.value = arr.join(", ");
    hideBoxes();
  });

  // Payer
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
    const u = currentUser();
    if (!u) return alert("Bạn cần đăng nhập.");
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
      payerEmail: (fPayer.value || "").trim() || u.email || "",
      splitMethod: "equal",
    };
    try {
      const ref = await createExpenseRequest({ uid: u.uid, payload });
      reqStatus.textContent = `Đã gửi! Mã yêu cầu: ${ref.id}`;
      toast(`Đã gửi yêu cầu ${money(amount)}₫`);
      form.reset();
      fDate.value = ymd(Date.now());
      if (u?.email) fPayer.value = u.email;
      hideBoxes();
    } catch (err) {
      console.error(err);
      alert("Gửi yêu cầu thất bại: " + (err?.message || "Unknown error"));
    }
  });
}
