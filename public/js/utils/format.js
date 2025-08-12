// public/js/utils/format.js
const vnd = new Intl.NumberFormat("vi-VN");
export const money = (n) => vnd.format(n ?? 0);
export const ymd = (d) => new Date(d).toISOString().slice(0, 10);
export const whenVN = (d) => new Date(d).toLocaleString("vi-VN"); // <= cái này
