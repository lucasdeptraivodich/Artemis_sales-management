-- ================================================================
-- HƯỚNG DẪN CẤU HÌNH DATABASE SUPABASE CHO SỔ BÁN HÀNG
-- 1. Đăng nhập vào https://supabase.com và bấm "New Project"
-- 2. Vào mục "SQL Editor" ở thanh menu bên trái
-- 3. Dán toàn bộ nội dung file này vào và bấm nút "Run" (hoặc Ctrl + Enter)
-- 4. Vào "Project Settings" -> "API" để lấy URL và Anon Public Key
-- ================================================================

-- 1. BẢNG HỒ SƠ CỬA HÀNG (PROFILES)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  shop_name text default 'Cửa hàng của tôi',
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. BẢNG MÓN HÀNG QUEN THUỘC (ITEMS)
create table if not exists public.items (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  default_price bigint default 0,
  default_cost bigint default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. BẢNG KHÁCH HÀNG & SỔ NỢ (CUSTOMERS)
create table if not exists public.customers (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  phone text default '',
  total_debt bigint default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. BẢNG GIAO DỊCH (TRANSACTIONS - Bán hàng, Chi tiền, Thu nợ)
create table if not exists public.transactions (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text not null, -- 'SALE' | 'EXPENSE' | 'DEBT_PAYMENT'
  item_name text not null,
  sale_price bigint default 0,
  cost_price bigint default 0,
  payment_method text default 'CASH_TRANSFER', -- 'CASH_TRANSFER' | 'DEBT' | 'COD'
  customer_name text default '',
  customer_phone text default '',
  shipping_address text default '',
  tracking_code text default '',
  shipping_fee bigint default 0,
  is_cod_received boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ================================================================
-- PHÂN QUYỀN BẢO MẬT (ROW LEVEL SECURITY - RLS)
-- Mỗi người dùng chỉ xem và quản lý dữ liệu của chính mình
-- ================================================================

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.customers enable row level security;
alter table public.transactions enable row level security;

-- Policies: profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Policies: items
drop policy if exists "items_all_own" on public.items;
create policy "items_all_own" on public.items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policies: customers
drop policy if exists "customers_all_own" on public.customers;
create policy "customers_all_own" on public.customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policies: transactions
drop policy if exists "transactions_all_own" on public.transactions;
create policy "transactions_all_own" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ================================================================
-- TRIGGER TỰ ĐỘNG TẠO PROFILE KHI ĐĂNG KÝ MỚI
-- ================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, shop_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'shop_name', 'Cửa hàng của tôi'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
