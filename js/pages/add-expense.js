import { currentUser } from "../auth.js";
import { createExpenseRequest } from "../store/requests.js";
import { money, ymd } from "../utils/format.js";
import { toast } from "../utils/toast.js";
import { getDb } from "../store/firestore.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const CSS_ID = "chips-field-css-v1";

/** chèn CSS cục bộ cho chips + dropdown (không đụng global) */
function ensureLocalCss() {
  if (document.getElementById(CSS_ID)) return;
  const css = `
  .chip-field{position:relative}
  .chip-field .chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  .chip-field .chip{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14)}
  .chip-field .chip .x{cursor:pointer;opacity:.75}
  .chip-field .chip .x:hover{opacity:1}
  .chip-field .badge{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px}
  .chip-field .hint{font-size:12px;color:#8aa0b4;margin-top:6px}
  .chip-field .suggest{position:absolute;left:0;right:0;top:100%;margin-top:6px;z-index:50;background:rgba(12,16,22,.92);backdrop-filter:blur(8px);
    border:1px solid rgba(255,255,255,.12);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.45);overflow:hidden}
  .chip-field .suggest ul{list-style:none;margin:0;padding:6px;max-height:240px;overflow:auto}
  .chip-field .suggest li{display:flex;align-items:center;gap:8px;padding:10px;border-radius:10px;cursor:pointer}
  .chip-field .suggest li:hover{background:rgba(255,255,255,.08)}
  .chip-field .suggest .name{font-weight:600}
  .chip-field .suggest .email{font-size:12px;color:#8aa0b4}
  /* ẩn spinner number để gọn */
  #f-amount::-webkit-outer-spin-button,#f-amount::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
  #f-amount[type=number]{appearance:textfield}
  `;
  const style = document.createElement("style");
  style.id = CSS_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

/** màu avatar từ email */
function colorFrom(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue},70%,45%)`;
}

/** component chips đơn giản: multiple (participants) / single (payer) */
function mountChipsField(input, { multiple = true, hint = "" }, people = []) {
  // bọc input -> field
  input.classList.add("chips-input");
  const field = document.createElement("div");
  field.className = "chip-field";
  input.parentElement.insertBefore(field, input);
  field.appendChild(input);

  const row = document.createElement("div");
  row.className = "chip-row";
  field.appendChild(row);

  if (hint) {
    const h = document.createElement("div");
    h.className = "hint";
    h.textContent = hint;
    field.appendChild(h);
  }

  const suggest = document.createElement("div");
  suggest.className = "suggest";
  suggest.style.display = "none";
  suggest.innerHTML = `<ul></ul>`;
  field.appendChild(suggest);
  const ul = suggest.querySelector("ul");

  let selected = []; // [{name,email}]
  function renderChips() {
    row.innerHTML = "";
    selected.forEach((item) => {
      const chip = document.createElement("div");
      chip.className = "chip";
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.style.background = colorFrom(item.email);
      badge.textContent = (item.name || item.email || "?")
        .trim()
        .charAt(0)
        .toUpperCase();
      const label = document.createElement("div");
      label.innerHTML = `<span class="name">${
        item.name || item.email
      }</span> <span class="email">• ${item.email}</span>`;
      const x = document.createElement("span");
      x.className = "x";
      x.textContent = "✕";
      x.onclick = () => {
        selected = selected.filter((s) => s.email !== item.email);
        renderChips();
      };
      chip.append(badge, label, x);
      row.appendChild(chip);
    });
    // đồng bộ value thực tế của input
    input.value = multiple
      ? selected.map((s) => s.email).join(", ")
      : selected[0]?.email || "";
  }

  function add(email) {
    if (!email) return;
    const norm = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) return;
    if (selected.some((s) => s.email.toLowerCase() === norm)) return;
    const found = people.find((p) => p.email.toLowerCase() === norm);
    const item = found || { name: "", email: norm };
    if (!multiple) selected = [item];
    else selected.push(item);
    input.value = "";
    hideSuggest();
    renderChips();
  }

  function showSuggest(list) {
    ul.innerHTML = list
      .map(
        (p) => `
      <li data-email="${p.email}">
        <div class="badge" style="background:${colorFrom(p.email)}">${(
          p.name || p.email
        )
          .charAt(0)
          .toUpperCase()}</div>
        <div>
          <div class="name">${p.name || p.email}</div>
          <div class="email">${p.email}</div>
        </div>
      </li>
    `
      )
      .join("");
    suggest.style.display = list.length ? "block" : "none";
  }
  function hideSuggest() {
    suggest.style.display = "none";
  }

  // events
  input.setAttribute("autocomplete", "off");
  input.addEventListener("focus", () => {
    const q = input.value.trim().toLowerCase();
    const list = people
      .filter(
        (p) =>
          !selected.some((s) => s.email.toLowerCase() === p.email.toLowerCase())
      )
      .filter(
        (p) =>
          !q ||
          p.email.toLowerCase().includes(q) ||
          (p.name || "").toLowerCase().includes(q)
      )
      .slice(0, 30);
    showSuggest(list);
  });
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    const list = people
      .filter(
        (p) =>
          !selected.some((s) => s.email.toLowerCase() === p.email.toLowerCase())
      )
      .filter(
        (p) =>
          !q ||
          p.email.toLowerCase().includes(q) ||
          (p.name || "").toLowerCase().includes(q)
      )
      .slice(0, 30);
    showSuggest(list);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const first = ul.querySelector("li");
      if (first) add(first.dataset.email);
      else add(input.value);
    }
    if (multiple && e.key === "Backspace" && !input.value && selected.length) {
      selected.pop();
      renderChips();
    }
    if (e.key === ",") {
      e.preventDefault();
      add(input.value.replace(",", ""));
    }
  });
  ul.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    add(li.dataset.email);
  });
  document.addEventListener("click", (e) => {
    if (!field.contains(e.target)) hideSuggest();
  });

  return {
    getValues: () => selected.map((s) => s.email),
    setValues: (emails = []) => {
      selected = [];
      emails
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .forEach(add);
      renderChips();
    },
  };
}

async function loadPeople() {
  try {
    const db = getDb();
    const qy = query(
      collection(db, "users"),
      orderBy("displayName"),
      limit(200)
    );
    const snap = await getDocs(qy);
    return snap.docs
      .map((d) => {
        const x = d.data();
        return { name: x.displayName || "", email: x.email || "" };
      })
      .filter((u) => !!u.email);
  } catch (err) {
    console.warn("Không đọc được users (rules?):", err?.message || err);
    return []; // fallback: vẫn cho nhập tay
  }
}

export async function render() {
  ensureLocalCss();

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
        <label>Những người mua cùng</label>
        <input id="f-participants" type="text" placeholder="gõ tên/email để tìm, enter để chọn..." />
        <div class="hint">Bạn có thể chọn nhiều người.</div>
      </div>

      <div style="grid-column:1/-1">
        <label>Người trả tiền</label>
        <input id="f-payer" type="text" placeholder="gõ tên/email để tìm, enter để chọn..." />
        <div class="hint">Nếu bỏ trống sẽ lấy email của bạn.</div>
      </div>

      <div style="grid-column:1/-1" class="row">
        <button class="btn primary" type="submit">Gửi yêu cầu</button>
        <span id="req-status" class="muted small"></span>
      </div>
    </form>
  </div></section>`;

  const form = document.getElementById("form-expense");
  const fDate = document.getElementById("f-date");
  const fAmount = document.getElementById("f-amount");
  const fNote = document.getElementById("f-note");
  const inParticipants = document.getElementById("f-participants");
  const inPayer = document.getElementById("f-payer");
  const reqStatus = document.getElementById("req-status");

  // tải danh bạ user để gợi ý (name + email)
  const people = await loadPeople();

  // gắn chips
  const participantsField = mountChipsField(
    inParticipants,
    {
      multiple: true,
      hint: "Bạn có thể chọn nhiều người.",
    },
    people
  );

  const payerField = mountChipsField(
    inPayer,
    {
      multiple: false,
      hint: "Nếu bỏ trống sẽ dùng email của bạn.",
    },
    people
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = currentUser();
    if (!u) return alert("Bạn cần đăng nhập.");

    const amount = parseInt(fAmount.value, 10);
    if (!Number.isFinite(amount) || amount <= 0)
      return alert("Số tiền không hợp lệ.");

    // lấy giá trị từ chips
    const participantEmails = participantsField.getValues();
    const payerEmail = payerField.getValues()[0] || u.email || "";

    const payload = {
      date: new Date(fDate.value || Date.now()).toISOString(),
      note: (fNote.value || "").trim(),
      amount,
      participantEmails,
      payerEmail,
      splitMethod: "equal",
    };

    try {
      const ref = await createExpenseRequest({ uid: u.uid, payload });
      reqStatus.textContent = `Đã gửi! Mã yêu cầu: ${ref.id}`;
      toast(`Đã gửi yêu cầu ${money(amount)}₫`);
      form.reset();
      document.getElementById("f-date").value = ymd(Date.now());
      // reset chips
      participantsField.setValues([]);
      payerField.setValues([]);
    } catch (err) {
      console.error(err);
      alert("Gửi yêu cầu thất bại: " + (err?.message || "Unknown error"));
    }
  });
}
