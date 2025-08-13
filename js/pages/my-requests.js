import { currentUser } from "../auth.js";
import { subscribeMyRequests } from "../store/requests.js";
import { money, whenVN } from "../utils/format.js";

let _unsub = null; // giữ listener để app.js có thể stop khi rời trang

export async function render() {
  const u = currentUser();
  if (!u) {
    alert("Bạn cần đăng nhập.");
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
      <tbody id="tbody-req">
        <tr><td colspan="5" class="muted">Đang tải…</td></tr>
      </tbody>
    </table>
  </div></section>`;

  const tbody = document.getElementById("tbody-req");

  // Hủy listener cũ (nếu có) trước khi tạo mới
  if (_unsub) {
    _unsub();
    _unsub = null;
  }

  _unsub = subscribeMyRequests(u.uid, (rows) => {
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="muted">Chưa có yêu cầu nào.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map((r) => {
        const d =
          r.createdAt?.toDate?.() || new Date(r.payload?.date || Date.now());
        const note = r?.payload?.note || "";
        const amt = r?.payload?.amount || 0;
        return `<tr>
        <td>${whenVN(d)}</td>
        <td>${r.type}</td>
        <td class="small">${note}</td>
        <td>${money(amt)}</td>
        <td>${r.status}</td>
      </tr>`;
      })
      .join("");
  });
}

// Được app.js gọi khi rời route này
export function stopMyRequestsRealtime() {
  if (_unsub) {
    _unsub();
    _unsub = null;
  }
}
