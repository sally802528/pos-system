// 全域變數
let products = []; // 用於儲存從 JSON 載入的商品清單
let cart = [];     // 用於儲存當前購物車的商品

// DOM 元素快取
const productsListEl = document.getElementById('products-list');
const cartItemsEl = document.getElementById('cart-items');
const subtotalEl = document.getElementById('subtotal');
const totalEl = document.getElementById('total');
const checkoutBtn = document.getElementById('checkout-btn');
const clearCartBtn = document.getElementById('clear-cart-btn');
const filterContainer = document.querySelector('.category-filter');
const receiptModal = document.getElementById('receipt-modal');
const receiptContentEl = document.getElementById('receipt-content');
const closeModalBtn = document.querySelector('.close-btn');

/**
 * 載入商品數據
 */
async function loadProducts() {
    try {
        const response = await fetch('./data/products.json');
        products = await response.json();
        renderProducts(products); // 渲染所有商品
        renderCategoryFilters(products); // 渲染分類按鈕
    } catch (error) {
        console.error('無法載入商品數據:', error);
        productsListEl.innerHTML = '<p style="color: red;">載入商品失敗，請檢查 data/products.json 檔案。</p>';
    }
}

/**
 * 渲染商品卡片到介面
 * @param {Array} productArray - 要顯示的商品陣列
 */
function renderProducts(productArray) {
    productsListEl.innerHTML = ''; // 清空現有內容
    productArray.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <h4>${product.name}</h4>
            <p>$${product.price.toFixed(2)}</p>
            <small>庫存: ${product.stock}</small>
        `;
        // 點擊卡片將商品加入購物車
        card.addEventListener('click', () => addToCart(product.id));
        productsListEl.appendChild(card);
    });
}

/**
 * 渲染分類按鈕
 */
function renderCategoryFilters(productArray) {
    const categories = new Set(['all']);
    productArray.forEach(p => categories.add(p.category));

    filterContainer.innerHTML = ''; // 清空預設的按鈕

    categories.forEach(category => {
        const btn = document.createElement('button');
        btn.className = `filter-btn ${category === 'all' ? 'active' : ''}`;
        btn.textContent = category === 'all' ? '全部' : category;
        btn.dataset.category = category;
        
        btn.addEventListener('click', () => filterProducts(category));
        filterContainer.appendChild(btn);
    });
}


/**
 * 根據分類過濾商品
 */
function filterProducts(selectedCategory) {
    // 1. 更新按鈕的 active 狀態
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === selectedCategory) {
            btn.classList.add('active');
        }
    });

    // 2. 過濾並渲染
    let filteredProducts = products;
    if (selectedCategory !== 'all') {
        filteredProducts = products.filter(p => p.category === selectedCategory);
    }
    renderProducts(filteredProducts);
}

/**
 * 將商品加入購物車
 * (待實現)
 */
function addToCart(productId) {
    // 這裡將是核心邏輯：檢查購物車是否有此商品，有則加數量，無則新增
    console.log(`商品 ID: ${productId} 加入購物車`);
    // ...
}

/**
 * 計算購物車總計
 * (待實現)
 */
function calculateTotals() {
    // 這裡將計算小計、折扣和總計
    // ...
}

/**
 * 渲染購物車內容
 * (待實現)
 */
function renderCart() {
    // 這裡將更新 #cart-items 區域的 HTML
    // ...
}

/**
 * 處理結帳流程
 * (待實現)
 */
function handleCheckout() {
    // 檢查購物車，生成收據內容，顯示模態視窗
    // ...
}

/**
 * 清空購物車
 * (待實現)
 */
function clearCart() {
    // ...
}

/**
 * 初始化函式：綁定事件監聽器並載入數據
 */
function initPOS() {
    loadProducts(); // 啟動時載入商品

    checkoutBtn.addEventListener('click', handleCheckout);
    clearCartBtn.addEventListener('click', clearCart);
    closeModalBtn.addEventListener('click', () => receiptModal.style.display = 'none');
    
    // 點擊模態視窗外部關閉
    window.onclick = function(event) {
        if (event.target == receiptModal) {
            receiptModal.style.display = 'none';
        }
    }

    // 載入本地儲存的交易紀錄（如果有的話，這屬於數據持久化部分，之後處理）
    // ...
}

// 啟動 POS 系統
initPOS();
