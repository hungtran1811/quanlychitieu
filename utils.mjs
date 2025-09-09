// utils.mjs — format, month key, user picker, helpers
export const fmt = new Intl.NumberFormat('vi-VN');

export function monthKeyFromDate(d=new Date()){
  const y = d.getFullYear();
  const m = (d.getMonth()+1).toString().padStart(2,'0');
  return `${y}-${m}`;
}

// User picker: search + check-all + badges
export function makeUserPicker(container, users, currentUid, {selectSelf=true}={}){
  container.innerHTML = `
    <div class="d-flex gap-2 mb-2 flex-wrap">
      <input class="form-control form-control-sm w-auto" placeholder="Tìm tên..." id="upSearch">
      <div class="btn-group btn-group-sm" role="group">
        <button type="button" class="btn btn-outline-secondary" id="upAll">Chọn tất</button>
        <button type="button" class="btn btn-outline-secondary" id="upNone">Bỏ chọn</button>
        <button type="button" class="btn btn-outline-secondary" id="upInvert">Đảo chọn</button>
      </div>
    </div>
    <div id="upList" class="d-flex flex-wrap gap-2"></div>
  `;
  const list = container.querySelector("#upList");
  const search = container.querySelector("#upSearch");

  function render(filter=""){
    list.innerHTML = "";
    users
      .filter(u=> selectSelf || u.uid!==currentUid)
      .filter(u=> (u.displayName||u.email||"").toLowerCase().includes(filter.toLowerCase()))
      .forEach(u=>{
        const id = `up_${u.uid}`;
        const wrap = document.createElement("label");
        wrap.className = "form-check form-check-inline user-chip";
        wrap.innerHTML = `
          <input class="form-check-input" type="checkbox" id="${id}" value="${u.uid}">
          <span class="badge rounded-pill text-bg-light">${u.displayName || u.email}</span>
        `;
        list.appendChild(wrap);
      });
  }
  render();

  search.addEventListener("input", ()=> render(search.value));
  container.querySelector("#upAll").addEventListener("click", ()=> list.querySelectorAll("input").forEach(i=> i.checked = true));
  container.querySelector("#upNone").addEventListener("click", ()=> list.querySelectorAll("input").forEach(i=> i.checked = false));
  container.querySelector("#upInvert").addEventListener("click", ()=> list.querySelectorAll("input").forEach(i=> i.checked = !i.checked));

  return {
    values(){ return Array.from(list.querySelectorAll("input:checked")).map(i=> i.value); },
    set(ids){ list.querySelectorAll("input").forEach(i=> i.checked = ids.includes(i.value)); }
  };
}
