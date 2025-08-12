import { $ } from "../utils/dom.js";
import { randomGuestAvatar } from "../utils/avatar.js";

export function render() {
  const root = document.getElementById("app-root");
  root.innerHTML = `
  <section class="card"><div class="inner">
    <h2>Chào mừng 👋</h2>
    <p class="muted">Đăng nhập để tạo yêu cầu khoản chi và xem danh sách yêu cầu của bạn.</p>
  </div></section>`;
  const img = document.getElementById("user-photo");
  if (img && !img.src) img.src = randomGuestAvatar(40);
}
