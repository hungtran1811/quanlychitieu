// js/core/router.js
// SPA Router with Firebase Auth guard and Admin UID check.
// Assumes firebase compat SDK is loaded + initialized in firebase-config.js
// Exposes window.navigate(path)

const ADMIN_UID = (window.P102 && window.P102.FIREBASE && window.P102.FIREBASE.ADMIN_UID) || null;

// Route table: path -> { view, script, guard }
// guard: "public" | "user" | "admin"
const routes = {
  '/login':     { view: '/js/views/login/login.html',       script: '/js/views/login/login.js',       guard: 'public' },
  '/dashboard': { view: '/js/views/dashboard/dashboard.html', script: '/js/views/dashboard/dashboard.js', guard: 'user'   },
  '/admin':     { view: '/js/views/admin/admin.html',       script: '/js/views/admin/admin.js',       guard: 'admin'  },
  '/bills':     { view: '/js/views/bills/bills.html',       script: '/js/views/bills/bills.js',       guard: 'user'   },
  // Dynamic route: /bills/:ym (YYYY-MM)
  '/bills/:ym': { view: '/js/views/bills/bill-detail.html', script: '/js/views/bills/bill-detail.js', guard: 'user'   },
  '/iou':       { view: '/js/views/iou/iou.html',           script: '/js/views/iou/iou.js',           guard: 'user'   },
  '/404':       { view: '/js/views/not-found/404.html',     script: null,                              guard: 'public' },
};

// --------------- Auth helpers ---------------
function getCurrentUser() {
  return new Promise((resolve) => {
    // If firebase not loaded yet, poll briefly
    if (!(window.firebase && firebase.auth)) return resolve(null);
    const unsub = firebase.auth().onAuthStateChanged((u) => {
      unsub();
      resolve(u);
    });
  });
}

function isAdminUser(user) {
  if (!user) return false;
  if (!ADMIN_UID) return false;
  return user.uid === ADMIN_UID;
}

// --------------- Routing core ---------------
function matchRoute(path) {
  if (routes[path]) return { key: path, params: {} };
  // match /bills/:ym (YYYY-MM)
  const billMatch = path.match(/^\/bills\/(\d{4}-\d{2})$/);
  if (billMatch) return { key: '/bills/:ym', params: { ym: billMatch[1] } };
  return { key: '/404', params: {} };
}

async function guardCheck(routeKey) {
  const route = routes[routeKey] || routes['/404'];
  const guard = route.guard || 'public';
  if (guard === 'public') return { ok: true };

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, redirect: '/login' };
  }
  if (guard === 'user') return { ok: true, user };
  if (guard === 'admin') {
    if (isAdminUser(user)) return { ok: true, user };
    return { ok: false, redirect: '/dashboard' };
  }
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

  // Annotate active nav links if needed
  document.querySelectorAll('a[data-link]').forEach(a => {
    a.setAttribute('data-active', a.getAttribute('href') === finalKey ? 'true' : 'false');
  });

  // Load and run associated script (as ES module)
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

// Intercept clicks on <a data-link>
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (a && a.getAttribute('href')) {
    e.preventDefault();
    navigate(a.getAttribute('href'));
  }
});

window.onpopstate = () => loadRoute(location.pathname);

// Boot
document.addEventListener('DOMContentLoaded', async () => {
  // Auto-redirect root to proper page
  const currentPath = location.pathname === '/' ? '/dashboard' : location.pathname;
  await loadRoute(currentPath);
});

// Expose navigate globally
window.navigate = navigate;
