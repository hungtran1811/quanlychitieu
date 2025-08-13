import { currentUser } from "../auth.js";
import { listRequestsAdmin, markRequestStatus } from "../store/requests.js";
import { getDb } from "../store/firestore.js";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { subscribeUsersMap } from "../store/users.js";
import { money, whenVN } from "../utils/format.js";

let users = { byEmail: new Map(), byUid: new Map() };

export async function render() {
  const me = currentUser();
  if (!me) {
    alert("Cần đăng nhập.");
    location.hash = "#/welcome";
    return;
  }

  const root = document.getElementById("app-root");
  root.innerHTML = `
  <section class="card"><div class="inner">
    <h2>Admin • Hàng đợi duyệt</h2>
    <div class="filters">
      <select id="f-status" class="select">
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <select id="f-type" class="select">
        <option value="all">Tất cả loại</option>
        <option value="expense">Expense</option>
        <option value="payment">Payment</option>
      </select>
      <button id="btn-refresh" class="btn">Tải lại</button>
    </div>
    <table class="table"><thead>
      <tr><th>Thời gian</th><th>Người tạo</th><th>Loại</th><th>Chi tiết</th><th>Số tiền</th><th>Trạng thái</th><th>Action</th></tr>
    </thead><tbody id="tb"><tr><td colspan="7" class="muted">Đang tải…</td></tr></tbody></table>
  </div></section>`;

  const fStatus = document.getElementById("f-status");
  const fType = document.getElementById("f-type");
  const tb = document.getElementById("tb");
  document.getElementById("btn-refresh").addEventListener("click", load);

  subscribeUsersMap((x) => {
    users = x;
  });
  await load();

  async function load() {
    const rows = await listRequestsAdmin({
      status: fStatus.value,
      type: fType.value,
      take: 80,
    });
    if (!rows.length) {
      tb.innerHTML = `<tr><td colspan="7" class="muted">Không có yêu cầu.</td></tr>`;
      return;
    }
    tb.innerHTML = rows
      .map((r) => {
        const when = r.createdAt?.toDate?.() || new Date();
        const by =
          users.byUid.get(r.requestedBy)?.name ||
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

  // approve / reject
  tb.addEventListener("click", async (e) => {
    const a = e.target.closest("[data-approve]");
    const r = e.target.closest("[data-reject]");
    if (!a && !r) return;
    const id = (a || r).dataset.approve || (a || r).dataset.reject;
    const row = (
      await listRequestsAdmin({ status: "pending", type: "all", take: 200 })
    ).find((x) => x.id === id);
    if (!row) return alert("Không tìm thấy request.");

    if (a) {
      // approve
      try {
        await approveToMain(row, me.uid);
        await markRequestStatus(row.id, {
          status: "approved",
          adminUid: me.uid,
        });
        alert("Approved.");
        await load();
      } catch (err) {
        console.error(err);
        alert("Approve thất bại: " + (err?.message || ""));
      }
    }
    if (r) {
      // reject
      const note = prompt("Lý do từ chối (tuỳ chọn):", "");
      await markRequestStatus(row.id, {
        status: "rejected",
        note,
        adminUid: me.uid,
      });
      await load();
    }
  });
}

/* ghi vào collections chính khi approve */
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
      fromEmail:
        req._fromEmail || null || null /* không cần — chỉ lưu tối thiểu */,
      toEmail: p.toEmail || "",
      approvedAt: serverTimestamp(),
      approvedBy: adminUid,
    });
  }
}
