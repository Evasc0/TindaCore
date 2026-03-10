-- TindaCore Supabase schema

-- Products
create table if not exists products (
  id text primary key,
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
  updated_at bigint default floor(extract(epoch from now())*1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists products_updated_at_idx on products (updated_at);

-- Sales
create table if not exists sales (
  id text primary key,
  total numeric not null,
  payment_type text not null,
  timestamp bigint not null,
  customer_id text,
  is_utang boolean default false,
  amount_paid numeric default 0,
  change_due numeric default 0,
  updated_at bigint default floor(extract(epoch from now())*1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists sales_updated_at_idx on sales (updated_at);

-- Sale items
create table if not exists sale_items (
  id text primary key,
  sale_id text references sales(id) on delete cascade,
  product_id text,
  name text,
  quantity numeric not null,
  unit text,
  price numeric not null,
  cost numeric,
  subtotal numeric not null,
  updated_at bigint default floor(extract(epoch from now())*1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists sale_items_updated_at_idx on sale_items (updated_at);

-- Customers
create table if not exists customers (
  id text primary key,
  name text not null,
  phone text,
  updated_at bigint default floor(extract(epoch from now())*1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists customers_updated_at_idx on customers (updated_at);

-- Utang records
create table if not exists utang_records (
  id text primary key,
  customer_id text references customers(id) on delete cascade,
  amount numeric not null,
  balance numeric not null,
  date text not null,
  items_json jsonb,
  updated_at bigint default floor(extract(epoch from now())*1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists utang_records_updated_at_idx on utang_records (updated_at);

-- Utang payments
create table if not exists utang_payments (
  id text primary key,
  utang_id text references utang_records(id) on delete cascade,
  amount numeric not null,
  date text not null,
  updated_at bigint default floor(extract(epoch from now())*1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists utang_payments_updated_at_idx on utang_payments (updated_at);

-- Pabili orders
create table if not exists pabili_orders (
  id text primary key,
  items_json jsonb not null,
  customer_name text,
  customer_phone text,
  status text not null,
  timestamp bigint not null,
  note text,
  total numeric default 0,
  updated_at bigint default floor(extract(epoch from now())*1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists pabili_orders_updated_at_idx on pabili_orders (updated_at);

-- Expenses
create table if not exists expenses (
  id text primary key,
  name text not null,
  amount numeric not null,
  date text not null,
  category text,
  description text,
  updated_at bigint default floor(extract(epoch from now())*1000),
  is_dirty boolean default false,
  deleted boolean default false
);
create index if not exists expenses_updated_at_idx on expenses (updated_at);

-- Settings (single row, id=1)
create table if not exists settings (
  id integer primary key check (id = 1),
  store_name text,
  owner_name text,
  subscription_tier text,
  address text,
  gcash_number text,
  paymaya_number text,
  theme text,
  language text,
  management_pin text,
  onboarding_complete boolean default false,
  enable_utang boolean default true,
  enable_pabili boolean default true,
  enable_barcode_scanner boolean default true,
  enable_receipt_printer boolean default false,
  updated_at bigint default floor(extract(epoch from now())*1000),
  is_dirty boolean default false
);
create index if not exists settings_updated_at_idx on settings (updated_at);

-- Optional: loosen RLS for anon key (or add your own policies)
alter table products disable row level security;
alter table sales disable row level security;
alter table sale_items disable row level security;
alter table customers disable row level security;
alter table utang_records disable row level security;
alter table utang_payments disable row level security;
alter table pabili_orders disable row level security;
alter table expenses disable row level security;
alter table settings disable row level security;
