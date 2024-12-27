import { app, auth, db } from "./firebaseConfig.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
onAuthStateChanged(auth, (user) => {
  if (user) {
  } else {
    const loginForm = document.querySelector("#loginForm");
    const invalid = document.querySelectorAll(".invalid-feedback");

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.querySelector("#email").value.trim();
      const password = document.querySelector("#password").value.trim();
      if (email === "") {
        invalid[0].style.display = "block";
      } else {
        invalid[0].style.display = "none";
        if (password === "" || password.length < 6) {
          invalid[1].style.display = "block";
        } else {
          invalid[1].style.display = "none";
          try {
            await signInWithEmailAndPassword(auth, email, password);
            alert("Login successfully");
            window.location.href = "../index.html";
          } catch (error) {
            alert(error.message);
          }
        }
      }
    });
  }
});
