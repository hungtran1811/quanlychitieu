// app.js — Phase 7 (stable) + Compact Menu
import { onAuthChanges, login, logout } from "./auth.js";
import { attachRouter, setAuthGuardState } from "./router.js";
import { $, setBodyFlags } from "./utils/dom.js";
import { randomGuestAvatar } from "./utils/avatar.js";
import { stopMyRequestsRealtime } from "./pages/my-requests.js";

// 1) Khởi động router
attachRouter();

/* 2) Điều hướng chung: click mọi phần tử có [data-link] */
addEventListener(
  "click",
  (e) => {
    const el = e.target.closest("[data-link]");
    if (!el) return;
    e.preventDefault();
    const to = el.getAttribute("data-link");
    if (!to) return;
    // đóng menu (nếu đang mở) rồi điều hướng
    closeMenu();
    if (location.hash !== to) location.hash = to;
  },
  true
);

// 3) Đăng nhập / Đăng xuất
$("#btn-login")?.addEventListener("click", async () => {
  try {
    await login();
    alert("Đăng nhập thành công");
  } catch (err) {
    console.error(err);
    let hint = err?.message || "Unknown error";
    if (err?.code === "auth/unauthorized-domain") {
      hint = `Thiếu Authorized domain: ${location.hostname}
Firebase Console → Authentication → Settings → Authorized domains → Add domain.`;
    }
    alert("Đăng nhập thất bại: " + hint);
  }
});
$("#btn-logout")?.addEventListener("click", async () => {
  try {
    await logout();
  } finally {
    location.hash = "#/welcome";
  }
});

/* 4) Đồng bộ trạng thái đăng nhập với UI + Router Guard */
onAuthChanges(({ user, isAdmin }) => {
  // Cho router biết trạng thái guard
  setAuthGuardState(!!user);

  // Cờ giao diện
  setBodyFlags({ authed: !!user, admin: isAdmin });

  // Ô thông tin footer (nếu có trong layout)
  const nameEl = $("#user-name");
  const emailEl = $("#user-email");
  const uidEl = $("#user-uid");
  const img = $("#user-photo");

  if (user) {
    nameEl && (nameEl.textContent = user.displayName || "Bạn");
    emailEl && (emailEl.textContent = user.email || "—");
    uidEl && (uidEl.textContent = `uid:${user.uid.slice(0, 6)}…`);
    if (img) img.src = user.photoURL || img.src || randomGuestAvatar(40);
    $("#btn-login")?.classList.add("hidden");
    $("#btn-logout")?.classList.remove("hidden");
    $("#admin-badge")?.classList.toggle("hidden", !isAdmin);
  } else {
    // dọn realtime listeners trang "Yêu cầu của tôi"
    stopMyRequestsRealtime?.();
    nameEl && (nameEl.textContent = "Khách");
    emailEl && (emailEl.textContent = "—");
    uidEl && (uidEl.textContent = "—");
    if (img) img.src = randomGuestAvatar(40);
    $("#btn-login")?.classList.remove("hidden");
    $("#btn-logout")?.classList.add("hidden");
    $("#admin-badge")?.classList.add("hidden");
  }
});

/* 5) Menu rút gọn */
const menu = $("#main-menu");
const btn = $("#menu-btn");
const panel = $("#menu-panel");

function closeMenu() {
  panel?.classList.add("hidden");
}
function toggleMenu(e) {
  e?.stopPropagation();
  panel?.classList.toggle("hidden");
}

btn?.addEventListener("click", toggleMenu);
addEventListener("click", (e) => {
  if (!menu?.contains(e.target)) closeMenu();
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});
addEventListener("hashchange", closeMenu);

// Tip khi chạy file://
if (location.protocol === "file:") {
  console.warn(
    "Hãy chạy qua Hosting/HTTP server để Google Sign-In hoạt động đúng."
  );
}
