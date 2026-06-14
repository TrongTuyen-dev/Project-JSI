/**
 * profile.js  —  Script cho trang profile.html
 *
 * Chức năng:
 *  1. Hiển thị avatar + tên + email người dùng
 *  2. Upload / đổi ảnh đại diện (Cloudinary qua server, fallback base64)
 *  3. Sửa tên hiển thị
 *  4. Ví tiền: xem số dư, nạp tiền (lưu localStorage per-user)
 *  5. Lịch sử giao dịch
 */

import {
  auth,
  db,
  getDisplayName,
  getAvatarUrl,
  generateAvatarUrl,
  renderNavbarUser,
  updateUserProfile
} from "./navbar.js";

import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { doc, getDoc, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Hằng số ───────────────────────────────────────────────────────────────────
const UPLOAD_URL = "http://localhost:3000/upload";

// ── Tiện ích UI ───────────────────────────────────────────────────────────────

function fmt(amount) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" })
    .format(amount || 0);
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch { return ""; }
}

function toast(msg, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `toast-msg ${type}`;
  el.innerHTML = `<i class="bi bi-${type === "success" ? "check-circle" : "x-circle"} me-2"></i>${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

function setUploadStatus(msg, type) {
  const el = document.getElementById("uploadStatus");
  if (!el) return;
  el.textContent = msg;
  el.className = "upload-status " + type;
  if (type === "success") setTimeout(() => { el.textContent = ""; el.className = "upload-status"; }, 3000);
}

// ── Ví tiền (Firestore: users/{uid}) ─────────────────────────────────────────

async function loadWallet(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : { balance: 0, txs: [] };
  } catch {
    return { balance: 0, txs: [] };
  }
}

async function addTopup(uid, amount) {
  const w = await loadWallet(uid);
  const newBal = (w.balance || 0) + amount;
  const newTx = {
    type: "topup",
    amount,
    note: "Nạp tiền vào ví",
    time: new Date().toISOString()
  };
  const newTxs = [newTx, ...(w.txs || [])].slice(0, 30);
  await setDoc(doc(db, "users", uid), {
    balance: newBal,
    txs: newTxs
  }, { merge: true });
  return { balance: newBal, txs: newTxs };
}

// ── Render Wallet UI ──────────────────────────────────────────────────────────

function renderWallet(w) {
  const bal = w.balance || 0;
  const txs = w.txs || [];

  const balEl = document.getElementById("walletBalance");
  const statBalEl = document.getElementById("statBalance");
  const statTxEl = document.getElementById("statTx");
  const listEl = document.getElementById("txList");

  if (balEl) balEl.textContent = fmt(bal);
  if (statBalEl) {
    statBalEl.textContent = bal >= 1000000
      ? (bal / 1000000).toFixed(1) + "M"
      : Math.floor(bal / 1000) + "K";
  }
  if (statTxEl) statTxEl.textContent = txs.length;

  if (!listEl) return;
  if (!txs.length) {
    listEl.innerHTML = `<p class="tx-empty"><i class="bi bi-inbox me-2"></i>Chưa có giao dịch nào</p>`;
    return;
  }
  listEl.innerHTML = txs.map(tx => `
    <div class="tx-item">
      <div class="d-flex align-items-center">
        <div class="tx-icon"><i class="bi bi-arrow-down-circle-fill"></i></div>
        <div>
          <div class="tx-note">${tx.note || "Giao dịch"}</div>
          <div class="tx-time">${fmtTime(tx.time)}</div>
        </div>
      </div>
      <div class="tx-amount">+${fmt(tx.amount)}</div>
    </div>`).join("");
}

// ── Khởi tạo trang ───────────────────────────────────────────────────────────

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  // Ẩn loading overlay
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "none";

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;

  // Render avatar navbar
  renderNavbarUser(user);

  // Điền thông tin profile
  const name      = getDisplayName(user);
  const avatarUrl = getAvatarUrl(user);

  const avatarImg = document.getElementById("avatarImg");
  if (avatarImg) {
    avatarImg.src = avatarUrl;
    avatarImg.onerror = () => { avatarImg.src = generateAvatarUrl(name); };
  }

  const inputName = document.getElementById("inputName");
  if (inputName) inputName.value = name;

  const emailEl = document.getElementById("profileEmail");
  if (emailEl) emailEl.textContent = user.email || "—";

  // Render ví từ Firestore
  renderWallet(await loadWallet(user.uid));
});

// ── Upload ảnh ────────────────────────────────────────────────────────────────

const fileInput = document.getElementById("fileInput");
if (fileInput) {
  fileInput.addEventListener("change", async function () {
    const file = this.files[0];
    if (!file || !currentUser) return;

    // Validate dung lượng
    if (file.size > 5 * 1024 * 1024) {
      setUploadStatus("❌ File quá lớn (tối đa 5MB)", "error");
      return;
    }

    // Preview ngay lập tức
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.getElementById("avatarImg");
      if (img) img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    setUploadStatus("⏳ Đang tải ảnh lên...", "loading");

    // Thử upload lên Cloudinary qua server node.js local
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(UPLOAD_URL, { method: "POST", body: formData });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Upload thất bại");

      await updateUserProfile(getDisplayName(currentUser), json.data.secure_url);
      setUploadStatus("✅ Ảnh đã được cập nhật!", "success");
      toast("Ảnh đại diện mới đã lưu!", "success");
      return;
    } catch (err) {
      console.warn("Server Cloudinary không khả dụng:", err.message);
    }

    // Fallback: lưu base64 vào Firebase Auth (chỉ ảnh ≤ 200KB)
    if (file.size <= 200 * 1024) {
      const r2 = new FileReader();
      r2.onload = async e2 => {
        try {
          await updateUserProfile(getDisplayName(currentUser), e2.target.result);
          setUploadStatus("✅ Lưu ảnh thành công!", "success");
          toast("Ảnh đã lưu thành công!", "success");
        } catch (e) {
          setUploadStatus("❌ Lưu ảnh thất bại: " + e.message, "error");
        }
      };
      r2.readAsDataURL(file);
    } else {
      setUploadStatus("⚠️ Cần khởi động server để upload ảnh > 200KB.", "error");
    }
  });
}

// ── Lưu tên ──────────────────────────────────────────────────────────────────

async function doSaveName() {
  const input = document.getElementById("inputName");
  if (!input || !currentUser) return;
  const name = input.value.trim();
  if (!name) return;
  try {
    await updateUserProfile(name);
    toast("Đã cập nhật tên hiển thị!", "success");
  } catch (e) {
    toast("Lỗi lưu tên: " + e.message, "error");
  }
}

const saveNameBtn = document.getElementById("saveName");
if (saveNameBtn) saveNameBtn.addEventListener("click", doSaveName);

const inputName = document.getElementById("inputName");
if (inputName) inputName.addEventListener("keydown", e => { if (e.key === "Enter") doSaveName(); });

// ── Nạp tiền ─────────────────────────────────────────────────────────────────

let selectedAmount = 0;

// Preset buttons
document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedAmount = parseInt(btn.dataset.amount, 10);
    const amountInput = document.getElementById("topupAmount");
    if (amountInput) amountInput.value = selectedAmount;
    const topupBtn = document.getElementById("btnTopup");
    if (topupBtn) topupBtn.disabled = false;
  });
});

// Nhập tay
const topupAmountInput = document.getElementById("topupAmount");
if (topupAmountInput) {
  topupAmountInput.addEventListener("input", e => {
    selectedAmount = parseInt(e.target.value, 10) || 0;
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
    const topupBtn = document.getElementById("btnTopup");
    if (topupBtn) topupBtn.disabled = selectedAmount < 10000;
  });
}

// Chọn phương thức thanh toán
document.querySelectorAll(".pay-method").forEach(m => {
  m.addEventListener("click", () => {
    document.querySelectorAll(".pay-method").forEach(x => x.classList.remove("active"));
    m.classList.add("active");
  });
});

// Xác nhận nạp
const btnTopup = document.getElementById("btnTopup");
if (btnTopup) {
  btnTopup.addEventListener("click", async () => {
    if (!currentUser || selectedAmount < 10000) return;

    btnTopup.disabled = true;
    btnTopup.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Đang xử lý...`;

    // Delay nhỏ để UX tốt hơn
    await new Promise(r => setTimeout(r, 500));

    try {
      const w = await addTopup(currentUser.uid, selectedAmount);
      renderWallet(w);
      toast(`✅ Nạp thành công ${fmt(selectedAmount)}! 🎉`, "success");

      // Reset form
      selectedAmount = 0;
      const amountInput = document.getElementById("topupAmount");
      if (amountInput) amountInput.value = "";
      document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
    } catch (e) {
      toast("❌ Nạp tiền thất bại: " + e.message, "error");
    } finally {
      btnTopup.disabled = false;
      btnTopup.innerHTML = `<i class="bi bi-lightning-charge-fill me-2"></i>XÁC NHẬN NẠP TIỀN`;
    }
  });
}

// ── Đăng xuất ────────────────────────────────────────────────────────────────

const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (e) {
      toast("Lỗi đăng xuất: " + e.message, "error");
    }
  });
}
