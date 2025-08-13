import { currentUser } from "../auth.js";
import { subscribeMyRequests } from "../store/requests.js";
import { money, whenVN } from "../utils/format.js";

let un = null;

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
      <h2>Yêu cầu của tôi</h2>
      <table class="table">
        <thead>
          <tr><th>Thời gian</th><th>Loại</th><th>Ghi chú</th><th>Số tiền</th><th>Trạng thái</th></tr>
        </thead>
        <tbody id="tbody-req"><tr><td colspan="5" class="muted">Đang tải…</td></tr></tbody>
      </table>
    </div></section>
  `;
  const tbody = document.getElementById("tbody-req");

  if (un) un();
  un = subscribeMyRequests(u.uid, (rows) => {
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Chưa có yêu cầu nào.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((r) => {
        const d =
          r.createdAt?.toDate?.() || new Date(r.payload?.date || Date.now());
        return `
        <tr>
          <td>${whenVN(d)}</td>
          <td>${r.type}</td>
          <td class="small">${r.payload?.note || ""}</td>
          <td>${money(r.payload?.amount || 0)}</td>
          <td>${r.status}</td>
        </tr>
      `;
      })
      .join("");
  });
}

export function stopMyRequestsRealtime() {
  if (un) un();
  un = null;
}
