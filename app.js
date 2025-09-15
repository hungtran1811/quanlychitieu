// app.js

// Đây là placeholder logic cho phần frontend: hiển thị avatar từ user, toggle split dạng custom, form bills có khoản ngoài lệ, switch giữa dashboard/admin

const ADMIN_UID = "rVrRomrCGbPqPcrPddtBTpdcLoh2";

// Giả sử bạn đã kết nối Firebase Auth & lấy user info nơi này

document.addEventListener("DOMContentLoaded", () => {
  // demo: giả sử user object
  const user = {
    uid: "abc123", // hoặc ADMIN_UID
    displayName: "Nguyễn Văn A",
    photoURL: "https://via.placeholder.com/40",
  };

  // Hiển thị avatar & tên
  const avatarEls = document.querySelectorAll("#user-avatar, #admin-avatar");
  avatarEls.forEach((el) => {
    if (user.photoURL) {
      el.src = user.photoURL;
      el.style.display = "inline-block";
    }
  });
  const nameEls = document.querySelectorAll("#user-name, #admin-name");
  nameEls.forEach((el) => {
    el.textContent = user.displayName;
  });

  // Toggle custom split in dashboard form
  const splitType = document.getElementById("input-split-type");
  const customContainer = document.getElementById("custom-split-container");
  splitType?.addEventListener("change", () => {
    if (splitType.value === "custom") {
      customContainer.style.display = "block";
    } else {
      customContainer.style.display = "none";
    }
  });

  // Toggle view between user/admin if admin
  const btnGoUser = document.getElementById("btn-go-user");
  if (user.uid === ADMIN_UID && btnGoUser) {
    btnGoUser.addEventListener("click", () => {
      window.location.href = "dashboard.html";
    });
  } else if (btnGoUser) {
    btnGoUser.style.display = "none";
  }
});
