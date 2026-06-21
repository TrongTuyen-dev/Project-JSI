/**
 * menu.js — Script cho Menu.html
 */
import { auth, initProfile } from "./navbar.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

initProfile();

// ── Đăng xuất ─────────────────────────────────────────────────────────────────
document.getElementById("btnLogout")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    alert("Đã đăng xuất thành công. Hẹn gặp lại quý khách!");
    window.location.href = "register.html";
  } catch (e) {
    console.error("Lỗi đăng xuất:", e);
  }
});

// ── Lọc danh mục (sidebar) ────────────────────────────────────────────────────
const catItems    = document.querySelectorAll("#categoryList li");
const catSections = document.querySelectorAll(".menu-cat-section");
const catEmpty    = document.getElementById("catEmpty");

catItems.forEach(item => {
  item.style.cursor = "pointer";
  item.addEventListener("click", () => {
    const cat = item.dataset.cat;

    // Cập nhật active
    catItems.forEach(i => i.classList.remove("active-cat"));
    item.classList.add("active-cat");

    if (cat === "all") {
      catSections.forEach(s => s.style.display = "");
      if (catEmpty) catEmpty.style.display = "none";
      return;
    }

    let hasMatch = false;
    catSections.forEach(s => {
      const match = s.dataset.section === cat;
      s.style.display = match ? "" : "none";
      if (match) hasMatch = true;
    });

    if (catEmpty) catEmpty.style.display = hasMatch ? "none" : "block";
  });
});
