// --- 核心全域變數 ---
const ADMIN_KEY = 'pos_admin_credentials';
const PRODUCTS_KEY = 'pos_products_data';
const TRANSACTION_KEY = 'pos_transactions_data';

let products = [];
let cart = [];
let transactionHistory = [];
let calculatorValue = '0';
let calculatorPendingOp = null;
let calculatorWaitingForSecondOperand = false;

// --- DOM 元素快取 ---
const $ = (id) => document.getElementById(id);
const $q = (selector) => document.querySelector(selector);
const $qa = (selector) => document.querySelectorAll(selector);

const productsListEl = $('products-list');
const cartItemsEl = $('cart-items');
const receivableEl = $('receivable');
const cashReceivedInput = $('cash-received');
const changeDueEl = $('change-due');
const filterContainer = $q('.category-filter');
const receiptModal = $('receipt-modal');
const receiptContentEl = $('receipt-content');
const loginPage = $('login-page');
const posPage = $('pos-page');
const managePage = $('manage-page');


// --- 輔助函式 ---

/**
 * 頁面切換函式 (解決頁面重疊問題的關鍵)
 * @param {string} pageId - 要顯示的頁面 ID (login-page, pos-page, manage-page)
 */
function showPage(pageId) {
    $('login-page').classList.remove('active');
    $('pos-page').classList.remove('active');
    $('manage-page').classList.remove('active');
    
    // 確保只顯示目標頁面
    $(pageId).classList.add('active');
}

/**
 * 從 localStorage 載入數據
 */
function loadData(key, defaultValue) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}

/**
 * 儲存數據到 localStorage
 */
function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// --- 1. 登入與帳號管理邏輯 ---

/**
 * 初始化管理員帳號 (如果不存在)
 */
function initAdmin() {
    const admin = loadData(ADMIN_KEY, null);
    if (!admin) {
        saveData(ADMIN_KEY, { username: 'admin', password: '123456' }); 
    }
}

/**
 * 處理登入
 */
function handleLogin() {
    const username = $('username').value;
    const password = $('password').value;
    const admin = loadData(ADMIN_KEY, {});
    const msgEl = $('login-message');
    
    msgEl.textContent = ''; 

    if (username === admin.username && password === admin.password) {
        // 登入成功後切換到 POS 頁面
        showPage('pos-page'); 
        msgEl.textContent = '';
        renderProducts(products); // 刷新 POS 商品列表
        renderCategoryFilters(products); // 刷新分類按鈕
    } else {
        msgEl.textContent = '使用者名或密碼錯誤！';
    }
}

/**
 * 處理登出
 */
function handleLogout() {
    showPage('login-page');
    $('username').value = '';
    $('password').value = '';
}

/**
 * 重置預設管理員帳號
 */
function resetAdmin() {
    if (confirm('確定要重置管理員帳號為 admin/123456 嗎？')) {
        saveData(ADMIN_KEY, { username: 'admin', password: '123456' });
        alert('管理員帳號已重置！');
    }
}


// --- 2. 商品數據與渲染邏輯 ---

/**
 * 初始化或載入商品數據
 */
function initProducts() {
    products = loadData(PRODUCTS_KEY, [
        { id: 101, name: "咖啡豆 (特選)", price: 350.00, category: "飲品原料", stock: 50 },
        { id: 102, name: "手工餅乾 (盒裝)", price: 120.00, category: "點心", stock: 100 },
        { id: 201, name: "美式咖啡", price: 65.00, category: "現製飲品", stock: 999 }
    ]);
    updateMaxProductId();
}

let maxProductId = 1000;
function updateMaxProductId() {
    if (products.length > 0) {
        maxProductId = products.reduce((max, p) => Math.max(max, p.id), 1000);
    }
}

/**
 * 渲染 POS 頁面的商品卡片
 */
function renderProducts(productArray) {
    productsListEl.innerHTML = '';
    productArray.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        const stockInfo = product.stock > 0 ? `庫存: ${product.stock}` : '<span style="color:red;">缺貨</span>';

        card.innerHTML = `
            <h4>${product.name}</h4>
            <p>$${product.price.toFixed(2)}</p>
            <small>${stockInfo}</small>
        `;
        if (product.stock > 0 || product.stock === 999) { 
            card.addEventListener('click', () => addToCart(product.id));
        } else {
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
        }
        productsListEl.appendChild(card);
    });
}

/**
 * 渲染分類按鈕並綁定篩選事件
 */
function renderCategoryFilters(productArray) {
    const categories = new Set(['all']);
    productArray.forEach(p => categories.add(p.category));

    filterContainer.innerHTML = '';
    
    categories.forEach(category => {
        const btn = document.createElement('button');
        btn.className = `filter-btn ${category === 'all' ? 'active' : ''}`;
        btn.textContent = category === 'all' ? '全部' : category;
        btn.dataset.category = category;
        
        btn.addEventListener('click', (e) => {
            $qa('.category-filter .filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            filterProducts(category)
        });
        filterContainer.appendChild(btn);
    });
}

/**
 * 根據分類過濾商品
 */
function filterProducts(selectedCategory) {
    let filteredProducts = products;
    if (selectedCategory !== 'all') {
        filteredProducts = products.filter(p => p.category === selectedCategory);
    }
    renderProducts(filteredProducts);
}

// --- 3. 購物車與結帳邏輯 ---

/**
 * 將商品加入購物車
 */
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const cartItem = cart.find(item => item.id === productId);

    if (cartItem) {
        if (product.stock !== 999 && cartItem.quantity >= product.stock) {
            alert(`"${product.name}" 庫存不足！`);
            return;
        }
        cartItem.quantity++;
    } else {
        cart.push({
            id: productId,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }
    renderCart();
}

/**
 * 更新購物車商品數量
 */
function updateCartQuantity(productId, type) {
    const product = products.find(p => p.id === productId);
    const itemIndex = cart.findIndex(item => item.id === productId);

    if (itemIndex > -1) {
        if (type === 'increase') {
             if (product.stock !== 999 && cart[itemIndex].quantity >= product.stock) {
                 alert(`"${product.name}" 庫存不足！`);
                 return;
            }
            cart[itemIndex].quantity++;
        } else if (type === 'decrease') {
            cart[itemIndex].quantity--;
            if (cart[itemIndex].quantity <= 0) {
                cart.splice(itemIndex, 1); 
            }
        }
    }
    renderCart();
}

/**
 * 渲染購物車內容並計算總計
 */
function renderCart() {
    cartItemsEl.innerHTML = '';
    let subtotal = 0;

    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p style="text-align: center;">購物車是空的。</p>';
        receivableEl.textContent = '$0.00';
        changeDueEl.textContent = '$0.00';
        cashReceivedInput.value = 0;
        return;
    }

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;

        const cartItemEl = document.createElement('div');
        cartItemEl.className = 'cart-item';
        cartItemEl.innerHTML = `
            <div class="item-info">
                ${item.name} ($${item.price.toFixed(2)})
            </div>
            <div class="item-qty-control">
                <button class="qty-btn" data-id="${item.id}" data-type="decrease">-</button>
                <span>${item.quantity}</span>
                <button class="qty-btn" data-id="${item.id}" data-type="increase">+</button>
                <button class="qty-btn remove" data-id="${item.id}" data-type="remove">X</button>
            </div>
            <span>$${itemTotal.toFixed(2)}</span>
        `;
        cartItemsEl.appendChild(cartItemEl);
    });

    const total = subtotal; 
    receivableEl.textContent = `$${total.toFixed(2)}`;
    
    // 綁定購物車按鈕事件
    cartItemsEl.querySelectorAll('.qty-btn').forEach(btn => {
        const productId = parseInt(btn.dataset.id);
        const type = btn.dataset.type;
        btn.addEventListener('click', () => {
            if (type === 'remove') {
                const itemIndex = cart.findIndex(item => item.id === productId);
                if (itemIndex > -1) cart.splice(itemIndex, 1);
                renderCart();
            } else {
                updateCartQuantity(productId, type);
            }
        });
    });

    calculateChange();
}

/**
 * 計算找零 (基於實收金額輸入框)
 */
function calculateChange() {
    const receivable = parseFloat(receivableEl.textContent.replace('$', ''));
    const received = parseFloat(cashReceivedInput.value) || 0;
    const change = received - receivable;

    changeDueEl.textContent = `$${Math.max(0, change).toFixed(2)}`;
    changeDueEl.style.color = change >= 0 ? '#dc3545' : '#ff0000';
}

/**
 * 處理結帳流程
 */
function handleCheckout() {
    if (cart.length === 0) {
        alert('購物車是空的，無法結帳！');
        return;
    }

    const receivable = parseFloat(receivableEl.textContent.replace('$', ''));
    const received = parseFloat(cashReceivedInput.value) || 0;
    
    if (received < receivable) {
        alert('實收金額不足！請確認收到的現金。');
        return;
    }

    const change = received - receivable;
    
    // 1. 生成交易數據
    const transaction = {
        id: Date.now(), 
        timestamp: new Date().toLocaleString(),
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity
        })),
        receivable: receivable,
        received: received,
        change: change,
        totalItems: cart.reduce((sum, item) => sum + item.quantity, 0)
    };

    // 2. 更新庫存
    cart.forEach(cartItem => {
        const product = products.find(p => p.id === cartItem.id);
        if (product && product.stock !== 999) {
            product.stock -= cartItem.quantity;
        }
    });
    
    // 3. 儲存交易紀錄與商品
    transactionHistory.unshift(transaction); 
    saveData(TRANSACTION_KEY, transactionHistory);
    saveData(PRODUCTS_KEY, products);

    // 4. 顯示收據
    displayReceipt(transaction);
    
    // 5. 清空購物車，重新渲染商品列表
    cart = [];
    renderCart();
    renderProducts(products); // 刷新庫存狀態

    // 彈出模態視窗後自動點擊列印（模擬）
    setTimeout(() => {
         $('print-receipt-btn').click();
    }, 100);
}

/**
 * 生成並顯示收據內容
 */
function displayReceipt(transaction) {
    let receiptText = '======================================\n';
    receiptText += `      GitHub POS 簡易收據\n`;
    receiptText += '======================================\n';
    receiptText += `交易時間: ${transaction.timestamp}\n`;
    receiptText += `收據編號: ${transaction.id}\n`;
    receiptText += '--------------------------------------\n';

    transaction.items.forEach(item => {
        receiptText += `${item.name.padEnd(20)} ${item.quantity} X ${item.price.toFixed(2).padStart(6)}\n`;
        receiptText += `${'小計'.padStart(20)} ${item.total.toFixed(2).padStart(17)}\n`;
    });

    receiptText += '--------------------------------------\n';
    receiptText += `應收金額: ${transaction.receivable.toFixed(2).padStart(30)}\n`;
    receiptText += `實收金額: ${transaction.received.toFixed(2).padStart(30)}\n`;
    receiptText += `找零金額: ${transaction.change.toFixed(2).padStart(30)}\n`;
    receiptText += '======================================\n';
    receiptText += `       感謝您的惠顧！\n`;
    receiptText += '======================================\n';

    receiptContentEl.textContent = receiptText;
    receiptModal.style.display = 'block';
}


// --- 4. 計算機邏輯 ---

/**
 * 處理計算機按鈕點擊
 */
function handleCalculator(value) {
    const displayEl = $('calc-display');
    let displayValue = displayEl.value;

    if (value === 'C') { 
        calculatorValue = '0';
        calculatorPendingOp = null;
        calculatorWaitingForSecondOperand = false;
    } else if (value === 'CE') { 
        calculatorValue = '0';
    } else if (value === '=') {
        if (calculatorPendingOp) {
            const result = performCalculation(calculatorPendingOp, parseFloat(calculatorValue), parseFloat(displayValue));
            calculatorValue = String(result);
            calculatorPendingOp = null;
        }
    } else if (value === '+' || value === '-' || value === '*' || value === '/') {
        if (calculatorPendingOp && !calculatorWaitingForSecondOperand) {
            handleCalculator('=');
        }
        calculatorPendingOp = value;
        calculatorValue = displayValue;
        calculatorWaitingForSecondOperand = true;
    } else if (value === '%') {
        calculatorValue = String(parseFloat(displayValue) / 100);
    } else if (value === 'apply') {
        let num = parseFloat(displayValue);
        if (!isNaN(num)) {
            cashReceivedInput.value = num.toFixed(2); 
            calculateChange();
        }
    } else { // 數字和點
        if (calculatorWaitingForSecondOperand) {
            displayValue = (value === '.') ? '0.' : value;
            calculatorWaitingForSecondOperand = false;
        } else {
            if (displayValue === '0' && value !== '.') {
                displayValue = value;
            } else if (value === '.' && displayValue.includes('.')) {
            } else {
                displayValue += value;
            }
        }
        calculatorValue = displayValue;
    }

    displayEl.value = calculatorValue.slice(0, 15); 
}

/**
 * 執行計算
 */
function performCalculation(operator, firstOperand, secondOperand) {
    switch (operator) {
        case '+': return firstOperand + secondOperand;
        case '-': return firstOperand - secondOperand;
        case '*': return firstOperand * secondOperand;
        case '/': return secondOperand === 0 ? 0 : firstOperand / secondOperand;
        default: return secondOperand;
    }
}


// --- 5. 管理頁面邏輯 (CRUD) ---

/**
 * 渲染管理頁面的商品清單
 */
function renderManagementList() {
    const listEl = $('managed-products-list');
    listEl.innerHTML = '';

    products.forEach(product => {
        const itemEl = document.createElement('div');
        itemEl.className = 'manage-item';
        itemEl.innerHTML = `
            <span>${product.name} (ID: ${product.id})</span>
            <div class="manage-item-actions">
                <small>分類: ${product.category} | 價格: $${product.price.toFixed(2)} | 庫存: ${product.stock}</small>
                <button class="secondary-btn small-btn edit-btn" data-id="${product.id}">編輯</button>
                <button class="qty-btn remove small-btn delete-btn" data-id="${product.id}">刪除</button>
            </div>
        `;
        listEl.appendChild(itemEl);
    });

    listEl.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEditProduct));
    listEl.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDeleteProduct));
}

/**
 * 處理新增/編輯商品
 */
function handleSaveProduct() {
    const id = $('manage-product-id').value;
    const name = $('manage-name').value;
    const price = parseFloat($('manage-price').value);
    const category = $('manage-category').value;
    const stock = parseInt($('manage-stock').value) || 0;

    if (!name || isNaN(price) || price < 0 || !category) {
        alert('請填寫完整且有效的商品資訊！');
        return;
    }

    if (id) {
        const index = products.findIndex(p => p.id == id);
        if (index !== -1) {
            products[index] = { id: parseInt(id), name, price, category, stock };
        }
    } else {
        maxProductId++;
        products.push({ id: maxProductId, name, price, category, stock });
    }

    saveData(PRODUCTS_KEY, products);
    renderManagementList();
    resetProductForm();
    
    renderCategoryFilters(products);
    renderProducts(products);
}

/**
 * 載入商品到編輯表單
 */
function handleEditProduct(event) {
    const productId = parseInt(event.target.dataset.id);
    const product = products.find(p => p.id === productId);

    if (product) {
        $('manage-product-id').value = product.id;
        $('manage-name').value = product.name;
        $('manage-price').value = product.price;
        $('manage-category').value = product.category;
        $('manage-stock').value = product.stock;
        $('save-product-btn').textContent = '更新商品';
    }
}

/**
 * 刪除商品
 */
function handleDeleteProduct(event) {
    const productId = parseInt(event.target.dataset.id);
    if (confirm(`確定要刪除 ID 為 ${productId} 的商品嗎？`)) {
        products = products.filter(p => p.id !== productId);
        saveData(PRODUCTS_KEY, products);
        renderManagementList();
        
        renderCategoryFilters(products);
        renderProducts(products);
    }
}

/**
 * 清空商品表單
 */
window.resetProductForm = function() { // 設為全域函式供 HTML 調用
    $('manage-product-id').value = '';
    $('manage-name').value = '';
    $('manage-price').value = '';
    $('manage-category').value = '';
    $('manage-stock').value = '';
    $('save-product-btn').textContent = '新增商品';
}

// --- 6. 導入/導出與列印功能 ---

function handleExportProducts() {
    const dataStr = JSON.stringify(products, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos_products_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('商品數據已導出！');
}

function handleImportProducts(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData) || !importedData.every(p => p.id && p.name && p.price)) {
                throw new Error("JSON 格式不正確，應為商品陣列。");
            }
            
            if (confirm('確定要覆蓋現有的商品數據嗎？建議先導出備份。')) {
                products = importedData;
                saveData(PRODUCTS_KEY, products);
                updateMaxProductId();

                renderManagementList();
                renderCategoryFilters(products);
                renderProducts(products);
                alert('商品數據導入成功！');
            }
        } catch (error) {
            alert('導入失敗: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function handlePrintReceipt() {
    receiptModal.style.display = 'none'; 
    const receiptWindow = window.open('', '', 'width=400,height=600');
    receiptWindow.document.write('<html><head><title>POS 收據</title>');
    receiptWindow.document.write('<style>body { font-family: monospace; white-space: pre; font-size: 12px; margin: 10px; }</style>');
    receiptWindow.document.write('</head><body>');
    receiptWindow.document.write(receiptContentEl.textContent);
    receiptWindow.document.write('</body></html>');
    receiptWindow.document.close();
    receiptWindow.print();
    receiptModal.style.display = 'block'; 
}

function handleExportPDF() {
    alert('PDF 導出功能需要引入 jspdf 或 html2canvas 庫，請自行加入程式碼。');
}


// --- 系統初始化 ---

function initPOS() {
    initAdmin();
    initProducts();
    transactionHistory = loadData(TRANSACTION_KEY, []);

    // 預設顯示登入頁面
    showPage('login-page');
    
    // 初始渲染
    renderCategoryFilters(products);
    renderProducts(products);
    renderCart();
    renderManagementList();

    // --- 事件監聽器綁定 ---

    // 登入頁面
    $('login-btn').addEventListener('click', handleLogin);
    $('reset-admin-btn').addEventListener('click', resetAdmin);
    $('password').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') handleLogin();
    });

    // POS 頁面
    $('logout-btn').addEventListener('click', handleLogout);
    $('go-to-manage-btn').addEventListener('click', () => {
        renderManagementList(); 
        showPage('manage-page');
    });
    $('checkout-btn').addEventListener('click', handleCheckout);
    $('clear-cart-btn').addEventListener('click', clearCart);
    cashReceivedInput.addEventListener('input', calculateChange);

    // 計算機
    $qa('.calc-btn').forEach(btn => {
        btn.addEventListener('click', () => handleCalculator(btn.dataset.val));
    });

    // 管理頁面
    $('go-to-pos-btn').addEventListener('click', () => {
        renderProducts(products); 
        renderCategoryFilters(products);
        showPage('pos-page');
    });
    $('save-product-btn').addEventListener('click', handleSaveProduct);
    
    // 導入/導出
    $('export-products-btn').addEventListener('click', handleExportProducts);
    $('import-products-btn').addEventListener('click', () => $('import-products-file').click());
    $('import-products-file').addEventListener('change', handleImportProducts);

    // 收據模態視窗
    $q('.close-btn').addEventListener('click', () => receiptModal.style.display = 'none');
    $('print-receipt-btn').addEventListener('click', handlePrintReceipt);
    $('export-receipt-pdf-btn').addEventListener('click', handleExportPDF);
    window.onclick = function(event) {
        if (event.target == receiptModal) {
            receiptModal.style.display = 'none';
        }
    }
}

// 確保 DOM 載入完成後才執行初始化
document.addEventListener('DOMContentLoaded', initPOS);
