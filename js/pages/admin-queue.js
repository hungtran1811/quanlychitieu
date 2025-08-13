import { currentUser } from "../auth.js";
import {
  subscribeRequests,
  approveRequest,
  rejectRequest,
} from "../store/requests.js";
import { money, whenVN } from "../utils/format.js";

let _unsub = null;

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
    <h2 style="margin:0 0 8px">Admin • Hàng đợi duyệt</h2>
    <div class="row" style="gap:8px;margin:0 0 10px">
      <label class="muted small">Trạng thái:</label>
      <select id="f-status">
        <option value="pending" selected>Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <label class="muted small">Loại:</label>
      <select id="f-type">
        <option value="all" selected>Tất cả</option>
        <option value="expense">Expense</option>
        <option value="payment">Payment</option>
      </select>
    </div>
    <table class="table">
      <thead><tr>
        <th>Thời gian</th><th>Người tạo</th><th>Loại</th><th>Chi tiết</th><th>Số tiền</th><th>Trạng thái</th><th>Action</th>
      </tr></thead>
      <tbody id="tbody-admin"><tr><td colspan="7" class="muted">Đang tải…</td></tr></tbody>
    </table>
  </div></section>`;

  const $ = (id) => document.getElementById(id);
  const tbody = $("tbody-admin");
  const fStatus = $("f-status");
  const fType = $("f-type");

  function mount(status, type) {
    if (_unsub) {
      _unsub();
      _unsub = null;
    }
    _unsub = subscribeRequests({ status, type, limitN: 100 }, (rows) => {
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="muted">Không có dữ liệu.</td></tr>`;
        return;
      }
      tbody.innerHTML = rows
        .map((r) => {
          const d =
            r.createdAt?.toDate?.() || new Date(r.payload?.date || Date.now());
          const note = r.payload?.note || "";
          const amt = r.payload?.amount || 0;
          const badge = r.status;
          const actions =
            r.status === "pending"
              ? `<button class="btn" data-approve="${r.id}">Approve</button>
             <button class="btn" data-reject="${r.id}">Reject</button>`
              : `<span class="muted small">${badge}</span>`;
          return `<tr data-id="${r.id}">
          <td>${whenVN(d)}</td>
          <td class="small">${r.requestedBy}</td>
          <td>${r.type}</td>
          <td class="small">${note}</td>
          <td>${money(amt)}</td>
          <td>${r.status}</td>
          <td>${actions}</td>
        </tr>`;
        })
        .join("");
    });
  }

  // init and events
  mount(fStatus.value, fType.value);
  fStatus.addEventListener("change", () => mount(fStatus.value, fType.value));
  fType.addEventListener("change", () => mount(fStatus.value, fType.value));

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const tr = btn.closest("tr");
    const id = tr?.dataset?.id;
    if (!id) return;

    // reconstruct minimal req object from row (we need full req for approve)
    // Fetching full request again would be ideal; nhưng ta đã có đủ info trong subscribeRequests.
    // Đơn giản: lấy từ DOM list snapshot lưu trong closure.
  });

  // Lưu cache hàng hiện tại để lấy full object khi click
  let _cache = [];
  if (_unsub) {
    _unsub();
  }
  _unsub = subscribeRequests(
    { status: fStatus.value, type: fType.value, limitN: 100 },
    (rows) => {
      _cache = rows;
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="muted">Không có dữ liệu.</td></tr>`;
        return;
      }
      tbody.innerHTML = rows
        .map((r) => {
          const d =
            r.createdAt?.toDate?.() || new Date(r.payload?.date || Date.now());
          const note = r.payload?.note || "";
          const amt = r.payload?.amount || 0;
          const actions =
            r.status === "pending"
              ? `<button class="btn" data-approve="${r.id}">Approve</button>
           <button class="btn" data-reject="${r.id}">Reject</button>`
              : `<span class="muted small">${r.status}</span>`;
          return `<tr data-id="${r.id}">
        <td>${whenVN(d)}</td>
        <td class="small">${r.requestedBy}</td>
        <td>${r.type}</td>
        <td class="small">${note}</td>
        <td>${money(amt)}</td>
        <td>${r.status}</td>
        <td>${actions}</td>
      </tr>`;
        })
        .join("");
    }
  );

  tbody.addEventListener("click", async (e) => {
    const id = e.target?.dataset?.approve || e.target?.dataset?.reject;
    if (!id) return;
    const req = _cache.find((x) => x.id === id);
    if (!req) return;

    if (e.target.dataset.approve) {
      if (
        !confirm(
          `Duyệt yêu cầu ${req.type} • ${money(req?.payload?.amount || 0)}?`
        )
      )
        return;
      try {
        await approveRequest({ req, adminUid: u.uid });
        alert("Đã approve & ghi sổ.");
      } catch (err) {
        console.error(err);
        alert("Approve thất bại: " + (err?.message || "Unknown"));
      }
    } else {
      const reason = prompt("Lý do từ chối? (tuỳ chọn)", "");
      try {
        await rejectRequest({ reqId: id, reason, adminUid: u.uid });
        alert("Đã reject.");
      } catch (err) {
        console.error(err);
        alert("Reject thất bại: " + (err?.message || "Unknown"));
      }
    }
  });
}

export function stopAdminRealtime() {
  if (_unsub) {
    _unsub();
    _unsub = null;
  }
}
