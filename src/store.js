// ============================================
// Artemis - Persistent Data Store
// (IndexedDB Database Engine + Supabase Cloud Sync)
// ============================================

import { getSupabase } from './supabase.js';
import {
  STORES,
  getAllRecords,
  putRecord,
  putRecords,
  deleteRecord,
  clearStore,
  migrateFromLocalStorageIfNeeded,
} from './db.js';
import {
  roundMoney,
  cleanQuantity,
  calculateLineTotal,
  calculateDiscount,
  calculateTax,
  calculateShippingFee,
  calculateOrderTotals,
  calculateProfit,
  calculateStockChange,
} from './utils/pricing.js';

export {
  roundMoney,
  cleanQuantity,
  calculateLineTotal,
  calculateDiscount,
  calculateTax,
  calculateShippingFee,
  calculateOrderTotals,
  calculateProfit,
  calculateStockChange,
};

const KEYS = {
  ITEMS: 'sbh_items',
  TRANSACTIONS: 'sbh_transactions',
  CUSTOMERS: 'sbh_customers',
  LAST_SYNC: 'sbh_last_sync_time',
};

// In-memory cache for ultra-fast, zero-lag synchronous UI access
let memoryStore = {
  transactions: null,
  customers: null,
  items: null,
};

let currentUser = null;
let isSyncing = false;
let syncListeners = [];

export function subscribeSyncStatus(listener) {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener);
  };
}

function notifySyncStatus(status) {
  syncListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (e) {
      console.error('Lỗi sync listener:', e);
    }
  });
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// Fallback localStorage getters/setters for backup
function getLocalStorage(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setLocalStorage(key, data) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('Lỗi ghi localStorage:', err);
  }
}

// --- Default Items (Món quen thuộc) ---
export const DEFAULT_ITEMS = [
  { id: 'default-1', name: 'Vòng tay đá', default_price: 150000, default_cost: 80000 },
  { id: 'default-2', name: 'Dây chuyền', default_price: 200000, default_cost: 100000 },
  { id: 'default-3', name: 'Nhẫn bạc', default_price: 120000, default_cost: 60000 },
  { id: 'default-4', name: 'Bông tai', default_price: 80000, default_cost: 35000 },
  { id: 'default-5', name: 'Lắc chân', default_price: 100000, default_cost: 50000 },
  { id: 'default-6', name: 'Trâm cài tóc', default_price: 60000, default_cost: 25000 },
  { id: 'default-7', name: 'Mỹ phẩm', default_price: 250000, default_cost: 150000 },
  { id: 'default-8', name: 'Khác...', default_price: 0, default_cost: 0 },
];

/**
 * Khởi tạo dữ liệu từ IndexedDB khi ứng dụng chạy
 */
export async function initAppDatabase() {
  try {
    // 1. Tự động chuyển đổi từ localStorage nếu lần đầu nâng cấp
    await migrateFromLocalStorageIfNeeded();

    // 2. Tải toàn bộ dữ liệu từ IndexedDB vào memoryStore
    const [txs, custs, items] = await Promise.all([
      getAllRecords(STORES.TRANSACTIONS),
      getAllRecords(STORES.CUSTOMERS),
      getAllRecords(STORES.ITEMS),
    ]);

    if (txs && txs.length > 0) {
      memoryStore.transactions = txs;
      setLocalStorage(KEYS.TRANSACTIONS, txs);
    } else {
      const localTxs = getLocalStorage(KEYS.TRANSACTIONS);
      memoryStore.transactions = localTxs;
      if (localTxs.length > 0) await putRecords(STORES.TRANSACTIONS, localTxs);
    }

    if (custs && custs.length > 0) {
      memoryStore.customers = custs;
      setLocalStorage(KEYS.CUSTOMERS, custs);
    } else {
      const localCusts = getLocalStorage(KEYS.CUSTOMERS);
      memoryStore.customers = localCusts;
      if (localCusts.length > 0) await putRecords(STORES.CUSTOMERS, localCusts);
    }

    if (items && items.length > 0) {
      memoryStore.items = items;
      setLocalStorage(KEYS.ITEMS, items);
    } else {
      const localItems = getLocalStorage(KEYS.ITEMS);
      const initialItems = localItems.length > 0 ? localItems : DEFAULT_ITEMS;
      memoryStore.items = initialItems;
      setLocalStorage(KEYS.ITEMS, initialItems);
      await putRecords(STORES.ITEMS, initialItems);
    }

    return true;
  } catch (err) {
    console.error('Lỗi khởi tạo IndexedDB:', err);
    // Fallback sang localStorage
    memoryStore.transactions = getLocalStorage(KEYS.TRANSACTIONS);
    memoryStore.customers = getLocalStorage(KEYS.CUSTOMERS);
    const localItems = getLocalStorage(KEYS.ITEMS);
    memoryStore.items = localItems.length > 0 ? localItems : DEFAULT_ITEMS;
    return false;
  }
}


// ============================================
// CLOUD SYNC & USER MANAGEMENT
// ============================================

export function setCurrentUser(user) {
  currentUser = user;
}

export function getCurrentAppUser() {
  return currentUser;
}

export function getLastSyncTime() {
  return localStorage.getItem(KEYS.LAST_SYNC);
}

/**
 * Lưu danh sách transactions vào memory, localStorage và IndexedDB
 */
function saveTransactions(txs) {
  memoryStore.transactions = txs;
  setLocalStorage(KEYS.TRANSACTIONS, txs);
  putRecords(STORES.TRANSACTIONS, txs);
}

/**
 * Lưu danh sách customers vào memory, localStorage và IndexedDB
 */
function saveCustomers(custs) {
  memoryStore.customers = custs;
  setLocalStorage(KEYS.CUSTOMERS, custs);
  putRecords(STORES.CUSTOMERS, custs);
}

/**
 * Lưu danh sách items vào memory, localStorage và IndexedDB
 */
function saveItems(items) {
  memoryStore.items = items;
  setLocalStorage(KEYS.ITEMS, items);
  putRecords(STORES.ITEMS, items);
}

/**
 * Đồng bộ toàn bộ dữ liệu từ Supabase Cloud về máy
 */
export async function syncAllFromCloud() {
  const supabase = getSupabase();
  if (!supabase || !currentUser) return false;

  try {
    isSyncing = true;
    notifySyncStatus({ syncing: true, message: 'Đang đồng bộ từ đám mây...' });

    // 1. Fetch transactions
    const { data: remoteTransactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (txError) throw txError;

    // 2. Fetch customers
    const { data: remoteCustomers, error: custError } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', currentUser.id);

    if (custError) throw custError;

    // 3. Fetch items
    const { data: remoteItems, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', currentUser.id);

    if (itemsError) throw itemsError;

    // Update local store with remote data if exists (bảo toàn các trường mở rộng như stock, quantity, unit_price nếu cloud chưa có cột)
    if (remoteTransactions && remoteTransactions.length > 0) {
      const localTxMap = new Map(getTransactions().map((t) => [t.id, t]));
      const mergedTxs = remoteTransactions.map((rt) => {
        const local = localTxMap.get(rt.id) || {};
        return {
          ...local,
          ...rt,
          quantity: rt.quantity !== undefined && rt.quantity !== null ? rt.quantity : (local.quantity ?? 1),
          unit_price: rt.unit_price !== undefined && rt.unit_price !== null ? rt.unit_price : local.unit_price,
          unit_cost: rt.unit_cost !== undefined && rt.unit_cost !== null ? rt.unit_cost : local.unit_cost,
        };
      });
      saveTransactions(mergedTxs);
    }

    if (remoteCustomers && remoteCustomers.length > 0) {
      saveCustomers(remoteCustomers);
    }

    if (remoteItems && remoteItems.length > 0) {
      const localItemMap = new Map(getItems().map((i) => [i.id, i]));
      const itemsWithoutKhac = remoteItems
        .filter((i) => i.name !== 'Khác...')
        .map((ri) => {
          const local = localItemMap.get(ri.id);
          return {
            ...ri,
            stock: ri.stock !== undefined ? ri.stock : (local?.stock ?? null),
          };
        });
      itemsWithoutKhac.push({ id: 'default-8', name: 'Khác...', default_price: 0, default_cost: 0 });
      saveItems(itemsWithoutKhac);
    } else if (getItems().length === 0) {
      saveItems(DEFAULT_ITEMS);
    }

    const now = new Date().toISOString();
    localStorage.setItem(KEYS.LAST_SYNC, now);
    isSyncing = false;
    notifySyncStatus({ syncing: false, success: true, lastSync: now });
    return true;
  } catch (err) {
    console.error('Lỗi đồng bộ từ Supabase:', err);
    isSyncing = false;
    notifySyncStatus({ syncing: false, success: false, error: err.message });
    return false;
  }
}

/**
 * Đẩy dữ liệu hiện có trên máy (localStorage) lên Supabase khi đăng ký / đăng nhập lần đầu
 */
export async function uploadLocalDataToCloud() {
  const supabase = getSupabase();
  if (!supabase || !currentUser) return { count: 0 };

  try {
    isSyncing = true;
    notifySyncStatus({ syncing: true, message: 'Đang sao lưu dữ liệu lên đám mây...' });

    const localTxs = getTransactions();
    const localCusts = getCustomers();
    const localItems = getItems().filter(i => i.name !== 'Khác...');

    // 1. Upload Customers
    if (localCusts.length > 0) {
      const custsToUpload = localCusts.map(c => ({
        id: c.id,
        user_id: currentUser.id,
        name: c.name,
        phone: c.phone || '',
        total_debt: c.total_debt || 0,
      }));
      await supabase.from('customers').upsert(custsToUpload, { onConflict: 'id' });
    }

    // 2. Upload Items
    if (localItems.length > 0) {
      const itemsToUpload = localItems.map(item => ({
        id: item.id,
        user_id: currentUser.id,
        name: item.name,
        default_price: item.default_price || 0,
        default_cost: item.default_cost || 0,
      }));
      await supabase.from('items').upsert(itemsToUpload, { onConflict: 'id' });
    }

    // 3. Upload Transactions
    if (localTxs.length > 0) {
      const txsToUpload = localTxs.map(t => ({
        id: t.id,
        user_id: currentUser.id,
        type: t.type,
        item_name: t.item_name,
        sale_price: t.sale_price || 0,
        cost_price: t.cost_price || 0,
        payment_method: t.payment_method || 'CASH_TRANSFER',
        customer_name: t.customer_name || '',
        customer_phone: t.customer_phone || '',
        shipping_address: t.shipping_address || '',
        tracking_code: t.tracking_code || '',
        shipping_fee: t.shipping_fee || 0,
        is_cod_received: Boolean(t.is_cod_received),
        created_at: t.created_at || new Date().toISOString(),
      }));
      await supabase.from('transactions').upsert(txsToUpload, { onConflict: 'id' });
    }

    const now = new Date().toISOString();
    localStorage.setItem(KEYS.LAST_SYNC, now);
    isSyncing = false;
    notifySyncStatus({ syncing: false, success: true, lastSync: now });
    return { count: localTxs.length };
  } catch (err) {
    console.error('Lỗi đẩy dữ liệu lên đám mây:', err);
    isSyncing = false;
    notifySyncStatus({ syncing: false, success: false, error: err.message });
    throw err;
  }
}

// Background sync helpers
async function pushTransactionToCloud(tx) {
  const supabase = getSupabase();
  if (!supabase || !currentUser) return;
  try {
    await supabase.from('transactions').upsert({
      id: tx.id,
      user_id: currentUser.id,
      type: tx.type,
      item_name: tx.item_name,
      sale_price: tx.sale_price || 0,
      cost_price: tx.cost_price || 0,
      payment_method: tx.payment_method || 'CASH_TRANSFER',
      customer_name: tx.customer_name || '',
      customer_phone: tx.customer_phone || '',
      shipping_address: tx.shipping_address || '',
      tracking_code: tx.tracking_code || '',
      shipping_fee: tx.shipping_fee || 0,
      is_cod_received: Boolean(tx.is_cod_received),
      created_at: tx.created_at || new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Lỗi ghi transaction lên Supabase (vẫn lưu trên máy an toàn):', err);
  }
}

async function removeTransactionFromCloud(id) {
  const supabase = getSupabase();
  if (!supabase || !currentUser) return;
  try {
    await supabase.from('transactions').delete().eq('id', id);
  } catch (err) {
    console.warn('Lỗi xóa transaction trên Supabase:', err);
  }
}

async function pushCustomerToCloud(customer) {
  const supabase = getSupabase();
  if (!supabase || !currentUser) return;
  try {
    await supabase.from('customers').upsert({
      id: customer.id,
      user_id: currentUser.id,
      name: customer.name,
      phone: customer.phone || '',
      total_debt: customer.total_debt || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Lỗi ghi customer lên Supabase:', err);
  }
}

async function pushItemToCloud(item) {
  const supabase = getSupabase();
  if (!supabase || !currentUser) return;
  try {
    await supabase.from('items').upsert({
      id: item.id,
      user_id: currentUser.id,
      name: item.name,
      default_price: item.default_price || 0,
      default_cost: item.default_cost || 0,
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Lỗi ghi item lên Supabase:', err);
  }
}

// ============================================
// ITEMS (Món quen thuộc) CRUD
// ============================================

export function getItems() {
  if (memoryStore.items && memoryStore.items.length > 0) {
    return memoryStore.items;
  }
  const items = getLocalStorage(KEYS.ITEMS);
  if (items.length === 0) {
    saveItems(DEFAULT_ITEMS);
    return DEFAULT_ITEMS;
  }
  memoryStore.items = items;
  return items;
}

export function addItem(item) {
  const items = [...getItems()];
  const newItem = {
    id: generateId(),
    name: item.name.trim(),
    default_price: roundMoney(item.default_price),
    default_cost: roundMoney(item.default_cost),
    stock: item.stock !== undefined && item.stock !== '' && item.stock !== null ? Number(item.stock) : null,
    created_at: new Date().toISOString(),
  };

  const khacIndex = items.findIndex((i) => i.name === 'Khác...');
  if (khacIndex !== -1) {
    items.splice(khacIndex, 0, newItem);
  } else {
    items.push(newItem);
  }

  saveItems(items);
  pushItemToCloud(newItem);
  return newItem;
}

export function updateItem(id, updates) {
  const items = [...getItems()];
  const idx = items.findIndex((i) => i.id === id);
  if (idx !== -1) {
    items[idx] = {
      ...items[idx],
      ...updates,
      default_price: updates.default_price !== undefined ? roundMoney(updates.default_price) : items[idx].default_price,
      default_cost: updates.default_cost !== undefined ? roundMoney(updates.default_cost) : items[idx].default_cost,
      stock: updates.stock !== undefined ? (updates.stock !== '' && updates.stock !== null ? Number(updates.stock) : null) : items[idx].stock,
    };
    saveItems(items);
    pushItemToCloud(items[idx]);
    return items[idx];
  }
  return null;
}

export function deleteItem(id) {
  let items = [...getItems()];
  const toDelete = items.find((i) => i.id === id);
  if (!toDelete || toDelete.name === 'Khác...') return false;

  items = items.filter((i) => i.id !== id);
  saveItems(items);
  deleteRecord(STORES.ITEMS, id);

  const supabase = getSupabase();
  if (supabase && currentUser) {
    supabase.from('items').delete().eq('id', id).then();
  }
  return true;
}

export function resetItemsToDefault() {
  saveItems(DEFAULT_ITEMS);
  clearStore(STORES.ITEMS).then(() => {
    putRecords(STORES.ITEMS, DEFAULT_ITEMS);
  });
  return DEFAULT_ITEMS;
}

/**
 * Trừ số lượng tồn kho khi bán hàng
 */
export function deductStock(itemName, quantity) {
  if (!itemName || quantity <= 0) return null;
  const items = [...getItems()];
  const normalized = itemName.trim().toLowerCase();
  const idx = items.findIndex((i) => (i.name || '').trim().toLowerCase() === normalized);
  if (idx !== -1 && items[idx].stock !== undefined && items[idx].stock !== null) {
    const { newStock, isOutOfStock } = calculateStockChange(items[idx].stock, quantity, 'DEDUCT');
    items[idx] = {
      ...items[idx],
      stock: Math.max(0, newStock),
      last_out_of_stock: isOutOfStock,
    };
    saveItems(items);
    pushItemToCloud(items[idx]);
    return items[idx];
  }
  return null;
}

/**
 * Hoàn lại số lượng tồn kho khi xóa đơn hoặc hủy bán hàng
 */
export function restoreStock(itemName, quantity) {
  if (!itemName || quantity <= 0) return null;
  const items = [...getItems()];
  const normalized = itemName.trim().toLowerCase();
  const idx = items.findIndex((i) => (i.name || '').trim().toLowerCase() === normalized);
  if (idx !== -1 && items[idx].stock !== undefined && items[idx].stock !== null) {
    const { newStock } = calculateStockChange(items[idx].stock, quantity, 'RESTORE');
    items[idx] = { ...items[idx], stock: newStock };
    saveItems(items);
    pushItemToCloud(items[idx]);
    return items[idx];
  }
  return null;
}

// ============================================
// TRANSACTIONS (Giao dịch / Đơn hàng) CRUD
// ============================================

export function getTransactions() {
  if (memoryStore.transactions) {
    return memoryStore.transactions;
  }
  const txs = getLocalStorage(KEYS.TRANSACTIONS);
  memoryStore.transactions = txs;
  return txs;
}

export function getTransactionById(id) {
  const transactions = getTransactions();
  return transactions.find((t) => t.id === id) || null;
}

/**
 * Tính số tiền nợ phát sinh trên 1 đơn bán hàng:
 * - Nếu payment_method === 'DEBT': nợ toàn bộ sale_price (hoặc remaining_debt nếu khách trả trước 1 phần).
 * - Nếu payment_method === 'CASH_TRANSFER' và khách đưa thiếu (customer_paid < sale_price): nợ phần thiếu.
 */
function getTransactionDebtAmount(tx) {
  if (!tx || tx.type !== 'SALE') return 0;
  const price = Math.max(0, roundMoney(tx.sale_price));
  if (tx.payment_method === 'DEBT') {
    return price;
  }
  if (
    tx.payment_method === 'CASH_TRANSFER' &&
    tx.customer_paid !== undefined &&
    tx.customer_paid !== null &&
    tx.customer_paid !== '' &&
    roundMoney(tx.customer_paid) < price
  ) {
    return Math.max(0, price - Math.max(0, roundMoney(tx.customer_paid)));
  }
  return 0;
}

/**
 * Tính số tiền mặt / chuyển khoản thực thu trên 1 đơn bán hàng
 */
function getTransactionCashCollected(tx) {
  if (!tx || tx.type !== 'SALE') return 0;
  const price = Math.max(0, roundMoney(tx.sale_price));
  if (tx.payment_method === 'CASH_TRANSFER') {
    const debtOnTx = getTransactionDebtAmount(tx);
    return Math.max(0, price - debtOnTx);
  }
  return 0;
}

/**
 * Tính doanh thu hàng hóa thuần của đơn bán (trước Thuế VAT & Phí Ship thu hộ)
 * Không cộng nhầm tiền ship của bưu điện hoặc tiền thuế VAT vào Lợi nhuận của cửa hàng
 */
function getNetMerchandiseRevenue(tx) {
  if (!tx || tx.type !== 'SALE') return 0;
  const price = Math.max(0, roundMoney(tx.sale_price));
  const taxAmt = Math.max(0, roundMoney(tx.tax_amount));
  const shipAmt = Math.max(0, roundMoney(tx.shipping_fee));
  if (tx.effective_subtotal !== undefined && tx.effective_subtotal !== null) {
    return Math.max(0, roundMoney(tx.effective_subtotal));
  }
  return Math.max(0, price - taxAmt - shipAmt);
}

export function addTransaction(tx) {
  const transactions = [...getTransactions()];
  const salePrice = Math.max(0, roundMoney(tx.sale_price));
  const costPrice = Math.max(0, roundMoney(tx.cost_price));
  const shippingFee = Math.max(0, roundMoney(tx.shipping_fee));
  const taxAmount = Math.max(0, roundMoney(tx.tax_amount));
  const discountAmount = Math.max(0, roundMoney(tx.discount_amount));
  const quantity = cleanQuantity(tx.quantity, 1);
  const baseSaleBeforeShipTax = Math.max(0, salePrice - shippingFee - taxAmount + discountAmount);
  const unitPrice =
    tx.unit_price !== undefined
      ? Math.max(0, roundMoney(tx.unit_price))
      : quantity > 1
      ? Math.round(baseSaleBeforeShipTax / quantity)
      : baseSaleBeforeShipTax;
  const unitCost =
    tx.unit_cost !== undefined
      ? Math.max(0, roundMoney(tx.unit_cost))
      : quantity > 1
      ? Math.round(costPrice / quantity)
      : costPrice;

  const newTx = {
    ...tx,
    id: tx.id || generateId(),
    type: tx.type || 'SALE',
    sale_price: salePrice,
    cost_price: costPrice,
    shipping_fee: shippingFee,
    quantity: quantity,
    unit_price: unitPrice,
    unit_cost: unitCost,
    is_cod_received: Boolean(tx.is_cod_received),
    created_at: tx.created_at || new Date().toISOString(),
  };

  if (newTx.type === 'SALE') {
    const debtAmt = getTransactionDebtAmount(newTx);
    if (debtAmt > 0) {
      newTx.remaining_debt = debtAmt;
      if (newTx.payment_method === 'CASH_TRANSFER' && !newTx.customer_name) {
        newTx.customer_name = 'Khách nợ';
      }
    }
  }

  transactions.unshift(newTx);
  saveTransactions(transactions);

  if (newTx.type === 'SALE') {
    const debtAmt = getTransactionDebtAmount(newTx);
    if (debtAmt > 0 && newTx.customer_name) {
      addOrUpdateCustomerDebt(newTx.customer_name, newTx.customer_phone || '', debtAmt);
    }
    if (newTx.item_name) {
      deductStock(newTx.item_name, newTx.quantity || 1);
    }
  }

  pushTransactionToCloud(newTx);
  return newTx;
}

export function updateTransaction(id, updates) {
  const transactions = [...getTransactions()];
  const idx = transactions.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  const oldTx = transactions[idx];
  const salePrice = updates.sale_price !== undefined ? Math.max(0, roundMoney(updates.sale_price)) : (Number(oldTx.sale_price) || 0);
  const costPrice = updates.cost_price !== undefined ? Math.max(0, roundMoney(updates.cost_price)) : (Number(oldTx.cost_price) || 0);
  const shippingFee = updates.shipping_fee !== undefined ? Math.max(0, roundMoney(updates.shipping_fee)) : (Number(oldTx.shipping_fee) || 0);
  const quantity = updates.quantity !== undefined ? cleanQuantity(updates.quantity, 1) : Math.max(1, Number(oldTx.quantity) || 1);

  const newTx = {
    ...oldTx,
    ...updates,
    sale_price: salePrice,
    cost_price: costPrice,
    shipping_fee: shippingFee,
    quantity: quantity,
  };

  // Cập nhật công nợ nếu có thay đổi (hỗ trợ cả đơn DEBT và đơn CASH_TRANSFER trả thiếu)
  const oldDebtAmt = getTransactionDebtAmount(oldTx);
  const newDebtAmt = getTransactionDebtAmount(newTx);
  newTx.remaining_debt = newDebtAmt;

  if (oldDebtAmt > 0 && newDebtAmt > 0) {
    const oldCust = (oldTx.customer_name || '').trim().toLowerCase();
    const newCust = (newTx.customer_name || '').trim().toLowerCase();
    if (oldCust === newCust) {
      const diff = newDebtAmt - oldDebtAmt;
      if (diff > 0) {
        addOrUpdateCustomerDebt(newTx.customer_name, newTx.customer_phone || '', diff);
      } else if (diff < 0) {
        reduceCustomerDebt(newTx.customer_name, Math.abs(diff));
      }
    } else {
      reduceCustomerDebt(oldTx.customer_name, oldDebtAmt);
      addOrUpdateCustomerDebt(newTx.customer_name, newTx.customer_phone || '', newDebtAmt);
    }
  } else if (oldDebtAmt > 0 && newDebtAmt === 0) {
    reduceCustomerDebt(oldTx.customer_name, oldDebtAmt);
  } else if (oldDebtAmt === 0 && newDebtAmt > 0) {
    addOrUpdateCustomerDebt(newTx.customer_name, newTx.customer_phone || '', newDebtAmt);
  }

  const oldWasPay = oldTx.type === 'DEBT_PAYMENT';
  const newIsPay = newTx.type === 'DEBT_PAYMENT';
  if (oldWasPay && newIsPay) {
    const oldCust = (oldTx.customer_name || '').trim().toLowerCase();
    const newCust = (newTx.customer_name || '').trim().toLowerCase();
    if (oldCust === newCust) {
      const diff = (newTx.sale_price || 0) - (oldTx.sale_price || 0);
      if (diff > 0) {
        reduceCustomerDebt(newTx.customer_name, diff);
      } else if (diff < 0) {
        addOrUpdateCustomerDebt(newTx.customer_name, newTx.customer_phone || '', Math.abs(diff));
      }
    } else {
      addOrUpdateCustomerDebt(oldTx.customer_name, oldTx.customer_phone || '', oldTx.sale_price || 0);
      reduceCustomerDebt(newTx.customer_name, newTx.sale_price || 0);
    }
  }

  // Điều chỉnh tồn kho khi sửa đơn
  if (oldTx.type === 'SALE' && newTx.type === 'SALE') {
    const oldName = (oldTx.item_name || '').trim().toLowerCase();
    const newName = (newTx.item_name || '').trim().toLowerCase();
    if (oldName === newName) {
      const qtyDiff = (newTx.quantity || 1) - (oldTx.quantity || 1);
      if (qtyDiff > 0) {
        deductStock(newTx.item_name, qtyDiff);
      } else if (qtyDiff < 0) {
        restoreStock(newTx.item_name, Math.abs(qtyDiff));
      }
    } else {
      restoreStock(oldTx.item_name, oldTx.quantity || 1);
      deductStock(newTx.item_name, newTx.quantity || 1);
    }
  }

  transactions[idx] = newTx;
  saveTransactions(transactions);
  pushTransactionToCloud(newTx);

  return newTx;
}

export function deleteTransaction(id) {
  let transactions = [...getTransactions()];
  const tx = transactions.find((t) => t.id === id);

  if (tx) {
    if (tx.type === 'SALE') {
      const debtAmt = getTransactionDebtAmount(tx);
      if (debtAmt > 0 && tx.customer_name) {
        reduceCustomerDebt(tx.customer_name, debtAmt);
      }
      if (tx.item_name) {
        restoreStock(tx.item_name, tx.quantity || 1);
      }
    } else if (tx.type === 'DEBT_PAYMENT' && tx.customer_name) {
      addOrUpdateCustomerDebt(tx.customer_name, tx.customer_phone || '', tx.sale_price || 0);
    }

    transactions = transactions.filter((t) => t.id !== id);
    saveTransactions(transactions);
    deleteRecord(STORES.TRANSACTIONS, id);
    removeTransactionFromCloud(id);
  }
}

export function getTransactionsByMonth(year, month) {
  const transactions = getTransactions();
  return transactions.filter((tx) => {
    const d = new Date(tx.created_at);
    return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
  });
}

export function deleteTransactionsByIds(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const idSet = new Set(ids);
  let deletedCount = 0;

  for (const id of idSet) {
    const existing = getTransactionById(id);
    if (existing) {
      deleteTransaction(id);
      deletedCount++;
    }
  }
  return deletedCount;
}

export function markCodReceived(id, received) {
  return updateTransaction(id, { is_cod_received: received });
}

export function updateCodOrder(id, updates) {
  return updateTransaction(id, updates);
}

// ============================================
// CUSTOMERS (Sổ Nợ) CRUD
// ============================================

export function getCustomers() {
  if (memoryStore.customers) {
    return memoryStore.customers;
  }
  const custs = getLocalStorage(KEYS.CUSTOMERS);
  memoryStore.customers = custs;
  return custs;
}

export function getCustomerById(id) {
  const customers = getCustomers();
  return customers.find((c) => c.id === id) || null;
}

export function addCustomer({ name, phone = '', total_debt = 0 }) {
  const customers = [...getCustomers()];
  const newCustomer = {
    id: generateId(),
    name: name.trim(),
    phone: phone ? phone.trim() : '',
    total_debt: Math.max(0, parseInt(total_debt) || 0),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  customers.push(newCustomer);
  saveCustomers(customers);
  pushCustomerToCloud(newCustomer);
  return newCustomer;
}

export function updateCustomer(id, updates) {
  const customers = [...getCustomers()];
  const idx = customers.findIndex((c) => c.id === id);
  if (idx !== -1) {
    customers[idx] = {
      ...customers[idx],
      ...updates,
      total_debt: updates.total_debt !== undefined ? Math.max(0, parseInt(updates.total_debt) || 0) : customers[idx].total_debt,
      updated_at: new Date().toISOString(),
    };
    saveCustomers(customers);
    pushCustomerToCloud(customers[idx]);
    return customers[idx];
  }
  return null;
}

export function deleteCustomer(id) {
  let customers = [...getCustomers()];
  customers = customers.filter((c) => c.id !== id);
  saveCustomers(customers);
  deleteRecord(STORES.CUSTOMERS, id);

  const supabase = getSupabase();
  if (supabase && currentUser) {
    supabase.from('customers').delete().eq('id', id).then();
  }
  return true;
}

export function addOrUpdateCustomerDebt(name, phone, amount) {
  const customers = [...getCustomers()];
  const normalizedName = (name || '').trim().toLowerCase();
  if (!normalizedName) return null;

  const existing = customers.find((c) => (c.name || '').trim().toLowerCase() === normalizedName);

  if (existing) {
    existing.total_debt = Math.max(0, (existing.total_debt || 0) + (parseInt(amount) || 0));
    if (phone) existing.phone = phone.trim();
    existing.updated_at = new Date().toISOString();
    saveCustomers(customers);
    pushCustomerToCloud(existing);
    return existing;
  } else {
    const newCustomer = {
      id: generateId(),
      name: name.trim(),
      phone: phone ? phone.trim() : '',
      total_debt: Math.max(0, parseInt(amount) || 0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    customers.push(newCustomer);
    saveCustomers(customers);
    pushCustomerToCloud(newCustomer);
    return newCustomer;
  }
}

export function reduceCustomerDebt(name, amount) {
  const customers = [...getCustomers()];
  const normalizedName = (name || '').trim().toLowerCase();
  if (!normalizedName) return null;

  const existing = customers.find((c) => (c.name || '').trim().toLowerCase() === normalizedName);

  if (existing) {
    existing.total_debt = Math.max(0, (existing.total_debt || 0) - (parseInt(amount) || 0));
    existing.updated_at = new Date().toISOString();
    saveCustomers(customers);
    pushCustomerToCloud(existing);
    return existing;
  }
  return null;
}

export function payDebt(customerId, amount, note = '') {
  const customers = [...getCustomers()];
  const customer = customers.find((c) => c.id === customerId);

  if (customer && customer.total_debt > 0) {
    const parsedAmount = Math.max(0, roundMoney(amount));
    const actualPay = Math.min(customer.total_debt, parsedAmount);
    if (actualPay <= 0) return null;

    const changeAmount = Math.max(0, parsedAmount - actualPay);
    customer.total_debt = Math.max(0, customer.total_debt - actualPay);
    customer.last_change_amount = changeAmount;
    customer.updated_at = new Date().toISOString();
    saveCustomers(customers);
    pushCustomerToCloud(customer);

    addTransaction({
      type: 'DEBT_PAYMENT',
      item_name: `Thu nợ - ${customer.name}${note ? ` (${note})` : ''}`,
      sale_price: actualPay,
      cost_price: 0,
      payment_method: 'CASH_TRANSFER',
      customer_name: customer.name,
      customer_phone: customer.phone,
    });

    return customer;
  }
  return null;
}

/**
 * Lấy tóm tắt toàn bộ công nợ hiện tại trong Sổ Nợ
 */
export function getDebtSummary(customerNameFilter = null) {
  const customers = getCustomers();
  const normalizedFilter = customerNameFilter ? customerNameFilter.trim().toLowerCase() : null;

  const owingCustomers = customers.filter((c) => {
    const debt = Number(c.total_debt) || 0;
    if (debt <= 0) return false;
    if (normalizedFilter) {
      return (c.name || '').toLowerCase().includes(normalizedFilter) || (c.phone || '').includes(normalizedFilter);
    }
    return true;
  });

  const totalDebt = owingCustomers.reduce((sum, c) => sum + (Number(c.total_debt) || 0), 0);
  return {
    owingCustomers,
    totalDebt,
    owingCount: owingCustomers.length,
    totalCustomerCount: customers.length,
  };
}

/**
 * Xóa sạch công nợ (đưa nợ chưa thu về 0đ cho toàn bộ khách hoặc theo tên khách)
 */
export function clearCustomerDebts({ customerName = null, recordAsPayment = false } = {}) {
  const customers = [...getCustomers()];
  const normalizedFilter = customerName ? customerName.trim().toLowerCase() : null;
  let clearedCount = 0;
  let clearedAmount = 0;
  const affectedNames = [];

  for (const c of customers) {
    const debt = Number(c.total_debt) || 0;
    if (debt <= 0) continue;
    if (normalizedFilter) {
      const matched =
        (c.name || '').toLowerCase().includes(normalizedFilter) || (c.phone || '').includes(normalizedFilter);
      if (!matched) continue;
    }

    clearedCount++;
    clearedAmount += debt;
    affectedNames.push(c.name);

    if (recordAsPayment) {
      addTransaction({
        type: 'DEBT_PAYMENT',
        item_name: `Thu hết nợ - ${c.name} (qua AI)`,
        sale_price: debt,
        cost_price: 0,
        payment_method: 'CASH_TRANSFER',
        customer_name: c.name,
        customer_phone: c.phone || '',
      });
    }

    c.total_debt = 0;
    c.updated_at = new Date().toISOString();
    pushCustomerToCloud(c);
  }

  if (clearedCount > 0) {
    saveCustomers(customers);
  }

  // Nếu xóa nợ (không ghi thu nợ) thì cập nhật luôn các giao dịch DEBT liên quan để không lệch sổ
  if (!recordAsPayment) {
    const txs = getTransactions();
    const debtTxIds = txs
      .filter((t) => {
        if (t.payment_method !== 'DEBT') return false;
        if (!normalizedFilter) return true;
        return (t.customer_name || '').toLowerCase().includes(normalizedFilter);
      })
      .map((t) => t.id);

    if (debtTxIds.length > 0) {
      deleteTransactionsByIds(debtTxIds);
    }
  }

  return {
    clearedCount,
    clearedAmount,
    affectedNames,
  };
}

/**
 * Tất toán / Đánh dấu đã nhận tiền toàn bộ đơn Ship COD đang chờ thu
 */
export function settleAllPendingCodOrders() {
  const codOrders = getCodOrders().filter((tx) => !tx.is_cod_received);
  let settledCount = 0;
  let settledAmount = 0;

  for (const tx of codOrders) {
    markCodReceived(tx.id, true);
    settledCount++;
    settledAmount += Number(tx.sale_price) || 0;
  }

  return { settledCount, settledAmount };
}

// ============================================
// STATISTICS & BÁO CÁO DÒNG TIỀN (CASH FLOW)
// ============================================

function isInventoryPurchaseExpense(tx) {
  return tx && tx.type === 'EXPENSE' && (tx.item_name || '').trim().toLowerCase() === 'nhập hàng';
}

export function getMonthlyStats(year, month) {
  const transactions = getTransactions();

  const monthTxs = transactions.filter((tx) => {
    const d = new Date(tx.created_at);
    return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
  });

  const actualIncome = monthTxs.reduce((sum, tx) => {
    const price = Number(tx.sale_price) || 0;
    if (tx.type === 'DEBT_PAYMENT') return sum + price;
    if (tx.type === 'SALE') {
      if (tx.payment_method === 'CASH_TRANSFER') return sum + getTransactionCashCollected(tx);
      if (tx.payment_method === 'COD' && tx.is_cod_received) return sum + price;
    }
    return sum;
  }, 0);

  const customers = getCustomers();
  const totalDebt = customers.reduce((sum, c) => sum + (Number(c.total_debt) || 0), 0);

  const totalRevenue = monthTxs.reduce((sum, tx) => {
    if (tx.type === 'SALE') return sum + (Number(tx.sale_price) || 0);
    return sum;
  }, 0);

  const netMerchandiseRevenue = monthTxs.reduce((sum, tx) => {
    if (tx.type === 'SALE') return sum + getNetMerchandiseRevenue(tx);
    return sum;
  }, 0);

  const totalCost = monthTxs.reduce((sum, tx) => {
    if (tx.type === 'SALE') return sum + (Number(tx.cost_price) || 0);
    return sum;
  }, 0);

  const totalExpense = monthTxs.reduce((sum, tx) => {
    if (tx.type === 'EXPENSE') return sum + (Number(tx.sale_price) || 0);
    return sum;
  }, 0);

  // Nếu đã có giá vốn từng đơn (totalCost > 0), không trừ đúp khoản chi "Nhập hàng" lần thứ 2 vào lợi nhuận
  const operatingExpense =
    totalCost > 0
      ? monthTxs.reduce((sum, tx) => {
          if (tx.type === 'EXPENSE' && !isInventoryPurchaseExpense(tx)) {
            return sum + (Number(tx.sale_price) || 0);
          }
          return sum;
        }, 0)
      : totalExpense;

  const profit = netMerchandiseRevenue - totalCost - operatingExpense;

  return {
    actualIncome,
    totalDebt,
    profit,
    totalRevenue,
    netMerchandiseRevenue,
    totalCost,
    totalExpense,
    operatingExpense,
    transactionCount: monthTxs.filter((t) => t.type === 'SALE').length,
  };
}

export function getDetailedCashFlowReport(year, month) {
  const transactions = getTransactions();

  const monthTxs = transactions.filter((tx) => {
    const d = new Date(tx.created_at);
    return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
  });

  let cashSaleIncome = 0;
  let codReceivedIncome = 0;
  let debtPaymentIncome = 0;
  let pendingDebtCreated = 0;
  let pendingCodAmount = 0;
  let totalCostOfGoods = 0;
  let totalRevenue = 0;
  let netMerchandiseRevenue = 0;
  let totalExpense = 0;

  const expensesByCategory = {
    'Nhập hàng': 0,
    'Phí ship': 0,
    'Bao bì/Đóng gói': 0,
    'Tiền điện/Nước': 0,
    'Ăn uống': 0,
    'Khác...': 0,
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyData = {};
  for (let i = 1; i <= daysInMonth; i++) {
    dailyData[i] = { day: i, income: 0, expense: 0, revenue: 0 };
  }

  monthTxs.forEach((tx) => {
    const d = new Date(tx.created_at);
    const day = d.getDate();
    const saleAmt = Number(tx.sale_price) || 0;
    const costAmt = Number(tx.cost_price) || 0;

    if (tx.type === 'SALE') {
      totalRevenue += saleAmt;
      netMerchandiseRevenue += getNetMerchandiseRevenue(tx);
      totalCostOfGoods += costAmt;
      if (dailyData[day]) dailyData[day].revenue += saleAmt;

      if (tx.payment_method === 'CASH_TRANSFER') {
        const cashCollected = getTransactionCashCollected(tx);
        const partialDebt = getTransactionDebtAmount(tx);
        cashSaleIncome += cashCollected;
        pendingDebtCreated += partialDebt;
        if (dailyData[day]) dailyData[day].income += cashCollected;
      } else if (tx.payment_method === 'COD') {
        if (tx.is_cod_received) {
          codReceivedIncome += saleAmt;
          if (dailyData[day]) dailyData[day].income += saleAmt;
        } else {
          pendingCodAmount += saleAmt;
        }
      } else if (tx.payment_method === 'DEBT') {
        pendingDebtCreated += getTransactionDebtAmount(tx);
      }
    } else if (tx.type === 'DEBT_PAYMENT') {
      debtPaymentIncome += saleAmt;
      if (dailyData[day]) dailyData[day].income += saleAmt;
    } else if (tx.type === 'EXPENSE') {
      const expAmount = saleAmt;
      totalExpense += expAmount;
      if (dailyData[day]) dailyData[day].expense += expAmount;

      const catName = tx.item_name || 'Khác...';
      if (expensesByCategory[catName] !== undefined) {
        expensesByCategory[catName] += expAmount;
      } else {
        expensesByCategory['Khác...'] += expAmount;
      }
    }
  });

  const operatingExpense =
    totalCostOfGoods > 0 ? Math.max(0, totalExpense - (expensesByCategory['Nhập hàng'] || 0)) : totalExpense;

  const actualCashInflow = cashSaleIncome + codReceivedIncome + debtPaymentIncome;
  const netCashFlow = actualCashInflow - totalExpense;
  const grossProfit = netMerchandiseRevenue - totalCostOfGoods;
  const netProfit = grossProfit - operatingExpense;

  const allCustomers = getCustomers();
  const totalCustomerDebt = allCustomers.reduce((sum, c) => sum + (Number(c.total_debt) || 0), 0);

  return {
    year,
    month,
    totalRevenue,
    cashSaleIncome,
    codReceivedIncome,
    debtPaymentIncome,
    actualCashInflow,
    pendingDebtCreated,
    pendingCodAmount,
    totalCostOfGoods,
    totalExpense,
    expensesByCategory,
    netCashFlow,
    grossProfit,
    netProfit,
    totalCustomerDebt,
    saleCount: monthTxs.filter((t) => t.type === 'SALE').length,
    expenseCount: monthTxs.filter((t) => t.type === 'EXPENSE').length,
    debtPaymentCount: monthTxs.filter((t) => t.type === 'DEBT_PAYMENT').length,
    dailyList: Object.values(dailyData),
  };
}

// ============================================
// COD Orders
// ============================================

export function getCodOrders() {
  const transactions = getTransactions();
  return transactions.filter(tx => tx.type === 'SALE' && tx.payment_method === 'COD');
}

// ============================================
// Debt history for a customer
// ============================================

export function getCustomerDebtHistory(customerName) {
  const transactions = getTransactions();
  const normalizedName = customerName.trim().toLowerCase();
  return transactions.filter(tx => {
    const txName = (tx.customer_name || '').trim().toLowerCase();
    return txName === normalizedName && (tx.payment_method === 'DEBT' || tx.type === 'DEBT_PAYMENT');
  });
}

// ============================================
// BACKUP & RESTORE & EXPORT
// ============================================

/**
 * Xuất toàn bộ cơ sở dữ liệu ra JSON để sao lưu dự phòng
 */
export function exportDatabaseToJson() {
  const data = {
    appName: 'Artemis',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    transactions: getTransactions(),
    customers: getCustomers(),
    items: getItems(),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Chống lỗ hổng CSV Formula Injection (CWE-1236)
 * Ngăn chặn Microsoft Excel / Google Sheets tự động thực thi công thức khi ô bắt đầu bằng =, +, -, @, \t, \r
 */
export function sanitizeCsvField(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  const formulaChars = ['=', '+', '-', '@', '\t', '\r'];
  const safeStr = formulaChars.includes(str.charAt(0)) ? `'${str}` : str;
  return `"${safeStr.replace(/"/g, '""')}"`;
}

/**
 * Nhập và phục hồi cơ sở dữ liệu từ file JSON (kèm kiểm định Schema và làm sạch dữ liệu)
 */
export async function importDatabaseFromJson(jsonContent) {
  try {
    const data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Định dạng file không hợp lệ: Dữ liệu sao lưu phải là một JSON Object.');
    }

    if (Array.isArray(data.transactions)) {
      const sanitizedTxs = data.transactions
        .filter((t) => t && typeof t === 'object' && !Array.isArray(t))
        .map((t) => {
          const type = ['SALE', 'EXPENSE', 'DEBT_PAYMENT'].includes(t.type) ? t.type : 'SALE';
          const payment_method = ['CASH_TRANSFER', 'DEBT', 'COD'].includes(t.payment_method)
            ? t.payment_method
            : 'CASH_TRANSFER';
          return {
            id: String(t.id || generateId()).slice(0, 64),
            type,
            item_name: String(t.item_name || '').slice(0, 200),
            sale_price: Math.max(0, Number(t.sale_price) || 0),
            cost_price: Math.max(0, Number(t.cost_price) || 0),
            payment_method,
            customer_name: String(t.customer_name || '').slice(0, 100),
            customer_phone: String(t.customer_phone || '').slice(0, 30),
            shipping_address: String(t.shipping_address || '').slice(0, 300),
            tracking_code: String(t.tracking_code || '').slice(0, 100),
            shipping_fee: Math.max(0, Number(t.shipping_fee) || 0),
            is_cod_received: Boolean(t.is_cod_received),
            quantity: Math.max(1, Number(t.quantity) || 1),
            created_at:
              typeof t.created_at === 'string' && !isNaN(Date.parse(t.created_at))
                ? t.created_at
                : new Date().toISOString(),
          };
        });
      saveTransactions(sanitizedTxs);
    }

    if (Array.isArray(data.customers)) {
      const sanitizedCusts = data.customers
        .filter((c) => c && typeof c === 'object' && !Array.isArray(c) && c.name)
        .map((c) => ({
          id: String(c.id || generateId()).slice(0, 64),
          name: String(c.name).trim().slice(0, 100),
          phone: String(c.phone || '').trim().slice(0, 30),
          total_debt: Math.max(0, roundMoney(c.total_debt)),
          created_at:
            typeof c.created_at === 'string' && !isNaN(Date.parse(c.created_at))
              ? c.created_at
              : new Date().toISOString(),
          updated_at:
            typeof c.updated_at === 'string' && !isNaN(Date.parse(c.updated_at))
              ? c.updated_at
              : new Date().toISOString(),
        }));
      saveCustomers(sanitizedCusts);
    }

    if (Array.isArray(data.items)) {
      const sanitizedItems = data.items
        .filter((i) => i && typeof i === 'object' && !Array.isArray(i) && i.name)
        .map((i) => {
          const rawStock = i.stock !== undefined && i.stock !== null && i.stock !== '' ? Number(i.stock) : null;
          return {
            id: String(i.id || generateId()).slice(0, 64),
            name: String(i.name).trim().slice(0, 100),
            default_price: Math.max(0, roundMoney(i.default_price)),
            default_cost: Math.max(0, roundMoney(i.default_cost)),
            stock: rawStock !== null && isFinite(rawStock) ? Math.max(0, Math.round(rawStock * 1000) / 1000) : null,
            created_at:
              typeof i.created_at === 'string' && !isNaN(Date.parse(i.created_at))
                ? i.created_at
                : new Date().toISOString(),
          };
        });
      saveItems(sanitizedItems);
    }

    if (currentUser) {
      try {
        await uploadLocalDataToCloud();
      } catch (e) {
        console.warn('Lỗi đồng bộ lên cloud sau khi import:', e);
      }
    }

    return true;
  } catch (err) {
    console.error('Lỗi import dữ liệu:', err);
    throw err;
  }
}

/**
 * Xuất danh sách giao dịch sang file CSV mở bằng Excel (UTF-8 BOM)
 */
export function exportTransactionsCsv(year, month) {
  const transactions = getTransactions().filter((tx) => {
    if (year === undefined || month === undefined) return true;
    const d = new Date(tx.created_at);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const headers = [
    'Mã GD',
    'Thời gian',
    'Loại GD',
    'Tên hàng / Khoản chi',
    'Số tiền / Doanh thu',
    'Giá vốn',
    'Hình thức thanh toán',
    'Khách hàng',
    'Số điện thoại',
    'Địa chỉ nhận',
    'Mã vận đơn',
    'Trạng thái COD',
  ];

  const typeLabels = {
    SALE: 'Bán hàng',
    EXPENSE: 'Chi phí',
    DEBT_PAYMENT: 'Thu nợ',
  };

  const paymentLabels = {
    CASH_TRANSFER: 'Tiền mặt/Chuyển khoản',
    DEBT: 'Ghi nợ',
    COD: 'Đơn Ship / COD',
  };

  const rows = transactions.map((t) => [
    sanitizeCsvField(t.id),
    sanitizeCsvField(formatDate(t.created_at)),
    sanitizeCsvField(typeLabels[t.type] || t.type),
    sanitizeCsvField(t.item_name || ''),
    t.sale_price || 0,
    t.cost_price || 0,
    sanitizeCsvField(paymentLabels[t.payment_method] || t.payment_method),
    sanitizeCsvField(t.customer_name || ''),
    sanitizeCsvField(t.customer_phone || ''),
    sanitizeCsvField(t.shipping_address || ''),
    sanitizeCsvField(t.tracking_code || ''),
    sanitizeCsvField(t.payment_method === 'COD' ? (t.is_cod_received ? 'Đã thu tiền' : 'Chờ thu tiền') : '-'),
  ]);

  const csvContent = '\uFEFF' + [headers.map(sanitizeCsvField).join(','), ...rows.map((r) => r.join(','))].join('\n');
  return csvContent;
}


/**
 * Lấy dữ liệu báo cáo doanh thu theo khoảng thời gian (today, week, month, all)
 */
export function getRevenueReportData(period = 'today') {
  const transactions = getTransactions();
  const now = new Date();

  const filtered = transactions.filter((tx) => {
    const d = new Date(tx.created_at);
    if (isNaN(d.getTime())) return false;

    if (period === 'today') {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }
    if (period === 'week') {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      // Monday as first day of week
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return d >= startOfWeek && d <= endOfWeek;
    }
    if (period === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    return true; // 'all'
  });

  let totalActualIncome = 0;
  let totalCostAndExpense = 0;
  let totalDebt = 0;
  let totalDebtPaidInPeriod = 0;
  let totalPendingCod = 0;
  let totalRevenue = 0;
  let netMerchandiseRevenue = 0;
  let totalCostOfGoods = 0;
  let totalExpense = 0;
  let inventoryPurchaseExpense = 0;
  let totalQuantity = 0;
  let orderCount = 0;

  const rows = filtered.map((tx) => {
    const price = Number(tx.sale_price) || 0;
    const cost = Number(tx.cost_price) || 0;
    const qty = Number(tx.quantity) || 1;

    let actualIncome = 0;
    let expense = 0;
    let debt = 0;
    let profit = 0;

    if (tx.type === 'SALE') {
      orderCount += 1;
      totalQuantity += qty;
      totalRevenue += price;
      const netSaleRev = getNetMerchandiseRevenue(tx);
      netMerchandiseRevenue += netSaleRev;
      totalCostOfGoods += cost;

      if (tx.payment_method === 'CASH_TRANSFER') {
        actualIncome = getTransactionCashCollected(tx);
        debt = getTransactionDebtAmount(tx);
      } else if (tx.payment_method === 'COD') {
        if (tx.is_cod_received) {
          actualIncome = price;
        } else {
          totalPendingCod += price;
        }
      } else if (tx.payment_method === 'DEBT') {
        debt = getTransactionDebtAmount(tx);
      }

      expense = cost;
      profit = netSaleRev - cost;
    } else if (tx.type === 'EXPENSE') {
      expense = price;
      totalExpense += price;
      if (isInventoryPurchaseExpense(tx)) {
        inventoryPurchaseExpense += price;
      }
      profit = -price;
    } else if (tx.type === 'DEBT_PAYMENT') {
      actualIncome = price;
      totalDebtPaidInPeriod += price;
      profit = 0;
    }

    totalActualIncome += actualIncome;
    totalCostAndExpense += expense;
    totalDebt += debt;

    return {
      ...tx,
      computedQuantity: tx.type === 'SALE' ? qty : 1,
      computedActualIncome: actualIncome,
      computedExpense: expense,
      computedDebt: debt,
      computedProfit: profit,
    };
  });

  const operatingExpense =
    totalCostOfGoods > 0 ? Math.max(0, totalExpense - inventoryPurchaseExpense) : totalExpense;
  const netProfit = netMerchandiseRevenue - totalCostOfGoods - operatingExpense;
  const remainingPeriodDebt = Math.max(0, totalDebt - totalDebtPaidInPeriod);

  return {
    transactions: rows,
    period,
    totals: {
      orderCount,
      totalQuantity,
      actualIncome: totalActualIncome,
      costAndExpense: totalCostAndExpense,
      costOfGoods: totalCostOfGoods,
      expense: totalExpense,
      operatingExpense,
      debt: remainingPeriodDebt,
      pendingCod: totalPendingCod,
      revenue: totalRevenue,
      netMerchandiseRevenue,
      profit: netProfit,
    },
  };
}

/**
 * Xuất Báo Cáo Doanh Thu ra định dạng Excel (.CSV UTF-8 BOM chuẩn)
 */
export function exportRevenueReportCsv(period = 'today', shopName = 'Cửa hàng') {
  const { transactions, totals } = getRevenueReportData(period);

  const periodLabels = {
    today: 'Hôm nay',
    week: 'Tuần này',
    month: 'Tháng này',
    all: 'Toàn bộ thời gian',
  };
  const periodLabel = periodLabels[period] || period;

  const headers = [
    'Thời gian',
    'Tên món / Khoản chi',
    'Số lượng',
    'Thu thực (VNĐ)',
    'Chi phí (VNĐ)',
    'Nợ chưa thu (VNĐ)',
    'Lợi nhuận (VNĐ)',
    'Hình thức thanh toán',
    'Khách hàng',
    'Ghi chú / Mã vận đơn',
  ];

  const paymentLabels = {
    CASH_TRANSFER: 'Tiền mặt/Chuyển khoản',
    DEBT: 'Ghi nợ',
    COD: 'Đơn Ship / COD',
  };

  const rows = transactions.map((t) => [
    sanitizeCsvField(formatDate(t.created_at)),
    sanitizeCsvField(t.item_name || (t.type === 'EXPENSE' ? 'Chi tiền' : 'Giao dịch')),
    t.computedQuantity,
    t.computedActualIncome,
    t.computedExpense,
    t.computedDebt,
    t.computedProfit,
    sanitizeCsvField(paymentLabels[t.payment_method] || (t.type === 'EXPENSE' ? 'Chi tiền' : (t.type === 'DEBT_PAYMENT' ? 'Thu nợ' : '-'))),
    sanitizeCsvField(t.customer_name || ''),
    sanitizeCsvField(t.tracking_code || t.note || ''),
  ]);

  const summaryRow = [
    sanitizeCsvField(`TỔNG CỘNG (${periodLabel})`),
    sanitizeCsvField(`${totals.orderCount} đơn hàng`),
    totals.totalQuantity,
    totals.actualIncome,
    totals.costAndExpense,
    totals.debt,
    totals.profit,
    '""',
    '""',
    '""',
  ];

  const metaRows = [
    sanitizeCsvField('BÁO CÁO DOANH THU & KẾT QUẢ KINH DOANH'),
    sanitizeCsvField(`Cửa hàng: ${shopName}`),
    sanitizeCsvField(`Kỳ báo cáo: ${periodLabel}`),
    sanitizeCsvField(`Ngày xuất: ${formatDate(new Date().toISOString())}`),
    '""',
  ];

  const csvContent =
    '\uFEFF' +
    metaRows.join('\n') +
    '\n' +
    headers.map(sanitizeCsvField).join(',') +
    '\n' +
    rows.map((r) => r.join(',')).join('\n') +
    '\n' +
    summaryRow.join(',');

  return csvContent;
}

// ============================================
// Format helpers
// ============================================

export function formatFullMoney(amount) {
  if (amount === null || amount === undefined || amount === '') return '0đ';
  const num = Number(amount);
  if (isNaN(num)) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(num) + 'đ';
}

export function formatMoney(amount) {
  if (amount === null || amount === undefined || amount === '') return '0đ';
  const num = Number(amount);
  if (isNaN(num)) return '0đ';
  const absAmount = Math.abs(num);
  if (absAmount >= 1000000) {
    const millions = num / 1000000;
    // Giữ tối đa 2 chữ số thập phân nếu có số lẻ hàng chục nghìn (ví dụ 2.84tr thay vì bị làm tròn cụt thành 2.8tr)
    const formatted = Number(millions.toFixed(2)).toString();
    return formatted + 'tr';
  }
  return new Intl.NumberFormat('vi-VN').format(num) + 'đ';
}

export const VIETNAMESE_WEEKDAYS = [
  { index: 0, short: 'CN', label: 'Chủ Nhật', color: '#ff4d6d', bg: 'rgba(255, 77, 109, 0.22)', border: 'rgba(255, 77, 109, 0.45)', gradient: 'from-rose-500 to-pink-600' },
  { index: 1, short: 'T2', label: 'Thứ Hai', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.22)', border: 'rgba(56, 189, 248, 0.45)', gradient: 'from-sky-500 to-blue-600' },
  { index: 2, short: 'T3', label: 'Thứ Ba', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.22)', border: 'rgba(192, 132, 252, 0.45)', gradient: 'from-purple-500 to-indigo-600' },
  { index: 3, short: 'T4', label: 'Thứ Tư', color: '#34d399', bg: 'rgba(52, 211, 153, 0.22)', border: 'rgba(52, 211, 153, 0.45)', gradient: 'from-emerald-500 to-teal-600' },
  { index: 4, short: 'T5', label: 'Thứ Năm', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.22)', border: 'rgba(251, 191, 36, 0.45)', gradient: 'from-amber-500 to-orange-600' },
  { index: 5, short: 'T6', label: 'Thứ Sáu', color: '#f472b6', bg: 'rgba(244, 114, 182, 0.22)', border: 'rgba(244, 114, 182, 0.45)', gradient: 'from-pink-500 to-fuchsia-600' },
  { index: 6, short: 'T7', label: 'Thứ Bảy', color: '#818cf8', bg: 'rgba(129, 140, 248, 0.22)', border: 'rgba(129, 140, 248, 0.45)', gradient: 'from-indigo-500 to-violet-600' },
];

export function getWeekdayInfo(isoString) {
  if (!isoString) return VIETNAMESE_WEEKDAYS[0];
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return VIETNAMESE_WEEKDAYS[0];
  return VIETNAMESE_WEEKDAYS[d.getDay()] || VIETNAMESE_WEEKDAYS[0];
}

export function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const wd = getWeekdayInfo(isoString);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${wd.label}, ${day}/${month} • ${hours}:${mins}`;
}

export function formatFullDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const wd = getWeekdayInfo(isoString);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${wd.label}, ${day}/${month}/${year}`;
}

/**
 * Tổng hợp chi tiết theo từng Thứ / Ngày: Thứ mấy bán được những gì, chi tiêu những gì
 */
export function getWeekdayActivitySummary({ year, month, weekdayFilter = null } = {}) {
  const transactions = getTransactions();
  const filtered = transactions.filter((tx) => {
    const d = new Date(tx.created_at);
    if (isNaN(d.getTime())) return false;
    if (year !== undefined && year !== null && d.getFullYear() !== year) return false;
    if (month !== undefined && month !== null && d.getMonth() !== month) return false;
    if (weekdayFilter !== null && weekdayFilter !== undefined && weekdayFilter !== 'ALL') {
      if (d.getDay() !== Number(weekdayFilter)) return false;
    }
    return true;
  });

  // Gom nhóm theo ngày cụ thể (YYYY-MM-DD) kèm thông tin Thứ
  const dayMap = new Map();
  for (const tx of filtered) {
    const d = new Date(tx.created_at);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}-${mm}-${dd}`;
    const wd = VIETNAMESE_WEEKDAYS[d.getDay()];

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        dateKey,
        displayDate: `${dd}/${mm}/${yyyy}`,
        shortDate: `${dd}/${mm}`,
        weekdayIndex: wd.index,
        weekdayLabel: wd.label,
        weekdayShort: wd.short,
        color: wd.color,
        bg: wd.bg,
        border: wd.border,
        gradient: wd.gradient,
        totalSales: 0,
        totalExpenses: 0,
        salesList: [],
        expensesList: [],
        transactions: []
      });
    }

    const group = dayMap.get(dateKey);
    group.transactions.push(tx);
    const amount = Number(tx.sale_price) || 0;

    if (tx.type === 'SALE') {
      group.totalSales += amount;
      group.salesList.push({
        id: tx.id,
        item_name: tx.item_name || 'Đơn bán',
        quantity: tx.quantity || 1,
        amount,
        customer_name: tx.customer_name || '',
        payment_method: tx.payment_method || 'CASH_TRANSFER',
        type: tx.type
      });
    } else if (tx.type === 'DEBT_PAYMENT') {
      group.totalDebtCollected = (group.totalDebtCollected || 0) + amount;
      group.salesList.push({
        id: tx.id,
        item_name: tx.item_name || 'Thu nợ',
        quantity: 1,
        amount,
        customer_name: tx.customer_name || '',
        payment_method: 'DEBT_PAYMENT',
        type: tx.type
      });
    } else if (tx.type === 'EXPENSE') {
      group.totalExpenses += amount;
      group.expensesList.push({
        id: tx.id,
        item_name: tx.item_name || 'Chi tiêu',
        amount
      });
    }
  }

  // Sắp xếp theo ngày mới nhất lên đầu
  return Array.from(dayMap.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}
