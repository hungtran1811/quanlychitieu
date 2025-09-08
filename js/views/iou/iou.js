
// js/views/iou/iou.js
function fmt(v){ return (Number(v)||0).toLocaleString('vi-VN') + ' đ'; }
function getMembers(){ return (window.P102 && window.P102.MEMBERS) ? window.P102.MEMBERS : []; }

function renderParticipants(containerId, currentUid){
  const box = document.getElementById(containerId);
  const members = getMembers();
  if (!box) return;
  if (!members.length){
    box.innerHTML = `<div class="alert alert-warning">Chưa cấu hình thành viên. Mở <code>js/members.js</code> và thêm UID, tên các thành viên.</div>`;
    return;
  }
  box.innerHTML = members.map(m => {
    const checked = (m.uid === currentUid) ? 'checked' : '';
    return `<div class="form-check">
      <input class="form-check-input participant" type="checkbox" data-uid="${m.uid}" data-name="${m.name}" ${checked}>
      <label class="form-check-label">${m.name}${m.uid===currentUid?' (bạn)':''}</label>
    </div>`;
  }).join('');
}

async function submitRequest(){
  try{
    if (!(window.firebase && firebase.firestore && firebase.auth)) {
      alert('Firebase chưa sẵn sàng.');
      return;
    }
    const user = firebase.auth().currentUser;
    if (!user){ window.navigate('/login'); return; }
    const amount = Number(document.getElementById('amount').value||0);
    const desc = document.getElementById('desc').value.trim();
    if (!amount || !desc){ alert('Nhập số tiền và mô tả.'); return; }
    const checks = Array.from(document.querySelectorAll('.participant:checked'));
    if (!checks.length){ alert('Chọn ít nhất 1 người tham gia.'); return; }
    const participants = checks.map(c => ({ uid: c.dataset.uid, name: c.dataset.name }));
    const payer = { uid: user.uid, name: user.displayName || user.email || 'User' };

    const db = firebase.firestore();
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const doc = {
      status: 'pending',
      amount,
      description: desc,
      payer,
      participants,
      requesterUid: user.uid,
      requesterName: payer.name,
      createdAt: now
    };
    await db.collection('iouRequests').add(doc);
    document.getElementById('amount').value = '';
    document.getElementById('desc').value = '';
    alert('Đã gửi yêu cầu (pending).');
    await loadLists(); // refresh
  }catch(e){
    console.error(e);
    alert('Gửi yêu cầu thất bại: '+e.message);
  }
}

async function loadYourQueues(uid){
  const db = firebase.firestore();
  const pendingSnap = await db.collection('iouRequests')
    .where('requesterUid','==',uid)
    .orderBy('createdAt','desc')
    .limit(50).get();
  const pending = pendingSnap.docs.map(d=>({id:d.id, ...d.data()}));
  const tbody = document.getElementById('yourQueue');
  tbody.innerHTML = pending.map(r => `
    <tr>
      <td>${(r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toISOString().slice(0,16).replace('T',' ') : '—')}</td>
      <td>${r.description||'—'}</td>
      <td class="text-end">${fmt(r.amount)}</td>
      <td><span class="badge ${r.status==='pending'?'text-bg-warning':(r.status==='approved'?'text-bg-success':'text-bg-danger')}">${r.status||'—'}</span></td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="text-muted">Chưa có yêu cầu.</td></tr>`;

  const approvedSnap = await db.collection('iouRequests')
    .where('requesterUid','==',uid)
    .where('status','==','approved')
    .orderBy('createdAt','desc')
    .limit(50).get();
  const approved = approvedSnap.docs.map(d=>({id:d.id, ...d.data()}));
  const tbody2 = document.getElementById('approvedList');
  tbody2.innerHTML = approved.map(r => `
    <tr>
      <td>${(r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toISOString().slice(0,16).replace('T',' ') : '—')}</td>
      <td>${r.description||'—'}</td>
      <td>${r.payer?.name||'—'}</td>
      <td class="text-end">${fmt(r.amount)}</td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="text-muted">Chưa có giao dịch đã duyệt.</td></tr>`;
}

async function loadLists(){
  const user = firebase.auth().currentUser;
  if (!user) return;
  await loadYourQueues(user.uid);
}

export function init(){
  const user = firebase.auth().currentUser;
  const currentUid = user?.uid || null;
  renderParticipants('participantBox', currentUid);

  const btn = document.getElementById('btnCreateReq');
  if (btn) btn.addEventListener('click', submitRequest);

  loadLists().catch(console.warn);
}
