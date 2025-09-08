export function init() {
  const btn = document.getElementById('btnGoogle');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!(window.firebase && firebase.auth)) {
      alert('Firebase chưa sẵn sàng. Kiểm tra firebase-config.js và CDN v12.');
      return;
    }
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
      window.navigate('/dashboard');
    } catch (e) {
      alert('Đăng nhập thất bại: ' + e.message);
    }
  });
}
