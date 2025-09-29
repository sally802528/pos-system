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

// --- 輔助函式 ---

/**
 * 頁面切換函式
 * @param {string} pageId - 要顯示的頁面 ID (login-page, pos-page, manage-page)
 */
function showPage(pageId) {
    $qa('.page').forEach(page => page.classList.remove('active'));
    $(pageId).classList.add('active');
}

/**
 * 從 localStorage 載入數據
 * @param {string} key - 儲存的鍵
 * @param {any} defaultValue - 預設值
 */
function loadData(key, defaultValue) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}

/**
 * 儲存數據到 localStorage
 * @param {string} key - 儲存的鍵
 * @param {any} data - 要儲存的數據
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
        saveData(ADMIN_KEY, { username: 'admin', password: '123456' }); // 預設密碼
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
    
    msgEl.textContent = ''; // 清空訊息

    if (username === admin.username && password === admin.password) {
        showPage('pos-page');
        msgEl.textContent = '';
        console.log('登入成功');
    } else {
        msgEl.textContent = '使用者名或密碼錯誤！';
    }
}

/**
 * 處理登出
 */
function handleLogout() {
    // 簡單地回到登入頁面
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


// --- 2. 商品數據與渲染邏輯 (POS & 管理) ---

/**
 * 初始化或載入商品數據
 */
function initProducts() {
    // 嘗試從本地儲存載入，如果沒有，則使用預設的空陣列
    products = loadData(PRODUCTS_KEY, [
        { id: 101, name: "咖啡豆 (特選)", price: 350.00, category: "飲品原料", stock: 50 },
        { id: 102, name: "手工餅乾 (盒裝)", price: 120.00, category: "點心", stock: 100 },
        { id: 201, name: "美式咖啡", price: 65.00, category: "現製飲品", stock: 999 }
    ]);
    // 確保 ID 是最新的
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
        // 如果庫存為 0, 顯示缺貨
        const stockInfo = product.stock > 0 ? `庫存: ${product.stock}` : '<span style="color:red;">缺貨</span>';

        card.innerHTML = `
            <h4>${product.name}</h4>
            <p>$${product.price.toFixed(2)}</p>
            <small>${stockInfo}</small>
        `;
        if (product.stock > 0 || product.stock === 999) { // 999 視為無限庫存
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
    // 保持 "全部" 按鈕的預設
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.textContent = '全部';
    allBtn.dataset.category = 'all';
    allBtn.addEventListener('click', () => filterProducts('all'));
    filterContainer.appendChild(allBtn);

    categories.forEach(category => {
        if (category !== 'all') {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.textContent = category;
            btn.dataset.category = category;
            btn.addEventListener('click', () => filterProducts(category));
            filterContainer.appendChild(btn);
        }
    });
}

/**
 * 根據分類過濾商品
 */
function filterProducts(selectedCategory) {
    $qa('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === selectedCategory) {
            btn.classList.add('active');
        }
    });

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
        // 檢查庫存 (如果庫存不是無限)
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
             // 檢查庫存
            if (product.stock !== 999 && cart[itemIndex].quantity >= product.stock) {
                 alert(`"${product.name}" 庫存不足！`);
                 return;
            }
            cart[itemIndex].quantity++;
        } else if (type === 'decrease') {
            cart[itemIndex].quantity--;
            if (cart[itemIndex].quantity <= 0) {
                cart.splice(itemIndex, 1); // 移除商品
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

    // 總計更新
    const total = subtotal; // 簡化：不計算折扣和稅
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
 * 計算找零
 */
function calculateChange() {
    const receivable = parseFloat(receivableEl.textContent.replace('$', ''));
    const received = parseFloat(cashReceivedInput.value) || 0;
    const change = received - receivable;

    changeDueEl.textContent = `$${Math.max(0, change).toFixed(2)}`;
    // 如果實收小於應收，找零顯示紅色
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
        id: Date.now(), // 使用時間戳作為唯一 ID
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
    transactionHistory.unshift(transaction); // 新紀錄放在前面
    saveData(TRANSACTION_KEY, transactionHistory);
    saveData(PRODUCTS_KEY, products);

    // 4. 顯示收據
    displayReceipt(transaction);
    
    // 5. 清空購物車，重新渲染商品列表
    cart = [];
    renderCart();
    renderProducts(products); // 刷新庫存狀態

    // 彈出模態視窗後自動點擊列印
    setTimeout(() => {
         $('print-receipt-btn').click();
    }, 100);
}

/**
 * 清空購物車
 */
function clearCart() {
    if (confirm('確定要清空購物車嗎？')) {
        cart = [];
        renderCart();
    }
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
    const displayValue = displayEl.value;

    if (value === 'C') { // 清空所有
        calculatorValue = '0';
        calculatorPendingOp = null;
        calculatorWaitingForSecondOperand = false;
    } else if (value === 'CE') { // 清空當前輸入
        calculatorValue = '0';
    } else if (value === '=') {
        if (calculatorPendingOp) {
            const result = performCalculation(calculatorPendingOp, parseFloat(calculatorValue), parseFloat(displayValue));
            calculatorValue = String(result);
            calculatorPendingOp = null;
        }
    } else if (value === '+' || value === '-' || value === '*' || value === '/') {
        if (calculatorPendingOp && !calculatorWaitingForSecondOperand) {
            // 如果連續輸入運算符，則先計算上一個結果
            handleCalculator('=');
        }
        calculatorPendingOp = value;
        calculatorValue = displayValue;
        calculatorWaitingForSecondOperand = true;
    } else if (value === '%') {
        calculatorValue = String(parseFloat(displayValue) / 100);
    } else if (value === 'apply') {
        // 將計算機結果應用到實收金額
        let num = parseFloat(displayValue);
        if (!isNaN(num)) {
            cashReceivedInput.value = num.toFixed(0); // 取整數作為收到的現金
            calculateChange();
        }
    } else { // 數字和點
        if (calculatorWaitingForSecondOperand) {
            displayEl.value = value;
            calculatorWaitingForSecondOperand = false;
        } else {
            // 防止多個零開頭或多個點
            if (displayValue === '0' && value !== '.') {
                displayEl.value = value;
            } else if (value === '.' && displayValue.includes('.')) {
                // 不做任何事
            } else {
                displayEl.value += value;
            }
        }
        calculatorValue = displayEl.value;
    }

    // 更新顯示
    displayEl.value = calculatorValue.slice(0, 15); // 限制長度
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
                <small>分類: ${product.category} | 價格: $${product.price} | 庫存: ${product.stock}</small>
                <button class="secondary-btn small-btn edit-btn" data-id="${product.id}">編輯</button>
                <button class="qty-btn remove small-btn delete-btn" data-id="${product.id}">刪除</button>
            </div>
        `;
        listEl.appendChild(itemEl);
    });

    // 編輯和刪除事件
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

    if (!name || isNaN(price) || !category) {
        alert('請填寫完整且有效的商品資訊！');
        return;
    }

    if (id) {
        // 編輯現有商品
        const index = products.findIndex(p => p.id == id);
        if (index !== -1) {
            products[index] = { id: parseInt(id), name, price, category, stock };
        }
    } else {
        // 新增商品
        maxProductId++;
        products.push({ id: maxProductId, name, price, category, stock });
    }

    saveData(PRODUCTS_KEY, products);
    renderManagementList();
    resetProductForm();
    
    // 重新載入 POS 數據
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
        
        // 重新載入 POS 數據
        renderCategoryFilters(products);
        renderProducts(products);
    }
}

/**
 * 清空商品表單
 */
function resetProductForm() {
    $('manage-product-id').value = '';
    $('manage-name').value = '';
    $('manage-price').value = '';
    $('manage-category').value = '';
    $('manage-stock').value = '';
    $('save-product-btn').textContent = '新增商品';
}

// --- 6. 導入/導出功能 ---

/**
 * 導出商品數據為 JSON
 */
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

/**
 * 處理導入商品數據
 */
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

                // 刷新所有頁面
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

// --- 7. 列印與 PDF 導出 ---

/**
 * 處理列印 (使用瀏覽器內建)
 */
function handlePrintReceipt() {
    // 臨時隱藏其他元素，只列印收據內容
    const originalBody = document.body.innerHTML;
    const printContent = receiptContentEl.outerHTML;

    // 為列印準備一個乾淨的頁面
    document.body.innerHTML = `
        <style>
            @media print {
                body { margin: 0; padding: 0; }
                #receipt-content { font-family: monospace; white-space: pre-wrap; font-size: 10px; border: none; padding: 0; }
                .print-header { text-align: center; margin-bottom: 10px; }
            }
        </style>
        <div class="print-header">POS 系統收據</div>
        ${printContent}
    `;

    window.print();

    // 恢復原來的內容
    document.body.innerHTML = originalBody;
    // 需要重新綁定所有事件
    initPOS();
}

// 注意：純前端導出 PDF 較複雜，需要引入第三方庫如 jspdf 或 html2canvas。
// 為了保持程式碼簡潔，這裡僅模擬導出 PDF 的行為，讓用戶知道需要引入額外庫。
function handleExportPDF() {
    alert('PDF 導出功能需要引入 jspdf 或 html2canvas 庫。目前已完成框架，請手動實現。');
    // 如果您想實現，可以在這裡加入 jspdf 的程式碼
}


// --- 系統初始化 ---

function initPOS() {
    initAdmin();
    initProducts();
    transactionHistory = loadData(TRANSACTION_KEY, []);

    // 檢查登入狀態
    // 由於沒有 session，預設顯示登入頁面
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

    // POS 頁面
    $('logout-btn').addEventListener('click', handleLogout);
    $('go-to-manage-btn').addEventListener('click', () => {
        renderManagementList(); // 每次切換前刷新管理清單
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
        renderProducts(products); // 刷新商品列表
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

// 啟動 POS 系統
initPOS();
