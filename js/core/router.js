const ADMIN_UID =
  (window.P102 && window.P102.FIREBASE && window.P102.FIREBASE.ADMIN_UID) ||
  null;
const ADMIN_EMAILS = ["hungtran00.nt@email.com"]; // thêm email của bạn
const routes = {
  "/login": {
    view: "/js/views/login/login.html",
    script: "/js/views/login/login.js",
    guard: "public",
  },
  "/dashboard": {
    view: "/js/views/dashboard/dashboard.html",
    script: "/js/views/dashboard/dashboard.js",
    guard: "user",
  },
  "/admin": {
    view: "/js/views/admin/admin.html",
    script: "/js/views/admin/admin.js",
    guard: "admin",
  },
  "/bills": {
    view: "/js/views/bills/bills.html",
    script: "/js/views/bills/bills.js",
    guard: "user",
  },
  "/bills/:ym": {
    view: "/js/views/bills/bill-detail.html",
    script: "/js/views/bills/bill-detail.js",
    guard: "user",
  },
  "/iou": {
    view: "/js/views/iou/iou.html",
    script: "/js/views/iou/iou.js",
    guard: "user",
  },
  "/404": {
    view: "/js/views/not-found/404.html",
    script: null,
    guard: "public",
  },
};
function getUser() {
  return new Promise((r) => {
    if (!(window.firebase && firebase.auth)) return r(null);
    const u = firebase.auth().onAuthStateChanged((x) => {
      u();
      r(x);
    });
  });
}

function isAdmin(u) {
  const okUid = ADMIN_UID && u?.uid === ADMIN_UID;
  const okMail = ADMIN_EMAILS.includes((u?.email || "").toLowerCase());
  return !!(okUid || okMail);
}
function match(p) {
  if (routes[p]) return { key: p, params: {} };
  const m = p.match(/^\/bills\/(\d{4}-\d{2})$/);
  if (m) return { key: "/bills/:ym", params: { ym: m[1] } };
  return { key: "/404", params: {} };
}
async function guard(k) {
  const rt = routes[k] || routes["/404"];
  const g = rt.guard || "public";
  if (g === "public") return { ok: true };
  const u = await getUser();
  if (!u) return { ok: false, redirect: "/login" };
  if (g === "user") return { ok: true, user: u };
  if (g === "admin")
    return isAdmin(u)
      ? { ok: true, user: u }
      : { ok: false, redirect: "/dashboard" };
  return { ok: true, user: u };
}
async function loadHTML(u) {
  const r = await fetch(u, { cache: "no-cache" });
  if (!r.ok) throw new Error("load fail:" + u);
  return r.text();
}
async function load(p) {
  const { key, params } = match(p);
  const g = await guard(key);
  const fk = g.ok ? key : g.redirect || "/login";
  const rt = routes[fk];
  const html = await loadHTML(rt.view);
  document.getElementById("app").innerHTML = html;
  if (rt.script) {
    const m = await import(rt.script + "?v=" + Date.now());
    if (m && typeof m.init === "function")
      m.init({ params, user: g.user || null, navigate });
  }
}
function navigate(p) {
  history.pushState({}, "", p);
  load(p);
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (a && a.getAttribute("href")) {
    e.preventDefault();
    navigate(a.getAttribute("href"));
  }
});
window.onpopstate = () => load(location.pathname);
document.addEventListener("DOMContentLoaded", () =>
  load(location.pathname === "/" ? "/dashboard" : location.pathname)
);
window.navigate = navigate;
