// js/core/auth.js
window.P102 = window.P102 || {};
// Có thể cấu hình thêm email admin cho tiện (không bắt buộc)
window.P102.FIREBASE = window.P102.FIREBASE || {};
window.P102.FIREBASE.ADMIN_EMAILS = window.P102.FIREBASE.ADMIN_EMAILS || [];
// ví dụ: ["youremail@gmail.com"]

window.P102.isAdminUser = function (u) {
  const uidOK = !!(
    u &&
    window.P102.FIREBASE.ADMIN_UID &&
    u.uid === window.P102.FIREBASE.ADMIN_UID
  );
  const emailOK = !!(
    u &&
    window.P102.FIREBASE.ADMIN_EMAILS.includes((u.email || "").toLowerCase())
  );
  return uidOK || emailOK;
};

window.P102.renderAdminNav = function (u, selector = "#adminNav") {
  const el = document.querySelector(selector);
  if (!el) return;
  if (window.P102.isAdminUser(u)) el.classList.remove("d-none");
  else el.classList.add("d-none");
};
