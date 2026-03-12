-- TindaCore Supabase schema (account-isolated)

-- Accounts
create table if not exists accounts (
  id text primary key,
  owner_name text,
  email text,
  mobile text,
  password_hash text not null,
  supabase_user_id text,
  created_at text not null,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists accounts_updated_at_idx on accounts (updated_at);
create index if not exists accounts_email_idx on accounts (email);
create index if not exists accounts_mobile_idx on accounts (mobile);

-- Stores (one account -> one store by product rule)
create table if not exists stores (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  store_name text not null,
  subscription_tier text default 'free',
  created_at text not null,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists stores_account_idx on stores (account_id);
create index if not exists stores_updated_at_idx on stores (updated_at);

-- Per-store settings
create table if not exists store_settings (
  id text primary key,
  store_id text not null unique references stores(id) on delete cascade,
  management_pin_hash text,
  language text default 'fil',
  theme text default 'light',
  utang_enabled boolean default true,
  pabili_enabled boolean default true,
  gcash_number text,
  maya_number text,
  address text,
  onboarding_complete boolean default false,
  enable_barcode_scanner boolean default true,
  enable_receipt_printer boolean default false,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists store_settings_updated_at_idx on store_settings (updated_at);
create index if not exists store_settings_store_idx on store_settings (store_id);

-- Sessions (local/offline tracking; optional to sync)
create table if not exists sessions (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  is_active boolean default true,
  login_at text not null
);
create index if not exists sessions_active_idx on sessions (is_active, login_at);

-- Products
create table if not exists products (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  name text not null,
  barcode text,
  price numeric not null,
  cost numeric default 0,
  stock numeric default 0,
  unit text,
  base_unit text,
  conversion numeric default 1,
  category text,
  is_quick_item boolean default false,
  emoji text,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists products_scope_idx on products (account_id, store_id);
create index if not exists products_updated_at_idx on products (updated_at);

-- Product barcodes (multiple optional barcodes per product)
create table if not exists product_barcodes (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  product_id text not null references products(id) on delete cascade,
  barcode text not null,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists product_barcodes_scope_idx on product_barcodes (account_id, store_id);
create index if not exists product_barcodes_product_idx on product_barcodes (product_id);
create index if not exists product_barcodes_barcode_idx on product_barcodes (barcode);

-- Sales
create table if not exists sales (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  total numeric not null,
  payment_type text not null,
  timestamp bigint not null,
  customer_id text,
  is_utang boolean default false,
  amount_paid numeric default 0,
  change_due numeric default 0,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists sales_scope_idx on sales (account_id, store_id);
create index if not exists sales_updated_at_idx on sales (updated_at);

-- Sale items
create table if not exists sale_items (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  sale_id text references sales(id) on delete cascade,
  product_id text,
  name text,
  quantity numeric not null,
  unit text,
  price numeric not null,
  cost numeric,
  subtotal numeric not null,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists sale_items_scope_idx on sale_items (account_id, store_id);
create index if not exists sale_items_updated_at_idx on sale_items (updated_at);

-- Customers
create table if not exists customers (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  name text not null,
  phone text,
  note text,
  credit_limit numeric,
  advance_balance numeric default 0,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists customers_scope_idx on customers (account_id, store_id);
create index if not exists customers_updated_at_idx on customers (updated_at);

-- Utang records
create table if not exists utang_records (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  customer_id text references customers(id) on delete cascade,
  amount numeric not null,
  balance numeric not null,
  date text not null,
  items_json jsonb,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists utang_records_scope_idx on utang_records (account_id, store_id);
create index if not exists utang_records_updated_at_idx on utang_records (updated_at);

-- Utang payments
create table if not exists utang_payments (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  utang_id text references utang_records(id) on delete cascade,
  amount numeric not null,
  date text not null,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists utang_payments_scope_idx on utang_payments (account_id, store_id);
create index if not exists utang_payments_updated_at_idx on utang_payments (updated_at);

-- Customer payment history
create table if not exists customer_payment_history (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade,
  amount numeric not null,
  applied_amount numeric default 0,
  advance_amount numeric default 0,
  date text not null,
  entry_type text not null default 'payment',
  reference_sale_id text,
  note text,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
alter table customer_payment_history add column if not exists entry_type text not null default 'payment';
alter table customer_payment_history add column if not exists reference_sale_id text;
alter table customer_payment_history add column if not exists note text;
create index if not exists customer_payment_history_scope_idx on customer_payment_history (account_id, store_id);
create index if not exists customer_payment_history_customer_idx on customer_payment_history (customer_id);
create index if not exists customer_payment_history_updated_at_idx on customer_payment_history (updated_at);

-- Pabili orders
create table if not exists pabili_orders (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  items_json jsonb not null,
  customer_name text,
  customer_phone text,
  status text not null,
  timestamp bigint not null,
  note text,
  total numeric default 0,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists pabili_orders_scope_idx on pabili_orders (account_id, store_id);
create index if not exists pabili_orders_updated_at_idx on pabili_orders (updated_at);

-- Expenses
create table if not exists expenses (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  name text not null,
  amount numeric not null,
  date text not null,
  category text,
  description text,
  updated_at bigint default floor(extract(epoch from now()) * 1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists expenses_scope_idx on expenses (account_id, store_id);
create index if not exists expenses_updated_at_idx on expenses (updated_at);

-- Optional: disable RLS for local/offline style anon usage.
alter table accounts disable row level security;
alter table stores disable row level security;
alter table store_settings disable row level security;
alter table sessions disable row level security;
alter table products disable row level security;
alter table product_barcodes disable row level security;
alter table sales disable row level security;
alter table sale_items disable row level security;
alter table customers disable row level security;
alter table utang_records disable row level security;
alter table utang_payments disable row level security;
alter table customer_payment_history disable row level security;
alter table pabili_orders disable row level security;
alter table expenses disable row level security;
