// Sửa đường dẫn import cho khớp với menu.js (dùng 10.12.2)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDP7nkvjEafM8XIVQlnl3c3hp4bHgN3Vc8",
  authDomain: "spck-tuyenjsi-10.firebaseapp.com",
  projectId: "spck-tuyenjsi-10",
  storageBucket: "spck-tuyenjsi-10.firebasestorage.app",
  messagingSenderId: "849414542869",
  appId: "1:849414542869:web:095821d5e0de71c3bf201c",
  measurementId: "G-BHXFRP2KG1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// --- ÉP BẮT BUỘC ĐỢI HTML LOAD XONG MỚI CHẠY JS ---
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const messageBox = document.getElementById("message-box");

    function showMessage(text, type) {
        if (messageBox) {
            messageBox.textContent = text;
            messageBox.className = `message-box ${type}`;
            messageBox.classList.remove("hidden");
        }
    }

    // Kiểm tra xem form có tồn tại không rồi mới gắn sự kiện
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault(); 
            
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            
            if (messageBox) messageBox.classList.add("hidden");

            signInWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    showMessage("🔓 Đăng nhập thành công! Đang chuyển hướng...", "success");
                    setTimeout(() => {
                        window.location.href = "Menu.html"; 
                    }, 1500);
                })
                .catch((error) => {
                    let errorMsg = "Đã xảy ra lỗi trong quá trình đăng nhập.";
                    if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
                        errorMsg = "❌ Sai tài khoản hoặc mật khẩu. Vui lòng kiểm tra lại.";
                    }
                    showMessage(errorMsg, "error");
                });
        });
    } else {
        console.error("LỖI: Không tìm thấy thẻ <form id='login-form'>. Hãy kiểm tra lại file login.html xem đã Save chưa nhé!");
    }

    // Đăng nhập bằng Google
    const btnGoogle = document.getElementById("btnGoogle");
    if (btnGoogle) {
        btnGoogle.addEventListener("click", async () => {
            if (messageBox) messageBox.classList.add("hidden");
            try {
                await signInWithPopup(auth, googleProvider);
                showMessage("🔓 Đăng nhập bằng Google thành công! Đang chuyển hướng...", "success");
                setTimeout(() => {
                    window.location.href = "Menu.html";
                }, 1200);
            } catch (error) {
                console.error("Lỗi đăng nhập Google:", error);
                let errorMsg = "❌ Đăng nhập bằng Google thất bại. Vui lòng thử lại.";
                if (error.code === "auth/popup-closed-by-user") {
                    errorMsg = "Bạn đã đóng cửa sổ đăng nhập Google trước khi hoàn tất.";
                } else if (error.code === "auth/account-exists-with-different-credential") {
                    errorMsg = "❌ Email này đã được dùng để đăng ký bằng phương thức khác.";
                } else if (error.code === "auth/operation-not-allowed") {
                    errorMsg = "❌ Đăng nhập Google chưa được bật trong Firebase Console.";
                }
                showMessage(errorMsg, "error");
            }
        });
    }
});