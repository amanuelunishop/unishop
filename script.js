// ── FIREBASE CONFIG (REST API - no imports needed) ─────
const FIREBASE_PROJECT = 'unishop-29b24';
const FIREBASE_API_KEY = 'AIzaSyC740CZqY6IBZd0-YHLlnkWzHyx6BMm6mY';
const DB_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

// ── TELEGRAM CONFIG ────────────────────────────────────
const TELEGRAM_TOKEN   = '8959402662:AAFJIC6vtshijasI-L8IrvZcapBtI4oXZAY';
const TELEGRAM_CHAT_ID = '892403321';

// ── ADMIN PASSWORD ─────────────────────────────────────
const ADMIN_PASSWORD = 'unishop@admin2025';

// ── STATE ──────────────────────────────────────────────
let cart = [];
let products = [];
let currentFilter = 'all';
let currentSearch = '';
let isAdmin = false;

// ── DEFAULT PRODUCTS ───────────────────────────────────
const DEFAULT_PRODUCTS = [
  { name: "iPhone 15",          price: 65000, category: "Electronics", rating: 4.8, reviews: 124, badge: "Hot",      image: "https://picsum.photos/300/220?random=1",  desc: "Latest Apple smartphone with A16 chip, 48MP camera, and all-day battery." },
  { name: "HP Laptop 15",       price: 45000, category: "Computers",   rating: 4.6, reviews: 89,  badge: "Popular",  image: "https://picsum.photos/300/220?random=2",  desc: "Core i5 processor, 8GB RAM, 512GB SSD. Handles all your coursework." },
  { name: "Bluetooth Speaker",  price: 2500,  category: "Audio",       rating: 4.3, reviews: 210, badge: "",          image: "https://picsum.photos/300/220?random=3",  desc: "Portable wireless speaker with 10-hour battery life." },
  { name: "Samsung Galaxy A54", price: 32000, category: "Electronics", rating: 4.5, reviews: 76,  badge: "New",      image: "https://picsum.photos/300/220?random=4",  desc: "5000mAh battery, 50MP camera, Super AMOLED display." },
  { name: "Sony WH-1000XM5",   price: 18000, category: "Audio",       rating: 4.9, reviews: 54,  badge: "Top Rated", image: "https://picsum.photos/300/220?random=5",  desc: "Industry-leading noise cancelling headphones." },
  { name: "Dell Inspiron 15",  price: 52000, category: "Computers",   rating: 4.4, reviews: 61,  badge: "",          image: "https://picsum.photos/300/220?random=6",  desc: "Core i7, 16GB RAM, dedicated GPU for engineering students." },
  { name: "Scientific Notebook",price: 150,  category: "Stationery",  rating: 4.2, reviews: 340, badge: "Budget",   image: "https://picsum.photos/300/220?random=7",  desc: "200-page hardcover notebook with graph paper." },
  { name: "Pen Set (12pcs)",   price: 120,   category: "Stationery",  rating: 4.1, reviews: 512, badge: "",          image: "https://picsum.photos/300/220?random=8",  desc: "Smooth-writing ballpoint pens in assorted colors." },
  { name: "Calculus Textbook", price: 850,   category: "Books",       rating: 4.7, reviews: 95,  badge: "Required",  image: "https://picsum.photos/300/220?random=9",  desc: "Comprehensive calculus for science and engineering." },
  { name: "Laptop Backpack",   price: 2200,  category: "Accessories", rating: 4.6, reviews: 188, badge: "",          image: "https://picsum.photos/300/220?random=10", desc: "Water-resistant 30L backpack with padded laptop sleeve." },
  { name: "USB-C Hub 7-in-1", price: 1800,  category: "Accessories", rating: 4.5, reviews: 143, badge: "New",      image: "https://picsum.photos/300/220?random=11", desc: "HDMI, USB 3.0 x3, SD card, Ethernet and PD charging." },
  { name: "Data Structures",  price: 720,   category: "Books",       rating: 4.8, reviews: 67,  badge: "Required",  image: "https://picsum.photos/300/220?random=12", desc: "Essential algorithms and data structures with practical examples." },
];

// ── FIREBASE REST HELPERS ──────────────────────────────
function toFirestore(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string')  fields[k] = { stringValue: v };
    if (typeof v === 'number')  fields[k] = { doubleValue: v };
    if (typeof v === 'boolean') fields[k] = { booleanValue: v };
  }
  return { fields };
}

function fromFirestore(doc) {
  const obj = { id: doc.name.split('/').pop() };
  for (const [k, v] of Object.entries(doc.fields || {})) {
    obj[k] = v.stringValue ?? v.doubleValue ?? v.integerValue ?? v.booleanValue ?? '';
    if (v.integerValue) obj[k] = parseInt(v.integerValue);
    if (v.doubleValue)  obj[k] = parseFloat(v.doubleValue);
  }
  return obj;
}

async function fbGet(col) {
  const res = await fetch(`${DB_URL}/${col}?key=${FIREBASE_API_KEY}`);
  const data = await res.json();
  if (!data.documents) return [];
  return data.documents.map(fromFirestore);
}

async function fbAdd(col, obj) {
  const res = await fetch(`${DB_URL}/${col}?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toFirestore(obj))
  });
  return await res.json();
}

async function fbUpdate(col, id, obj) {
  const fields = Object.keys(obj).map(k => k).join(',');
  const res = await fetch(`${DB_URL}/${col}/${id}?key=${FIREBASE_API_KEY}&updateMask.fieldPaths=${Object.keys(obj).join('&updateMask.fieldPaths=')}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toFirestore(obj))
  });
  return await res.json();
}

async function fbDelete(col, id) {
  await fetch(`${DB_URL}/${col}/${id}?key=${FIREBASE_API_KEY}`, { method: 'DELETE' });
}

// ── INIT ───────────────────────────────────────────────
async function initApp() {
  document.getElementById('loadingScreen').style.display = 'flex';
  try {
    let docs = await fbGet('products');
    if (docs.length === 0) {
      // Upload default products first time
      for (const p of DEFAULT_PRODUCTS) await fbAdd('products', p);
      docs = await fbGet('products');
    }
    products = docs;
  } catch(e) {
    // If offline, use default products
    products = DEFAULT_PRODUCTS.map((p, i) => ({ ...p, id: String(i) }));
    showToast('⚠️ Offline mode - changes won\'t save');
  }
  document.getElementById('loadingScreen').style.display = 'none';
  applySortAndDisplay();
}

// ── RENDER STARS ───────────────────────────────────────
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let stars = '';
  for (let i = 0; i < full; i++) stars += '<span class="star full">★</span>';
  if (half) stars += '<span class="star half">★</span>';
  for (let i = full + (half ? 1 : 0); i < 5; i++) stars += '<span class="star empty">★</span>';
  return stars;
}

// ── DISPLAY PRODUCTS ───────────────────────────────────
function displayProducts(list) {
  const grid  = document.getElementById('products');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('resultCount');

  if (!list || list.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    count.textContent = 'No products found';
    return;
  }
  empty.style.display = 'none';
  count.textContent = `Showing ${list.length} product${list.length !== 1 ? 's' : ''}`;

  grid.innerHTML = list.map((p, i) => `
    <div class="card" style="animation-delay:${i*0.06}s" onclick="openModal('${p.id}')">
      ${p.badge ? `<span class="badge badge-${p.badge.toLowerCase().replace(' ','-')}">${p.badge}</span>` : ''}
      ${isAdmin ? `
        <div class="admin-card-actions">
          <button onclick="event.stopPropagation();openEditProduct('${p.id}')">✏️</button>
          <button onclick="event.stopPropagation();deleteProduct('${p.id}','${p.name}')">🗑</button>
        </div>` : ''}
      <div class="card-img-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
      </div>
      <div class="card-body">
        <span class="card-cat">${p.category}</span>
        <h3 class="card-name">${p.name}</h3>
        <div class="card-rating">
          ${renderStars(p.rating)}
          <span class="rating-val">${p.rating}</span>
          <span class="rating-count">(${p.reviews})</span>
        </div>
        <p class="card-price">ETB ${Number(p.price).toLocaleString()}</p>
        <button class="add-btn" onclick="event.stopPropagation();addToCart('${p.id}')">
          <span>Add to Cart</span><span>+</span>
        </button>
      </div>
    </div>
  `).join('');
}

// ── FILTERING ──────────────────────────────────────────
function getFiltered() {
  return products.filter(p => {
    const matchCat  = currentFilter === 'all' || p.category === currentFilter;
    const matchSrch = p.name.toLowerCase().includes(currentSearch) ||
                      p.category.toLowerCase().includes(currentSearch) ||
                      (p.desc||'').toLowerCase().includes(currentSearch);
    return matchCat && matchSrch;
  });
}

function filterCategory(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  applySortAndDisplay();
  document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
}

function searchProduct() {
  currentSearch = document.getElementById('searchInput').value.toLowerCase().trim();
  applySortAndDisplay();
}

function resetSearch() {
  document.getElementById('searchInput').value = '';
  currentSearch = ''; currentFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  applySortAndDisplay();
}

function sortProducts() { applySortAndDisplay(); }

function applySortAndDisplay() {
  let list = [...getFiltered()];
  const sort = document.getElementById('sortSelect').value;
  if (sort === 'price-asc')  list.sort((a,b) => a.price - b.price);
  if (sort === 'price-desc') list.sort((a,b) => b.price - a.price);
  if (sort === 'name')       list.sort((a,b) => a.name.localeCompare(b.name));
  displayProducts(list);
}

// ── CART ───────────────────────────────────────────────
function addToCart(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  const existing = cart.find(i => i.id === id);
  if (existing) { existing.qty++; }
  else { cart.push({ ...product, qty: 1 }); }
  updateCartUI();
  showToast(`✅ ${product.name} added to cart!`);
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  updateCartUI();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  updateCartUI();
}

function updateCartUI() {
  const total = cart.reduce((s,i) => s + i.price*i.qty, 0);
  const count = cart.reduce((s,i) => s + i.qty, 0);
  document.getElementById('cartCount').textContent = count;
  document.getElementById('cartTotal').textContent = total.toLocaleString();
  const el = document.getElementById('cartItems');
  if (cart.length === 0) {
    el.innerHTML = '<div class="cart-empty">Your cart is empty.<br>Add some products!</div>';
    return;
  }
  el.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.name}">
      <div class="cart-item-info">
        <p class="cart-item-name">${item.name}</p>
        <p class="cart-item-price">ETB ${(item.price*item.qty).toLocaleString()}</p>
        <div class="qty-controls">
          <button onclick="changeQty('${item.id}',-1)">−</button>
          <span>${item.qty}</span>
          <button onclick="changeQty('${item.id}',1)">+</button>
        </div>
      </div>
      <button class="remove-btn" onclick="removeFromCart('${item.id}')">🗑</button>
    </div>
  `).join('');
}

function toggleCart() {
  document.getElementById('cartSidebar').classList.toggle('open');
  document.getElementById('cartOverlay').classList.toggle('open');
}

// ── PRODUCT MODAL ──────────────────────────────────────
function openModal(id) {
  const p = products.find(pr => pr.id === id);
  if (!p) return;
  document.getElementById('modalContent').innerHTML = `
    <div class="modal-product">
      <img src="${p.image}" alt="${p.name}">
      <div class="modal-info">
        <span class="card-cat">${p.category}</span>
        <h2>${p.name}</h2>
        <div class="card-rating" style="margin:8px 0">
          ${renderStars(p.rating)}
          <span class="rating-val">${p.rating}</span>
          <span class="rating-count">(${p.reviews} reviews)</span>
        </div>
        <p class="modal-desc">${p.desc}</p>
        <p class="modal-price">ETB ${Number(p.price).toLocaleString()}</p>
        <button class="add-btn" style="width:100%;padding:14px" onclick="addToCart('${p.id}');closeModal()">
          <span>Add to Cart</span><span>+</span>
        </button>
      </div>
    </div>
  `;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ── TOAST ──────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── PAYMENT ────────────────────────────────────────────
function openPayment() {
  if (cart.length === 0) { showToast('⚠️ Your cart is empty!'); return; }
  const total = cart.reduce((s,i) => s + i.price*i.qty, 0);
  document.getElementById('paymentTotal').textContent = total.toLocaleString();
  document.querySelectorAll('.pay-amt').forEach(el => el.textContent = total.toLocaleString());
  document.getElementById('cartSidebar').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('customerName').value = '';
  document.getElementById('customerPhone').value = '';
  document.getElementById('screenshotInput').value = '';
  document.getElementById('screenshotPreview').innerHTML = '<span style="font-size:2rem">📸</span><p>Tap to upload your payment screenshot</p>';
  document.getElementById('paymentOverlay').classList.add('open');
}

function closePayment() {
  document.getElementById('paymentOverlay').classList.remove('open');
}

function switchPayTab(method, btn) {
  document.querySelectorAll('.pay-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.pay-method').forEach(m => m.style.display = 'none');
  document.getElementById('pay-' + method).style.display = 'block';
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✅ Copied!';
    btn.style.background = 'var(--green)';
    setTimeout(() => { btn.textContent = 'Copy'; btn.style.background = ''; }, 2000);
  }).catch(() => { showToast('📋 ' + text); });
}

function previewScreenshot(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('screenshotPreview').innerHTML = `
      <img src="${e.target.result}" style="width:100%;border-radius:8px;max-height:180px;object-fit:contain;">
      <p style="margin-top:6px;color:var(--green);font-size:0.82rem;">✅ Screenshot ready!</p>
    `;
  };
  reader.readAsDataURL(file);
}

async function confirmPayment() {
  const name  = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const file  = document.getElementById('screenshotInput').files[0];
  const activeTab = document.querySelector('.pay-tab.active').textContent.trim();

  if (!name)  { showToast('⚠️ Please enter your full name!'); return; }
  if (!phone) { showToast('⚠️ Please enter your phone number!'); return; }
  if (!file)  { showToast('⚠️ Please upload your payment screenshot!'); return; }

  const total = cart.reduce((s,i) => s + i.price*i.qty, 0);
  const items = cart.map(i => `• ${i.name} x${i.qty} = ETB ${(i.price*i.qty).toLocaleString()}`).join('\n');

  const btn = document.querySelector('.confirm-pay-btn');
  btn.textContent = '⏳ Sending...';
  btn.disabled = true;

  try {
    const message = `🛒 NEW ORDER — UniShop\n\n👤 Customer: ${name}\n📞 Phone: ${phone}\n💳 Payment: ${activeTab}\n\n📦 Items:\n${items}\n\n💰 Total: ETB ${total.toLocaleString()}\n\nPlease verify the screenshot below!`;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message })
    });

    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('photo', file);
    formData.append('caption', `📸 Payment from ${name} (${phone})`);
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { method: 'POST', body: formData });

    closePayment();
    cart = [];
    updateCartUI();
    showOrderSuccess(name, total, items);
  } catch(e) {
    showToast('⚠️ Network error. Try again!');
  }
  btn.textContent = '✅ Confirm & Send Order';
  btn.disabled = false;
}

function showOrderSuccess(name, total, items) {
  document.getElementById('modalContent').innerHTML = `
    <div style="text-align:center;padding:40px 28px;">
      <div style="font-size:4rem;margin-bottom:16px;">🎉</div>
      <h2 style="font-family:var(--font-head);font-size:1.5rem;margin-bottom:10px;">Order Sent!</h2>
      <p style="color:var(--text-soft);margin-bottom:20px;line-height:1.7;">
        Thank you <strong>${name}</strong>!<br>We will contact you within <strong>30 minutes</strong>.
      </p>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:24px;text-align:left;">
        <p style="font-size:0.75rem;color:var(--text-soft);margin-bottom:8px;">ORDER SUMMARY</p>
        <pre style="font-size:0.85rem;white-space:pre-wrap;font-family:var(--font-body);margin-bottom:10px;">${items}</pre>
        <p style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);font-weight:800;">Total: ETB ${total.toLocaleString()}</p>
      </div>
      <button class="add-btn" style="width:100%;padding:14px;justify-content:center;" onclick="closeModal()">Continue Shopping</button>
    </div>
  `;
  document.getElementById('modalOverlay').classList.add('open');
}

// ── ADMIN ──────────────────────────────────────────────
let logoTaps = 0, tapTimer = null;

function onLogoBrandTap() {
  logoTaps++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { logoTaps = 0; }, 2000);
  if (logoTaps >= 5) {
    logoTaps = 0;
    if (isAdmin) openAdminPanel();
    else {
      document.getElementById('adminLoginOverlay').classList.add('open');
      document.getElementById('adminPasswordInput').focus();
    }
  }
}

function adminLogin() {
  const pwd = document.getElementById('adminPasswordInput').value;
  if (pwd === ADMIN_PASSWORD) {
    isAdmin = true;
    document.getElementById('adminLoginOverlay').classList.remove('open');
    document.getElementById('adminPasswordInput').value = '';
    document.getElementById('adminBadge').style.display = 'inline-flex';
    showToast('🔐 Admin mode activated!');
    applySortAndDisplay();
    openAdminPanel();
  } else {
    document.getElementById('adminLoginError').style.display = 'block';
    document.getElementById('adminPasswordInput').value = '';
    setTimeout(() => document.getElementById('adminLoginError').style.display = 'none', 2500);
  }
}

function adminLogout() {
  isAdmin = false;
  document.getElementById('adminBadge').style.display = 'none';
  closeAdminPanel();
  applySortAndDisplay();
  showToast('👋 Logged out.');
}

function closeAdminLogin() {
  document.getElementById('adminLoginOverlay').classList.remove('open');
  document.getElementById('adminPasswordInput').value = '';
}

function openAdminPanel() { renderAdminPanel(); document.getElementById('adminPanelOverlay').classList.add('open'); }
function closeAdminPanel() { document.getElementById('adminPanelOverlay').classList.remove('open'); }

function renderAdminPanel() {
  const totalValue = products.reduce((s,p) => s + Number(p.price), 0);
  const cats = [...new Set(products.map(p => p.category))].length;
  document.getElementById('adminPanelContent').innerHTML = `
    <div class="admin-panel">
      <div class="admin-header">
        <div><h2>🔐 Admin Panel</h2><p>Welcome back, Amanuel!</p></div>
        <button class="admin-logout-btn" onclick="adminLogout()">Logout →</button>
      </div>
      <div class="admin-stats">
        <div class="stat-card"><span class="stat-icon">📦</span><div><p class="stat-num">${products.length}</p><p class="stat-label">Products</p></div></div>
        <div class="stat-card"><span class="stat-icon">🗂</span><div><p class="stat-num">${cats}</p><p class="stat-label">Categories</p></div></div>
        <div class="stat-card"><span class="stat-icon">💰</span><div><p class="stat-num">ETB ${totalValue.toLocaleString()}</p><p class="stat-label">Stock Value</p></div></div>
      </div>
      <div class="admin-section-header">
        <h3>All Products</h3>
        <button class="add-product-btn" onclick="openAddProduct()">+ Add Product</button>
      </div>
      <div class="admin-product-list">
        ${products.map(p => `
          <div class="admin-product-row">
            <img src="${p.image}" alt="${p.name}">
            <div class="admin-product-info">
              <p class="admin-product-name">${p.name}</p>
              <p class="admin-product-meta">${p.category} · ETB ${Number(p.price).toLocaleString()}</p>
            </div>
            <div class="admin-product-btns">
              <button class="edit-btn" onclick="closeAdminPanel();openEditProduct('${p.id}')">✏️</button>
              <button class="delete-btn" onclick="deleteProduct('${p.id}','${p.name}')">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function openAddProduct() {
  document.getElementById('productFormTitle').textContent = '➕ Add New Product';
  ['productFormId','productFormName','productFormPrice','productFormBadge','productFormImage','productFormDesc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('productFormCategory').value = 'Electronics';
  closeAdminPanel();
  document.getElementById('productFormOverlay').classList.add('open');
}

function openEditProduct(id) {
  const p = products.find(pr => pr.id === id);
  if (!p) return;
  document.getElementById('productFormTitle').textContent = '✏️ Edit Product';
  document.getElementById('productFormId').value    = p.id;
  document.getElementById('productFormName').value  = p.name;
  document.getElementById('productFormPrice').value = p.price;
  document.getElementById('productFormCategory').value = p.category;
  document.getElementById('productFormBadge').value = p.badge || '';
  document.getElementById('productFormImage').value = p.image;
  document.getElementById('productFormDesc').value  = p.desc;
  document.getElementById('productFormOverlay').classList.add('open');
}

function closeProductForm() { document.getElementById('productFormOverlay').classList.remove('open'); }

async function saveProduct() {
  const id       = document.getElementById('productFormId').value;
  const name     = document.getElementById('productFormName').value.trim();
  const price    = parseFloat(document.getElementById('productFormPrice').value);
  const category = document.getElementById('productFormCategory').value;
  const badge    = document.getElementById('productFormBadge').value.trim();
  const image    = document.getElementById('productFormImage').value.trim() || `https://picsum.photos/300/220?random=${Date.now()}`;
  const desc     = document.getElementById('productFormDesc').value.trim();

  if (!name || !price || !desc) { showToast('⚠️ Please fill all required fields!'); return; }

  const btn = document.querySelector('.save-product-btn');
  btn.textContent = '⏳ Saving...';
  btn.disabled = true;

  try {
    const data = { name, price, category, badge, image, desc, rating: 4.5, reviews: 0 };
    if (id) {
      await fbUpdate('products', id, data);
      showToast(`✅ "${name}" updated!`);
    } else {
      await fbAdd('products', data);
      showToast(`✅ "${name}" added!`);
    }
    // Refresh products
    products = await fbGet('products');
    closeProductForm();
    applySortAndDisplay();
  } catch(e) {
    showToast('⚠️ Error saving. Check internet!');
  }
  btn.textContent = '💾 Save Product';
  btn.disabled = false;
}

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  try {
    await fbDelete('products', id);
    products = await fbGet('products');
    applySortAndDisplay();
    showToast(`🗑 "${name}" deleted!`);
    if (document.getElementById('adminPanelOverlay').classList.contains('open')) renderAdminPanel();
  } catch(e) {
    showToast('⚠️ Error deleting!');
  }
}

// ── KEYBOARD ───────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeAdminLogin(); closeAdminPanel(); closeProductForm(); closePayment(); }
  if (e.key === 'Enter' && document.getElementById('adminLoginOverlay').classList.contains('open')) adminLogin();
});

// ── START ──────────────────────────────────────────────
initApp();
