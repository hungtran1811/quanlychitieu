// trong app.js hoặc trong mỗi trang
const toggle = document.createElement("button");
toggle.textContent = "Chế độ tối/sáng";
document.body.appendChild(toggle);
toggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
});
// On load
if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark");
}
