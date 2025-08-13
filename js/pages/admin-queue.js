import { currentUser } from "../auth.js";
import {
  subscribeRequestsAdmin,
  markRequestStatus,
} from "../store/requests.js";
import { getDb } from "../store/firestore.js";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { subscribeUsersMap } from "../store/users.js";
import { money, whenVN } from "../utils/format.js";

let users = { byEmail: new Map(), byUid: new Map() };
let unReq = null; // unsubscribe requests
let currentRows = []; // cache hiện tại để lấy payload khi approve/reject

export async function render() {
  const me = currentUser();
  if (!me) {
    alert("Cần đăng nhập.");
    location.hash = "#/welcome";
    return;
  }

  const root = document.getElementById("app-root");
  root.innerHTML = `
  <section id="admin-queue" class="card"><div class="inner">
    <h2>Admin • Hàng đợi duyệt</h2>

    <div class="aq-filters">
      <span class="aq-label">Trạng thái</span>
      <span class="aq-select-wrap">
        <select id="f-status" class="aq-select" aria-label="Trạng thái">
          <option value="pending" selected>Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </span>

      <span class="aq-label">Loại</span>
      <span class="aq-select-wrap">
        <select id="f-type" class="aq-select" aria-label="Loại yêu cầu">
          <option value="all" selected>Tất cả loại</option>
          <option value="expense">Expense</option>
          <option value="payment">Payment</option>
        </select>
      </span>
    </div>

    <table class="table"><thead>
      <tr>
        <th>Thời gian</th><th>Người tạo</th><th>Loại</th><th>Chi tiết</th>
        <th>Số tiền</th><th>Trạng thái</th><th>Action</th>
      </tr>
    </thead><tbody id="tb"><tr><td colspan="7" class="muted">Đang tải…</td></tr></tbody></table>
  </div></section>`;

  const fStatus = document.getElementById("f-status");
  const fType = document.getElementById("f-type");
  const tb = document.getElementById("tb");

  subscribeUsersMap((x) => {
    users = x;
    renderRows();
  });

  // 🔄 Realtime lần đầu + khi đổi filter
  resub();
  fStatus.addEventListener("change", resub);
  fType.addEventListener("change", resub);

  function resub() {
    if (unReq) unReq();
    tb.innerHTML = `<tr><td colspan="7" class="muted">Đang tải…</td></tr>`;
    unReq = subscribeRequestsAdmin(
      { status: fStatus.value, type: fType.value, take: 80 },
      (rows) => {
        currentRows = rows;
        renderRows();
      }
    );
  }

  function renderRows() {
    const rows = currentRows;
    if (!rows.length) {
      tb.innerHTML = `<tr><td colspan="7" class="muted">Không có yêu cầu.</td></tr>`;
      return;
    }
    tb.innerHTML = rows
      .map((r) => {
        const when = r.createdAt?.toDate?.() || new Date();
        const by =
          users.byUid.get(r.requestedBy)?.name ||
          users.byUid.get(r.requestedBy)?.email ||
          r.requestedBy?.slice(0, 6) ||
          "—";
        const note = r.payload?.note || "";
        const amount = money(r.payload?.amount || 0);
        const st = r.status;
        const badge = `<span class="badge ${st}">${st}</span>`;
        const action =
          st === "pending"
            ? `<div class="row"><button class="btn" data-approve="${r.id}">Approve</button><button class="btn" data-reject="${r.id}">Reject</button></div>`
            : `<span class="muted small">—</span>`;
        return `<tr>
        <td>${whenVN(when)}</td>
        <td>${by}</td>
        <td>${r.type}</td>
        <td class="small">${note}</td>
        <td>${amount}</td>
        <td>${badge}</td>
        <td>${action}</td>
      </tr>`;
      })
      .join("");
  }

  // Approve / Reject (snapshot sẽ tự cập nhật, không cần reload)
  tb.addEventListener("click", async (e) => {
    const a = e.target.closest("[data-approve]");
    const rj = e.target.closest("[data-reject]");
    if (!a && !rj) return;
    const id = (a || rj).dataset.approve || (a || rj).dataset.reject;
    const row = currentRows.find((x) => x.id === id);
    if (!row) return alert("Không tìm thấy request.");

    if (a) {
      try {
        await approveToMain(row, me.uid);
        await markRequestStatus(row.id, {
          status: "approved",
          adminUid: me.uid,
        });
        // realtime sẽ tự loại khỏi danh sách nếu đang xem 'pending'
      } catch (err) {
        console.error(err);
        alert("Approve thất bại: " + (err?.message || ""));
      }
    }
    if (rj) {
      const note = prompt("Lý do từ chối (tuỳ chọn):", "");
      await markRequestStatus(row.id, {
        status: "rejected",
        note,
        adminUid: me.uid,
      });
    }
  });
}

async function approveToMain(req, adminUid) {
  const db = getDb();
  if (req.type === "expense") {
    const p = req.payload || {};
    await addDoc(collection(db, "expenses"), {
      amount: +p.amount || 0,
      note: p.note || "",
      date: p.date || new Date().toISOString(),
      payerEmail: p.payerEmail || "",
      participantsEmails: Array.isArray(p.participantEmails)
        ? p.participantEmails
        : p.participantsEmails || [],
      approvedAt: serverTimestamp(),
      approvedBy: adminUid,
    });
    return;
  }
  if (req.type === "payment") {
    const p = req.payload || {};
    await addDoc(collection(db, "payments"), {
      amount: +p.amount || 0,
      note: p.note || "",
      date: new Date().toISOString(),
      fromEmail: req._fromEmail || null,
      toEmail: p.toEmail || "",
      approvedAt: serverTimestamp(),
      approvedBy: adminUid,
    });
  }
}
