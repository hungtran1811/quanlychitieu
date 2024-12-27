import { app, auth, db } from "./firebaseConfig.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
  collection,
  addDoc,
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const registerForm = document.querySelector("#registerForm");
const invalid = document.querySelectorAll(".invalid-feedback");

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fullName = document.querySelector("#fullName").value.trim();
  const age = document.querySelector("#age").value.trim();
  const email = document.querySelector("#email").value.trim();
  const phoneNumber = document.querySelector("#phoneNumber").value.trim();
  const password = document.querySelector("#password").value.trim();
  const checkBox = document.querySelector("#checkBox").checked;

  if (checkBox) {
    invalid[4].style.display = "none";
    if (fullName === "") {
      invalid[0].style.display = "block";
    } else {
      invalid[0].style.display = "none";
      if (age === "") {
        invalid[1].style.display = "block";
      } else {
        invalid[1].style.display = "none";
        if (email === "") {
          invalid[2].style.display = "block";
        } else {
          invalid[2].style.display = "none";
          if (password === "" || password.length < 6) {
            invalid[3].style.display = "block";
          } else {
            invalid[3].style.display = "none";
            if (phoneNumber === "") {
              invalid[4].style.display = "block";
            } else {
              invalid[4].style.display = "none";
              try {
                const userCredential = await createUserWithEmailAndPassword(
                  auth,
                  email,
                  password
                );
                const user = userCredential.user;
                await addDoc(collection(db, "users"), {
                  uid: user.uid,
                  fullName: fullName,
                  age: age,
                  email: email,
                  phoneNumber: phoneNumber,
                  password: password,
                });
                alert("Register successfully");
                window.location.href = "../index.html";
              } catch (error) {
                alert(error.message);
              }
            }
          }
        }
      }
    }
  } else {
    invalid[4].style.display = "block";
  }
});
