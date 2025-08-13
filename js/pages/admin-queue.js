import { currentUser } from "../auth.js";
import {
  subscribeRequests,
  approveRequest,
  rejectRequest,
} from "../store/requests.js";
import { subscribeUsersMap } from "../store/users.js";
import { money, whenVN } from "../utils/format.js";

let unReq = null,
  unUsers = null;

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

    <table class="table table-admin">
      <thead><tr>
        <th>Thời gian</th><th>Người tạo</th><th>Loại</th><th>Chi tiết</th><th>Số tiền</th><th>Trạng thái</th><th>Action</th>
      </tr></thead>
      <tbody id="tbody-admin"><tr><td colspan="7" class="muted">Đang tải…</td></tr></tbody>
    </table>
  </div></section>`;

  const $ = (id) => document.getElementById(id);
  const tbody = $("tbody-admin");
  const fStatus = $("f-status"),
    fType = $("f-type");

  let cacheReq = [];
  let users = { byUid: new Map(), byEmail: new Map() };

  // render rows using cache + users map
  const draw = () => {
    if (!cacheReq.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Không có dữ liệu.</td></tr>`;
      return;
    }
    tbody.innerHTML = cacheReq
      .map((r) => {
        const d =
          r.createdAt?.toDate?.() || new Date(r.payload?.date || Date.now());
        const note = r.payload?.note || "";
        const amt = +r.payload?.amount || 0;
        const usr = users.byUid.get(r.requestedBy);
        const name = usr?.name || "(không tên)";
        const email = usr?.email || "";
        const photo = usr?.photoURL || "";
        const statusClass =
          r.status === "approved"
            ? "status-approved"
            : r.status === "rejected"
            ? "status-rejected"
            : "status-pending";
        const actions =
          r.status === "pending"
            ? `<button class="btn" data-approve="${r.id}">Approve</button>
           <button class="btn" data-reject="${r.id}">Reject</button>`
            : `<span class="status-badge ${statusClass}">${r.status}</span>`;
        return `<tr data-id="${r.id}">
        <td>${whenVN(d)}</td>
        <td>
          <div class="creator">
            <img class="avatar" src="${
              photo ||
              "data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2228%22 height=%2228%22><rect width=%2228%22 height=%2228%22 rx=%2214%22 fill=%22%23666%22/></svg>"
            }" alt="">
            <div><div class="name">${name}</div><div class="email">${email}</div></div>
          </div>
        </td>
        <td>${r.type}</td>
        <td class="small">${note}</td>
        <td><span class="pill-amt">${money(amt)}</span></td>
        <td>${
          r.status === "pending"
            ? `<span class="status-badge status-pending">pending</span>`
            : r.status === "approved"
            ? `<span class="status-badge status-approved">approved</span>`
            : `<span class="status-badge status-rejected">rejected</span>`
        }
        </td>
        <td>${actions}</td>
      </tr>`;
      })
      .join("");
  };

  // attach subscriptions
  const mount = () => {
    if (unReq) {
      unReq();
      unReq = null;
    }
    unReq = subscribeRequests(
      { status: fStatus.value, type: fType.value, limitN: 100 },
      (rows) => {
        cacheReq = rows;
        draw();
      }
    );
  };
  if (unUsers) {
    unUsers();
  }
  unUsers = subscribeUsersMap((map) => {
    users = map;
    draw();
  });

  mount();
  fStatus.addEventListener("change", mount);
  fType.addEventListener("change", mount);

  // actions
  tbody.addEventListener("click", async (e) => {
    const id = e.target?.dataset?.approve || e.target?.dataset?.reject;
    if (!id) return;
    const req = cacheReq.find((x) => x.id === id);
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
  if (unReq) unReq();
  if (unUsers) unUsers();
  unReq = unUsers = null;
}
