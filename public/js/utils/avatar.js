export function randomGuestAvatar(size = 40) {
  const hue = Math.floor(Math.random() * 360);
  const c1 = `hsl(${hue},70%,55%)`,
    c2 = `hsl(${(hue + 50) % 360},70%,45%)`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const ch = chars[Math.floor(Math.random() * chars.length)];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${c1}'/><stop offset='100%' stop-color='${c2}'/></linearGradient></defs>
<rect width='${size}' height='${size}' rx='${size / 2}' fill='url(#g)'/>
<text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='Inter,Segoe UI,Arial' font-size='${
    size * 0.5
  }' fill='rgba(255,255,255,.92)' font-weight='700'>${ch}</text>
</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
