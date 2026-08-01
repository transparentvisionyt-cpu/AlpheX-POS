// ============================================
// ALPHEX AI SOLUTIONS POS - Main Application
// ============================================

// State
const state = {
    user: null,
    token: null,
    cart: [],
    products: [],
    categories: [],
    customers: [],
    vendors: [],
    sales: [],
    currentView: 'pos',
    paymentMethod: 'cash',
    selectedCustomer: null,
    editingProduct: null,
    editingContact: null,
    contactType: 'customer',
    lowStockFilter: 'all'
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    checkTrial();
    checkAuth();
    updateDateTime();
    setInterval(updateDateTime, 60000);
});

// ===== TRIAL CHECK =====
async function checkTrial() {
    try {
        const trial = await db.query('store_settings', { select: 'trial_start,trial_days', limit: 1 });
        if (trial.length > 0) {
            const start = new Date(trial[0].trial_start);
            const days = trial[0].trial_days || 3;
            const now = new Date();
            const elapsed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
            const left = Math.max(0, days - elapsed);
            
            const badge = document.getElementById('trialBadge');
            if (left <= 0) {
                badge.className = 'trial-badge expired';
                badge.innerHTML = '⚠️ Trial Expired — Contact ALPHEX AI SOLUTIONS';
                document.getElementById('authBtn').disabled = true;
            } else {
                badge.innerHTML = `✅ Free Trial: <strong>${left} day${left > 1 ? 's' : ''} remaining</strong>`;
            }
        }
    } catch (e) { console.log('Trial check:', e.message); }
}

// ===== AUTH =====
function checkAuth() {
    const saved = localStorage.getItem('alpex_token');
    if (saved) {
        state.token = saved;
        state.user = JSON.parse(localStorage.getItem('alpex_user') || '{}');
        showApp();
    }
}

document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    
    try {
        // Simple local auth (can be replaced with Supabase Auth)
        if (email === 'admin@alpexai.com' && password === 'admin123') {
            state.user = { id: '1', name: 'Admin', email, role: 'admin' };
        } else if (email === 'cashier@alpexai.com' && password === 'cashier123') {
            state.user = { id: '2', name: 'Cashier', email, role: 'cashier' };
        } else {
            throw new Error('Invalid credentials');
        }
        
        state.token = 'local_' + Date.now();
        localStorage.setItem('alpex_token', state.token);
        localStorage.setItem('alpex_user', JSON.stringify(state.user));
        showApp();
        showToast('Welcome back, ' + state.user.name + '!', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    }
});

function showApp() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('appScreen').classList.add('active');
    document.getElementById('sidebarUser').textContent = state.user.name;
    loadView('pos');
}

function logout() {
    localStorage.removeItem('alpex_token');
    localStorage.removeItem('alpex_user');
    state.token = null;
    state.user = null;
    document.getElementById('appScreen').classList.remove('active');
    document.getElementById('authScreen').classList.add('active');
    toggleSidebar(false);
}

// ===== NAVIGATION =====
function loadView(view) {
    state.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const viewEl = document.getElementById(view + 'View');
    const navEl = document.querySelector(`[data-view="${view}"]`);
    if (viewEl) viewEl.classList.add('active');
    if (navEl) navEl.classList.add('active');
    
    const titles = { pos: 'Point of Sale', products: 'Products', stock: 'Receive Stock', inventory: 'Inventory', customers: 'Customers', vendors: 'Vendors', sales: 'Sales History', reports: 'Reports', settings: 'Settings' };
    document.getElementById('pageTitle').textContent = titles[view] || 'POS';
    
    toggleSidebar(false);
    
    switch(view) {
        case 'pos': loadPOS(); break;
        case 'products': loadProducts(); break;
        case 'stock': loadStock(); break;
        case 'inventory': loadInventory(); break;
        case 'customers': loadContacts('customer'); break;
        case 'vendors': loadContacts('vendor'); break;
        case 'sales': loadSales(); break;
        case 'reports': loadReports(); break;
        case 'settings': loadSettings(); break;
    }
}

function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (open === undefined) open = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', open);
    overlay.classList.toggle('active', open);
}

function updateDateTime() {
    const now = new Date();
    const el = document.getElementById('headerDate');
    if (el) el.textContent = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ===== POS =====
async function loadPOS() {
    try {
        const [products, categories, customers] = await Promise.all([
            db.query('products', { select: '*', where: { active: true }, order: 'name' }),
            db.query('categories', { select: '*', order: 'sort_order' }),
            db.query('contacts', { select: '*', where: { type: 'customer' }, order: 'name' })
        ]);
        
        state.products = products;
        state.categories = categories;
        state.customers = customers;
        
        renderCategoryPills();
        renderProducts();
        renderCustomerSelect();
    } catch (e) {
        showToast('Failed to load data: ' + e.message, 'error');
    }
}

function renderCategoryPills() {
    const el = document.getElementById('categoryPills');
    el.innerHTML = `<button class="pill active" onclick="filterByCategory('all', this)">All</button>` +
        state.categories.map(c => `<button class="pill" onclick="filterByCategory('${c.name}', this)">${c.icon || '📦'} ${c.name}</button>`).join('');
}

function renderProducts(products = null) {
    const grid = document.getElementById('productGrid');
    const items = products || state.products;
    
    if (items.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No products found</p></div>';
        return;
    }
    
    grid.innerHTML = items.map(p => {
        const out = p.stock_quantity <= 0;
        const imgHtml = p.image_url 
            ? `<img class="prod-img" src="${p.image_url}" alt="${p.name}" onerror="this.outerHTML='<div class=\\'prod-img-placeholder\\'>📦</div>'">`
            : `<div class="prod-img-placeholder">📦</div>`;
        return `
            <div class="product-card ${out ? 'out-of-stock' : ''}" onclick="${out ? '' : `addToCart('${p.id}')`}">
                ${imgHtml}
                <div class="prod-name">${p.name}</div>
                <div class="prod-price">${formatMoney(p.sale_price)}</div>
                <div class="prod-stock">${out ? '<span class="badge badge-danger">Out of Stock</span>' : `Stock: ${p.stock_quantity}`}</div>
            </div>
        `;
    }).join('');
}

function filterProducts() {
    const search = document.getElementById('productSearch').value.toLowerCase();
    const filtered = state.products.filter(p => 
        p.name.toLowerCase().includes(search) || 
        (p.sku && p.sku.toLowerCase().includes(search)) ||
        (p.barcode && p.barcode.includes(search))
    );
    renderProducts(filtered);
}

function filterByCategory(cat, btn) {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    
    if (cat === 'all') {
        renderProducts();
    } else {
        renderProducts(state.products.filter(p => p.category === cat));
    }
}

// ===== BARCODE HANDLING =====
function handleBarcode(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    
    const input = document.getElementById('barcodeInput');
    const code = input.value.trim();
    if (!code) return;
    
    const product = state.products.find(p => p.barcode === code || p.sku === code);
    const bar = document.getElementById('scannerBar');
    
    if (product) {
        addToCart(product.id);
        bar.classList.add('scanner-success');
        setTimeout(() => bar.classList.remove('scanner-success'), 500);
        input.value = '';
    } else {
        bar.classList.add('scanner-error');
        setTimeout(() => bar.classList.remove('scanner-error'), 400);
        openQuickAdd(code);
        input.value = '';
    }
}

// ===== CART =====
function addToCart(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product || product.stock_quantity <= 0) return;
    
    const existing = state.cart.find(i => i.productId === productId);
    if (existing) {
        if (existing.quantity >= product.stock_quantity) {
            showToast('Maximum stock reached', 'warning');
            return;
        }
        existing.quantity++;
    } else {
        state.cart.push({
            productId: product.id,
            name: product.name,
            price: product.sale_price,
            cost: product.purchase_price,
            quantity: 1,
            maxStock: product.stock_quantity
        });
    }
    
    renderCart();
    showToast('Added: ' + product.name, 'success');
}

function updateQty(index, change) {
    const item = state.cart[index];
    item.quantity += change;
    if (item.quantity <= 0) state.cart.splice(index, 1);
    else if (item.quantity > item.maxStock) {
        item.quantity = item.maxStock;
        showToast('Max stock reached', 'warning');
    }
    renderCart();
}

function removeFromCart(index) {
    state.cart.splice(index, 1);
    renderCart();
}

function clearCart() {
    state.cart = [];
    state.selectedCustomer = null;
    document.getElementById('discountInput').value = 0;
    document.getElementById('customerSelect').value = '';
    renderCart();
}

function renderCart() {
    const el = document.getElementById('cartItems');
    document.getElementById('cartCount').textContent = state.cart.length;
    
    if (state.cart.length === 0) {
        el.innerHTML = '<div class="cart-empty"><div class="empty-icon">🛒</div><p>Cart is empty</p></div>';
    } else {
        el.innerHTML = state.cart.map((item, i) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${formatMoney(item.price)}</div>
                </div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateQty(${i}, -1)">-</button>
                    <span class="qty-value">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQty(${i}, 1)">+</button>
                </div>
                <div class="cart-item-total">${formatMoney(item.price * item.quantity)}</div>
                <button class="remove-btn" onclick="removeFromCart(${i})">✕</button>
            </div>
        `).join('');
    }
    
    updateCartTotals();
}

function updateCartTotals() {
    const subtotal = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const discount = parseFloat(document.getElementById('discountInput')?.value) || 0;
    const tax = Math.round(subtotal * (CONFIG.TAX_RATE / 100));
    const total = subtotal + tax - discount;
    
    document.getElementById('cartSubtotal').textContent = formatMoney(subtotal);
    document.getElementById('cartTax').textContent = formatMoney(tax);
    document.getElementById('cartTotal').textContent = formatMoney(total);
    
    calculateChange();
}

function calculateChange() {
    const total = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const discount = parseFloat(document.getElementById('discountInput')?.value) || 0;
    const tax = Math.round(total * (CONFIG.TAX_RATE / 100));
    const grandTotal = total + tax - discount;
    const paid = parseFloat(document.getElementById('amountPaid')?.value) || 0;
    const change = Math.max(0, paid - grandTotal);
    document.getElementById('changeAmount').textContent = formatMoney(change);
}

function selectCustomer(id) { state.selectedCustomer = id || null; }
function setPayment(method, btn) {
    state.paymentMethod = method;
    document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('cashInput').style.display = method === 'cash' ? 'block' : 'none';
}

function renderCustomerSelect() {
    const el = document.getElementById('customerSelect');
    el.innerHTML = '<option value="">Walk-in Customer</option>' +
        state.customers.map(c => `<option value="${c.id}">${c.name} (${c.phone || ''})</option>`).join('');
}

// ===== COMPLETE SALE =====
async function completeSale() {
    if (state.cart.length === 0) return showToast('Cart is empty!', 'warning');
    
    const subtotal = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const discount = parseFloat(document.getElementById('discountInput')?.value) || 0;
    const tax = Math.round(subtotal * (CONFIG.TAX_RATE / 100));
    const total = subtotal + tax - discount;
    const paid = state.paymentMethod === 'cash' ? (parseFloat(document.getElementById('amountPaid')?.value) || 0) : total;
    
    if (state.paymentMethod === 'cash' && paid < total) {
        return showToast('Insufficient payment!', 'warning');
    }
    
    try {
        // Generate order number
        const orders = await db.query('orders', { select: 'order_number', order: 'created_at.desc', limit: 1 });
        let num = 1;
        if (orders.length > 0) {
            const last = parseInt(orders[0].order_number.replace('INV-', ''));
            num = last + 1;
        }
        const orderNum = 'INV-' + String(num).padStart(6, '0');
        
        // Create order
        const [order] = await db.insert('orders', {
            order_number: orderNum,
            order_type: 'SALE',
            total_amount: total,
            amount_paid: paid,
            change_due: Math.max(0, paid - total),
            discount,
            tax_rate: CONFIG.TAX_RATE,
            tax_amount: tax,
            contact_id: state.selectedCustomer,
            user_id: state.user.id,
            payment_method: state.paymentMethod,
            status: 'completed'
        });
        
        // Create order items & update stock
        for (const item of state.cart) {
            await db.insert('order_items', {
                order_id: order.id,
                product_id: item.productId,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: item.price,
                cost_price: item.cost,
                subtotal: item.price * item.quantity
            });
            
            // Decrement stock
            await db.update('products', 
                { stock_quantity: item.maxStock - item.quantity }, 
                { id: item.productId }
            );
            
            // Log stock movement
            await db.insert('stock_movements', {
                product_id: item.productId,
                movement_type: 'SALE',
                quantity: -item.quantity,
                reference_order_id: order.id
            });
        }
        
        // Update customer loyalty
        if (state.selectedCustomer) {
            const cust = state.customers.find(c => c.id === state.selectedCustomer);
            if (cust) {
                await db.update('contacts', {
                    loyalty_points: (cust.loyalty_points || 0) + Math.floor(total / 100),
                    total_spent: (cust.total_spent || 0) + total,
                    total_visits: (cust.total_visits || 0) + 1
                }, { id: state.selectedCustomer });
            }
        }
        
        showReceipt(order, orderNum);
        showToast('Sale completed! ' + orderNum, 'success');
        state.cart = [];
        document.getElementById('discountInput').value = 0;
        document.getElementById('customerSelect').value = '';
        renderCart();
        loadPOS(); // Refresh products/stock
        
    } catch (e) {
        showToast('Sale failed: ' + e.message, 'error');
    }
}

// ===== RECEIPT =====
function showReceipt(order, orderNum) {
    const items = state.cart.length > 0 ? state.cart : [];
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const tax = Math.round(subtotal * (CONFIG.TAX_RATE / 100));
    const discount = parseFloat(document.getElementById('discountInput')?.value) || 0;
    const total = subtotal + tax - discount;
    const paid = parseFloat(document.getElementById('amountPaid')?.value) || total;
    
    document.getElementById('receiptContent').innerHTML = `
        <div class="receipt-header">
            <h2>${CONFIG.STORE_NAME}</h2>
            <p>${CONFIG.STORE_ADDRESS}</p>
            <p>${CONFIG.STORE_PHONE}</p>
            <p style="margin-top:8px">Invoice: ${orderNum}</p>
            <p>${new Date().toLocaleString()}</p>
        </div>
        <div style="font-weight:bold;display:flex;justify-content:space-between;border-bottom:1px dashed #ccc;padding-bottom:6px;margin-bottom:6px;">
            <span>Item</span><span>Total</span>
        </div>
        ${items.map(i => `<div class="receipt-item"><span>${i.name} x${i.quantity}</span><span>${formatMoney(i.price * i.quantity)}</span></div>`).join('')}
        <div class="receipt-total">
            <div class="row"><span>Subtotal:</span><span>${formatMoney(subtotal)}</span></div>
            <div class="row"><span>Tax (${CONFIG.TAX_RATE}%):</span><span>${formatMoney(tax)}</span></div>
            ${discount ? `<div class="row"><span>Discount:</span><span>-${formatMoney(discount)}</span></div>` : ''}
            <div class="row" style="font-weight:bold;font-size:15px;"><span>Total:</span><span>${formatMoney(total)}</span></div>
            <div class="row"><span>Paid:</span><span>${formatMoney(paid)}</span></div>
            <div class="row"><span>Change:</span><span>${formatMoney(Math.max(0, paid - total))}</span></div>
        </div>
        <div class="receipt-footer">
            <p>${CONFIG.RECEIPT_HEADER}</p>
            <p style="margin-top:4px">${CONFIG.RECEIPT_FOOTER}</p>
            <p style="margin-top:4px">Payment: ${state.paymentMethod.toUpperCase()}</p>
        </div>
    `;
    openModal('receiptModal');
}

function printReceipt() { window.print(); }

// ===== PRODUCTS CRUD =====
async function loadProducts() {
    try {
        state.products = await db.query('products', { select: '*', where: { active: true }, order: 'name' });
        renderProductsTable();
    } catch (e) { showToast('Failed to load products', 'error'); }
}

function renderProductsTable(products = null) {
    const items = products || state.products;
    const el = document.getElementById('productsTable');
    
    if (items.length === 0) {
        el.innerHTML = '<div class="empty-state"><p>No products found</p></div>';
        return;
    }
    
    el.innerHTML = `<table>
        <thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${items.map(p => {
            const status = p.stock_quantity <= 0 ? 'badge-danger' : p.stock_quantity <= p.min_stock ? 'badge-warning' : 'badge-success';
            const statusText = p.stock_quantity <= 0 ? 'Out' : p.stock_quantity <= p.min_stock ? 'Low' : 'OK';
            return `<tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.sku}</td>
                <td>${p.category}</td>
                <td>${formatMoney(p.sale_price)}</td>
                <td>${p.stock_quantity}</td>
                <td><span class="badge ${status}">${statusText}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="editProduct('${p.id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Del</button>
                </td>
            </tr>`;
        }).join('')}</tbody></table>`;
}

function filterProductsList(q) {
    const filtered = state.products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()));
    renderProductsTable(filtered);
}

function openProductModal(id = null) {
    state.editingProduct = id;
    const p = id ? state.products.find(x => x.id === id) : null;
    document.getElementById('productModalTitle').textContent = p ? 'Edit Product' : 'Add Product';
    document.getElementById('prodName').value = p?.name || '';
    document.getElementById('prodSku').value = p?.sku || '';
    document.getElementById('prodBarcode').value = p?.barcode || '';
    document.getElementById('prodCategory').value = p?.category || 'Other';
    document.getElementById('prodPurchasePrice').value = p?.purchase_price || 0;
    document.getElementById('prodSalePrice').value = p?.sale_price || '';
    document.getElementById('prodStock').value = p?.stock_quantity || 0;
    document.getElementById('prodMinStock').value = p?.min_stock || 5;
    document.getElementById('prodImage').value = p?.image_url || '';
    
    const imgPreview = document.getElementById('prodImagePreview');
    const imgEl = document.getElementById('prodImageImg');
    if (p?.image_url) {
        imgEl.src = p.image_url;
        imgPreview.style.display = 'block';
    } else {
        imgPreview.style.display = 'none';
    }
    
    // Live image preview
    document.getElementById('prodImage').oninput = function() {
        const url = this.value.trim();
        if (url) {
            imgEl.src = url;
            imgPreview.style.display = 'block';
        } else {
            imgPreview.style.display = 'none';
        }
    };
    
    openModal('productModal');
}

function editProduct(id) { openProductModal(id); }

async function saveProduct(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('prodName').value,
        sku: document.getElementById('prodSku').value,
        barcode: document.getElementById('prodBarcode').value,
        category: document.getElementById('prodCategory').value,
        purchase_price: parseFloat(document.getElementById('prodPurchasePrice').value) || 0,
        sale_price: parseFloat(document.getElementById('prodSalePrice').value),
        stock_quantity: parseInt(document.getElementById('prodStock').value) || 0,
        min_stock: parseInt(document.getElementById('prodMinStock').value) || 5,
        image_url: document.getElementById('prodImage').value.trim() || null,
        active: true
    };
    
    try {
        if (state.editingProduct) {
            await db.update('products', data, { id: state.editingProduct });
            showToast('Product updated!', 'success');
        } else {
            await db.insert('products', data);
            showToast('Product added!', 'success');
        }
        closeModal('productModal');
        loadProducts();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    try {
        await db.update('products', { active: false }, { id });
        showToast('Product deleted', 'success');
        loadProducts();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// ===== STOCK / PURCHASE =====
async function loadStock() {
    try {
        const [vendors, products, purchases] = await Promise.all([
            db.query('contacts', { select: '*', where: { type: 'vendor' }, order: 'name' }),
            db.query('products', { select: '*', where: { active: true }, order: 'name' }),
            db.query('orders', { select: '*, contacts(name)', where: { order_type: 'PURCHASE' }, order: 'created_at.desc', limit: 20 })
        ]);
        
        state.vendors = vendors;
        state.products = products;
        
        document.getElementById('stockVendor').innerHTML = vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
        document.getElementById('stockProduct').innerHTML = products.map(p => `<option value="${p.id}" data-cost="${p.purchase_price}">${p.name} (Stock: ${p.stock_quantity})</option>`).join('');
        
        if (products.length > 0) updateStockPrice();
        
        document.getElementById('purchasesTable').innerHTML = purchases.length === 0 ? '<p style="text-align:center;color:var(--text3);padding:20px;">No purchases yet</p>' :
            `<table><thead><tr><th>Invoice</th><th>Vendor</th><th>Total</th><th>Date</th></tr></thead>
            <tbody>${purchases.map(p => `<tr><td>${p.order_number}</td><td>${p.contacts?.name || '-'}</td><td>${formatMoney(p.total_amount)}</td><td>${new Date(p.created_at).toLocaleDateString()}</td></tr>`).join('')}</tbody></table>`;
    } catch (e) { showToast('Failed to load stock data', 'error'); }
}

function updateStockPrice() {
    const sel = document.getElementById('stockProduct');
    const opt = sel.options[sel.selectedIndex];
    const cost = opt?.dataset?.cost || 0;
    document.getElementById('stockCost').value = cost;
    document.getElementById('stockQty').oninput = () => {
        const qty = parseInt(document.getElementById('stockQty').value) || 0;
        document.getElementById('stockTotal').value = formatMoney(qty * cost);
    };
    document.getElementById('stockQty').dispatchEvent(new Event('input'));
}

async function receiveStock() {
    const vendorId = document.getElementById('stockVendor').value;
    const productId = document.getElementById('stockProduct').value;
    const qty = parseInt(document.getElementById('stockQty').value) || 0;
    const cost = parseFloat(document.getElementById('stockCost').value) || 0;
    const paid = parseFloat(document.getElementById('stockPaid').value) || 0;
    
    if (!vendorId || !productId || qty <= 0) return showToast('Fill all fields', 'warning');
    
    try {
        const product = state.products.find(p => p.id === productId);
        
        // Generate PO number
        const purchases = await db.query('orders', { select: 'order_number', where: { order_type: 'PURCHASE' }, order: 'created_at.desc', limit: 1 });
        let num = 1;
        if (purchases.length > 0) {
            num = parseInt(purchases[0].order_number.replace('PO-', '')) + 1;
        }
        
        const [order] = await db.insert('orders', {
            order_number: 'PO-' + String(num).padStart(6, '0'),
            order_type: 'PURCHASE',
            total_amount: qty * cost,
            amount_paid: paid,
            change_due: Math.max(0, paid - (qty * cost)),
            contact_id: vendorId,
            user_id: state.user.id,
            payment_method: 'cash',
            status: 'completed'
        });
        
        await db.insert('order_items', {
            order_id: order.id,
            product_id: productId,
            product_name: product.name,
            quantity: qty,
            unit_price: cost,
            cost_price: cost,
            subtotal: qty * cost
        });
        
        // Increment stock
        await db.update('products', { stock_quantity: product.stock_quantity + qty }, { id: productId });
        
        // Log movement
        await db.insert('stock_movements', {
            product_id: productId,
            movement_type: 'PURCHASE',
            quantity: qty,
            reference_order_id: order.id
        });
        
        showToast('Stock received! +' + qty + ' ' + product.name, 'success');
        loadStock();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// ===== INVENTORY =====
async function loadInventory() {
    try {
        state.products = await db.query('products', { select: '*', where: { active: true }, order: 'name' });
        renderInventory();
    } catch (e) { showToast('Failed to load inventory', 'error'); }
}

function renderInventory(filter = 'all') {
    let items = state.products;
    if (filter === 'low') items = items.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock);
    else if (filter === 'out') items = items.filter(p => p.stock_quantity <= 0);
    
    const el = document.getElementById('inventoryTable');
    if (items.length === 0) {
        el.innerHTML = '<div class="empty-state"><p>No products match filter</p></div>';
        return;
    }
    
    el.innerHTML = `<table>
        <thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>Stock</th><th>Min</th><th>Status</th><th>Value</th></tr></thead>
        <tbody>${items.map(p => {
            const status = p.stock_quantity <= 0 ? 'badge-danger' : p.stock_quantity <= p.min_stock ? 'badge-warning' : 'badge-success';
            const statusText = p.stock_quantity <= 0 ? 'Out of Stock' : p.stock_quantity <= p.min_stock ? 'Low Stock' : 'In Stock';
            return `<tr>
                <td>${p.sku}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.category}</td>
                <td>${p.stock_quantity}</td>
                <td>${p.min_stock}</td>
                <td><span class="badge ${status}">${statusText}</span></td>
                <td>${formatMoney(p.stock_quantity * p.purchase_price)}</td>
            </tr>`;
        }).join('')}</tbody></table>`;
}

function filterInventory(filter, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderInventory(filter);
}

// ===== CONTACTS =====
async function loadContacts(type) {
    try {
        const contacts = await db.query('contacts', { select: '*', where: { type }, order: 'name' });
        if (type === 'customer') state.customers = contacts;
        else state.vendors = contacts;
        renderContactsTable(type);
    } catch (e) { showToast('Failed to load contacts', 'error'); }
}

function renderContactsTable(type, items = null) {
    const data = items || (type === 'customer' ? state.customers : state.vendors);
    const el = document.getElementById(type + 'sTable');
    
    if (data.length === 0) {
        el.innerHTML = `<div class="empty-state"><p>No ${type}s found</p></div>`;
        return;
    }
    
    el.innerHTML = `<table>
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th>${type === 'customer' ? '<th>Points</th><th>Spent</th>' : ''}<th>Actions</th></tr></thead>
        <tbody>${data.map(c => `<tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone || '-'}</td>
            <td>${c.email || '-'}</td>
            ${type === 'customer' ? `<td>${c.loyalty_points || 0}</td><td>${formatMoney(c.total_spent || 0)}</td>` : ''}
            <td>
                <button class="btn btn-sm btn-outline" onclick="editContact('${c.id}', '${type}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteContact('${c.id}')">Del</button>
            </td>
        </tr>`).join('')}</tbody></table>`;
}

function filterContacts(type, q) {
    const data = (type === 'customer' ? state.customers : state.vendors).filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || (c.phone && c.phone.includes(q)));
    renderContactsTable(type, data);
}

function openContactModal(type, id = null) {
    state.contactType = type;
    state.editingContact = id;
    const c = id ? (type === 'customer' ? state.customers : state.vendors).find(x => x.id === id) : null;
    document.getElementById('contactModalTitle').textContent = (c ? 'Edit ' : 'Add ') + (type === 'customer' ? 'Customer' : 'Vendor');
    document.getElementById('contactName').value = c?.name || '';
    document.getElementById('contactEmail').value = c?.email || '';
    document.getElementById('contactPhone').value = c?.phone || '';
    document.getElementById('contactAddress').value = c?.address || '';
    openModal('contactModal');
}

function editContact(id, type) { openContactModal(type, id); }

async function saveContact(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('contactName').value,
        email: document.getElementById('contactEmail').value,
        phone: document.getElementById('contactPhone').value,
        address: document.getElementById('contactAddress').value,
        type: state.contactType
    };
    
    try {
        if (state.editingContact) {
            await db.update('contacts', data, { id: state.editingContact });
        } else {
            await db.insert('contacts', data);
        }
        showToast('Saved!', 'success');
        closeModal('contactModal');
        loadContacts(state.contactType);
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

async function deleteContact(id) {
    if (!confirm('Delete this contact?')) return;
    try {
        await db.delete('contacts', { id });
        showToast('Deleted', 'success');
        loadContacts(state.contactType);
    } catch (e) { showToast('Error', 'error'); }
}

// ===== SALES HISTORY =====
async function loadSales() {
    try {
        const sales = await db.query('orders', { select: '*, contacts(name)', where: { order_type: 'SALE' }, order: 'created_at.desc', limit: 50 });
        state.sales = sales;
        renderSalesTable();
    } catch (e) { showToast('Failed to load sales', 'error'); }
}

function renderSalesTable(sales = null) {
    const items = sales || state.sales;
    const el = document.getElementById('salesTable');
    
    if (items.length === 0) {
        el.innerHTML = '<div class="empty-state"><p>No sales found</p></div>';
        return;
    }
    
    el.innerHTML = `<table>
        <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
        <tbody>${items.map(s => `<tr>
            <td><strong>${s.order_number}</strong></td>
            <td>${new Date(s.created_at).toLocaleDateString()}</td>
            <td>${s.contacts?.name || 'Walk-in'}</td>
            <td>${formatMoney(s.total_amount)}</td>
            <td><span class="badge badge-info">${(s.payment_method || 'cash').toUpperCase()}</span></td>
            <td><span class="badge badge-success">${s.status}</span></td>
        </tr>`).join('')}</tbody></table>`;
}

function filterSales() {
    const from = document.getElementById('salesFrom').value;
    const to = document.getElementById('salesTo').value;
    let filtered = state.sales;
    if (from) filtered = filtered.filter(s => s.created_at >= from);
    if (to) filtered = filtered.filter(s => s.created_at <= to + 'T23:59:59');
    renderSalesTable(filtered);
}

// ===== REPORTS =====
async function loadReports() {
    try {
        const [sales, products] = await Promise.all([
            db.query('orders', { select: 'total_amount,created_at', where: { order_type: 'SALE', status: 'completed' } }),
            db.query('order_items', { select: 'product_name,quantity,subtotal', order: 'quantity.desc', limit: 10 })
        ]);
        
        const today = new Date().toISOString().split('T')[0];
        const todaySales = sales.filter(s => s.created_at?.startsWith(today));
        const todayTotal = todaySales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
        const totalRevenue = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
        
        document.getElementById('reportStats').innerHTML = `
            <div class="stat-card"><div class="stat-icon blue">💰</div><div class="stat-info"><h3>${formatMoney(todayTotal)}</h3><p>Today's Sales</p></div></div>
            <div class="stat-card"><div class="stat-icon green">📈</div><div class="stat-info"><h3>${formatMoney(totalRevenue)}</h3><p>Total Revenue</p></div></div>
            <div class="stat-card"><div class="stat-icon yellow">🧾</div><div class="stat-info"><h3>${sales.length}</h3><p>Total Orders</p></div></div>
            <div class="stat-card"><div class="stat-icon red">📦</div><div class="stat-info"><h3>${state.products.filter(p => p.stock_quantity <= p.min_stock).length}</h3><p>Low Stock Items</p></div></div>
        `;
        
        document.getElementById('topProductsReport').innerHTML = products.length === 0 ? '<p>No data</p>' :
            products.map((p, i) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
                <span>#${i+1} ${p.product_name}</span>
                <span>${p.quantity} sold — ${formatMoney(p.subtotal)}</span>
            </div>`).join('');
    } catch (e) { showToast('Failed to load reports', 'error'); }
}

// ===== QUICK ADD (Scanner) =====
function openQuickAdd(barcode) {
    document.getElementById('quickBarcode').value = barcode;
    document.getElementById('quickName').value = '';
    document.getElementById('quickSalePrice').value = '';
    openModal('quickAddModal');
}

async function saveQuickProduct(e) {
    e.preventDefault();
    const data = {
        sku: 'QR-' + Date.now().toString(36).toUpperCase(),
        barcode: document.getElementById('quickBarcode').value,
        name: document.getElementById('quickName').value,
        category: document.getElementById('quickCategory').value,
        purchase_price: parseFloat(document.getElementById('quickPurchasePrice').value) || 0,
        sale_price: parseFloat(document.getElementById('quickSalePrice').value),
        stock_quantity: parseInt(document.getElementById('quickStock').value) || 10,
        min_stock: 5,
        image_url: null,
        active: true
    };
    
    try {
        const [product] = await db.insert('products', data);
        closeModal('quickAddModal');
        showToast('Product added!', 'success');
        
        // Add to cart
        state.products.push(product);
        addToCart(product.id);
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// ===== CAMERA SCANNER =====
function openCameraScanner() {
    openModal('scannerModal');
    startCamera();
}

async function startCamera() {
    try {
        const video = document.getElementById('scannerVideo');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        video.srcObject = stream;
    } catch (e) {
        document.getElementById('scannerResult').textContent = 'Camera access denied';
    }
}

function closeScanner() {
    const video = document.getElementById('scannerVideo');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
        video.srcObject = null;
    }
    closeModal('scannerModal');
}

// ===== UTILITIES =====
function formatMoney(amount) {
    return CONFIG.CURRENCY_SYMBOL + Number(amount || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    toast.innerHTML = `<span style="font-size:16px">${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ===== SETTINGS =====
function loadSettings() {
    document.getElementById('setStoreName').value = CONFIG.STORE_NAME;
    document.getElementById('setStoreAddress').value = CONFIG.STORE_ADDRESS;
    document.getElementById('setStorePhone').value = CONFIG.STORE_PHONE;
    document.getElementById('setStoreEmail').value = CONFIG.STORE_EMAIL;
    document.getElementById('setTaxRate').value = CONFIG.TAX_RATE;
    document.getElementById('setCurrency').value = CONFIG.CURRENCY_SYMBOL;
    document.getElementById('settingsUser').textContent = state.user?.name || 'Admin';
}

function saveSettings() {
    CONFIG.STORE_NAME = document.getElementById('setStoreName').value;
    CONFIG.STORE_ADDRESS = document.getElementById('setStoreAddress').value;
    CONFIG.STORE_PHONE = document.getElementById('setStorePhone').value;
    CONFIG.STORE_EMAIL = document.getElementById('setStoreEmail').value;
    CONFIG.TAX_RATE = parseFloat(document.getElementById('setTaxRate').value) || 13;
    CONFIG.CURRENCY_SYMBOL = document.getElementById('setCurrency').value || '$';
    
    localStorage.setItem('alpex_config', JSON.stringify({
        storeName: CONFIG.STORE_NAME,
        storeAddress: CONFIG.STORE_ADDRESS,
        storePhone: CONFIG.STORE_PHONE,
        storeEmail: CONFIG.STORE_EMAIL,
        taxRate: CONFIG.TAX_RATE,
        currency: CONFIG.CURRENCY_SYMBOL
    }));
    
    showToast('Settings saved!', 'success');
    updateCartTotals();
}

// Load saved settings on start
(function() {
    try {
        const saved = JSON.parse(localStorage.getItem('alpex_config') || '{}');
        if (saved.storeName) CONFIG.STORE_NAME = saved.storeName;
        if (saved.storeAddress) CONFIG.STORE_ADDRESS = saved.storeAddress;
        if (saved.storePhone) CONFIG.STORE_PHONE = saved.storePhone;
        if (saved.storeEmail) CONFIG.STORE_EMAIL = saved.storeEmail;
        if (saved.taxRate) CONFIG.TAX_RATE = saved.taxRate;
        if (saved.currency) CONFIG.CURRENCY_SYMBOL = saved.currency;
    } catch(e) {}
})();

// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
