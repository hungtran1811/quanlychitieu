import { getAuthInst } from "./store/firestore.js"; // firestore đã auto init
import { onAuthChanges, login, logout } from "./auth.js";
import { attachRouter, setAuthGuardState } from "./router.js";
import { $, setBodyFlags } from "./utils/dom.js";
import { randomGuestAvatar } from "./utils/avatar.js";

attachRouter();

// Nav buttons (hash routing)
addEventListener("click", (e) => {
  const a = e.target.closest("[data-link]");
  if (!a) return;
  e.preventDefault();
  location.hash = a.getAttribute("data-link");
});

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

// Auth state → cập nhật UI + guard
onAuthChanges(({ user, isAdmin }) => {
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
    nameEl.textContent = "Khách";
    emailEl.textContent = "—";
    uidEl.textContent = "—";
    img.src = randomGuestAvatar(40);
    $("#btn-login").classList.remove("hidden");
    $("#btn-logout").classList.add("hidden");
    $("#admin-badge").classList.add("hidden");
    if (
      [
        "#/add",
        "#/mine",
        "#/dashboard",
        "#/pay",
        "#/admin/queue",
        "#/admin/overview",
      ].includes(location.hash.split("?")[0])
    ) {
      location.hash = "#/welcome";
    }
  }
});

if (location.protocol === "file:") {
  console.warn(
    "Hãy chạy qua Hosting/HTTP server để Google Sign-In hoạt động đúng."
  );
}
