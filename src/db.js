// ============================================
// Artemis - IndexedDB Database Engine
// Cung cấp giải pháp lưu trữ bền vững (Persistent Storage)
// ============================================

const DB_NAME = 'Flowers_QLBH_DB';
const DB_VERSION = 1;

export const STORES = {
  TRANSACTIONS: 'transactions',
  CUSTOMERS: 'customers',
  ITEMS: 'items',
  META: 'meta',
};

let dbInstance = null;

/**
 * Khởi tạo và mở kết nối IndexedDB
 */
export function openDB() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB không được hỗ trợ trong môi trường này');
      return resolve(null);
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const txStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
        txStore.createIndex('type', 'type', { unique: false });
        txStore.createIndex('payment_method', 'payment_method', { unique: false });
        txStore.createIndex('created_at', 'created_at', { unique: false });
        txStore.createIndex('customer_name', 'customer_name', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        const custStore = db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
        custStore.createIndex('name', 'name', { unique: false });
        custStore.createIndex('phone', 'phone', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.ITEMS)) {
        const itemStore = db.createObjectStore(STORES.ITEMS, { keyPath: 'id' });
        itemStore.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Lỗi mở IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Lấy tất cả bản ghi từ 1 ObjectStore
 */
export async function getAllRecords(storeName) {
  try {
    const db = await openDB();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error(`Lỗi getAllRecords (${storeName}):`, err);
    return null;
  }
}


/**
 * Lấy 1 bản ghi theo ID
 */
export async function getRecord(storeName, id) {
  try {
    const db = await openDB();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error(`Lỗi getRecord (${storeName}, ${id}):`, err);
    return null;
  }
}

/**
 * Thêm hoặc Cập nhật 1 bản ghi
 */
export async function putRecord(storeName, item) {
  try {
    const db = await openDB();
    if (!db) return false;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error(`Lỗi putRecord (${storeName}):`, err);
    return false;
  }
}

/**
 * Thêm hoặc cập nhật hàng loạt bản ghi
 */
export async function putRecords(storeName, items) {
  if (!items || items.length === 0) return true;
  try {
    const db = await openDB();
    if (!db) return false;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      items.forEach((item) => {
        store.put(item);
      });

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error(`Lỗi putRecords (${storeName}):`, err);
    return false;
  }
}

/**
 * Xóa 1 bản ghi theo ID
 */
export async function deleteRecord(storeName, id) {
  try {
    const db = await openDB();
    if (!db) return false;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error(`Lỗi deleteRecord (${storeName}, ${id}):`, err);
    return false;
  }
}

/**
 * Xóa sạch toàn bộ bản ghi trong store
 */
export async function clearStore(storeName) {
  try {
    const db = await openDB();
    if (!db) return false;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error(`Lỗi clearStore (${storeName}):`, err);
    return false;
  }
}

/**
 * Tự động chuyển đổi dữ liệu từ localStorage sang IndexedDB nếu lần đầu khởi chạy
 */
export async function migrateFromLocalStorageIfNeeded() {
  try {
    const db = await openDB();
    if (!db) return false;

    const existingTx = await getAllRecords(STORES.TRANSACTIONS);
    const existingCust = await getAllRecords(STORES.CUSTOMERS);
    const existingItems = await getAllRecords(STORES.ITEMS);

    const hasIdbData =
      (existingTx && existingTx.length > 0) ||
      (existingCust && existingCust.length > 0) ||
      (existingItems && existingItems.length > 0);

    if (hasIdbData) {
      return true;
    }

    const localTxStr = localStorage.getItem('sbh_transactions');
    const localCustStr = localStorage.getItem('sbh_customers');
    const localItemsStr = localStorage.getItem('sbh_items');

    if (localTxStr) {
      const localTxs = JSON.parse(localTxStr);
      if (Array.isArray(localTxs) && localTxs.length > 0) {
        await putRecords(STORES.TRANSACTIONS, localTxs);
      }
    }

    if (localCustStr) {
      const localCusts = JSON.parse(localCustStr);
      if (Array.isArray(localCusts) && localCusts.length > 0) {
        await putRecords(STORES.CUSTOMERS, localCusts);
      }
    }

    if (localItemsStr) {
      const localItems = JSON.parse(localItemsStr);
      if (Array.isArray(localItems) && localItems.length > 0) {
        await putRecords(STORES.ITEMS, localItems);
      }
    }

    return true;
  } catch (err) {
    console.error('Lỗi khi migrate dữ liệu sang IndexedDB:', err);
    return false;
  }
}
