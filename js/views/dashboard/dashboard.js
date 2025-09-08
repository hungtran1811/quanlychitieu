
// js/views/dashboard/dashboard.js
// Live: reads Firestore `debts` for current user if available (compat v12).
// Fallback: demo data when Firestore isn't initialized or query returns empty.

function fmt(v) {
  if (typeof v !== 'number') return v || '0';
  return v.toLocaleString('vi-VN') + ' đ';
}

async function readUserDebts(uid) {
  try {
    if (!(window.firebase && firebase.firestore)) return null;
    const db = firebase.firestore();
    // Query: all debts of this user, newest first
    const snap = await db.collection('debts')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return items;
  } catch (e) {
    console.warn('[dashboard] Firestore query failed:', e);
    return null;
  }
}

function renderRows(tbody, items) {
  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Chưa có dữ liệu.</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(it => {
    const statusBadge = it.status === 'unpaid'
      ? '<span class="badge text-bg-warning">Chưa thanh toán</span>'
      : it.status === 'approved'
      ? '<span class="badge text-bg-success">Đã duyệt</span>'
      : `<span class="badge text-bg-secondary">${(it.status||'—')}</span>`;
    return `
      <tr>
        <td>${it.title || '—'}</td>
        <td>${it.kind || '—'}</td>
        <td>${it.creditor || '—'}</td>
        <td class="text-end">${fmt(it.amount)}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

function computeTotal(items) {
  if (!items) return 0;
  // Sum only unpaid amounts
  return items
    .filter(it => (it.status || '').toLowerCase() === 'unpaid')
    .reduce((s, it) => s + (Number(it.amount)||0), 0);
}

export async function init(ctx) {
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await firebase.auth().signOut();
      window.navigate('/login');
    });
  }

  const userName = document.getElementById('userName');
  const u = (ctx && ctx.user) || null;
  userName.textContent = u?.displayName || u?.email || 'User';

  const totalDebt = document.getElementById('totalDebt');
  const tbody = document.getElementById('debtRows');

  // Try live Firestore
  let items = null;
  if (u && window.firebase && firebase.firestore) {
    items = await readUserDebts(u.uid);
  }

  if (items && items.length) {
    renderRows(tbody, items);
    totalDebt.textContent = fmt(computeTotal(items));
  } else {
    // Fallback demo
    totalDebt.textContent = fmt(1950000);
    renderRows(tbody, [
      { title: 'Tiền nhà 2025-09', kind: 'Tiền nhà', creditor: 'Chủ nhà', amount: 1720200, status: 'unpaid' },
      { title: 'Giấy vệ sinh', kind: 'Chi tiêu', creditor: 'A', amount: 120000, status: 'approved' },
      { title: 'Nước ngọt', kind: 'Chi tiêu', creditor: 'B', amount: 109800, status: 'approved' },
    ]);
  }
}
