// utils.mjs
export const fmt = new Intl.NumberFormat('vi-VN');

export function monthKeyFromDate(d=new Date()) {
  const y = d.getFullYear();
  const m = (d.getMonth()+1).toString().padStart(2,"0");
  return `${y}-${m}`;
}

export function uidSelected(checkboxName="participant") {
  return Array.from(document.querySelectorAll(`input[name='${checkboxName}']:checked`)).map(i => i.value);
}

export function renderUserChips(container, users, currentUid=null) {
  container.innerHTML = "";
  users.forEach(u => {
    const id = `p_${u.uid}`;
    const div = document.createElement("div");
    div.className = "form-check form-check-inline mb-2";
    div.innerHTML = `
      <input class="form-check-input" type="checkbox" name="participant" id="${id}" value="${u.uid}" ${u.uid===currentUid?"checked":""}>
      <label class="form-check-label" for="${id}">${u.displayName || u.email}</label>
    `;
    container.appendChild(div);
  });
}
