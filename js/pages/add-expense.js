// public/js/pages/add-expense.js
import { currentUser } from "../auth.js";
import { createExpenseRequest } from "../store/requests.js";
import { money, ymd } from "../utils/format.js";
import { toast } from "../utils/toast.js";
import { getDb } from "../store/firestore.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const S = {
  users: [], // [{displayName,email,photoURL}]
  selParticipants: new Set(), // emails đã chọn
};

const byName = (a, b) =>
  (a.displayName || a.email || "").localeCompare(
    b.displayName || b.email || ""
  );

function parseEmails(str) {
  return new Set(
    (str || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}
function setParticipantsInputFromSet(input, set) {
  input.value = Array.from(set).join(", ") + (set.size ? ", " : "");
}

function renderChips(list, $wrap, onPick) {
  if (!$wrap) return;
  if (!list.length) {
    $wrap.innerHTML = "";
    return;
  }
  $wrap.innerHTML = list
    .map(
      (u) => `
    <button type="button" class="chip-suggest" data-email="${u.email}">
      <span class="chip-avatar" style="background:${avatarColor(u.email)}">${(
        u.displayName || "?"
      )
        .trim()
        .charAt(0)
        .toUpperCase()}</span>
      <span class="chip-meta">
        <strong class="chip-name">${u.displayName || "Không tên"}</strong>
      </span>
    </button>
  `
    )
    .join("");
  $wrap.querySelectorAll("button[data-email]").forEach((btn) => {
    btn.addEventListener("click", () => onPick(btn.dataset.email));
  });
}

function avatarColor(key) {
  // màu tươi, cố định theo email
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return `hsl(${h},70%,45%)`;
}

function filterUsers(term, excludeSet = new Set()) {
  const t = (term || "").trim().toLowerCase();
  return S.users
    .filter((u) => !excludeSet.has(u.email))
    .filter(
      (u) =>
        !t ||
        u.email?.toLowerCase().includes(t) ||
        u.displayName?.toLowerCase().includes(t)
    )
    .sort(byName);
}

export function render() {
  const root = document.getElementById("app-root");
  const today = ymd(Date.now());

  root.innerHTML = `
  <section class="card"><div class="inner">
    <h2>Thêm khoản chi</h2>

    <form id="form-expense" class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
      <div><label>Ngày</label><input id="f-date" type="date" value="${today}" required /></div>
      <div><label>Số tiền (VND)</label><input id="f-amount" type="number" min="1" step="1" inputmode="numeric" placeholder="vd. 150000" required /></div>

      <div style="grid-column:1/-1"><label>Ghi chú</label><input id="f-note" type="text" placeholder="vd. Mua đồ siêu thị" /></div>

      <div style="grid-column:1/-1">
        <label>Những người mua cùng (emails, cách nhau dấu phẩy)</label>
        <input id="f-participants" type="text" placeholder="a@gmail.com, b@gmail.com" />
        <div id="sug-participants" class="suggest-wrap"></div>
        <div class="muted small">Bạn có thể chọn nhiều người.</div>
      </div>

      <div style="grid-column:1/-1">
        <label>Người trả tiền (email)</label>
        <input id="f-payer" type="email" placeholder="mặc định là email của bạn nếu bỏ trống" />
        <div id="sug-payer" class="suggest-wrap"></div>
      </div>

      <div style="grid-column:1/-1" class="row">
        <button class="btn primary" type="submit">Gửi yêu cầu</button>
        <span id="req-status" class="muted small"></span>
      </div>
    </form>
  </div></section>`;

  const form = document.getElementById("form-expense");
  const $date = document.getElementById("f-date");
  const $amt = document.getElementById("f-amount");
  const $note = document.getElementById("f-note");
  const $part = document.getElementById("f-participants");
  const $payer = document.getElementById("f-payer");
  const $sp = document.getElementById("sug-participants");
  const $sr = document.getElementById("sug-payer");
  const $status = document.getElementById("req-status");

  // lấy users realtime (giống Admin Overview)
  const db = getDb();
  const qUsers = query(collection(db, "users"), orderBy("displayName"));
  onSnapshot(qUsers, (snap) => {
    S.users = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .map((u) => ({
        displayName: u.displayName || u.email || "Không tên",
        email: u.email || "",
        photoURL: u.photoURL || "",
      }))
      .filter((u) => !!u.email);
    // render gợi ý ngay khi có users
    S.selParticipants = parseEmails($part.value);
    refreshParticipantSuggest();
    refreshPayerSuggest();
  });

  // ————— participants: gợi ý luôn hiện, bấm để thêm nhiều
  function refreshParticipantSuggest() {
    const term = lastToken($part.value);
    renderChips(filterUsers(term, S.selParticipants), $sp, (email) => {
      S.selParticipants.add(email);
      setParticipantsInputFromSet($part, S.selParticipants);
      refreshParticipantSuggest(); // chip đã chọn biến mất
      $part.focus();
    });
  }
  $part.addEventListener("focus", refreshParticipantSuggest);
  $part.addEventListener("input", () => {
    // cập nhật set theo input (trường hợp user sửa tay)
    S.selParticipants = parseEmails($part.value);
    refreshParticipantSuggest();
  });

  // ————— payer: chọn 1, set vào input, chip vẫn hiển thị cho người khác (trừ email đã chọn)
  function refreshPayerSuggest() {
    const cur = ($payer.value || "").trim();
    renderChips(
      filterUsers($payer.value, new Set(cur ? [cur] : [])),
      $sr,
      (email) => {
        $payer.value = email;
        refreshPayerSuggest();
        $payer.focus();
      }
    );
  }
  $payer.addEventListener("focus", refreshPayerSuggest);
  $payer.addEventListener("input", refreshPayerSuggest);

  function lastToken(str) {
    const parts = (str || "").split(",");
    return parts[parts.length - 1] || "";
  }

  // ————— submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = currentUser();
    if (!u) return alert("Bạn cần đăng nhập.");

    const amount = parseInt($amt.value, 10);
    if (!Number.isFinite(amount) || amount <= 0)
      return alert("Số tiền không hợp lệ.");

    const payload = {
      date: new Date($date.value || Date.now()).toISOString(),
      note: ($note.value || "").trim(),
      amount,
      participantEmails: Array.from(parseEmails($part.value)),
      payerEmail: ($payer.value || "").trim() || u.email || "",
      splitMethod: "equal",
    };

    try {
      const ref = await createExpenseRequest({ uid: u.uid, payload });
      $status.textContent = `Đã gửi! Mã yêu cầu: ${ref.id}`;
      toast(`Đã gửi yêu cầu ${money(amount)}₫`);
      form.reset();
      S.selParticipants.clear();
      document.getElementById("f-date").value = ymd(Date.now());
      refreshParticipantSuggest();
      refreshPayerSuggest();
    } catch (err) {
      console.error(err);
      alert("Gửi yêu cầu thất bại: " + (err?.message || "Unknown error"));
    }
  });
}
