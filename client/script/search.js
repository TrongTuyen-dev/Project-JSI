
import { auth, initProfile } from "./navbar.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { PRODUCTS } from "./products.js";

initProfile();

let currentUser = null;
onAuthStateChanged(auth, user => { currentUser = user; });

// ════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════
const SEARCH_API_BASE = "https://www.themealdb.com/api/json/v1/"; 
const SEARCH_API_KEY  = "1";                                      

function buildApiUrl(path) {
  return `${SEARCH_API_BASE}${SEARCH_API_KEY}/${path}`;
}

async function searchViaApi(keyword) {
  try {
    const url = buildApiUrl(`search.php?s=${encodeURIComponent(keyword)}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.meals)) return []; // TheMealDB trả {"meals":null} khi không tìm thấy
    return data.meals.map(normalizeMeal);
  } catch (err) {
    console.warn("TheMealDB API lỗi, chuyển sang tìm trong dữ liệu local:", err.message);
    return null;
  }
}

/** Hash chuỗi → số nguyên dương (dùng để sinh giá/đánh giá ổn định cho từng món, không đổi mỗi lần render) */
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/** TheMealDB không có nhóm "Khai vị/Món chính/Tráng miệng" kiểu VN → quy đổi tương đối */
function mapMealCategory(strCategory = "") {
  if (strCategory === "Dessert") return "Tráng miệng";
  if (strCategory === "Starter" || strCategory === "Side") return "Khai vị";
  return "Món chính";
}


function normalizeMeal(meal) {
  const h        = hashStr(meal.idMeal || meal.strMeal || "0");
  const price    = 95000 + (h % 22) * 15000;                 // ~95.000đ – 410.000đ
  const oldPrice = Math.round((price * 1.18) / 1000) * 1000; // +18%, làm tròn nghìn
  const rating   = +(4.3 + (h % 7) * 0.1).toFixed(1);        // 4.3 – 4.9

  return {
    id:       `api-${meal.idMeal}`,
    name:     meal.strMeal,
    category: mapMealCategory(meal.strCategory),
    price,
    oldPrice,
    image:    meal.strMealThumb,
    rating,
    desc:     `${meal.strArea ? "Món " + meal.strArea + ". " : ""}${meal.strTags ? meal.strTags.split(",").join(", ") + "." : ""}`.trim() || "Công thức từ TheMealDB.",
    detail:   meal.strInstructions || ""
  };
}
// ════════════════════════════════════════════════════════

// ── Tiện ích ──────────────────────────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat("vi-VN").format(n || 0) + "đ"; }

/** Escape HTML để tránh chèn thẻ lạ vào DOM (đặc biệt với dữ liệu lấy từ API bên ngoài) */
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

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

// ── Thêm vào giỏ (localStorage) ──────────────────────────────────────────────
function addToCart(product, btn) {
  if (!currentUser) {
    toast("Bạn cần đăng nhập để thêm vào giỏ!", "error");
    return;
  }
  let origHTML;
  if (btn) { btn.disabled = true; origHTML = btn.innerHTML; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`; }
  try {
    const cart  = JSON.parse(localStorage.getItem("cart") || "[]");
    const found = cart.find(i => i.name === product.name);
    if (found) found.quantity = (found.quantity || 1) + 1;
    else cart.push({ name: product.name, price: product.price, oldPrice: product.oldPrice || 0, image: product.image, quantity: 1, checked: true });
    localStorage.setItem("cart", JSON.stringify(cart));
    toast(`✅ Đã thêm "<b>${product.name}</b>" vào giỏ hàng!`, "success");
  } catch { toast("Có lỗi xảy ra!", "error"); }
  finally { if (btn) { setTimeout(() => { btn.disabled = false; btn.innerHTML = origHTML; }, 500); } }
}

// ── Render card ───────────────────────────────────────────────────────────────
let currentList = PRODUCTS;

function discPct(p) {
  if (!p.oldPrice || p.oldPrice <= p.price) return 0;
  return Math.round((1 - p.price / p.oldPrice) * 100);
}
function stars(r) {
  const f = Math.round(r);
  return Array.from({length:5},(_,i)=>`<i class="bi bi-star${i<f?"-fill":""}"></i>`).join("") + ` ${r.toFixed(1)}`;
}

function renderCard(p) {
  const d = discPct(p);
  return `<div class="col-sm-6 col-lg-4 col-xl-3">
    <div class="food-card">
      <div class="food-card-img-wrap">
        <img class="food-card-img" src="${p.image}" alt="${escapeHtml(p.name)}" onerror="this.src='https://placehold.co/400x300/f5efe4/c5a059?text=🍽'">
        ${d > 0 ? `<span class="food-card-discount">-${d}%</span>` : ""}
        <span class="food-card-cat">${escapeHtml(p.category)}</span>
      </div>
      <div class="food-card-body">
        <div class="food-card-title">${escapeHtml(p.name)}</div>
        <div class="food-card-rating">${stars(p.rating)}</div>
        <div class="food-card-desc">${escapeHtml(p.desc)}</div>
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

function renderResults(list, metaHTML) {
  currentList = list;
  const resultsEl = document.getElementById("results");
  const metaEl    = document.getElementById("resultsMeta");
  const emptyEl   = document.getElementById("searchEmpty");
  if (!resultsEl) return;

  if (!list.length) {
    resultsEl.innerHTML = "";
    if (emptyEl) emptyEl.style.display = "block";
    if (metaEl)  metaEl.innerHTML = "";
    return;
  }
  if (emptyEl) emptyEl.style.display = "none";
  if (metaEl)  metaEl.innerHTML = metaHTML || `Hiển thị <strong>${list.length}</strong> món`;
  resultsEl.innerHTML = list.map(renderCard).join("");

  resultsEl.querySelectorAll(".btn-view-more").forEach(btn => {
    btn.addEventListener("click", () => openModal(btn.dataset.id));
  });
  resultsEl.querySelectorAll(".btn-quick-add").forEach(btn => {
    btn.addEventListener("click", () => {
      const p = currentList.find(x => String(x.id) === String(btn.dataset.id));
      if (p) addToCart(p, btn);
    });
  });
}

// ── Search logic ──────────────────────────────────────────────────────────────
let activeCat = "Tất cả";
let searchTimer = null;

async function doSearch() {
  const kw = (document.getElementById("searchInput")?.value || "").trim();
  if (!kw) {
    const list = activeCat === "Tất cả" ? PRODUCTS : PRODUCTS.filter(p => p.category === activeCat);
    renderResults(list, `Hiển thị <strong>${list.length}</strong> món`);
    return;
  }

  // Loading
  const loading = document.getElementById("searchLoading");
  if (loading) loading.style.display = "block";

  const apiResult = await searchViaApi(kw);
  if (loading) loading.style.display = "none";

  const kwL = kw.toLowerCase();
  const localMatches = PRODUCTS.filter(p => p.name.toLowerCase().includes(kwL));

  let list, metaSuffix = "";
  if (apiResult !== null) {
    // Gộp món có sẵn của nhà hàng + món tìm được từ TheMealDB (loại trùng tên)
    const existingNames = new Set(localMatches.map(p => p.name.toLowerCase()));
    const apiOnly = apiResult.filter(p => !existingNames.has(p.name.toLowerCase()));
    list = [...localMatches, ...apiOnly];
    if (apiOnly.length) metaSuffix = ` <span class="api-badge">+${apiOnly.length} từ TheMealDB</span>`;
  } else {
    list = localMatches;
  }

  if (activeCat !== "Tất cả") list = list.filter(p => p.category === activeCat);

  renderResults(list, `Tìm thấy <strong>${list.length}</strong> món cho "<strong>${kw}</strong>"${metaSuffix}`);
}

document.getElementById("searchInput")?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(doSearch, 350);
});

document.querySelectorAll(".cat-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".cat-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeCat = chip.dataset.cat;
    doSearch();
  });
});

// ── Modal Xem thêm ────────────────────────────────────────────────────────────
function openModal(id) {
  const p = currentList.find(x => String(x.id) === String(id));
  if (!p) return;
  const d = discPct(p);
  const mc = document.getElementById("detailModalContent");
  const mb = document.getElementById("detailModalBackdrop");
  if (!mc || !mb) return;

  mc.innerHTML = `
    <button class="detail-modal-close" id="closeModalBtn"><i class="bi bi-x-lg"></i></button>
    <div class="detail-modal-body">
      <div class="detail-modal-img">
        <img src="${p.image}" alt="${escapeHtml(p.name)}" onerror="this.src='https://placehold.co/600x400/f5efe4/c5a059?text=🍽'">
      </div>
      <div class="detail-modal-info">
        <h2>${escapeHtml(p.name)}</h2>
        <div class="detail-modal-rating">${stars(p.rating)}<span class="badge-best">Best Seller</span></div>
        <p class="detail-modal-desc">${escapeHtml(p.desc)}</p>
        <div class="detail-modal-price">
          <span class="now">${fmt(p.price)}</span>
          ${p.oldPrice ? `<span class="old">${fmt(p.oldPrice)}</span>` : ""}
          ${d > 0 ? `<span class="disc">-${d}%</span>` : ""}
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
      <p style="white-space:pre-line;">${escapeHtml(p.detail || p.desc)}</p>
    </div>`;

  mb.classList.add("show");
  document.body.style.overflow = "hidden";

  document.getElementById("closeModalBtn")?.addEventListener("click", closeModal);
  document.getElementById("modalAddCartBtn")?.addEventListener("click", e => addToCart(p, e.currentTarget));
}

function closeModal() {
  document.getElementById("detailModalBackdrop")?.classList.remove("show");
  document.body.style.overflow = "";
}

document.getElementById("detailModalBackdrop")?.addEventListener("click", e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById("btnLogout")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderResults(PRODUCTS, `Hiển thị <strong>${PRODUCTS.length}</strong> món`);
});
