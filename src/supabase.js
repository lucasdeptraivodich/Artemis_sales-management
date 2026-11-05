import { createClient } from '@supabase/supabase-js';

// Các key lưu config dự phòng trong localStorage nếu người dùng nhập trực tiếp trên giao diện
const STORAGE_KEYS = {
  URL: 'sbh_supabase_url',
  ANON_KEY: 'sbh_supabase_anon_key',
};

// Lấy config từ biến môi trường .env hoặc từ localStorage
export function getSupabaseConfig() {
  const envUrl = import.meta?.env?.VITE_SUPABASE_URL;
  const envKey = import.meta?.env?.VITE_SUPABASE_ANON_KEY;
  const localUrl = localStorage.getItem(STORAGE_KEYS.URL);
  const localKey = localStorage.getItem(STORAGE_KEYS.ANON_KEY);

  const url = (envUrl && envUrl !== 'YOUR_SUPABASE_URL' ? envUrl : '') || localUrl || '';
  const anonKey = (envKey && envKey !== 'YOUR_SUPABASE_ANON_KEY' ? envKey : '') || localKey || '';

  return { url: url.trim(), anonKey: anonKey.trim() };
}

export function saveSupabaseConfig(url, anonKey) {
  if (url) localStorage.setItem(STORAGE_KEYS.URL, url.trim());
  else localStorage.removeItem(STORAGE_KEYS.URL);

  if (anonKey) localStorage.setItem(STORAGE_KEYS.ANON_KEY, anonKey.trim());
  else localStorage.removeItem(STORAGE_KEYS.ANON_KEY);

  // Reset client instance
  supabaseInstance = null;
}

let supabaseInstance = null;

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    return null;
  }

  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return supabaseInstance;
  } catch (err) {
    console.error('Lỗi khởi tạo Supabase:', err);
    return null;
  }
}

export function isSupabaseReady() {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith('http'));
}

// ============================================
// Auth Helpers
// ============================================

export async function signUpWithEmail(email, password, shopName = '') {
  const client = getSupabase();
  if (!client) {
    throw new Error('Chưa cấu hình Supabase URL và Anon Key. Vui lòng cấu hình trước!');
  }

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        shop_name: shopName || 'Cửa hàng của tôi',
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmail(email, password) {
  const client = getSupabase();
  if (!client) {
    throw new Error('Chưa cấu hình Supabase URL và Anon Key. Vui lòng cấu hình trước!');
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOutUser() {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data: { user } } = await client.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export function onAuthStateChange(callback) {
  const client = getSupabase();
  if (!client) return { unsubscribe: () => {} };

  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return subscription;
}
