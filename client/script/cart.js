
import { auth, db, initProfile } from "./navbar.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

initProfile();

// ── Tiện ích ──────────────────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat("vi-VN").format(n || 0) + "đ";
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

// ── Giỏ hàng (localStorage) ───────────────────────────────────────────────────
function getCart() {
  try { return JSON.parse(localStorage.getItem("cart") || "[]"); }
  catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

// ── Ví tiền (Firestore: users/{uid}) ─────────────────────────────────────────
async function getWallet(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : { balance: 0, txs: [] };
  } catch { return { balance: 0, txs: [] }; }
}

async function deductWallet(uid, amount, note) {
  const wallet = await getWallet(uid);
  const newBal = (wallet.balance || 0) - amount;
  if (newBal < 0) throw new Error("Số dư không đủ");
  const newTx = {
    type: "purchase",
    amount: -amount,
    note,
    time: new Date().toISOString(),
    timeStr: new Date().toLocaleString("vi-VN")
  };
  await setDoc(doc(db, "users", uid), {
    balance: newBal,
    txs: [newTx, ...(wallet.txs || [])].slice(0, 30)
  }, { merge: true });
  return newBal;
}

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser = null;

// ── Render ────────────────────────────────────────────────────────────────────
function renderCart() {
  const cart     = getCart();
  const listEl   = document.getElementById("cartList");
  const emptyEl  = document.getElementById("cartEmpty");
  const sumEl    = document.getElementById("summarySection");
  if (!listEl) return;

  if (!cart.length) {
    listEl.innerHTML = "";
    if (emptyEl) emptyEl.style.display = "block";
    if (sumEl)   sumEl.style.display   = "none";
    updateSummary([]);
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";
  if (sumEl)   sumEl.style.display   = "block";

  listEl.innerHTML = cart.map((item, i) => `
    <div class="cart-item" id="row-${i}">
      <input type="checkbox" class="cart-check item-check" data-idx="${i}"
             ${item.checked !== false ? "checked" : ""}>
      <div class="cart-product">
        <img class="cart-img"
             src="${item.image || "https://placehold.co/72x72/f5efe4/c5a059?text=🍽"}"
             alt="${item.name}"
             onerror="this.src='https://placehold.co/72x72/f5efe4/c5a059?text=🍽'">
        <div>
          <div class="cart-name">${item.name}</div>
          <div class="cart-sub">Celestial Meal</div>
        </div>
      </div>
      <div>
        <div class="cart-price">${fmt(item.price)}</div>
        ${item.oldPrice ? `<div class="cart-price-old">${fmt(item.oldPrice)}</div>` : ""}
      </div>
      <div class="qty-wrap">
        <button class="qty-btn" onclick="window.changeQty(${i},-1)">−</button>
        <div class="qty-val">${item.quantity}</div>
        <button class="qty-btn" onclick="window.changeQty(${i},1)">+</button>
      </div>
      <div class="cart-subtotal">${fmt(item.price * item.quantity)}</div>
      <button class="btn-del" onclick="window.removeItem(${i})" title="Xóa">
        <i class="bi bi-trash3"></i>
      </button>
    </div>`).join("");

  // Checkbox events
  document.querySelectorAll(".item-check").forEach(cb => {
    cb.addEventListener("change", () => {
      const cart = getCart();
      cart[parseInt(cb.dataset.idx)].checked = cb.checked;
      saveCart(cart);
      updateSummary(cart);
    });
  });

  // Master checkbox
  const masterCb = document.getElementById("masterCheck");
  if (masterCb) {
    masterCb.checked = cart.every(i => i.checked !== false);
    masterCb.onchange = () => {
      const cart = getCart();
      cart.forEach(i => i.checked = masterCb.checked);
      saveCart(cart);
      renderCart();
    };
  }

  const hdrEl = document.getElementById("cartCountHeader");
  if (hdrEl) hdrEl.textContent = `(${cart.length} sản phẩm)`;

  updateSummary(cart);
}

async function updateSummary(cart) {
  cart = cart || getCart();
  const selected = cart.filter(i => i.checked !== false);
  const count    = selected.reduce((s, i) => s + (i.quantity || 1), 0);
  const subtotal = selected.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const ship     = subtotal > 0 ? (subtotal >= 100000 ? 0 : 25000) : 0;
  const total    = subtotal + ship;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("sumCount",    count + " sản phẩm");
  set("sumSubtotal", fmt(subtotal));
  set("sumShip",     ship === 0 && subtotal > 0 ? "Miễn phí" : fmt(ship));
  set("sumTotal",    fmt(total));

  // Ví tiền
  let walletBal = 0;
  if (currentUser) {
    const w = await getWallet(currentUser.uid);
    walletBal = w.balance || 0;
  }
  const walletEl = document.getElementById("walletBal");
  const shortEl  = document.getElementById("walletShort");
  if (walletEl) walletEl.textContent = fmt(walletBal);
  if (shortEl) {
    if (total > 0 && walletBal < total) {
      shortEl.textContent = `⚠ Ví thiếu ${fmt(total - walletBal)} — nạp thêm tại trang hồ sơ`;
      shortEl.style.display = "block";
    } else {
      shortEl.style.display = "none";
    }
  }

  // Nút thanh toán
  const btnCO = document.getElementById("btnCheckout");
  if (btnCO) {
    if (!currentUser) {
      btnCO.disabled = true;
      btnCO.innerHTML = `<i class="bi bi-person-x me-2"></i>Vui lòng đăng nhập`;
    } else if (count === 0) {
      btnCO.disabled = true;
      btnCO.innerHTML = `<i class="bi bi-cart-x me-2"></i>Chọn sản phẩm để thanh toán`;
    } else if (walletBal < total) {
      btnCO.disabled = true;
      btnCO.innerHTML = `<i class="bi bi-wallet2 me-2"></i>Số dư không đủ — Nạp tiền`;
    } else {
      btnCO.disabled = false;
      btnCO.innerHTML = `<i class="bi bi-lightning-charge-fill me-2"></i>THANH TOÁN NGAY`;
    }
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────
window.changeQty = function(index, delta) {
  const cart = getCart();
  cart[index].quantity = Math.max(1, (cart[index].quantity || 1) + delta);
  saveCart(cart);
  renderCart();
};

window.removeItem = function(index) {
  const cart = getCart();
  const name = cart[index].name;
  cart.splice(index, 1);
  saveCart(cart);
  renderCart();
  toast(`Đã xóa "${name}" khỏi giỏ hàng`, "info");
};

window.clearCart = function() {
  const cart = getCart();
  if (!cart.length) { toast("Giỏ hàng đang trống!", "info"); return; }
  if (!confirm("Bạn có chắc muốn xóa toàn bộ giỏ hàng?")) return;
  localStorage.removeItem("cart");
  renderCart();
  toast("Đã xóa toàn bộ giỏ hàng", "info");
};

// ── Thanh toán ────────────────────────────────────────────────────────────────
async function checkout() {
  if (!currentUser) { toast("Vui lòng đăng nhập!", "error"); return; }

  const cart     = getCart();
  const selected = cart.filter(i => i.checked !== false);
  if (!selected.length) { toast("Chưa chọn sản phẩm nào!", "error"); return; }

  const subtotal = selected.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const ship     = subtotal >= 100000 ? 0 : 25000;
  const total    = subtotal + ship;

  const wallet = await getWallet(currentUser.uid);
  if ((wallet.balance || 0) < total) {
    toast(`Số dư không đủ! Cần thêm ${fmt(total - (wallet.balance || 0))}.`, "error");
    return;
  }

  const btnCO = document.getElementById("btnCheckout");
  if (btnCO) { btnCO.disabled = true; btnCO.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Đang xử lý...`; }

  try {
    // Trừ tiền ví Firestore
    await deductWallet(
      currentUser.uid,
      total,
      `Thanh toán ${selected.length} món tại Celestial Meal`
    );

    // Xóa sản phẩm đã chọn khỏi localStorage
    const remaining = cart.filter(i => i.checked === false);
    saveCart(remaining);

    renderCart();
    toast(`🎉 Thanh toán thành công! Đã trừ ${fmt(total)} từ ví.`, "success");
  } catch (err) {
    toast("Thanh toán thất bại: " + err.message, "error");
    if (btnCO) { btnCO.disabled = false; btnCO.innerHTML = `<i class="bi bi-lightning-charge-fill me-2"></i>THANH TOÁN NGAY`; }
  }
}

// ── Auth state ────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  renderCart();
});

// ── DOMContentLoaded ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnCheckout")?.addEventListener("click", checkout);
  document.getElementById("btnClear")?.addEventListener("click", window.clearCart);
  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
});
