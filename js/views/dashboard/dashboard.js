export function init(ctx) {
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
  totalDebt.textContent = '1.950.000 đ';
  tbody.innerHTML = `
    <tr><td>Tiền nhà 2025-09</td><td>Tiền nhà</td><td>Chủ nhà</td><td class="text-end">1.720.200 đ</td><td><span class="badge text-bg-warning">Chưa thanh toán</span></td></tr>
    <tr><td>Giấy vệ sinh</td><td>Chi tiêu</td><td>A</td><td class="text-end">120.000 đ</td><td><span class="badge text-bg-success">Đã duyệt</span></td></tr>
    <tr><td>Nước ngọt</td><td>Chi tiêu</td><td>B</td><td class="text-end">109.800 đ</td><td><span class="badge text-bg-success">Đã duyệt</span></td></tr>
  `;
}
