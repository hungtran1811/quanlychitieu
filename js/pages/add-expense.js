import { currentUser } from "../auth.js";
import { createExpenseRequest } from "../store/requests.js";
import { money, ymd } from "../utils/format.js";
import { toast } from "../utils/toast.js";
import { listDirectory } from "../store/directory.js"; // <— thêm

export async function render() {
  const root = document.getElementById("app-root");
  const today = ymd(Date.now());
  root.innerHTML = `
  <section class="card"><div class="inner">
    <h2>Thêm khoản chi</h2>
    <form id="form-expense" class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
      <div><label>Ngày</label><input id="f-date" type="date" value="${today}" required /></div>
      <div><label>Số tiền (VND)</label><input id="f-amount" type="number" min="1" step="1" placeholder="vd. 150000" required /></div>
      <div style="grid-column:1/-1"><label>Ghi chú</label><input id="f-note" type="text" placeholder="vd. Mua đồ siêu thị" /></div>
      <div style="grid-column:1/-1"><label>Những người mua cùng (emails, cách nhau dấu phẩy)</label>
        <input id="f-participants" type="text" list="emails-list" placeholder="a@gmail.com, b@gmail.com" />
        <datalist id="emails-list"></datalist>
        <div id="email-chips" class="chips"></div>
      </div>
      <div style="grid-column:1/-1"><label>Người trả tiền (email)</label>
        <input id="f-payer" type="email" list="emails-list" placeholder="mặc định là email của bạn nếu bỏ trống" />
      </div>
      <div style="grid-column:1/-1" class="row"><button class="btn primary" type="submit">Gửi yêu cầu</button><span id="req-status" class="muted small"></span></div>
    </form>
  </div></section>`;

  // nạp gợi ý email
  const users = await listDirectory();
  const dl = document.getElementById("emails-list");
  const chips = document.getElementById("email-chips");
  dl.innerHTML = users
    .map(
      (u) =>
        `<option value="${u.email}" label="${
          u.displayName || u.email
        }"></option>`
    )
    .join("");
  chips.innerHTML = users
    .map(
      (u) =>
        `<span class="chip" data-email="${u.email}">${
          u.displayName ? `${u.displayName} • ${u.email}` : u.email
        }</span>`
    )
    .join("");
  chips.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => {
      const input = document.getElementById("f-participants");
      const cur = (input.value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const email = c.dataset.email;
      if (!cur.includes(email)) cur.push(email);
      input.value = cur.join(", ");
    })
  );

  const form = document.getElementById("form-expense");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = currentUser();
    if (!u) return alert("Bạn cần đăng nhập.");
    const amount = parseInt(document.getElementById("f-amount").value, 10);
    if (!Number.isFinite(amount) || amount <= 0)
      return alert("Số tiền không hợp lệ.");

    const payload = {
      date: new Date(
        document.getElementById("f-date").value || Date.now()
      ).toISOString(),
      note: (document.getElementById("f-note").value || "").trim(),
      amount,
      participantEmails: (document.getElementById("f-participants").value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      payerEmail:
        (document.getElementById("f-payer").value || "").trim() ||
        u.email ||
        "",
      splitMethod: "equal",
    };

    try {
      const ref = await createExpenseRequest({ uid: u.uid, payload });
      document.getElementById(
        "req-status"
      ).textContent = `Đã gửi! Mã yêu cầu: ${ref.id}`;
      toast(`Đã gửi yêu cầu ${money(amount)}₫`);
      form.reset();
      document.getElementById("f-date").value = ymd(Date.now());
    } catch (err) {
      console.error(err);
      alert("Gửi yêu cầu thất bại: " + (err?.message || "Unknown error"));
    }
  });
}
