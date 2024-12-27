import { app, auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
onAuthStateChanged(auth, (user) => {
  if (user) {
    const loginRegister = document.getElementById("loginRegister");
    loginRegister.innerHTML = `
        Xin chào ${user.email}
        <button class="btn btn-dark pb-2 pe-4 ps-4 pt-2" onclick="logOut()">Đăng xuất</button>
    `;
  } else {
    loginRegister.innerHTML = `
        <a class="btn btn-dark pb-2 pe-4 ps-4 pt-2" href="./html/login.html">Đăng nhập</a>
        <a class="btn btn-dark pb-2 pe-4 ps-4 pt-2" href="./html/register.html">Đăng ký</a>
    `;
  }
});

function signOut(auth) {
  return auth.signOut();
}

window.logOut = async () => {
  try {
    await signOut(auth);
    alert("Đăng xuất thành công");
  } catch (error) {
    alert(error.message);
  }
};
