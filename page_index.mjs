// page_index.mjs — v3.4.3 HOTFIX
// Fix: avoid optional-chaining on assignment (not allowed): use safe get + set.

import { auth, db, collection, query, where, onSnapshot } from "./firebase.mjs";
import { bindAuthUI, signInGoogle, signOutNow } from "./auth.mjs";
import { fmt, monthKeyFromDate } from "./utils.mjs";

bindAuthUI();
const btnLogin = document.getElementById("btnLogin");
if (btnLogin) btnLogin.addEventListener("click", signInGoogle);
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) btnLogout.addEventListener("click", signOutNow);

const mk = monthKeyFromDate();
const monthEl = document.getElementById("monthKey");
if (monthEl) monthEl.textContent = mk;

function renderList(el, map){
  if (!el) return;
  const entries = Object.entries(map).sort((a,b)=> b[1]-a[1]);
  el.innerHTML = entries.length
    ? entries.map(([name,amt]) => `<div class="d-flex justify-content-between"><span>${name}</span><span>${fmt.format(amt)}</span></div>`).join("")
    : "<div class='text-muted'>—</div>";
}

auth.onAuthStateChanged((user)=>{
  if (!user) return;
  const uid = user.uid;

  // Ai nợ bạn
  const box1 = document.getElementById("boxOweYou") || document.getElementById("listOweYou") || document.querySelector("#debtToYou");
  const q1 = query(collection(db,"splits"), where("status","==","approved"), where("monthKey","==", mk), where("payerId","==", uid));
  onSnapshot(q1, (snap)=>{
    const m={};
    snap.forEach(d=>{ const x=d.data(); const name=x.debtorName||x.debtorId; m[name]=(m[name]||0)+Number(x.shareAmount||0); });
    renderList(box1, m);
  });

  // Bạn đang nợ ai
  const box2 = document.getElementById("boxYouOwe") || document.getElementById("listYouOwe") || document.querySelector("#youOwe");
  const q2 = query(collection(db,"splits"), where("status","==","approved"), where("monthKey","==", mk), where("debtorId","==", uid));
  onSnapshot(q2, (snap)=>{
    const m={};
    snap.forEach(d=>{ const x=d.data(); const name=x.payerName||x.payerId; m[name]=(m[name]||0)+Number(x.shareAmount||0); });
    renderList(box2, m);
  });
});
