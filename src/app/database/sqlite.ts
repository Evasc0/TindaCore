import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

const DB_STORAGE_KEY = "tindacore.sqlite";
const PERSIST_DEBOUNCE_MS = 200;

let dbPromise: Promise<Database> | null = null;
let persistTimer: number | undefined;

type QueryExecResult = { columns: string[]; values: any[][] };

const schemaStatements = [
  "PRAGMA foreign_keys = ON;",
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    owner_name TEXT,
    email TEXT,
    mobile TEXT,
    password_hash TEXT NOT NULL,
    supabase_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_mobile ON accounts(mobile);`,
  `CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    store_name TEXT NOT NULL,
    subscription_tier TEXT DEFAULT 'free',
    created_at TEXT NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_stores_account ON stores(account_id);`,
  `CREATE TABLE IF NOT EXISTS store_settings (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL UNIQUE,
    management_pin_hash TEXT,
    language TEXT DEFAULT 'fil',
    theme TEXT DEFAULT 'light',
    utang_enabled INTEGER DEFAULT 1,
    pabili_enabled INTEGER DEFAULT 1,
    gcash_number TEXT,
    maya_number TEXT,
    address TEXT,
    onboarding_complete INTEGER DEFAULT 0,
    enable_barcode_scanner INTEGER DEFAULT 1,
    enable_receipt_printer INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_store_settings_store ON store_settings(store_id);`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    login_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active, login_at);`,
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    name TEXT NOT NULL,
    barcode TEXT,
    price REAL NOT NULL,
    cost REAL DEFAULT 0,
    stock REAL DEFAULT 0,
    unit TEXT,
    base_unit TEXT,
    conversion REAL DEFAULT 1,
    category TEXT,
    is_quick_item INTEGER DEFAULT 0,
    emoji TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_products_scope ON products(account_id, store_id);`,
  `CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    total REAL NOT NULL,
    payment_type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    customer_id INTEGER,
    is_utang INTEGER DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    change_due REAL DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_sales_scope ON sales(account_id, store_id);`,
  `CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    sale_id INTEGER NOT NULL,
    product_id INTEGER,
    name TEXT,
    quantity REAL NOT NULL,
    unit TEXT,
    price REAL NOT NULL,
    cost REAL,
    subtotal REAL NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_sale_items_scope ON sale_items(account_id, store_id);`,
  `CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_customers_scope ON customers(account_id, store_id);`,
  `CREATE TABLE IF NOT EXISTS utang_records (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    balance REAL NOT NULL,
    date TEXT NOT NULL,
    items_json TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_utang_records_scope ON utang_records(account_id, store_id);`,
  `CREATE TABLE IF NOT EXISTS utang_payments (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    utang_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 0,
    FOREIGN KEY (utang_id) REFERENCES utang_records(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS idx_utang_payments_scope ON utang_payments(account_id, store_id);`,
  `CREATE TABLE IF NOT EXISTS pabili_orders (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    items_json TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    status TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    note TEXT,
    total REAL DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_pabili_orders_scope ON pabili_orders(account_id, store_id);`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    category TEXT,
    description TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_scope ON expenses(account_id, store_id);`,
  `CREATE TABLE IF NOT EXISTS sync_state (
    table_name TEXT PRIMARY KEY,
    last_synced_at INTEGER DEFAULT 0
  );`,
];

type ColumnMigration = { table: string; column: string; definition: string };

const columnMigrations: ColumnMigration[] = [
  { table: "products", column: "account_id", definition: "TEXT" },
  { table: "products", column: "store_id", definition: "TEXT" },
  { table: "sales", column: "account_id", definition: "TEXT" },
  { table: "sales", column: "store_id", definition: "TEXT" },
  { table: "sale_items", column: "account_id", definition: "TEXT" },
  { table: "sale_items", column: "store_id", definition: "TEXT" },
  { table: "customers", column: "account_id", definition: "TEXT" },
  { table: "customers", column: "store_id", definition: "TEXT" },
  { table: "utang_records", column: "account_id", definition: "TEXT" },
  { table: "utang_records", column: "store_id", definition: "TEXT" },
  { table: "utang_payments", column: "account_id", definition: "TEXT" },
  { table: "utang_payments", column: "store_id", definition: "TEXT" },
  { table: "pabili_orders", column: "account_id", definition: "TEXT" },
  { table: "pabili_orders", column: "store_id", definition: "TEXT" },
  { table: "expenses", column: "account_id", definition: "TEXT" },
  { table: "expenses", column: "store_id", definition: "TEXT" },
];

const toBase64 = (buffer: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < buffer.length; i += 1) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
};

const fromBase64 = (str: string) => {
  const binary = atob(str);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

function mapResult(result: QueryExecResult[]): any[] {
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, any> = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

function createTables(db: Database) {
  const indexStatements = schemaStatements.filter(sql => sql.trim().toUpperCase().startsWith("CREATE INDEX"));
  const baseStatements = schemaStatements.filter(sql => !sql.trim().toUpperCase().startsWith("CREATE INDEX"));

  baseStatements.forEach(sql => db.exec(sql));
  columnMigrations.forEach(migration => {
    const info = db.exec(`PRAGMA table_info(${migration.table});`);
    const columns = info[0]?.values?.map(row => String(row[1])) || [];
    if (!columns.includes(migration.column)) {
      db.exec(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.definition};`);
    }
  });
  indexStatements.forEach(sql => db.exec(sql));
}

async function schedulePersist(db: Database) {
  if (typeof window === "undefined") return;
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    const data = db.export();
    localStorage.setItem(DB_STORAGE_KEY, toBase64(data));
  }, PERSIST_DEBOUNCE_MS);
}

export async function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await initSqlJs({ locateFile: () => wasmUrl });
      const stored = typeof window !== "undefined" ? localStorage.getItem(DB_STORAGE_KEY) : null;
      const db = stored ? new SQL.Database(fromBase64(stored)) : new SQL.Database();
      createTables(db);
      return db;
    })();
  }
  return dbPromise;
}

export async function initializeDatabase() {
  await getDatabase();
}

export async function run(sql: string, params?: Record<string, any> | any[]) {
  const db = await getDatabase();
  try {
    db.run(sql, params as any);
    await schedulePersist(db);
  } catch (err) {
    console.error("SQLite run failed", err);
    throw err;
  }
}

export async function queryAll<T = any>(sql: string, params?: Record<string, any> | any[]): Promise<T[]> {
  const db = await getDatabase();
  try {
    const result = db.exec(sql, params as any);
    return mapResult(result) as T[];
  } catch (err) {
    console.error("SQLite queryAll failed", err);
    return [];
  }
}

export async function queryOne<T = any>(sql: string, params?: Record<string, any> | any[]): Promise<T | undefined> {
  const rows = await queryAll<T>(sql, params);
  return rows[0];
}

export async function runTransaction<T>(callback: (db: Database) => T | Promise<T>): Promise<T> {
  const db = await getDatabase();
  db.exec("BEGIN");
  try {
    const result = await callback(db);
    db.exec("COMMIT");
    await schedulePersist(db);
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    console.error("SQLite transaction failed", err);
    throw err;
  }
}

export function execRows(db: Database, sql: string, params?: Record<string, any>): any[] {
  return mapResult(db.exec(sql, params as any));
}

export async function setSyncMarker(table: string, timestamp: number) {
  await run(
    `INSERT INTO sync_state (table_name, last_synced_at)
     VALUES (:table, :ts)
     ON CONFLICT(table_name) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
    { ":table": table, ":ts": timestamp }
  );
}

export async function getSyncMarker(table: string) {
  const row = await queryOne<{ last_synced_at: number }>(
    "SELECT last_synced_at FROM sync_state WHERE table_name = :table",
    { ":table": table }
  );
  return row?.last_synced_at ?? 0;
}
