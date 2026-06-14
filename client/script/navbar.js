/**
 * navbar.js — Module dùng chung cho MỌI trang
 * Export: auth, db, initProfile, renderNavbarUser,
 *         getDisplayName, getAvatarUrl, generateAvatarUrl, updateUserProfile
 */
import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, updateProfile }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export { auth, db };

// ── Tiện ích ──────────────────────────────────────────────────────────────────
export function generateAvatarUrl(name) {
  return "https://ui-avatars.com/api/?background=c5a059&color=2c1e14&bold=true&size=128&name="
    + encodeURIComponent(name || "U");
}
export function getDisplayName(user) {
  if (!user) return "";
  if (user.displayName) return user.displayName;
  if (user.email) return user.email.split("@")[0];
  return "Khách";
}
export function getAvatarUrl(user) {
  if (!user) return generateAvatarUrl("?");
  if (user.photoURL) return user.photoURL;
  return generateAvatarUrl(getDisplayName(user));
}

// ── CSS inject (chỉ 1 lần) ────────────────────────────────────────────────────
function injectAvatarStyles() {
  if (document.getElementById("navbar-avatar-css")) return;
  const s = document.createElement("style");
  s.id = "navbar-avatar-css";
  s.textContent = `
    .navbar-user-wrapper{display:flex;align-items:center;gap:8px;text-decoration:none;cursor:pointer;}
    .navbar-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;
      border:2px solid #c5a059;box-shadow:0 0 6px rgba(197,160,89,.5);
      flex-shrink:0;transition:transform .2s,box-shadow .2s;}
    .navbar-avatar:hover{transform:scale(1.1);box-shadow:0 0 12px rgba(197,160,89,.9);}
    .navbar-username{color:#c5a059;font-size:.85rem;font-weight:600;letter-spacing:.5px;
      max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    @media(max-width:576px){.navbar-username{display:none;}}
  `;
  document.head.appendChild(s);
}

// ── Render avatar lên #navbar-user-info ───────────────────────────────────────
export function renderNavbarUser(user) {
  const el = document.getElementById("navbar-user-info");
  if (!el) return;
  if (!user) { el.innerHTML = ""; return; }
  injectAvatarStyles();
  const name   = getDisplayName(user);
  const avatar = getAvatarUrl(user);
  const fb     = generateAvatarUrl(name);
  el.innerHTML = `
    <a href="profile.html" class="navbar-user-wrapper" title="Hồ sơ — ${name}">
      <img src="${avatar}" alt="avatar" class="navbar-avatar"
           onerror="this.onerror=null;this.src='${fb}'">
      <span class="navbar-username">${name}</span>
    </a>`;
}

// ── initProfile: gọi ở mọi trang có #navbar-user-info ────────────────────────
export function initProfile() {
  injectAvatarStyles();
  onAuthStateChanged(auth, (user) => renderNavbarUser(user));
}

// ── Cập nhật profile Firebase Auth ───────────────────────────────────────────
export async function updateUserProfile(newName, newPhotoURL = null) {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");
  const p = { displayName: newName };
  if (newPhotoURL) p.photoURL = newPhotoURL;
  await updateProfile(user, p);
  renderNavbarUser(auth.currentUser);
}
