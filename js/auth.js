const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userInfo = document.getElementById('user-info');
const userPic = document.getElementById('user-pic');
const userName = document.getElementById('user-name');
const adminPreview = document.getElementById('admin-uid-preview');
if (adminPreview && window.ADMIN_UID) adminPreview.textContent = window.ADMIN_UID;

btnLogin.addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => ui.showToast(err.message, 'danger'));
});

btnLogout.addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(user => {
  if (user) {
    userInfo.classList.remove('d-none');
    if (user.photoURL) userPic.src = user.photoURL;
    userName.textContent = user.displayName || user.email;
    btnLogin.classList.add('d-none');
    btnLogout.classList.remove('d-none');

    // Simple admin hint (for Phase 2+ role gating logic)
    if (window.ADMIN_UID && user.uid === window.ADMIN_UID) {
      ui.showToast("Bạn đang đăng nhập với quyền ADMIN (UID khớp config).", 'success');
    }
  } else {
    userInfo.classList.add('d-none');
    btnLogin.classList.remove('d-none');
    btnLogout.classList.add('d-none');
  }
});
