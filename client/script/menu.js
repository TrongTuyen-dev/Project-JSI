/**
 * menu.js — Script cho Menu.html
 * Dùng firebase-init.js (tránh khởi tạo trùng)
 */
import { auth, initProfile } from "./navbar.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Khởi tạo avatar navbar
initProfile();

// Đăng xuất
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
      alert("Đã đăng xuất thành công. Hẹn gặp lại quý khách!");
      window.location.href = "register.html";
    } catch (e) {
      console.error("Lỗi đăng xuất:", e);
    }
  });
}
