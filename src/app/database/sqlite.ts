import initSqlJs, { Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

const DB_STORAGE_KEY = "tindacore.sqlite";

let dbPromise: Promise<Database> | null = null;
let persistTimer: number | undefined;

const createStatements: string[] = [
  `PRAGMA foreign_keys = ON;`,
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
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
    is_dirty INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    total REAL NOT NULL,
    payment_type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    customer_id TEXT,
    is_utang INTEGER DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    change_due REAL DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    product_id TEXT,
    name TEXT,
    quantity REAL NOT NULL,
    unit TEXT,
    price REAL NOT NULL,
    cost REAL,
    subtotal REAL NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS utang_records (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    amount REAL NOT NULL,
    balance REAL NOT NULL,
    date TEXT NOT NULL,
    items_json TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS utang_payments (
    id TEXT PRIMARY KEY,
    utang_id TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0,
    FOREIGN KEY (utang_id) REFERENCES utang_records(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS pabili_orders (
    id TEXT PRIMARY KEY,
    items_json TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    status TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    note TEXT,
    total REAL DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    category TEXT,
    description TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 1,
    deleted INTEGER DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    store_name TEXT,
    owner_name TEXT,
    subscription_tier TEXT,
    address TEXT,
    gcash_number TEXT,
    paymaya_number TEXT,
    theme TEXT,
    language TEXT,
    management_pin TEXT,
    onboarding_complete INTEGER DEFAULT 0,
    enable_utang INTEGER DEFAULT 1,
    enable_pabili INTEGER DEFAULT 1,
    enable_barcode_scanner INTEGER DEFAULT 1,
    enable_receipt_printer INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    is_dirty INTEGER DEFAULT 1
  );`,
  `CREATE TABLE IF NOT EXISTS sync_state (
    table_name TEXT PRIMARY KEY,
    last_synced_at INTEGER DEFAULT 0
  );`,
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

async function persist(db: Database) {
  if (typeof window === "undefined") return;
  if (persistTimer) {
    window.clearTimeout(persistTimer);
  }
  persistTimer = window.setTimeout(() => {
    const data = db.export();
    localStorage.setItem(DB_STORAGE_KEY, toBase64(data));
  }, 200);
}

function initSchema(db: Database) {
  db.exec("BEGIN;");
  createStatements.forEach(sql => db.exec(sql));
  db.exec("COMMIT;");
}

export async function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await initSqlJs({ locateFile: () => wasmUrl });
      const stored = typeof window !== "undefined" ? localStorage.getItem(DB_STORAGE_KEY) : null;
      const db = stored ? new SQL.Database(fromBase64(stored)) : new SQL.Database();
      initSchema(db);
      return db;
    })();
  }
  return dbPromise;
}

export async function run(sql: string, params?: Record<string, any> | any[]) {
  const db = await getDatabase();
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params as any);
  stmt.step();
  stmt.free();
  await persist(db);
}

export async function all<T = any>(sql: string, params?: Record<string, any> | any[]): Promise<T[]> {
  const db = await getDatabase();
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params as any);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export async function get<T = any>(sql: string, params?: Record<string, any> | any[]): Promise<T | undefined> {
  const rows = await all<T>(sql, params);
  return rows[0];
}

export async function transaction(callback: (db: Database) => void | Promise<void>) {
  const db = await getDatabase();
  db.exec("BEGIN;");
  try {
    await callback(db);
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  } finally {
    await persist(db);
  }
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
  const row = await get<{ last_synced_at: number }>(
    "SELECT last_synced_at FROM sync_state WHERE table_name = :table",
    { ":table": table }
  );
  return row?.last_synced_at ?? 0;
}
