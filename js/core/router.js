// js/core/router.js
// SPA Router with Firebase Auth guard and Admin UID check (compat SDK).
// Exposes window.navigate(path)

const ADMIN_UID = (window.P102 && window.P102.FIREBASE && window.P102.FIREBASE.ADMIN_UID) || null;

const routes = {
  '/login':     { view: '/js/views/login/login.html',       script: '/js/views/login/login.js',       guard: 'public' },
  '/dashboard': { view: '/js/views/dashboard/dashboard.html', script: '/js/views/dashboard/dashboard.js', guard: 'user'   },
  '/admin':     { view: '/js/views/admin/admin.html',       script: '/js/views/admin/admin.js',       guard: 'admin'  },
  '/bills':     { view: '/js/views/bills/bills.html',       script: '/js/views/bills/bills.js',       guard: 'user'   },
  '/bills/:ym': { view: '/js/views/bills/bill-detail.html', script: '/js/views/bills/bill-detail.js', guard: 'user'   },
  '/iou':       { view: '/js/views/iou/iou.html',           script: '/js/views/iou/iou.js',           guard: 'user'   },
  '/404':       { view: '/js/views/not-found/404.html',     script: null,                              guard: 'public' },
};

function getCurrentUser() {
  return new Promise((resolve) => {
    if (!(window.firebase && firebase.auth)) return resolve(null);
    const unsub = firebase.auth().onAuthStateChanged((u) => { unsub(); resolve(u); });
  });
}

function isAdminUser(user) {
  return !!(user && ADMIN_UID && user.uid === ADMIN_UID);
}

function matchRoute(path) {
  if (routes[path]) return { key: path, params: {} };
  const m = path.match(/^\/bills\/(\d{4}-\d{2})$/);
  if (m) return { key: '/bills/:ym', params: { ym: m[1] } };
  return { key: '/404', params: {} };
}

async function guardCheck(routeKey) {
  const route = routes[routeKey] || routes['/404'];
  const guard = route.guard || 'public';
  if (guard === 'public') return { ok: true };
  const user = await getCurrentUser();
  if (!user) return { ok: false, redirect: '/login' };
  if (guard === 'user') return { ok: true, user };
  if (guard === 'admin') return isAdminUser(user) ? { ok: true, user } : { ok: false, redirect: '/dashboard' };
  return { ok: true, user };
}

async function loadHTML(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Failed to load view: ' + url);
  return res.text();
}

async function loadRoute(path) {
  const { key, params } = matchRoute(path);
  const guard = await guardCheck(key);
  const finalKey = guard.ok ? key : (guard.redirect || '/login');
  const route = routes[finalKey];

  const html = await loadHTML(route.view);
  const app = document.getElementById('app');
  app.innerHTML = html;

  document.querySelectorAll('a[data-link]').forEach(a => {
    a.setAttribute('data-active', a.getAttribute('href') === finalKey ? 'true' : 'false');
  });

  if (route.script) {
    const module = await import(route.script + '?v=' + Date.now());
    if (module && typeof module.init === 'function') {
      module.init({ params, user: guard.user || null, navigate });
    }
  }
}

function navigate(path) {
  history.pushState({}, '', path);
  loadRoute(path);
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (a && a.getAttribute('href')) {
    e.preventDefault();
    navigate(a.getAttribute('href'));
  }
});

window.onpopstate = () => loadRoute(location.pathname);

document.addEventListener('DOMContentLoaded', async () => {
  const currentPath = location.pathname === '/' ? '/dashboard' : location.pathname;
  await loadRoute(currentPath);
});

window.navigate = navigate;
