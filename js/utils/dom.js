export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) =>
  Array.from(root.querySelectorAll(sel));
export const show = (el) => el?.classList.remove("hidden");
export const hide = (el) => el?.classList.add("hidden");
export function setBodyFlags({ authed, admin }) {
  document.body.dataset.auth = authed ? "user" : "guest";
  document.body.dataset.admin = admin ? "1" : "0";
}
