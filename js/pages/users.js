// CHỈ import, không khai báo lại subscribeAllUsers
import { subscribeAllUsers } from "../store/users.js";

let un = null;

export async function render() {
  const root = document.getElementById("app-root");
  root.innerHTML = `
    <section class="card"><div class="inner">
      <h2>Thành viên</h2>
      <div id="list" class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px"></div>
    </div></section>
  `;
  const list = document.getElementById("list");

  // Lắng nghe realtime danh sách users
  if (un) un();
  un = subscribeAllUsers((arr) => {
    if (!arr.length) {
      list.innerHTML = `<div class="muted">Chưa có người dùng.</div>`;
      return;
    }
    list.innerHTML = arr
      .map(
        (u) => `
      <div class="row" style="padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03)">
        <img class="avatar" src="${
          u.photoURL ||
          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' rx='20' fill='%23666'/></svg>"
        }" alt="">
        <div>
          <div><strong>${
            u.name || u.displayName || "(không tên)"
          }</strong></div>
          <div class="small muted">${u.email || "—"}</div>
        </div>
      </div>
    `
      )
      .join("");
  });
}

export function stopUsersRealtime() {
  if (un) un();
  un = null;
}
