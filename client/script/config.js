// Thay thế đoạn chặn ở đầu file config.js bằng cách này:
import { auth } from "./menu.js"; // Import auth từ menu.js của bạn
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  const isLoginPage = window.location.pathname.includes("login.html");
  if (!user && !isLoginPage) {
    // Nếu chưa đăng nhập và không ở trang login thì mới đẩy về login
    window.location.href = "./login.html";
  }
});

// Phần còn lại của file config.js giữ nguyên...

// logout
window.handleSignOut = () => {
  localStorage.removeItem("currentUser");
  window.location.href = "./login.html";
};
