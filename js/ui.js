// Minimal toast helper (Bootstrap 5-like)
const ui = {
  showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-bg-${type} border-0 show position-fixed bottom-0 end-0 m-3`;
    toast.role = 'alert';
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.closest('.toast').remove()"></button>
    </div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
};
