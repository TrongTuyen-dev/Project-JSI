/**
 * detail.js — Script cho các trang chi tiết sản phẩm
 * Lưu giỏ hàng vào Firestore: collection "carts" / doc = user.uid
 */
import { auth, db, initProfile } from "./navbar.js";
import { signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Khởi tạo avatar navbar
initProfile();

// ── Toast thông báo ────────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  // Tạo container nếu chưa có
  let wrap = document.getElementById("detail-toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "detail-toast-wrap";
    wrap.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;";
    document.body.appendChild(wrap);
  }
  const colors = { success: "#27ae60", error: "#e74c3c", info: "#2980b9" };
  const icons  = { success: "✅", error: "❌", info: "ℹ️" };
  const el = document.createElement("div");
  el.style.cssText = `
    background:#2c1e14;border-left:4px solid ${colors[type]};color:#fff;
    padding:12px 18px;font-size:.85rem;border-radius:2px;
    box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:300px;
    animation:dtIn .3s forwards,dtOut .3s 2.7s forwards;
  `;
  el.innerHTML = `${icons[type]} ${msg}`;
  // inject keyframes một lần
  if (!document.getElementById("dt-kf")) {
    const kf = document.createElement("style");
    kf.id = "dt-kf";
    kf.textContent = "@keyframes dtIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}} @keyframes dtOut{to{opacity:0;transform:translateX(20px)}}";
    document.head.appendChild(kf);
  }
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

// ── Thêm vào giỏ hàng (Firestore) ────────────────────────────────────────────
window.addToCart = async function(button) {
  const user = auth.currentUser;
  if (!user) {
    showToast("Bạn cần đăng nhập để thêm món vào giỏ!", "error");
    setTimeout(() => window.location.href = "login.html", 1500);
    return;
  }

  const item = {
    name:     button.dataset.name  || "Món ăn",
    price:    Number(button.dataset.price) || 0,
    image:    button.dataset.image || "",
    oldPrice: Number(button.dataset.oldprice) || 0,
    quantity: 1,
    checked:  true
  };

  // Disable nút tránh double-click
  button.disabled = true;
  const origHTML = button.innerHTML;
  button.innerHTML = `<span style="opacity:.6">Đang thêm...</span>`;

  try {
    const cartRef  = doc(db, "carts", user.uid);
    const cartSnap = await getDoc(cartRef);

    if (!cartSnap.exists()) {
      await setDoc(cartRef, { items: [item] });
    } else {
      const items = cartSnap.data().items || [];
      const found = items.find(i => i.name === item.name);
      if (found) found.quantity += 1;
      else items.push(item);
      await updateDoc(cartRef, { items });
    }
    showToast(`Đã thêm "<b>${item.name}</b>" vào giỏ hàng!`, "success");
  } catch (err) {
    console.error("Lỗi thêm giỏ hàng:", err);
    showToast("Có lỗi xảy ra, vui lòng thử lại!", "error");
  } finally {
    button.disabled = false;
    button.innerHTML = origHTML;
  }
};

// ── Đăng xuất ─────────────────────────────────────────────────────────────────
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// ── Phần bình luận ────────────────────────────────────────────────────────────
function getStorageKey() {
  const title = document.querySelector(".detail-title");
  if (title) return "comments_" + title.innerText.trim().replace(/[^a-zA-Z0-9]/g, "_");
  return "product_comments_default";
}
function getComments() {
  try { return JSON.parse(localStorage.getItem(getStorageKey())) || []; }
  catch { return []; }
}
function saveComments(c) { localStorage.setItem(getStorageKey(), JSON.stringify(c)); }

function renderComments() {
  const list = document.getElementById("commentsList");
  const reviewCount = document.getElementById("reviewCount");
  if (!list) return;
  const comments = getComments();
  if (reviewCount) reviewCount.textContent = `(${comments.length} đánh giá)`;
  if (!comments.length) {
    list.innerHTML = `<p style="color:#8a7668;font-size:.85rem;">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>`;
    return;
  }
  list.innerHTML = comments.map(c => `
    <div style="border:1px solid #e8ddd0;padding:14px 18px;margin-bottom:12px;background:#fff;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <strong style="color:#2c1e14;">${c.name}</strong>
        <span style="color:#c5a059;font-size:.85rem;">${"★".repeat(c.rating)}${"☆".repeat(5 - c.rating)}</span>
      </div>
      <p style="margin:0;font-size:.88rem;color:#4a3728;">${c.text}</p>
      <small style="color:#8a7668;">${c.time}</small>
    </div>`).join("");
}

let selectedRating = 5;
document.querySelectorAll(".rating-input .bi-star, .rating-input .bi-star-fill").forEach(star => {
  star.addEventListener("click", () => {
    selectedRating = parseInt(star.dataset.rate);
    document.getElementById("commentRating").value = selectedRating;
    document.querySelectorAll(".rating-input i").forEach((s, i) => {
      s.className = i < selectedRating ? "bi bi-star-fill" : "bi bi-star";
      s.style.color = i < selectedRating ? "#c5a059" : "#ccc";
    });
  });
});

const btnAddComment = document.getElementById("btnAddComment");
if (btnAddComment) {
  btnAddComment.addEventListener("click", () => {
    const name = (document.getElementById("commentName")?.value || "").trim();
    const text = (document.getElementById("commentText")?.value || "").trim();
    if (!name || !text) { showToast("Vui lòng nhập tên và nội dung!", "error"); return; }
    const comments = getComments();
    comments.unshift({
      name, text, rating: selectedRating,
      time: new Date().toLocaleString("vi-VN")
    });
    saveComments(comments);
    document.getElementById("commentName").value = "";
    document.getElementById("commentText").value = "";
    renderComments();
    showToast("Đã gửi đánh giá!", "success");
  });
}

document.addEventListener("DOMContentLoaded", renderComments);
