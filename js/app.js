import { getAuthInst } from "./store/firestore.js";
import { onAuthChanges, login, logout } from "./auth.js";
import { attachRouter, setAuthGuardState } from "./router.js"; // ⬅️ thêm setAuthGuardState
import { $, setBodyFlags } from "./utils/dom.js";
import { randomGuestAvatar } from "./utils/avatar.js";
import { stopMyRequestsRealtime } from "./pages/my-requests.js";

attachRouter();

/** ----------------------------
 *  NAVIGATION (giữ button[data-link])
 * ---------------------------- */
const PROTECTED = new Set([
  "#/add",
  "#/mine",
  "#/dashboard",
  "#/pay",
  "#/admin/queue",
  "#/admin/overview",
]);
function goto(hash) {
  if (!hash) return;
  if (location.hash !== hash) location.hash = hash;
}
function isProtectedRoute(h) {
  const key = (h || "").split("?")[0];
  return PROTECTED.has(key);
}

// Click chuột
document.addEventListener(
  "click",
  (e) => {
    const el = e.target.closest("button[data-link]");
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const to = el.getAttribute("data-link");
    goto(to);
  },
  true
);

// Bàn phím (Enter / Space trên button)
document.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target.closest("button[data-link]");
    if (!el) return;
    e.preventDefault();
    const to = el.getAttribute("data-link");
    goto(to);
  },
  true
);

// Login/Logout
$("#btn-login")?.addEventListener("click", async () => {
  try {
    await login();
    alert("Đăng nhập thành công");
  } catch (err) {
    let hint = err?.message || "Unknown error";
    if (err?.code === "auth/unauthorized-domain")
      hint = `Thiếu Authorized domain: ${location.hostname}`;
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

// Auth state → cập nhật UI + THÔNG BÁO CHO ROUTER
onAuthChanges(({ user, isAdmin }) => {
  // ⬇️ thêm dòng này để router biết bạn đã đăng nhập
  setAuthGuardState(!!user);

  setBodyFlags({ authed: !!user, admin: isAdmin });
  const nameEl = $("#user-name");
  const emailEl = $("#user-email");
  const uidEl = $("#user-uid");
  const img = $("#user-photo");

  if (user) {
    nameEl.textContent = user.displayName || "Bạn";
    emailEl.textContent = user.email || "—";
    uidEl.textContent = `uid:${user.uid.slice(0, 6)}…`;
    img.src = user.photoURL || img.src || randomGuestAvatar(40);
    $("#btn-login").classList.add("hidden");
    $("#btn-logout").classList.remove("hidden");
    $("#admin-badge").classList.toggle("hidden", !isAdmin);
  } else {
    stopMyRequestsRealtime();
    nameEl.textContent = "Khách";
    emailEl.textContent = "—";
    uidEl.textContent = "—";
    img.src = randomGuestAvatar(40);
    $("#btn-login").classList.remove("hidden");
    $("#btn-logout").classList.add("hidden");
    $("#admin-badge").classList.add("hidden");
  }
});

// Tip khi chạy file://
if (location.protocol === "file:") {
  console.warn(
    "Hãy chạy qua Hosting/HTTP server để Google Sign-In hoạt động đúng."
  );
}
