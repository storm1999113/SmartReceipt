/**
 * SmartReceipt - レシート価格比較・家計簿Webアプリ
 * Supabase JavaScript Client (CDN v2) 対応 + リレーショナルDB構造対応
 */

// ==========================================
// 1. Supabase 接続情報の設定変数
// ==========================================
let SUPABASE_URL = localStorage.getItem('smartreceipt_sb_url') || "https://yyioyhwduumezfggkifv.supabase.co";
let SUPABASE_ANON_KEY = localStorage.getItem('smartreceipt_sb_key') || "sb_publishable_aW10b4JrZZgLk3f3HEcKig_WWaZtkm3";

// Supabase クライアント保持変数
let supabaseClient = null;

// アプリ内部状態 (State Management)
const state = {
  currentUser: null, // { email, id }
  isDemoMode: true,
  // リレーショナルキャッシュデータ
  categories: [], // [{ id, user_id, name }]
  stores: [],     // [{ id, user_id, name }]
  products: [],   // [{ id, user_id, category_id, name }]
  items: [],      // [{ id, user_id, store_id, product_id, price, purchase_date, image_url, store_name, category_name, item_name }]
  filterCategory: 'ALL',
  searchQuery: ''
};

// デモ初期マスターデータ
const DEFAULT_DEMO_CATEGORIES = [
  { id: 'cat-1', name: '食料品', user_id: 'demo-user-id' },
  { id: 'cat-2', name: '日用品', user_id: 'demo-user-id' },
  { id: 'cat-3', name: '飲料・お酒', user_id: 'demo-user-id' },
  { id: 'cat-4', name: '家電・雑貨', user_id: 'demo-user-id' }
];

const DEFAULT_DEMO_STORES = [
  { id: 'store-1', name: 'イオン', user_id: 'demo-user-id' },
  { id: 'store-2', name: 'セブンイレブン', user_id: 'demo-user-id' },
  { id: 'store-3', name: 'マツモトキヨシ', user_id: 'demo-user-id' },
  { id: 'store-4', name: 'スーパーA', user_id: 'demo-user-id' }
];

const DEFAULT_DEMO_PRODUCTS = [
  { id: 'prod-1', category_id: 'cat-1', name: '明治おいしい牛乳 1000ml', user_id: 'demo-user-id' },
  { id: 'prod-2', category_id: 'cat-2', name: 'エリエール ティシュー 5個パック', user_id: 'demo-user-id' },
  { id: 'prod-3', category_id: 'cat-3', name: 'アサヒ スーパードライ 350ml 6缶', user_id: 'demo-user-id' }
];

const DEFAULT_DEMO_ITEMS = [
  {
    id: 'demo-1',
    user_id: 'demo-user-id',
    store_id: 'store-1',
    product_id: 'prod-1',
    price: 238,
    purchase_date: new Date().toISOString().split('T')[0],
    image_url: null,
    store_name: 'イオン',
    category_name: '食料品',
    item_name: '明治おいしい牛乳 1000ml'
  },
  {
    id: 'demo-2',
    user_id: 'demo-user-id',
    store_id: 'store-2',
    product_id: 'prod-1',
    price: 278,
    purchase_date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    image_url: null,
    store_name: 'セブンイレブン',
    category_name: '食料品',
    item_name: '明治おいしい牛乳 1000ml'
  },
  {
    id: 'demo-3',
    user_id: 'demo-user-id',
    store_id: 'store-4',
    product_id: 'prod-1',
    price: 218,
    purchase_date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
    image_url: null,
    store_name: 'スーパーA',
    category_name: '食料品',
    item_name: '明治おいしい牛乳 1000ml'
  },
  {
    id: 'demo-4',
    user_id: 'demo-user-id',
    store_id: 'store-3',
    product_id: 'prod-2',
    price: 348,
    purchase_date: new Date(Date.now() - 86400000 * 4).toISOString().split('T')[0],
    image_url: null,
    store_name: 'マツモトキヨシ',
    category_name: '日用品',
    item_name: 'エリエール ティシュー 5個パック'
  }
];

// ==========================================
// 3. 初期化処理
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initDateInput();
  initSupabaseClient();
  setupEventListeners();
  loadInitialData();
});

function initDateInput() {
  const dateInput = document.getElementById('purchase-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }

  const urlInput = document.getElementById('cfg-url');
  const keyInput = document.getElementById('cfg-key');
  if (urlInput) urlInput.value = SUPABASE_URL;
  if (keyInput) keyInput.value = SUPABASE_ANON_KEY;
}

function initSupabaseClient() {
  const statusLabel = document.getElementById('config-status');

  if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      state.isDemoMode = false;
      if (statusLabel) {
        statusLabel.textContent = "現在のモード: Supabase 接続中";
        statusLabel.style.color = "#34d399";
      }
      checkSupabaseSession();
    } catch (err) {
      console.error("Supabase初期化エラー:", err);
      enableDemoMode("Supabase接続エラー。ローカルデモモードで動作します。");
    }
  } else {
    enableDemoMode();
  }
}

function enableDemoMode(message) {
  state.isDemoMode = true;
  const statusLabel = document.getElementById('config-status');
  if (statusLabel) {
    statusLabel.textContent = "現在のモード: ローカルデモモード";
    statusLabel.style.color = "#f59e0b";
  }

  const savedDemoUser = localStorage.getItem('smartreceipt_demo_user');
  if (savedDemoUser) {
    state.currentUser = JSON.parse(savedDemoUser);
  } else {
    state.currentUser = { email: 'demo@example.com', id: 'demo-user-id' };
  }

  if (message) showNotification(message);
}

async function checkSupabaseSession() {
  if (!supabaseClient) return;

  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (session && session.user) {
      state.currentUser = { email: session.user.email, id: session.user.id };
    } else {
      state.currentUser = null;
    }

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) {
        state.currentUser = { email: session.user.email, id: session.user.id };
      } else {
        state.currentUser = null;
      }
      renderUI();
      if (state.currentUser) fetchAllSupabaseData();
    });
  } catch (err) {
    console.error("セッション確認失敗:", err);
    state.currentUser = null;
  }

  renderUI();
}

// ==========================================
// 4. UI レンダリング & ドロップダウン更新
// ==========================================
function renderUI() {
  const authSection = document.getElementById('auth-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const authStatusBar = document.getElementById('auth-status-bar');

  if (state.currentUser) {
    if (authSection) authSection.classList.add('hidden');
    if (dashboardSection) dashboardSection.classList.remove('hidden');

    const modeClass = state.isDemoMode ? 'demo' : 'supabase';
    const modeLabel = state.isDemoMode ? 'デモ' : 'Cloud';

    if (authStatusBar) {
      authStatusBar.innerHTML = `
        <div class="user-badge">
          <div class="user-avatar">${state.currentUser.email.charAt(0).toUpperCase()}</div>
          <span class="user-email">${escapeHtml(state.currentUser.email)}</span>
          <span class="mode-badge ${modeClass}">${modeLabel}</span>
        </div>
        <button id="logout-btn" class="btn btn-secondary btn-sm">ログアウト</button>
      `;
      document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    }
  } else {
    if (authSection) authSection.classList.remove('hidden');
    if (dashboardSection) dashboardSection.classList.add('hidden');
    if (authStatusBar) {
      authStatusBar.innerHTML = `<span class="mode-badge demo">未ログイン</span>`;
    }
  }

  updateSelectDropdowns();
  renderDashboard();
}

function updateSelectDropdowns() {
  const storeSelect = document.getElementById('store-select');
  const categorySelect = document.getElementById('category-select');
  const categoryFilter = document.getElementById('category-filter');

  if (storeSelect) {
    const currentVal = storeSelect.value;
    storeSelect.innerHTML = `<option value="">-- 既存の店舗を選択 --</option>` +
      state.stores.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('') +
      `<option value="__NEW__">＋ 新しい店舗を入力する</option>`;
    if (currentVal) storeSelect.value = currentVal;
  }

  if (categorySelect) {
    const currentVal = categorySelect.value;
    categorySelect.innerHTML = `<option value="">-- 既存のカテゴリを選択 --</option>` +
      state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('') +
      `<option value="__NEW__">＋ 新しいカテゴリを入力する</option>`;
    if (currentVal) categorySelect.value = currentVal;
  }

  if (categoryFilter) {
    const currentVal = categoryFilter.value;
    categoryFilter.innerHTML = `<option value="ALL">全カテゴリ</option>` +
      state.categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
    if (currentVal) categoryFilter.value = currentVal;
  }
}

function renderDashboard() {
  renderSummary();
  renderHistoryTable();
  renderPriceInsights();
}

function renderSummary() {
  const totalAmountEl = document.getElementById('monthly-total-amount');
  const countEl = document.getElementById('monthly-receipt-count');
  const breakdownContainer = document.getElementById('category-breakdown-container');
  const currentMonthLabel = document.getElementById('current-month-label');

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  if (currentMonthLabel) {
    currentMonthLabel.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  }

  const monthlyItems = state.items.filter(item => {
    return item.purchase_date && item.purchase_date.startsWith(currentYearMonth);
  });

  const totalAmount = monthlyItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
  if (totalAmountEl) totalAmountEl.textContent = `¥${totalAmount.toLocaleString()}`;
  if (countEl) countEl.textContent = `${monthlyItems.length}件`;

  const catTotals = {};
  monthlyItems.forEach(item => {
    const cat = item.category_name || '未分類';
    catTotals[cat] = (catTotals[cat] || 0) + Number(item.price || 0);
  });

  if (breakdownContainer) {
    if (Object.keys(catTotals).length === 0) {
      breakdownContainer.innerHTML = `<p class="empty-state" style="padding:1rem;">今月の購入データがまだありません。</p>`;
    } else {
      const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
      breakdownContainer.innerHTML = sortedCats.map(([cat, amount]) => {
        const pct = totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0;
        return `
          <div class="cat-item">
            <div class="cat-info">
              <span class="cat-name">${escapeHtml(cat)} (${pct}%)</span>
              <span class="cat-amount">¥${amount.toLocaleString()}</span>
            </div>
            <div class="cat-progress-bg">
              <div class="cat-progress-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function renderHistoryTable() {
  const tbody = document.getElementById('history-table-body');
  const emptyMsg = document.getElementById('empty-history-msg');
  if (!tbody) return;

  const filteredItems = state.items.filter(item => {
    if (state.filterCategory !== 'ALL' && item.category_name !== state.filterCategory) {
      return false;
    }
    if (state.searchQuery.trim() !== '') {
      const query = state.searchQuery.toLowerCase();
      const matchName = (item.item_name || '').toLowerCase().includes(query);
      const matchStore = (item.store_name || '').toLowerCase().includes(query);
      return matchName || matchStore;
    }
    return true;
  });

  filteredItems.sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));

  if (filteredItems.length === 0) {
    tbody.innerHTML = '';
    if (emptyMsg) emptyMsg.classList.remove('hidden');
    return;
  }

  if (emptyMsg) emptyMsg.classList.add('hidden');

  const priceMap = {};
  state.items.forEach(item => {
    const nameKey = (item.item_name || '').trim().toLowerCase();
    if (!nameKey) return;
    if (!priceMap[nameKey]) {
      priceMap[nameKey] = { min: Number(item.price), max: Number(item.price) };
    } else {
      if (Number(item.price) < priceMap[nameKey].min) priceMap[nameKey].min = Number(item.price);
      if (Number(item.price) > priceMap[nameKey].max) priceMap[nameKey].max = Number(item.price);
    }
  });

  tbody.innerHTML = filteredItems.map(item => {
    const nameKey = (item.item_name || '').trim().toLowerCase();
    const stats = priceMap[nameKey];
    let priceBadge = `<span class="badge badge-normal">通常</span>`;

    if (stats && stats.min !== stats.max) {
      if (Number(item.price) === stats.min) {
        priceBadge = `<span class="badge badge-lowest">底値 (最安)</span>`;
      } else if (Number(item.price) === stats.max) {
        priceBadge = `<span class="badge badge-highest">最高値</span>`;
      }
    }

    return `
      <tr>
        <td>${escapeHtml(item.purchase_date)}</td>
        <td><strong>${escapeHtml(item.store_name)}</strong></td>
        <td><span class="badge badge-cat">${escapeHtml(item.category_name)}</span></td>
        <td>
          <div class="item-name-cell">
            ${escapeHtml(item.item_name)}
          </div>
        </td>
        <td class="text-right price-cell">¥${Number(item.price).toLocaleString()}</td>
        <td>${priceBadge}</td>
        <td class="text-center">
          <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${item.id}">削除</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      handleDeleteItem(id);
    });
  });
}

function renderPriceInsights() {
  const insightCard = document.getElementById('price-insight-card');
  const insightText = document.getElementById('price-insight-text');

  if (!insightCard || !insightText) return;

  if (state.searchQuery.trim() !== '') {
    const query = state.searchQuery.trim().toLowerCase();
    const matched = state.items.filter(i => (i.item_name || '').toLowerCase().includes(query));

    if (matched.length > 0) {
      let lowestItem = matched[0];
      matched.forEach(i => {
        if (Number(i.price) < Number(lowestItem.price)) lowestItem = i;
      });

      insightCard.classList.remove('hidden');
      insightText.innerHTML = `
        <h4>「${escapeHtml(state.searchQuery)}」の最安値分析</h4>
        <p>
          これまでで最も安く購入できた店舗は <strong>${escapeHtml(lowestItem.store_name)}</strong> で
          <span class="highlight-price">¥${Number(lowestItem.price).toLocaleString()}</span> (${escapeHtml(lowestItem.purchase_date)}) です！
        </p>
      `;
      return;
    }
  }

  insightCard.classList.add('hidden');
}

// ==========================================
// 5. データ同期・CRUD (Supabase & デモ)
// ==========================================

async function loadInitialData() {
  if (state.isDemoMode) {
    const savedCat = localStorage.getItem('smartreceipt_demo_categories');
    const savedStore = localStorage.getItem('smartreceipt_demo_stores');
    const savedProd = localStorage.getItem('smartreceipt_demo_products');
    const savedItems = localStorage.getItem('smartreceipt_demo_items');

    state.categories = savedCat ? JSON.parse(savedCat) : [...DEFAULT_DEMO_CATEGORIES];
    state.stores = savedStore ? JSON.parse(savedStore) : [...DEFAULT_DEMO_STORES];
    state.products = savedProd ? JSON.parse(savedProd) : [...DEFAULT_DEMO_PRODUCTS];
    state.items = savedItems ? JSON.parse(savedItems) : [...DEFAULT_DEMO_ITEMS];

    renderUI();
  } else {
    await fetchAllSupabaseData();
  }
}

// Supabase の全テーブル (categories, stores, products, receipt_items) をリレーション取得
async function fetchAllSupabaseData() {
  if (!supabaseClient || !state.currentUser) return;

  try {
    // 1. Categories
    const { data: catData, error: catErr } = await supabaseClient.from('categories').select('*');
    if (catErr) console.warn("categories取得エラー:", catErr.message);
    state.categories = catData || [];

    // 2. Stores
    const { data: storeData, error: storeErr } = await supabaseClient.from('stores').select('*');
    if (storeErr) console.warn("stores取得エラー:", storeErr.message);
    state.stores = storeData || [];

    // 3. Products
    const { data: prodData, error: prodErr } = await supabaseClient.from('products').select('*');
    if (prodErr) console.warn("products取得エラー:", prodErr.message);
    state.products = prodData || [];

    // 4. Receipt Items (JOIN SELECT)
    const { data: itemData, error: itemErr } = await supabaseClient
      .from('receipt_items')
      .select(`
        id,
        user_id,
        store_id,
        product_id,
        price,
        purchase_date,
        image_url,
        stores ( name ),
        products ( name, category_id, categories ( name ) )
      `)
      .order('purchase_date', { ascending: false });

    if (itemErr) {
      console.warn("receipt_items取得エラー:", itemErr.message);
      showNotification("receipt_items テーブルの取得に失敗しました。構造をご確認ください。");
      return;
    }

    // 表示用にマッピング
    state.items = (itemData || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      store_id: row.store_id,
      product_id: row.product_id,
      price: row.price,
      purchase_date: row.purchase_date,
      image_url: row.image_url,
      store_name: row.stores ? row.stores.name : '不明な店舗',
      item_name: row.products ? row.products.name : '不明な商品',
      category_name: (row.products && row.products.categories) ? row.products.categories.name : '未分類'
    }));

    renderUI();
  } catch (err) {
    console.error("Supabase全データ読み込み例外:", err);
  }
}

// 共通ヘルパー: カテゴリの取得または新規作成
async function getOrCreateCategory(selectedVal, newName) {
  if (selectedVal && selectedVal !== '__NEW__') {
    return selectedVal; // 既存ID
  }

  const name = newName.trim();
  if (!name) throw new Error("カテゴリ名を入力してください。");

  // デモモード
  if (state.isDemoMode) {
    const existing = state.categories.find(c => c.name === name);
    if (existing) return existing.id;
    const newCat = { id: 'cat-' + Date.now(), name: name, user_id: state.currentUser.id };
    state.categories.push(newCat);
    localStorage.setItem('smartreceipt_demo_categories', JSON.stringify(state.categories));
    return newCat.id;
  }

  // Supabase 既存検索
  const { data: existing } = await supabaseClient.from('categories').select('id').eq('name', name).single();
  if (existing) return existing.id;

  // 新規作成
  const { data, error } = await supabaseClient
    .from('categories')
    .insert([{ name: name, user_id: state.currentUser.id }])
    .select()
    .single();

  if (error) throw error;
  state.categories.push(data);
  return data.id;
}

// 共通ヘルパー: 店舗の取得または新規作成
async function getOrCreateStore(selectedVal, newName) {
  if (selectedVal && selectedVal !== '__NEW__') {
    return selectedVal; // 既存ID
  }

  const name = newName.trim();
  if (!name) throw new Error("店舗名を入力してください。");

  if (state.isDemoMode) {
    const existing = state.stores.find(s => s.name === name);
    if (existing) return existing.id;
    const newStore = { id: 'store-' + Date.now(), name: name, user_id: state.currentUser.id };
    state.stores.push(newStore);
    localStorage.setItem('smartreceipt_demo_stores', JSON.stringify(state.stores));
    return newStore.id;
  }

  const { data: existing } = await supabaseClient.from('stores').select('id').eq('name', name).single();
  if (existing) return existing.id;

  const { data, error } = await supabaseClient
    .from('stores')
    .insert([{ name: name, user_id: state.currentUser.id }])
    .select()
    .single();

  if (error) throw error;
  state.stores.push(data);
  return data.id;
}

// 共通ヘルパー: 商品の取得または新規作成 (category_id 紐付け)
async function getOrCreateProduct(productName, categoryId) {
  const name = productName.trim();
  if (!name) throw new Error("商品名を入力してください。");

  if (state.isDemoMode) {
    const existing = state.products.find(p => p.name === name);
    if (existing) return existing.id;
    const newProd = { id: 'prod-' + Date.now(), name: name, category_id: categoryId, user_id: state.currentUser.id };
    state.products.push(newProd);
    localStorage.setItem('smartreceipt_demo_products', JSON.stringify(state.products));
    return newProd.id;
  }

  const { data: existing } = await supabaseClient.from('products').select('id').eq('name', name).single();
  if (existing) return existing.id;

  const { data, error } = await supabaseClient
    .from('products')
    .insert([{ name: name, category_id: categoryId, user_id: state.currentUser.id }])
    .select()
    .single();

  if (error) throw error;
  state.products.push(data);
  return data.id;
}

// レシート登録メインロジック
async function handleAddReceiptForm({ purchaseDate, storeSelectVal, newStoreName, catSelectVal, newCatName, productName, price }) {
  try {
    // 1. カテゴリIDの取得または登録
    const categoryId = await getOrCreateCategory(catSelectVal, newCatName);

    // 2. 店舗IDの取得または登録
    const storeId = await getOrCreateStore(storeSelectVal, newStoreName);

    // 3. 商品IDの取得または登録 (category_id紐付け)
    const productId = await getOrCreateProduct(productName, categoryId);

    // 4. receipt_items に保存
    if (state.isDemoMode) {
      const catObj = state.categories.find(c => c.id === categoryId);
      const storeObj = state.stores.find(s => s.id === storeId);
      const prodObj = state.products.find(p => p.id === productId);

      const newItem = {
        id: 'demo-' + Date.now(),
        user_id: state.currentUser.id,
        store_id: storeId,
        product_id: productId,
        price: Number(price),
        purchase_date: purchaseDate,
        image_url: null,
        store_name: storeObj ? storeObj.name : newStoreName,
        category_name: catObj ? catObj.name : newCatName,
        item_name: prodObj ? prodObj.name : productName
      };

      state.items.unshift(newItem);
      localStorage.setItem('smartreceipt_demo_items', JSON.stringify(state.items));
      showNotification("レシート明細を登録しました (デモモード)");
      renderUI();
    } else {
      const receiptPayload = {
        user_id: state.currentUser.id,
        store_id: storeId,
        product_id: productId,
        price: Number(price),
        purchase_date: purchaseDate
      };

      const { error } = await supabaseClient.from('receipt_items').insert([receiptPayload]);
      if (error) throw error;

      showNotification("Supabase に購入明細を登録しました！");
      await fetchAllSupabaseData();
    }
  } catch (err) {
    console.error("登録エラー:", err);
    alert(`登録に失敗しました: ${err.message}`);
  }
}

async function handleDeleteItem(id) {
  if (!confirm("この購入明細を削除してもよろしいですか？")) return;

  if (state.isDemoMode) {
    state.items = state.items.filter(item => item.id !== id);
    localStorage.setItem('smartreceipt_demo_items', JSON.stringify(state.items));
    showNotification("明細を削除しました");
    renderUI();
  } else {
    try {
      const { error } = await supabaseClient.from('receipt_items').delete().eq('id', id);
      if (error) throw error;
      showNotification("明細を削除しました");
      await fetchAllSupabaseData();
    } catch (err) {
      console.error("削除エラー:", err);
      alert(`削除に失敗しました: ${err.message}`);
    }
  }
}

// ==========================================
// 6. イベントハンドラー
// ==========================================
function setupEventListeners() {
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  if (tabLogin && tabSignup) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabSignup.classList.remove('active');
      loginForm.classList.remove('hidden');
      signupForm.classList.add('hidden');
    });

    tabSignup.addEventListener('click', () => {
      tabSignup.classList.add('active');
      tabLogin.classList.remove('active');
      signupForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      if (state.isDemoMode) {
        state.currentUser = { email, id: 'demo-user-id' };
        localStorage.setItem('smartreceipt_demo_user', JSON.stringify(state.currentUser));
        showNotification("ログインしました (デモモード)");
        renderUI();
      } else {
        try {
          const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (error) throw error;
          showNotification("ログインに成功しました！");
        } catch (err) {
          showAuthError(err.message || "ログインに失敗しました。");
        }
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signup-email').value;
      const password = document.getElementById('signup-password').value;

      if (state.isDemoMode) {
        state.currentUser = { email, id: 'demo-user-id' };
        localStorage.setItem('smartreceipt_demo_user', JSON.stringify(state.currentUser));
        showNotification("会員登録が完了しました (デモモード)");
        renderUI();
      } else {
        try {
          const { error } = await supabaseClient.auth.signUp({ email, password });
          if (error) throw error;
          showNotification("会員登録が完了しました！メール確認を行ってください。");
        } catch (err) {
          showAuthError(err.message || "会員登録に失敗しました。");
        }
      }
    });
  }

  const storeSelect = document.getElementById('store-select');
  const storeNewInput = document.getElementById('store-new-input');
  if (storeSelect) {
    storeSelect.addEventListener('change', (e) => {
      if (e.target.value === '__NEW__') {
        storeNewInput.classList.remove('hidden');
        storeNewInput.focus();
      } else {
        storeNewInput.classList.add('hidden');
      }
    });
  }

  const categorySelect = document.getElementById('category-select');
  const categoryNewInput = document.getElementById('category-new-input');
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      if (e.target.value === '__NEW__') {
        categoryNewInput.classList.remove('hidden');
        categoryNewInput.focus();
      } else {
        categoryNewInput.classList.add('hidden');
      }
    });
  }

  // レシート登録フォーム送信処理
  const receiptForm = document.getElementById('receipt-form');
  if (receiptForm) {
    receiptForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const purchaseDate = document.getElementById('purchase-date').value;
      const storeSelectVal = storeSelect.value;
      const newStoreName = storeNewInput.value;
      const catSelectVal = categorySelect.value;
      const newCatName = categoryNewInput.value;
      const productName = document.getElementById('item-name').value;
      const price = document.getElementById('item-price').value;

      await handleAddReceiptForm({
        purchaseDate,
        storeSelectVal,
        newStoreName,
        catSelectVal,
        newCatName,
        productName,
        price
      });

      receiptForm.reset();
      initDateInput();
      storeNewInput.classList.add('hidden');
      categoryNewInput.classList.add('hidden');
    });
  }

  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.searchQuery) {
        searchClearBtn?.classList.remove('hidden');
      } else {
        searchClearBtn?.classList.add('hidden');
      }
      renderDashboard();
    });

    searchClearBtn?.addEventListener('click', () => {
      searchInput.value = '';
      state.searchQuery = '';
      searchClearBtn.classList.add('hidden');
      renderDashboard();
    });
  }

  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      state.filterCategory = e.target.value;
      renderDashboard();
    });
  }

  const saveConfigBtn = document.getElementById('save-config-btn');
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', () => {
      const url = document.getElementById('cfg-url').value.trim();
      const key = document.getElementById('cfg-key').value.trim();

      if (!url || !key) {
        alert("Supabase URLとAnon Keyを入力してください。");
        return;
      }

      localStorage.setItem('smartreceipt_sb_url', url);
      localStorage.setItem('smartreceipt_sb_key', key);
      SUPABASE_URL = url;
      SUPABASE_ANON_KEY = key;

      initSupabaseClient();
      showNotification("Supabase接続設定を保存しました！");
    });
  }

  const clearConfigBtn = document.getElementById('clear-config-btn');
  if (clearConfigBtn) {
    clearConfigBtn.addEventListener('click', () => {
      localStorage.removeItem('smartreceipt_sb_url');
      localStorage.removeItem('smartreceipt_sb_key');
      SUPABASE_URL = "";
      SUPABASE_ANON_KEY = "";
      supabaseClient = null;
      enableDemoMode("ローカルデモモードに切り替えました。");
      renderUI();
    });
  }

  document.getElementById('banner-close-btn')?.addEventListener('click', () => {
    document.getElementById('notification-banner')?.classList.add('hidden');
  });
}

async function handleLogout() {
  if (state.isDemoMode) {
    state.currentUser = null;
    localStorage.removeItem('smartreceipt_demo_user');
    showNotification("ログアウトしました");
    renderUI();
  } else if (supabaseClient) {
    await supabaseClient.auth.signOut();
    state.currentUser = null;
    showNotification("ログアウトしました");
    renderUI();
  }
}

function showNotification(msg) {
  const banner = document.getElementById('notification-banner');
  const bannerMsg = document.getElementById('banner-message');
  if (banner && bannerMsg) {
    bannerMsg.textContent = msg;
    banner.classList.remove('hidden');
    setTimeout(() => {
      banner.classList.add('hidden');
    }, 4000);
  }
}

function showAuthError(msg) {
  const errorEl = document.getElementById('auth-error-msg');
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
