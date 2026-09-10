// Tienda - JavaScript del cliente
// Maneja: carga de productos, carrito, checkout, demo mode

const TIENDA = {
  apiBase: '/api',
  cart: JSON.parse(localStorage.getItem('tienda_cart') || '[]'),
  isDemo: new URLSearchParams(window.location.search).get('demo') === '1'
};

// ============== NAV (badge del carrito) ==============
function updateCartBadge() {
  const badges = document.querySelectorAll('.cart-count');
  const total = TIENDA.cart.reduce((s, i) => s + i.cantidad, 0);
  badges.forEach(b => {
    b.textContent = total;
    b.dataset.count = total;
  });
}

// ============== CARRO ==============
function saveCart() {
  localStorage.setItem('tienda_cart', JSON.stringify(TIENDA.cart));
  updateCartBadge();
}

function addToCart(producto, cantidad = 1) {
  const existing = TIENDA.cart.find(i => i.id === producto.id);
  if (existing) {
    existing.cantidad += cantidad;
  } else {
    TIENDA.cart.push({ id: producto.id, nombre: producto.nombre, precio: producto.precio, imagen: producto.imagen, cantidad });
  }
  saveCart();
  showToast(`${producto.nombre} agregado al carro`);
}

function updateCartItem(id, cantidad) {
  const item = TIENDA.cart.find(i => i.id === id);
  if (item) {
    if (cantidad <= 0) {
      TIENDA.cart = TIENDA.cart.filter(i => i.id !== id);
    } else {
      item.cantidad = cantidad;
    }
    saveCart();
  }
}

function removeFromCart(id) {
  TIENDA.cart = TIENDA.cart.filter(i => i.id !== id);
  saveCart();
  if (typeof renderCart === 'function') renderCart();
}

function clearCart() {
  TIENDA.cart = [];
  saveCart();
}

function cartTotal() {
  return TIENDA.cart.reduce((s, i) => s + i.precio * i.cantidad, 0);
}

function formatCLP(n) {
  return '$' + n.toLocaleString('es-CL');
}

// ============== TOAST ==============
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1A1A1A;color:white;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:500;z-index:1000;opacity:0;transition:opacity 0.2s;box-shadow:0 8px 24px rgba(0,0,0,0.3)';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// ============== FETCH API ==============
async function api(path, options = {}) {
  const url = TIENDA.apiBase + path;
  const opts = { headers: { 'Content-Type': 'application/json' }, ...options };
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  const r = await fetch(url, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}

// ============== RENDER PRODUCTOS ==============
function productCard(p) {
  return `
    <article class="product">
      <a href="/producto.html?id=${p.id}">
        <img class="product-img" src="${p.imagen}" alt="${p.nombre}" loading="lazy" />
      </a>
      <div class="product-body">
        <div class="product-cat">${p.categoria}</div>
        <a href="/producto.html?id=${p.id}" style="color:inherit">
          <div class="product-name">${p.nombre}</div>
        </a>
        <div class="product-price">${formatCLP(p.precio)} <small>CLP</small></div>
        <button class="product-btn" onclick="addToCart({id:${p.id},nombre:'${p.nombre.replace(/'/g, "\\'")}',precio:${p.precio},imagen:'${p.imagen}'})">Agregar al carro</button>
      </div>
    </article>
  `;
}

// Inicialización global
updateCartBadge();
