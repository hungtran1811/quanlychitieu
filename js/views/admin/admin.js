export function init() {
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await firebase.auth().signOut();
      window.navigate('/login');
    });
  }
}
