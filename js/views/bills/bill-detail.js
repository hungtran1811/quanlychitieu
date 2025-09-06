export function init(ctx) {
  const ym = (ctx && ctx.params && ctx.params.ym) || '—';
  document.getElementById('billYm').textContent = ym;
  // Placeholder values until Firestore is wired
  document.getElementById('landlordTotal').textContent = '5.160.600 đ';
  document.getElementById('computedTotal').textContent = '5.160.600 đ';
  document.getElementById('diff').textContent = '0 đ';
  document.getElementById('shares').innerHTML = `
    <ul class="list-group">
      <li class="list-group-item d-flex justify-content-between"><span>Hưng</span><strong>1.720.200 đ</strong></li>
      <li class="list-group-item d-flex justify-content-between"><span>B</span><strong>1.720.200 đ</strong></li>
      <li class="list-group-item d-flex justify-content-between"><span>C</span><strong>1.720.200 đ</strong></li>
    </ul>
  `;
}
