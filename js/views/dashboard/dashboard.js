export function init(ctx) {
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await firebase.auth().signOut();
      window.navigate('/login');
    });
  }
  // Placeholder data; hook Firestore later
  const totalDebt = document.getElementById('totalDebt');
  const tbody = document.getElementById('debtRows');
  totalDebt.textContent = '0 đ';
  tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Chưa có dữ liệu. (Sẽ nối Firestore sau)</td></tr>';
}
