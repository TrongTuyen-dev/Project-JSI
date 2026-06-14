/**
 * cart.js — Giỏ hàng Celestial Meal
 * Đọc/ghi Firestore: collection "carts" / doc = user.uid
 * Ví tiền: collection "users" / doc = user.uid / field balance + txs
 */
import { auth, db, initProfile } from "./navbar.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Khởi tạo avatar navbar
initProfile();

// ── Tiện ích ──────────────────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat("vi-VN").format(n || 0) + "đ";
}

function toast(msg, type = "success") {
  let wrap = document.getElementById("toastWrap");
  if (!wrap) return;
  const icon = type === "success" ? "check-circle" : type === "error" ? "x-circle" : "info-circle";
  const el = document.createElement("div");
  el.className = `cm-toast ${type}`;
  el.innerHTML = `<i class="bi bi-${icon} me-2"></i>${msg}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

// ── Ví tiền (Firestore: users/{uid}) ─────────────────────────────────────────
async function getWallet(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : { balance: 0, txs: [] };
}

async function deductWallet(uid, amount, note) {
  const wallet = await getWallet(uid);
  const newBal = (wallet.balance || 0) - amount;
  if (newBal < 0) throw new Error("Số dư không đủ");
  const newTx = { type: "purchase", amount: -amount, note, time: new Date().toISOString() };
  await setDoc(doc(db, "users", uid), {
    balance: newBal,
    txs: [newTx, ...(wallet.txs || [])].slice(0, 30)
  }, { merge: true });
  return newBal;
}

// ── State ──────────────────────────────────────────────────────────────────────
let currentUser = null;
let unsubCart   = null; // real-time listener

// ── Render ─────────────────────────────────────────────────────────────────────
function renderItems(items) {
  const listEl    = document.getElementById("cartList");
  const emptyEl   = document.getElementById("cartEmpty");
  const summaryEl = document.getElementById("summarySection");
  if (!listEl) return;

  if (!items || items.length === 0) {
    listEl.innerHTML = "";
    if (emptyEl)   emptyEl.style.display   = "block";
    if (summaryEl) summaryEl.style.display = "none";
    updateSummary([]);
    return;
  }

  if (emptyEl)   emptyEl.style.display   = "none";
  if (summaryEl) summaryEl.style.display = "block";

  listEl.innerHTML = items.map((item, i) => `
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

  // Bind checkbox
  document.querySelectorAll(".item-check").forEach(cb => {
    cb.addEventListener("change", () => updateCheck(parseInt(cb.dataset.idx), cb.checked));
  });

  // Master checkbox
  const masterCb = document.getElementById("masterCheck");
  if (masterCb) {
    masterCb.checked = items.every(i => i.checked !== false);
    masterCb.onchange = () => toggleAll(masterCb.checked);
  }

  // Update header count
  const hdrEl = document.getElementById("cartCountHeader");
  if (hdrEl) hdrEl.textContent = `(${items.length} sản phẩm)`;

  updateSummary(items);
}

async function updateSummary(items) {
  items = items || [];
  const selected = items.filter(i => i.checked !== false);
  const count    = selected.reduce((s, i) => s + (i.quantity || 1), 0);
  const subtotal = selected.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const ship     = subtotal > 0 ? (subtotal >= 100000 ? 0 : 25000) : 0;
  const total    = subtotal + ship;

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText("sumCount",    count + " sản phẩm");
  setText("sumSubtotal", fmt(subtotal));
  setText("sumShip",     ship === 0 && subtotal > 0 ? "Miễn phí" : fmt(ship));
  setText("sumTotal",    fmt(total));

  // Wallet balance
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

  // Checkout button
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

// ── Cập nhật Firestore ─────────────────────────────────────────────────────────
async function getCartItems() {
  if (!currentUser) return [];
  const snap = await getDoc(doc(db, "carts", currentUser.uid));
  return snap.exists() ? (snap.data().items || []) : [];
}

async function saveCartItems(items) {
  if (!currentUser) return;
  await setDoc(doc(db, "carts", currentUser.uid), { items }, { merge: true });
}

// ── Actions (global vì onclick inline) ───────────────────────────────────────
window.changeQty = async function(index, delta) {
  const items = await getCartItems();
  items[index].quantity = Math.max(1, (items[index].quantity || 1) + delta);
  await saveCartItems(items);
};

window.removeItem = async function(index) {
  const items = await getCartItems();
  const name = items[index].name;
  items.splice(index, 1);
  await saveCartItems(items);
  toast(`Đã xóa "${name}" khỏi giỏ hàng`, "info");
};

async function updateCheck(index, checked) {
  const items = await getCartItems();
  items[index].checked = checked;
  await saveCartItems(items);
}

async function toggleAll(checked) {
  const items = await getCartItems();
  items.forEach(i => i.checked = checked);
  await saveCartItems(items);
}

window.clearCart = async function() {
  const items = await getCartItems();
  if (!items.length) { toast("Giỏ hàng đang trống!", "info"); return; }
  if (!confirm("Bạn có chắc muốn xóa toàn bộ giỏ hàng?")) return;
  await saveCartItems([]);
  toast("Đã xóa toàn bộ giỏ hàng", "info");
};

// ── Thanh toán ─────────────────────────────────────────────────────────────────
async function checkout() {
  if (!currentUser) { toast("Vui lòng đăng nhập!", "error"); return; }
  const items    = await getCartItems();
  const selected = items.filter(i => i.checked !== false);
  if (!selected.length) { toast("Chưa chọn sản phẩm nào!", "error"); return; }

  const subtotal = selected.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const ship     = subtotal >= 100000 ? 0 : 25000;
  const total    = subtotal + ship;

  const wallet = await getWallet(currentUser.uid);
  if ((wallet.balance || 0) < total) {
    toast(`Số dư không đủ! Cần ${fmt(total - wallet.balance)} nữa.`, "error");
    return;
  }

  const btnCO = document.getElementById("btnCheckout");
  if (btnCO) { btnCO.disabled = true; btnCO.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Đang xử lý...`; }

  try {
    // 1. Trừ tiền ví
    await deductWallet(
      currentUser.uid,
      total,
      `Thanh toán ${selected.length} món tại Celestial Meal`
    );

    // 2. Xóa các sản phẩm đã thanh toán, giữ lại unchecked
    const remaining = items.filter(i => i.checked === false);
    await saveCartItems(remaining);

    toast(`🎉 Thanh toán thành công! Đã trừ ${fmt(total)} từ ví.`, "success");
  } catch (err) {
    console.error(err);
    toast("Thanh toán thất bại: " + err.message, "error");
    if (btnCO) { btnCO.disabled = false; btnCO.innerHTML = `<i class="bi bi-lightning-charge-fill me-2"></i>THANH TOÁN NGAY`; }
  }
}

// ── Auth state + real-time cart listener ──────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  currentUser = user;

  // Hủy listener cũ nếu có
  if (unsubCart) { unsubCart(); unsubCart = null; }

  if (!user) {
    renderItems([]);
    return;
  }

  // Lắng nghe thay đổi giỏ hàng real-time
  unsubCart = onSnapshot(doc(db, "carts", user.uid), (snap) => {
    const items = snap.exists() ? (snap.data().items || []) : [];
    renderItems(items);
  });
});

// ── DOMContentLoaded ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnCheckout")?.addEventListener("click", checkout);
  document.getElementById("btnClear")?.addEventListener("click", window.clearCart);
  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    if (unsubCart) unsubCart();
    await signOut(auth);
    window.location.href = "login.html";
  });
});
