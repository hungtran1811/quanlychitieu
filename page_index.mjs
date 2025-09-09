// page_index.mjs — patch v3.4.1 small: rebind listeners after approvals to reflect debts for all users
import { auth, db, collection, addDoc, serverTimestamp, onAuthStateChanged, query, where, orderBy, limit, onSnapshot, doc, deleteDoc, getDocs, updateDoc } from "./firebase.mjs";
import { bindAuthUI, signInGoogle, signOutNow } from "./auth.mjs";
import { fmt, monthKeyFromDate, renderUserChips, uidSelected, userMap } from "./utils.mjs";

bindAuthUI();
document.getElementById("btnLogin")?.addEventListener("click", signInGoogle);
document.getElementById("btnLogout")?.addEventListener("click", signOutNow);

const mk = monthKeyFromDate();
document.getElementById("monthKey").textContent = mk;

let _usersCache = null, _nameMap = {};
async function fetchUsersOnce() {
  if (_usersCache) return _usersCache;
  const snap = await getDocs(collection(db, "users"));
  _usersCache = snap.docs.map(d=>d.data());
  _nameMap = userMap(_usersCache);
  return _usersCache;
}
async function initParticipants(currentUid) {
  await fetchUsersOnce();
  renderUserChips(document.getElementById("participants"), _usersCache, currentUid);
  const sel = document.getElementById("toUid");
  if (sel){
    sel.innerHTML = "";
    Object.entries(_nameMap).forEach(([uid, name]) => {
      if (uid !== currentUid) {
        const opt = document.createElement("option"); opt.value = uid; opt.textContent = name; sel.appendChild(opt);
      }
    });
  }
}
onAuthStateChanged(auth, (user) => { if (user) initParticipants(user.uid); });

// ... (rest the same as v3.2/3.3) – not included here to keep patch short
