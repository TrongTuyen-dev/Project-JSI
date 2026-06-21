import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";


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

const registerForm = document.getElementById("register-form");


// Hàm thực hiện hiển thị thông báo lên giao diện
const messageBox = document.getElementById("message-box");
function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.className = `message-box ${type}`;
    messageBox.classList.remove("hidden");
}
registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
   const email = document.getElementById("email").value;
const password = document.getElementById("password").value;

    // Ẩn thông báo cũ trước khi gửi yêu cầu mới lên Firebase
    messageBox.classList.add("hidden");

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Hiện thông báo thành công
            showMessage("🎉 Đăng ký tài khoản thành công!", "success");
            
            // Đợi đúng 2 giây để người dùng kịp đọc rồi chuyển hướng sang trang đăng nhập
            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000);
        })
        .catch((error) => {
            // Việt hóa các mã lỗi phổ biến từ Firebase
            let errorMsg = "Đã xảy ra lỗi khi đăng ký. Vui lòng thử lại.";
            if (error.code === "auth/email-already-in-use") {
                errorMsg = "❌ Email này đã được sử dụng bởi tài khoản khác.";
            } else if (error.code === "auth/weak-password") {
                errorMsg = "❌ Mật khẩu quá yếu (Yêu cầu tối thiểu phải 6 ký tự).";
            } else if (error.code === "auth/invalid-email") {
                errorMsg = "❌ Định dạng email không chính xác.";
            }
            showMessage(errorMsg, "error");
        });
});