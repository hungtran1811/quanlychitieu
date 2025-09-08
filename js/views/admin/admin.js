
// js/views/admin/admin.js
function fmt(v){ return (Number(v)||0).toLocaleString('vi-VN') + ' đ'; }

async function loadPending(){
  const db = firebase.firestore();
  const snap = await db.collection('iouRequests')
    .where('status','==','pending')
    .orderBy('createdAt','desc')
    .limit(50).get();
  const items = snap.docs.map(d=>({id:d.id, ...d.data()}));
  const tbody = document.getElementById('pendingTbody');
  tbody.innerHTML = (items.map(r => `
    <tr data-id="${r.id}">
      <td>${(r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toISOString().slice(0,16).replace('T',' ') : '—')}</td>
      <td>${r.description||'—'}</td>
      <td>${r.payer?.name||'—'}</td>
      <td>${r.requesterName||'—'}</td>
      <td class="text-end">${fmt(r.amount)}</td>
      <td>
        <button class="btn btn-success btn-sm btn-approve">Duyệt</button>
        <button class="btn btn-outline-danger btn-sm btn-reject">Từ chối</button>
      </td>
    </tr>
  `).join('')) or `<tr><td colspan="6" class="text-muted">Không có yêu cầu pending.</td></tr>`;
}

async function approve(id){
  const db = firebase.firestore();
  const ref = db.collection('iouRequests').doc(id);
  const doc = await ref.get();
  if (!doc.exists) return alert('Yêu cầu không tồn tại.');
  const r = doc.data();
  const participants = Array.isArray(r.participants) ? r.participants : [];
  if (!participants.length) return alert('Không có người tham gia.');
  const each = Math.round(Number(r.amount||0) / participants.length);

  const batch = db.batch();
  const now = firebase.firestore.FieldValue.serverTimestamp();

  participants.forEach(p => {
    const debtRef = db.collection('debts').doc();
    batch.set(debtRef, {
      userId: p.uid,
      title: r.description || 'Chi tiêu',
      kind: 'Chi tiêu',
      creditor: r.payer?.name || '—',
      amount: each,
      status: 'unpaid',
      createdAt: now
    });
  });
  batch.update(ref, { status: 'approved', approvedAt: now });
  await batch.commit();
  await loadPending();
  alert('Đã duyệt & tạo nợ cho người tham gia.');
}

async function reject(id){
  const db = firebase.firestore();
  const ref = db.collection('iouRequests').doc(id);
  await ref.update({ status:'rejected', rejectedAt: firebase.firestore.FieldValue.serverTimestamp() });
  await loadPending();
  alert('Đã từ chối yêu cầu.');
}

export function init(){
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await firebase.auth().signOut();
      window.navigate('/login');
    });
  }

  const tbody = document.getElementById('pendingTbody');
  if (tbody) {
    tbody.addEventListener('click', (e)=>{
      const tr = e.target.closest('tr[data-id]'); if (!tr) return;
      const id = tr.getAttribute('data-id');
      if (e.target.classList.contains('btn-approve')) approve(id).catch(alert);
      if (e.target.classList.contains('btn-reject'))  reject(id).catch(alert);
    });
  }

  loadPending().catch(console.warn);
}
