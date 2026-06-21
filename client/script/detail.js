/**
 * detail.js
 * - Load sản phẩm từ products.js theo ?id=
 * - Thêm giỏ hàng → localStorage
 * - Bình luận → Firestore: comments/{productId}/items
 */
import { auth, db, initProfile } from "./navbar.js";
import { signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { PRODUCTS } from "./products.js";

initProfile();

// ── Tiện ích ──────────────────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat("vi-VN").format(n || 0) + "đ";
}

function showToast(msg, type = "success") {
  let wrap = document.getElementById("detail-toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "detail-toast-wrap";
    wrap.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;";
    document.body.appendChild(wrap);
  }
  if (!document.getElementById("dt-kf")) {
    const kf = document.createElement("style");
    kf.id = "dt-kf";
    kf.textContent = "@keyframes dtIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}@keyframes dtOut{to{opacity:0;transform:translateX(20px)}}";
    document.head.appendChild(kf);
  }
  const colors = { success:"#27ae60", error:"#e74c3c", info:"#2980b9" };
  const icons  = { success:"✅", error:"❌", info:"ℹ️" };
  const el = document.createElement("div");
  el.style.cssText = `background:#2c1e14;border-left:4px solid ${colors[type]};color:#fff;padding:12px 18px;font-size:.85rem;border-radius:2px;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:300px;animation:dtIn .3s forwards,dtOut .3s 2.7s forwards;`;
  el.innerHTML = `${icons[type]} ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

// ── Lấy sản phẩm theo ?id= ────────────────────────────────────────────────────
const params    = new URLSearchParams(window.location.search);
const productId = parseInt(params.get("id"), 10) || 1;
const product   = PRODUCTS.find(p => p.id === productId) || PRODUCTS[0];

// ── Render thông tin sản phẩm ─────────────────────────────────────────────────
function renderProduct(p) {
  document.title = `${p.name} - Celestial Meal`;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set("pageTitle",      `${p.name} - Celestial Meal`);
  set("breadcrumbName", p.name);
  set("productName",    p.name);
  set("productRating",  p.rating.toFixed(1));
  set("productDesc",    p.desc);
  set("productPrice",   fmt(p.price));
  set("productFullDesc", p.detail);

  const img = document.getElementById("productImage");
  if (img) { img.src = p.image; img.alt = p.name; }

  const oldEl  = document.getElementById("productOldPrice");
  const discEl = document.getElementById("productDiscount");
  if (p.oldPrice && p.oldPrice > p.price) {
    const pct = Math.round((1 - p.price / p.oldPrice) * 100);
    if (oldEl)  oldEl.textContent  = fmt(p.oldPrice);
    if (discEl) discEl.textContent = `-${pct}%`;
  } else {
    if (oldEl)  oldEl.style.display  = "none";
    if (discEl) discEl.style.display = "none";
  }

  // Gán data-* cho nút thêm giỏ hàng
  const btn = document.getElementById("btnAddToCart");
  if (btn) {
    btn.dataset.name     = p.name;
    btn.dataset.price    = p.price;
    btn.dataset.oldprice = p.oldPrice || 0;
    btn.dataset.image    = p.image;
  }
}

// ── Render món liên quan ──────────────────────────────────────────────────────
function renderRelated(p) {
  const wrap = document.getElementById("relatedProducts");
  if (!wrap) return;
  let list = PRODUCTS.filter(x => x.category === p.category && x.id !== p.id);
  if (!list.length) list = PRODUCTS.filter(x => x.id !== p.id);
  wrap.innerHTML = list.slice(0, 3).map(r => `
    <div class="col-12 col-sm-6 col-md-4">
      <div class="card product-card h-100">
        <img src="${r.image}" class="card-img-top product-img" alt="${r.name}"
             onerror="this.src='https://placehold.co/400x300/f5efe4/c5a059?text=🍽'">
        <div class="card-body d-flex flex-column justify-content-between">
          <p class="product-title">${r.name}</p>
          <div class="price-rating">
            <p class="product-price">${fmt(r.price)}</p>
            <span class="rating"><i class="bi bi-star-fill"></i> ${r.rating.toFixed(1)}</span>
          </div>
          <a href="detail.html?id=${r.id}" class="btn btn-primary w-100 btn-sm">Xem chi tiết</a>
        </div>
      </div>
    </div>`).join("");
}

renderProduct(product);
renderRelated(product);

// ── Thêm vào giỏ hàng (localStorage) ─────────────────────────────────────────
window.addToCart = function(button) {
  const item = {
    name:     button.dataset.name     || "Món ăn",
    price:    Number(button.dataset.price)    || 0,
    oldPrice: Number(button.dataset.oldprice) || 0,
    image:    button.dataset.image    || "",
    quantity: 1,
    checked:  true
  };

  button.disabled = true;
  const orig = button.innerHTML;
  button.innerHTML = `<span style="opacity:.6">Đang thêm...</span>`;

  try {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const found = cart.find(i => i.name === item.name);
    if (found) found.quantity = (found.quantity || 1) + 1;
    else cart.push(item);
    localStorage.setItem("cart", JSON.stringify(cart));
    showToast(`✅ Đã thêm "<b>${item.name}</b>" vào giỏ hàng!`, "success");
  } catch (err) {
    showToast("Có lỗi xảy ra!", "error");
  } finally {
    button.disabled = false;
    button.innerHTML = orig;
  }
};

// ── Đăng xuất ─────────────────────────────────────────────────────────────────
document.getElementById("btnLogout")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

// ── Bình luận → Firestore ────────────────────────────────────────────────────
const COMMENT_COL = `comments_product_${product.id}`;

async function loadComments() {
  const listEl = document.getElementById("commentsList");
  const countEl = document.getElementById("reviewCount");
  if (!listEl) return;

  try {
    const q = query(collection(db, COMMENT_COL), orderBy("time", "desc"));
    const snap = await getDocs(q);
    const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (countEl) countEl.textContent = `(${comments.length} đánh giá)`;

    if (!comments.length) {
      listEl.innerHTML = `<p style="color:#8a7668;font-size:.85rem;">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>`;
      return;
    }

    listEl.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-header">
          <div class="comment-user">
            <i class="bi bi-person-circle"></i>
            <span class="comment-name">${c.name}</span>
          </div>
          <div class="d-flex align-items-center gap-2">
            <div class="comment-rating">
              ${"<i class='bi bi-star-fill'></i>".repeat(c.rating)}${"<i class='bi bi-star'></i>".repeat(5 - c.rating)}
            </div>
            <span class="comment-date">${c.timeStr || ""}</span>
          </div>
        </div>
        <p class="comment-content">${c.text}</p>
        <button class="btn-delete-comment" onclick="deleteComment('${c.id}')">
          <i class="bi bi-trash3 me-1"></i>Xóa
        </button>
      </div>`).join("");
  } catch (err) {
    console.warn("Lỗi load bình luận:", err);
    listEl.innerHTML = `<p style="color:#8a7668;font-size:.85rem;">Không thể tải bình luận. Vui lòng kiểm tra kết nối.</p>`;
  }
}

window.deleteComment = async function(docId) {
  if (!confirm("Bạn có chắc muốn xóa bình luận này?")) return;
  try {
    await deleteDoc(doc(db, COMMENT_COL, docId));
    showToast("Đã xóa bình luận", "info");
    loadComments();
  } catch (err) {
    showToast("Xóa thất bại!", "error");
  }
};

let selectedRating = 5;
document.querySelectorAll(".rating-input i").forEach(star => {
  star.addEventListener("click", () => {
    selectedRating = parseInt(star.dataset.rate);
    document.getElementById("commentRating").value = selectedRating;
    document.querySelectorAll(".rating-input i").forEach((s, i) => {
      s.className = i < selectedRating ? "bi bi-star-fill" : "bi bi-star";
      s.style.color = i < selectedRating ? "#ffb347" : "#ddd";
    });
  });
});

document.getElementById("btnAddComment")?.addEventListener("click", async () => {
  const name = (document.getElementById("commentName")?.value || "").trim();
  const text = (document.getElementById("commentText")?.value || "").trim();
  if (!name || !text) { showToast("Vui lòng nhập tên và nội dung!", "error"); return; }

  const btn = document.getElementById("btnAddComment");
  btn.disabled = true;
  try {
    await addDoc(collection(db, COMMENT_COL), {
      name, text,
      rating: selectedRating,
      time: Date.now(),
      timeStr: new Date().toLocaleString("vi-VN")
    });
    document.getElementById("commentName").value = "";
    document.getElementById("commentText").value = "";
    loadComments();
    showToast("Đã gửi đánh giá!", "success");
  } catch (err) {
    showToast("Gửi thất bại: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

document.addEventListener("DOMContentLoaded", loadComments);
