export function init(ctx) {
  const ym = (ctx && ctx.params && ctx.params.ym) || '—';
  const el = document.getElementById('billYm');
  if (el) el.textContent = ym;
}
