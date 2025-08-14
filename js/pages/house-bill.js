// public/js/pages/house-bill.js
import { getDb, ts } from "../store/firestore.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { currentUser } from "../auth.js";
import { money } from "../utils/format.js";
import { toast } from "../utils/toast.js";

/** ===== Helpers ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const firstDay = (monthStr) => new Date(monthStr + "-01T00:00:00");
const lastDay = (monthStr) =>
  new Date(
    new Date(monthStr + "-01").getFullYear(),
    new Date(monthStr + "-01").getMonth() + 1,
    0
  );
const clampDate = (d, min, max) =>
  new Date(Math.max(Math.min(new Date(d), max), min));
const daysDiffIncl = (a, b) =>
  Math.round((new Date(b) - new Date(a)) / 86400000) + 1;

/** Tính toán chia tiền:
 * - Điện = (công tơ mới - cũ) * rate.
 * - Tiền cố định (rent + water + netTrash + extras) chia đều theo số người.
 * - Điện chia theo "person-days": mỗi người đóng theo số ngày ở (nếu có ngày về sớm).
 */
function calcShares(input) {
  const {
    month,
    meterPrev,
    meterCurr,
    rate,
    rent,
    water,
    netTrash,
    extras,
    members,
  } = input;
  const start = firstDay(month);
  const end = lastDay(month);

  const kwh = Math.max(0, meterCurr - meterPrev);
  const elec = kwh * rate;
  const fixedTotal = (rent | 0) + (water | 0) + (netTrash | 0) + (extras | 0);
  const count = members.length || 1;

  // person-days
  const pd =
    members.reduce((sum, m) => {
      const leave = m.leaveAt ? clampDate(m.leaveAt, start, end) : end;
      const d = daysDiffIncl(start, leave);
      m._days = d;
      return sum + d;
    }, 0) || 1;

  const fixedEach = fixedTotal / count;

  const rows = members.map((m) => {
    const elecShare = elec * (m._days / pd);
    const total = Math.round(elecShare + fixedEach);
    return {
      email: m.email,
      name: m.name || "",
      days: m._days,
      elecShare: Math.round(elecShare),
      fixedShare: Math.round(fixedEach),
      total,
    };
  });

  const grand = rows.reduce((s, r) => s + r.total, 0);

  return {
    start,
    end,
    kwh,
    elec,
    fixedTotal,
    totalCost: elec + fixedTotal,
    rows,
  };
}

/** Lưu 1 bill + phát sinh các expense “đã duyệt” cho từng người (payer là admin). */
async function saveBillAndPostExpenses(input) {
  const db = getDb();
  const u = currentUser();
  if (!u) throw new Error("Bạn cần đăng nhập.");
  const {
    month,
    meterPrev,
    meterCurr,
    rate,
    rent,
    water,
    netTrash,
    extras,
    payerEmail,
    members,
  } = input;

  const calc = calcShares({
    month,
    meterPrev,
    meterCurr,
    rate,
    rent,
    water,
    netTrash,
    extras,
    members,
  });

  // 1) Lưu houseBills
  const billRef = await addDoc(collection(db, "houseBills"), {
    month,
    periodStart: calc.start,
    periodEnd: calc.end,
    meterPrev,
    meterCurr,
    kwh: calc.kwh,
    rate,
    rent,
    water,
    netTrash,
    extras,
    elec: calc.elec,
    fixedTotal: calc.fixedTotal,
    totalCost: calc.totalCost,
    members,
    shares: calc.rows,
    createdBy: u.uid,
    createdAt: ts(),
  });

  // 2) Tạo expense đã duyệt cho từng người
  const noteBase = `Tiền nhà ${month} • Điện ${calc.kwh}kWh (${money(
    calc.elec
  )}đ); Cố định ${money(calc.fixedTotal)}đ`;
  for (const r of calc.rows) {
    await addDoc(collection(db, "expenses"), {
      type: "house-bill",
      date: calc.end,
      amount: r.total,
      note: `${noteBase} • ${r.name || r.email} (${r.days} ngày)`,
      participantsEmails: [r.email],
      payerEmail,
      status: "approved",
      meta: { houseBillId: billRef.id, days: r.days },
      createdAt: ts(),
      updatedAt: ts(),
    });
  }

  return { id: billRef.id, calc };
}

/** ===== UI render ===== */
export async function render() {
  const u = currentUser();
  if (!u) {
    alert("Bạn cần đăng nhập.");
    location.hash = "#/welcome";
    return;
  }

  const root = document.getElementById("app-root");
  root.innerHTML = `
  <section class="card"><div class="inner">
    <h2 style="margin:0 0 12px">Tiền nhà (House Bill)</h2>
    <p class="muted small" style="margin:-6px 0 14px">Admin nhập hoá đơn, hệ thống tự chia và ghi nợ từng người.</p>

    <form id="hb-form" class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
      <div><label>Tháng</label><input id="hb-month" type="month" required /></div>
      <div><label>Payer (email)</label><input id="hb-payer" type="email" required /></div>

      <div><label>Điện cũ (kWh)</label><input id="hb-prev" type="number" min="0" step="1" required /></div>
      <div><label>Điện mới (kWh)</label><input id="hb-curr" type="number" min="0" step="1" required /></div>
      <div><label>Đơn giá điện (đ/kWh)</label><input id="hb-rate" type="number" min="0" step="1" value="3800" /></div>
      <div></div>

      <div><label>Tiền nhà (đ)</label><input id="hb-rent" type="number" min="0" step="1" required /></div>
      <div><label>Nước (đ)</label><input id="hb-water" type="number" min="0" step="1" value="0" /></div>
      <div><label>Net + Rác (đ)</label><input id="hb-net" type="number" min="0" step="1" value="0" /></div>
      <!-- Khoản khác (nhiều dòng) -->
      <div class="grid" id="other-section" style="grid-column:1/-1"><label>Khoản khác (Internet + rác, phí gửi xe đạp, quỹ phòng…)</label><div id="other-list" class="grid" style="gap:8px;"></div><div class="row" style="justify-content:space-between;align-items:center;margin-top:6px;"><button id="btn-add-other" type="button" class="btn">+ Thêm khoản khác</button><div class="muted small">Tổng “khác”: <b id="other-total">0</b> đ</div>
  </div>

  <!-- GIỮ input ẩn này để code cũ vẫn lấy được tổng tiền “khác” -->
  <input id="f-other" type="hidden" value="0" />
</div>

      <div style="grid-column:1/-1">
        <label>Thành viên (tick để tính, có thể điền ngày về sớm)</label>
        <div id="hb-members" class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"></div>
      </div>

      <div class="row" style="grid-column:1/-1;justify-content:flex-start;gap:10px">
        <button id="hb-preview" class="btn" type="button">Xem chia tiền</button>
        <button id="hb-save" class="btn primary" type="button">Lưu & tạo nợ</button>
        <span id="hb-msg" class="muted small"></span>
      </div>
    </form>

    <div id="hb-result" class="card" style="margin-top:14px;display:none">
      <div class="inner">
        <h3 style="margin:0 0 10px">Kết quả tạm tính</h3>
        <div id="hb-summary" class="muted small" style="margin-bottom:8px"></div>
        <table class="table">
          <thead><tr><th>Người</th><th>Ngày ở</th><th>Điện</th><th>Cố định</th><th>Tổng</th></tr></thead>
          <tbody id="hb-rows"><tr><td colspan="5" class="muted">—</td></tr></tbody>
        </table>
      </div>
    </div>
  </div></section>`;

  // Prefill
  $("#hb-month").value = new Date().toISOString().slice(0, 7);
  $("#hb-payer").value = u.email || "";

  // Load users as selectable list
  const users = await fetchUsers();
  renderMembers($("#hb-members"), users);

  // Buttons
  $("#hb-preview").addEventListener("click", () => doPreview());
  $("#hb-save").addEventListener("click", () => doSave());

  function readInput() {
    const month = $("#hb-month").value;
    const data = {
      month,
      payerEmail: $("#hb-payer").value.trim(),
      meterPrev: +$("#hb-prev").value || 0,
      meterCurr: +$("#hb-curr").value || 0,
      rate: +$("#hb-rate").value || 0,
      rent: +$("#hb-rent").value || 0,
      water: +$("#hb-water").value || 0,
      netTrash: +$("#hb-net").value || 0,
      extras: +$("#hb-etc").value || 0,
      members: readMembers($("#hb-members"), month),
    };
    if (!data.members.length) throw new Error("Chưa chọn thành viên.");
    return data;
  }

  function doPreview() {
    try {
      const input = readInput();
      const r = calcShares(input);
      fillResult(input, r);
      $("#hb-result").style.display = "block";
      $("#hb-msg").textContent = "";
    } catch (e) {
      $("#hb-msg").textContent = e.message;
    }
  }

  async function doSave() {
    try {
      const input = readInput();
      const { calc } = await saveBillAndPostExpenses(input);
      fillResult(input, calc);
      $("#hb-result").style.display = "block";
      toast("Đã lưu bill & ghi nợ cho từng người");
      $("#hb-msg").textContent = "Done.";
    } catch (e) {
      console.error(e);
      $("#hb-msg").textContent = e.message || "Lỗi không xác định";
    }
  }

  // === OTHER ITEMS UI (tổng “khác” đẩy vào #f-other) ===
  (function setupOtherUI() {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const fmtVND = new Intl.NumberFormat("vi-VN");

    const list = $("#other-list");
    const total = $("#other-total");
    const hidden = $("#f-other");
    const btnAdd = $("#btn-add-other");

    if (!list || !total || !hidden || !btnAdd) return; // phòng khi chưa ở đúng trang

    // style nhẹ cho dòng item (không phá CSS hiện tại)
    const baseRowCSS =
      "display:flex;gap:8px;align-items:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:8px;";
    const inputCSS =
      "flex:1 1 auto;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.25);color:inherit;";
    const amtCSS = "width:180px;min-width:140px;text-align:right;";

    function addRow(label = "", amount = "") {
      const row = document.createElement("div");
      row.className = "other-row";
      row.style.cssText = baseRowCSS;

      row.innerHTML = `
      <input class="oi-label" placeholder="Tên khoản (vd. Internet + rác)" />
      <input class="oi-amount" type="number" min="0" step="1000" placeholder="Số tiền" />
      <button class="btn" type="button" title="Xóa">✕</button>
    `;

      const lab = row.querySelector(".oi-label");
      const amt = row.querySelector(".oi-amount");
      const del = row.querySelector("button");

      lab.style.cssText = inputCSS;
      amt.style.cssText = inputCSS + amtCSS;

      lab.value = label;
      amt.value = amount;

      const recalc = () => {
        let sum = 0;
        $$(".oi-amount", list).forEach((i) => {
          const v = parseInt(i.value, 10);
          if (Number.isFinite(v)) sum += v;
        });
        total.textContent = fmtVND.format(sum);
        hidden.value = String(sum); // <-- tổng đưa vào #f-other
      };

      lab.addEventListener("input", recalc);
      amt.addEventListener("input", recalc);
      del.addEventListener("click", () => {
        row.remove();
        recalc();
      });

      list.appendChild(row);
      recalc();
    }

    btnAdd.addEventListener("click", () => addRow());

    // Khởi tạo 1 dòng gợi ý ban đầu (có thể xoá)
    addRow("Máy lạnh", "");
  })();
}

/** ===== Users UI ===== */
async function fetchUsers() {
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, "users"), orderBy("displayName", "asc"))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) }))
    .map((u) => ({
      email: u.email,
      name: u.displayName || u.email,
      photo: u.photoURL || "",
    }));
}
function renderMembers(host, users) {
  host.innerHTML = users
    .map(
      (u, i) => `
    <div class="card hb-member" style="padding:8px 10px">
      <label class="row" style="justify-content:space-between;gap:8px">
        <span class="row" style="gap:8px">
          <input type="checkbox" class="hb-check" data-role="pick" data-email="${
            u.email
          }" checked />
          <span><strong>${
            u.name || u.email
          }</strong><br/><span class="muted small">${u.email}</span></span>
        </span>
        <span class="row small">
          <span class="muted">Ngày về sớm:</span>
          <input type="date" data-role="leave" style="width:160px" />
        </span>
      </label>
    </div>
  `
    )
    .join("");
}
function readMembers(host, monthStr) {
  const start = firstDay(monthStr),
    end = lastDay(monthStr);
  const rows = [];
  $$(".card", host).forEach((card) => {
    const pick = $("[data-role='pick']", card);
    if (!pick.checked) return;
    const email = pick.dataset.email;
    const name = card.querySelector("strong")?.textContent || email;
    const leave = $("[data-role='leave']", card)?.value || "";
    rows.push({
      email,
      name,
      leaveAt: leave ? clampDate(leave, start, end) : null,
    });
  });
  return rows;
}
function fillResult(input, calc) {
  $("#hb-summary").innerHTML =
    `Điện: <b>${calc.kwh} kWh</b> → <b>${money(
      calc.elec
    )}đ</b> &nbsp;•&nbsp; ` +
    `Cố định: <b>${money(calc.fixedTotal)}đ</b> &nbsp;•&nbsp; Tổng: <b>${money(
      calc.totalCost
    )}đ</b>`;
  $("#hb-rows").innerHTML = calc.rows
    .map(
      (r) => `
    <tr>
      <td>${r.name || r.email}<br/><span class="muted small">${
        r.email
      }</span></td>
      <td>${r.days}</td>
      <td>${money(r.elecShare)}</td>
      <td>${money(r.fixedShare)}</td>
      <td><b>${money(r.total)}</b></td>
    </tr>
  `
    )
    .join("");
}
