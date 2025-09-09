// page_index.mjs — v1.1 dashboard fixes
import { auth, db, collection, doc, addDoc, serverTimestamp, onSnapshot, query, where, orderBy, getDocs } from "./firebase.mjs";
import { bindAuthUI, signInGoogle, signOutNow } from "./auth.mjs";
import { fmt, monthKeyFromDate, makeUserPicker } from "./utils.mjs";

bindAuthUI();
const btnLogin = document.getElementById("btnLogin"); if (btnLogin) btnLogin.addEventListener("click", signInGoogle);
const btnLogout = document.getElementById("btnLogout"); if (btnLogout) btnLogout.addEventListener("click", signOutNow);

const mk = monthKeyFromDate(); const mkEl = document.getElementById("monthKey"); if (mkEl) mkEl.textContent = mk;

let pickerApi = null;
auth.onAuthStateChanged(async (user)=>{
  if (!user) return;
  // users map
  const usersSnap = await getDocs(collection(db,"users"));
  const users = usersSnap.docs.map(d=>d.data());
  const name = {}; users.forEach(u=> name[u.uid] = u.displayName || u.email || u.uid);
  // build picker
  pickerApi = makeUserPicker(document.getElementById("picker"), users, user.uid, {selectSelf:false});

  // my expenses
  const myBody = document.getElementById("myExpBody");
  const qMy = query(collection(db,"expenses"), where("ownerId","==", user.uid), orderBy("createdAt","desc"));
  onSnapshot(qMy, (snap)=>{
    myBody.innerHTML = "";
    snap.forEach(docu=>{
      const d = docu.data();
      const tr = document.createElement("tr");
      const st = d.status==="approved" ? "<span class='badge badge-approve'>approved</span>" :
                d.status==="rejected" ? "<span class='badge badge-reject'>rejected</span>" :
                "<span class='badge text-bg-secondary'>pending</span>";
      tr.innerHTML = `<td style="width:20%">${st}</td>
        <td style="width:30%">${d.category}</td>
        <td style="width:15%">${fmt.format(d.amount)}</td>
        <td style="width:15%">${(d.participants||[]).length}</td>
        <td style="width:20%">${d.createdAt?.toDate?.().toLocaleString("vi-VN") || ""}</td>`;
      myBody.appendChild(tr);
    });
  });

  // debts boxes
  const box1 = document.getElementById("boxOweYou");
  const box2 = document.getElementById("boxYouOwe");
  function renderList(el, map){
    if (!el) return;
    const arr = Object.entries(map).sort((a,b)=> b[1]-a[1]);
    el.innerHTML = arr.length ? arr.map(([k,v])=>`<div class="d-flex justify-content-between"><span>${name[k]||k}</span><span>${fmt.format(v)}</span></div>`).join("") : "<div class='text-muted'>—</div>";
  }
  const q1 = query(collection(db,"splits"), where("status","==","approved"), where("monthKey","==", mk), where("payerId","==", user.uid));
  onSnapshot(q1, (snap)=>{
    const m={}; snap.forEach(d=>{ const x=d.data(); const id=x.debtorId; m[id]=(m[id]||0)+Number(x.shareAmount||0); }); renderList(box1, m);
  });
  const q2 = query(collection(db,"splits"), where("status","==","approved"), where("monthKey","==", mk), where("debtorId","==", user.uid));
  onSnapshot(q2, (snap)=>{
    const m={}; snap.forEach(d=>{ const x=d.data(); const id=x.payerId; m[id]=(m[id]||0)+Number(x.shareAmount||0); }); renderList(box2, m);
  });
});

// Save request
const btnSave = document.getElementById("btnSaveExpense");
if (btnSave) btnSave.addEventListener("click", async ()=>{
  const user = auth.currentUser; if (!user) return alert("Đăng nhập trước!");
  const amount = Number(document.getElementById("exAmount").value || 0);
  const category = document.getElementById("exCategory").value || "Khác";
  const note = document.getElementById("exNote").value || "";
  const participants = pickerApi ? pickerApi.values() : [];
  if (amount<=0) return alert("Nhập số tiền");
  if (participants.length===0) return alert("Chọn người chia");

  await addDoc(collection(db, "expenses"), {
    ownerId: user.uid, amount, category, note,
    participants, splitMode: "equal",
    status:"pending", monthKey: monthKeyFromDate(),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  alert("Đã lưu (pending). Admin sẽ duyệt.");
  document.getElementById("exAmount").value = "";
  document.getElementById("exCategory").value = "";
  document.getElementById("exNote").value = "";
});
