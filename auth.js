// auth.js
const provider = new firebase.auth.GoogleAuthProvider();

async function signInWithGoogle() {
  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    alert("Đăng nhập thất bại: " + e.message);
  }
}

async function signOutNow() {
  try {
    await auth.signOut();
  } catch (e) {
    alert("Đăng xuất lỗi: " + e.message);
  }
}

function isAdmin(user) {
  return user && user.uid === window.ADMIN_UID;
}

// Ensure user profile doc exists
async function ensureUserDoc(user) {
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  const base = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    role: isAdmin(user) ? "admin" : "user",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (!snap.exists) {
    await ref.set({
      ...base,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } else {
    await ref.set(base, { merge: true });
  }
}

// Navbar visibility & route guard
auth.onAuthStateChanged(async (user) => {
  const authedEls = document.querySelectorAll("[data-authed]");
  const guestEls = document.querySelectorAll("[data-guest]");
  const adminEls = document.querySelectorAll("[data-admin]");
  const userName = document.getElementById("userName");
  const userAvatar = document.getElementById("userAvatar");

  if (user) {
    await ensureUserDoc(user);
    authedEls.forEach(e => e.classList.remove("hidden"));
    guestEls.forEach(e => e.classList.add("hidden"));
    if (userName) userName.textContent = user.displayName || user.email;
    if (userAvatar) userAvatar.src = user.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.displayName || user.email);
    // Admin-only UI
    if (adminEls) adminEls.forEach(e => isAdmin(user) ? e.classList.remove("hidden") : e.classList.add("hidden"));
  } else {
    authedEls.forEach(e => e.classList.add("hidden"));
    guestEls.forEach(e => e.classList.remove("hidden"));
    if (adminEls) adminEls.forEach(e => e.classList.add("hidden"));
  }
});
