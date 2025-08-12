let box;
export function toast(msg, ms = 2200) {
  if (!box) {
    box = document.createElement("div");
    box.style.cssText =
      "position:fixed;top:16px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:9999";
    document.body.appendChild(box);
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
