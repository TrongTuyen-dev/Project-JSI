/**
 * search.js — Tìm kiếm món ăn (Celestial Meal)
 * - Tìm theo tên / lọc theo danh mục
 * - "Xem thêm" mở modal chi tiết đầy đủ
 * - Thêm vào giỏ hàng (Firestore: carts/{uid})
 */
import { auth, db, initProfile } from "./navbar.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { PRODUCTS } from "./products.js";

// Khởi tạo avatar navbar
initProfile();

let currentUser = null;
onAuthStateChanged(auth, (user) => { currentUser = user; });

// ── Toast ──────────────────────────────────────────────────────────────────────
function toast(msg, type = "success") {
  const wrap = document.getElementById("toastWrap");
  if (!wrap) return;
  const icon = type === "success" ? "check-circle" : type === "error" ? "x-circle" : "info-circle";
  const el = document.createElement("div");
  el.className = `cm-toast ${type}`;
  el.innerHTML = `<i class="bi bi-${icon} me-2"></i>${msg}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

function fmt(n) {
  return new Intl.NumberFormat("vi-VN").format(n || 0) + "đ";
}

// ── Thêm vào giỏ hàng (Firestore) ─────────────────────────────────────────────
async function addToCart(product, btn) {
  if (!currentUser) {
    toast("Bạn cần đăng nhập để thêm món vào giỏ!", "error");
    setTimeout(() => window.location.href = "login.html", 1200);
    return;
  }

  const item = {
    name: product.name,
    price: product.price,
    oldPrice: product.oldPrice || 0,
    image: product.image,
    quantity: 1,
    checked: true
  };

  let origHTML;
  if (btn) {
    btn.disabled = true;
    origHTML = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
  }

  try {
    const cartRef  = doc(db, "carts", currentUser.uid);
    const cartSnap = await getDoc(cartRef);

    if (!cartSnap.exists()) {
      await setDoc(cartRef, { items: [item] });
    } else {
      const items = cartSnap.data().items || [];
      const found = items.find(i => i.name === item.name);
      if (found) found.quantity = (found.quantity || 1) + 1;
      else items.push(item);
      await setDoc(cartRef, { items }, { merge: true });
    }
    toast(`✅ Đã thêm "<b>${product.name}</b>" vào giỏ hàng thành công!`, "success");
  } catch (err) {
    console.error(err);
    toast("Có lỗi xảy ra, vui lòng thử lại!", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHTML;
    }
  }
}

// ── Render danh sách kết quả ──────────────────────────────────────────────────
const resultsEl   = document.getElementById("results");
const metaEl      = document.getElementById("resultsMeta");
const emptyEl     = document.getElementById("searchEmpty");
const searchInput = document.getElementById("searchInput");

let activeCategory = "Tất cả";

function discountPercent(p) {
  if (!p.oldPrice || p.oldPrice <= p.price) return 0;
  return Math.round((1 - p.price / p.oldPrice) * 100);
}

function renderRatingStars(rating) {
  const full = Math.round(rating);
  let html = "";
  for (let i = 0; i < 5; i++) {
    html += `<i class="bi bi-star${i < full ? "-fill" : ""}"></i>`;
  }
  return html + ` ${rating.toFixed(1)}`;
}

function renderCard(p) {
  const disc = discountPercent(p);
  return `
    <div class="col-sm-6 col-lg-4 col-xl-3">
      <div class="food-card">
        <div class="food-card-img-wrap">
          <img class="food-card-img" src="${p.image}" alt="${p.name}"
               onerror="this.src='https://placehold.co/400x300/f5efe4/c5a059?text=🍽'">
          ${disc > 0 ? `<span class="food-card-discount">-${disc}%</span>` : ""}
          <span class="food-card-cat">${p.category}</span>
        </div>
        <div class="food-card-body">
          <div class="food-card-title">${p.name}</div>
          <div class="food-card-rating">${renderRatingStars(p.rating)}</div>
          <div class="food-card-desc">${p.desc}</div>
          <div class="food-card-price-row">
            <span class="food-card-price">${fmt(p.price)}</span>
            ${p.oldPrice ? `<span class="food-card-old-price">${fmt(p.oldPrice)}</span>` : ""}
          </div>
          <div class="food-card-actions">
            <button class="btn-view-more" data-id="${p.id}">Xem thêm</button>
            <button class="btn-quick-add" data-id="${p.id}" title="Thêm vào giỏ">
              <i class="bi bi-cart-plus"></i>
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderResults(list) {
  if (!resultsEl) return;

  if (!list.length) {
    resultsEl.innerHTML = "";
    if (emptyEl) emptyEl.style.display = "block";
    if (metaEl) metaEl.textContent = "";
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";
  if (metaEl) {
    const kw = searchInput.value.trim();
    metaEl.innerHTML = kw
      ? `Tìm thấy <strong>${list.length}</strong> món cho "<strong>${kw}</strong>"`
      : `Hiển thị <strong>${list.length}</strong> món${activeCategory !== "Tất cả" ? ` trong "<strong>${activeCategory}</strong>"` : ""}`;
  }

  resultsEl.innerHTML = list.map(renderCard).join("");

  // Bind events
  resultsEl.querySelectorAll(".btn-view-more").forEach(btn => {
    btn.addEventListener("click", () => openDetailModal(parseInt(btn.dataset.id)));
  });
  resultsEl.querySelectorAll(".btn-quick-add").forEach(btn => {
    btn.addEventListener("click", () => {
      const product = PRODUCTS.find(p => p.id === parseInt(btn.dataset.id));
      addToCart(product, btn);
    });
  });
}

function doSearch() {
  const kw = searchInput.value.trim().toLowerCase();
  let list = PRODUCTS;

  if (activeCategory !== "Tất cả") {
    list = list.filter(p => p.category === activeCategory);
  }
  if (kw) {
    list = list.filter(p => p.name.toLowerCase().includes(kw));
  }
  renderResults(list);
}

// ── Category chips ─────────────────────────────────────────────────────────────
document.querySelectorAll(".cat-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".cat-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeCategory = chip.dataset.cat;
    doSearch();
  });
});

// ── Search input ──────────────────────────────────────────────────────────────
if (searchInput) {
  searchInput.addEventListener("input", doSearch);
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
const modalBackdrop = document.getElementById("detailModalBackdrop");
const modalContent  = document.getElementById("detailModalContent");

function openDetailModal(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;

  const disc = discountPercent(p);

  modalContent.innerHTML = `
    <button class="detail-modal-close" id="closeModalBtn"><i class="bi bi-x-lg"></i></button>
    <div class="detail-modal-body">
      <div class="detail-modal-img">
        <img src="${p.image}" alt="${p.name}" onerror="this.src='https://placehold.co/600x400/f5efe4/c5a059?text=🍽'">
      </div>
      <div class="detail-modal-info">
        <h2>${p.name}</h2>
        <div class="detail-modal-rating">
          ${renderRatingStars(p.rating)}
          <span class="badge-best">Best Seller</span>
        </div>
        <p class="detail-modal-desc">${p.desc}</p>
        <div class="detail-modal-price">
          <span class="now">${fmt(p.price)}</span>
          ${p.oldPrice ? `<span class="old">${fmt(p.oldPrice)}</span>` : ""}
          ${disc > 0 ? `<span class="disc">-${disc}%</span>` : ""}
        </div>
        <div class="info-row"><i class="bi bi-truck"></i><strong> Vận chuyển:</strong> Miễn phí nội thành</div>
        <div class="info-row"><i class="bi bi-arrow-return-left"></i><strong> Đổi trả:</strong> 15 ngày miễn phí</div>
        <div class="info-row"><i class="bi bi-shield-check"></i><strong> Bảo hành:</strong> Chất lượng cam kết</div>
        <div class="mt-4">
          <button class="btn-add-cart-modal" id="modalAddCartBtn">
            <i class="bi bi-cart-plus me-2"></i>Thêm vào giỏ hàng
          </button>
        </div>
      </div>
    </div>
    <div class="detail-modal-fulldesc">
      <h6><i class="bi bi-info-circle me-2"></i>Chi tiết món ăn</h6>
      <p>${p.detail}</p>
    </div>
  `;

  modalBackdrop.classList.add("show");
  document.body.style.overflow = "hidden";

  document.getElementById("closeModalBtn").addEventListener("click", closeDetailModal);
  document.getElementById("modalAddCartBtn").addEventListener("click", (e) => {
    addToCart(p, e.currentTarget);
  });
}

function closeDetailModal() {
  modalBackdrop.classList.remove("show");
  document.body.style.overflow = "";
}

if (modalBackdrop) {
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeDetailModal();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetailModal();
});

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById("btnLogout")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

// ── Khởi tạo: hiển thị toàn bộ món ăn ban đầu ────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderResults(PRODUCTS);
});
