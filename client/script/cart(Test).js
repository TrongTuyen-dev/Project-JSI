/* ===== 1. LẤY GIỎ HÀNG ===== */
let cart = JSON.parse(localStorage.getItem("cart")) || [];

/* ===== 2. RENDER GIỎ ===== */
function renderCart() {
  const tbody = document.getElementById("cart-body");
  const totalEl = document.getElementById("cart-total");

  tbody.innerHTML = "";
  let total = 0;

  if (cart.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Giỏ hàng trống</td>
      </tr>
    `;
    totalEl.innerText = 0;
    return;
  }

  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    tbody.innerHTML += `
      <tr>
        <td>${item.name}</td>
        <td>${item.price} đ</td>
        <td>
          <button class="btn btn-sm btn-secondary"
            onclick="changeQuantity(${index}, -1)">-</button>
          ${item.quantity}
          <button class="btn btn-sm btn-secondary"
            onclick="changeQuantity(${index}, 1)">+</button>
        </td>
        <td>${itemTotal} đ</td>
        <td>
          <button class="btn btn-sm btn-danger"
            onclick="removeItem(${index})">X</button>
        </td>
      </tr>
    `;
  });

  totalEl.innerText = total;
}

/* ===== 3. TĂNG / GIẢM SỐ LƯỢNG ===== */
function changeQuantity(index, change) {
  cart[index].quantity += change;

  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
}

/* ===== 4. XOÁ MÓN ===== */
function removeItem(index) {
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
}

/* ===== 5. CHẠY KHI LOAD TRANG ===== */
renderCart()