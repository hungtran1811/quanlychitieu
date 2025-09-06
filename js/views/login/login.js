export function init() {
  const btn = document.getElementById('btnGoogle');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!(window.firebase && firebase.auth)) {
      alert('Firebase chưa sẵn sàng. Hãy kiểm tra firebase-config.js');
      return;
    }
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
      // After login, router will navigate based on guard
      window.navigate('/dashboard');
    } catch (e) {
      alert('Đăng nhập thất bại: ' + e.message);
    }
  });
}
