import type {
  Product,
  Sale,
  Customer,
  UtangRecord,
  PabiliOrder,
  Expense,
  StoreSettings,
  Unit,
} from "../context/StoreContext";
import {
  initializeDatabase as initDb,
  run,
  queryAll,
  queryOne,
  runTransaction,
  execRows,
} from "../database/sqlite";

export type Table =
  | "products"
  | "sales"
  | "sale_items"
  | "customers"
  | "utang_records"
  | "utang_payments"
  | "pabili_orders"
  | "expenses"
  | "settings";

const now = () => Date.now();
const generateId = () => Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`);
type DbId = string | number;
type ResolvedId = { id: DbId; exists: boolean };

const stableHash = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return 1_000_000 + (hash % 9_000_000_000); // keep within safe integer range
};
const toNumericId = (value?: string | number) => {
  if (value === undefined || value === null) return generateId();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  return stableHash(String(value));
};

function resolveExistingIdInTx(
  db: { exec: (sql: string, params?: Record<string, any>) => any[] },
  table: "products" | "customers" | "utang_records",
  incoming: DbId
): ResolvedId {
  const numeric = toNumericId(incoming);
  const numericRows = execRows(db as any, `SELECT id FROM ${table} WHERE id = :id`, { ":id": numeric });
  if (numericRows.length) return { id: numericRows[0].id, exists: true };

  if (typeof incoming === "string") {
    const rawRows = execRows(db as any, `SELECT id FROM ${table} WHERE id = :id`, { ":id": incoming });
    if (rawRows.length) return { id: rawRows[0].id, exists: true };
  }

  return { id: numeric, exists: false };
}

async function resolveExistingId(
  table: "products" | "customers" | "utang_records",
  incoming: DbId
): Promise<ResolvedId> {
  const numeric = toNumericId(incoming);
  const byNumeric = await queryOne<{ id: DbId }>(`SELECT id FROM ${table} WHERE id = :id`, { ":id": numeric });
  if (byNumeric) return { id: byNumeric.id, exists: true };

  if (typeof incoming === "string") {
    const byRaw = await queryOne<{ id: DbId }>(`SELECT id FROM ${table} WHERE id = :id`, { ":id": incoming });
    if (byRaw) return { id: byRaw.id, exists: true };
  }

  return { id: numeric, exists: false };
}

const unitFactor = (unit?: Unit, conversion?: number) => {
  if (unit === "pack" || unit === "box") return conversion || 1;
  if (unit === "kg" || unit === "liters") return 1000;
  return 1;
};

const mapProduct = (row: any): Product => ({
  id: String(row.id),
  name: row.name,
  barcode: row.barcode || "",
  price: Number(row.price),
  cost: Number(row.cost ?? 0),
  stock: Number(row.stock ?? 0),
  unit: (row.unit || "piece") as Unit,
  baseUnit: (row.base_unit || "piece") as Product["baseUnit"],
  conversion: Number(row.conversion ?? 1),
  category: row.category || "General",
  isQuickItem: !!row.is_quick_item,
  emoji: row.emoji || "🛒",
});

async function getDb() {
  await initDb();
}

export const initializeDatabase = initDb;

// ─── Products ──────────────────────────────────────────────────────────────
export async function getProducts(): Promise<Product[]> {
  await getDb();
  const rows = await queryAll("SELECT * FROM products ORDER BY name ASC");
  return rows.map(mapProduct);
}

export async function createProduct(input: Omit<Product, "id"> & { id?: string }): Promise<Product> {
  await getDb();
  const id = toNumericId(input.id);
  const ts = now();
  const payload = {
    ":id": id,
    ":name": input.name,
    ":barcode": input.barcode || "",
    ":price": input.price,
    ":cost": input.cost ?? 0,
    ":stock": input.stock ?? 0,
    ":unit": input.unit || "piece",
    ":base_unit": input.baseUnit || "piece",
    ":conversion": input.conversion ?? 1,
    ":category": input.category || "General",
    ":is_quick_item": input.isQuickItem ? 1 : 0,
    ":emoji": input.emoji || "🛒",
    ":ts": ts,
  };
  await run(
    `INSERT INTO products (id, name, barcode, price, cost, stock, unit, base_unit, conversion, category, is_quick_item, emoji, updated_at, is_dirty)
     VALUES (:id, :name, :barcode, :price, :cost, :stock, :unit, :base_unit, :conversion, :category, :is_quick_item, :emoji, :ts, 1)`,
    payload
  );
  return { ...input, id: String(id) };
}

export async function updateProduct(input: Partial<Product> & { id: string }) {
  await getDb();
  const fields: string[] = [];
  const params: Record<string, any> = { ":id": toNumericId(input.id), ":ts": now() };
  const map: Record<string, string> = {
    name: "name",
    barcode: "barcode",
    price: "price",
    cost: "cost",
    stock: "stock",
    unit: "unit",
    baseUnit: "base_unit",
    conversion: "conversion",
    category: "category",
    isQuickItem: "is_quick_item",
    emoji: "emoji",
  };
  Object.entries(input).forEach(([key, value]) => {
    const column = map[key];
    if (!column || value === undefined) return;
    fields.push(`${column} = :${column}`);
    params[`:${column}`] = key === "isQuickItem" ? (value ? 1 : 0) : value;
  });
  if (!fields.length) return;
  await run(`UPDATE products SET ${fields.join(", ")}, updated_at = :ts, is_dirty = 1 WHERE id = :id`, params);
}

export async function deleteProduct(id: string) {
  await getDb();
  await run("DELETE FROM products WHERE id = :id", { ":id": toNumericId(id) });
}

// ─── Sales ─────────────────────────────────────────────────────────────────
export async function getSales(): Promise<Sale[]> {
  await getDb();
  const sales = await queryAll<any>("SELECT * FROM sales ORDER BY timestamp DESC");
  const items = await queryAll<any>("SELECT * FROM sale_items");
  const itemsBySale = items.reduce<Record<string, any[]>>((acc, item) => {
    const key = String(item.sale_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return sales.map(row => ({
    id: String(row.id),
    timestamp: new Date(Number(row.timestamp)).toISOString(),
    date: new Date(Number(row.timestamp)).toISOString().split("T")[0],
    items: (itemsBySale[String(row.id)] || []).map(it => ({
      productId: it.product_id !== null ? String(it.product_id) : undefined,
      name: it.name,
      qty: Number(it.quantity),
      unit: (it.unit || "piece") as Unit,
      price: Number(it.price),
      cost: it.cost !== null ? Number(it.cost) : undefined,
      subtotal: Number(it.subtotal),
    })),
    total: Number(row.total),
    paymentType: row.payment_type,
    isUtang: !!row.is_utang,
    customerId: row.customer_id !== null ? String(row.customer_id) : undefined,
  }));
}

export async function createSale(input: {
  id?: string;
  items: {
    productId?: string;
    name: string;
    qty: number;
    unit?: Unit;
    price: number;
    cost?: number;
    subtotal: number;
  }[];
  total: number;
  paymentType: Sale["paymentType"];
  isUtang?: boolean;
  customerId?: string;
  amountPaid?: number;
  changeDue?: number;
  timestamp?: number;
}) {
  await getDb();
  const saleId = toNumericId(input.id);
  const ts = input.timestamp ?? now();

  await runTransaction(async db => {
    const customerRef = input.customerId
      ? resolveExistingIdInTx(db as any, "customers", input.customerId)
      : null;

    db.run(
      `INSERT INTO sales (id, total, payment_type, timestamp, customer_id, is_utang, amount_paid, change_due, updated_at, is_dirty)
       VALUES (:id, :total, :payment_type, :timestamp, :customer_id, :is_utang, :amount_paid, :change_due, :ts, 1)`,
      {
        ":id": saleId,
        ":total": input.total,
        ":payment_type": input.paymentType,
        ":timestamp": ts,
        ":customer_id": customerRef?.exists ? customerRef.id : null,
        ":is_utang": input.isUtang ? 1 : 0,
        ":amount_paid": input.amountPaid ?? input.total,
        ":change_due": input.changeDue ?? 0,
        ":ts": ts,
      }
    );

    for (const item of input.items) {
      const itemId = generateId();
      const productRef = item.productId
        ? resolveExistingIdInTx(db as any, "products", item.productId)
        : null;

      db.run(
        `INSERT INTO sale_items (id, sale_id, product_id, name, quantity, unit, price, cost, subtotal, updated_at, is_dirty)
         VALUES (:id, :sale_id, :product_id, :name, :quantity, :unit, :price, :cost, :subtotal, :ts, 1)`,
        {
          ":id": itemId,
          ":sale_id": saleId,
          ":product_id": productRef?.exists ? productRef.id : null,
          ":name": item.name,
          ":quantity": item.qty,
          ":unit": item.unit || "piece",
          ":price": item.price,
          ":cost": item.cost ?? null,
          ":subtotal": item.subtotal,
          ":ts": ts,
        }
      );

      if (productRef?.exists) {
        const rows = execRows(db, "SELECT conversion, unit FROM products WHERE id = :pid", {
          ":pid": productRef.id,
        });
        const product = rows[0] || { conversion: 1, unit: "piece" };
        const factor = unitFactor(item.unit, product.conversion);
        db.run(
          `UPDATE products SET stock = stock - :qty, updated_at = :ts, is_dirty = 1 WHERE id = :pid`,
          {
            ":qty": item.qty * factor,
            ":ts": ts,
            ":pid": productRef.id,
          }
        );
      }
    }
  });

  return String(saleId);
}

// ─── Customers / Utang ─────────────────────────────────────────────────────
export async function getCustomers(): Promise<Customer[]> {
  await getDb();
  const customers = await queryAll<any>("SELECT * FROM customers ORDER BY name ASC");
  const utang = await queryAll<any>("SELECT * FROM utang_records");
  const payments = await queryAll<any>("SELECT * FROM utang_payments");

  const paymentsByUtang = payments.reduce<Record<string, any[]>>((acc, p) => {
    const key = String(p.utang_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const utangByCustomer = utang.reduce<Record<string, UtangRecord[]>>((acc, r) => {
    const rec: UtangRecord = {
      id: String(r.id),
      date: r.date,
      items: r.items_json ? JSON.parse(r.items_json) : [],
      amount: Number(r.amount),
      balance: Number(r.balance),
      payments: (paymentsByUtang[String(r.id)] || []).map(p => ({
        id: String(p.id),
        amount: Number(p.amount),
        date: p.date,
      })),
    };
    const custId = String(r.customer_id);
    if (!acc[custId]) acc[custId] = [];
    acc[custId].push(rec);
    return acc;
  }, {});

  return customers.map(c => ({
    id: String(c.id),
    name: c.name,
    phone: c.phone || "",
    transactions: utangByCustomer[String(c.id)] || [],
  }));
}

export async function createCustomer(name: string, phone?: string, id?: string) {
  await getDb();
  const customerId = toNumericId(id);
  await run(
    `INSERT INTO customers (id, name, phone, updated_at, is_dirty) VALUES (:id, :name, :phone, :ts, 1)`,
    { ":id": customerId, ":name": name, ":phone": phone || "", ":ts": now() }
  );
  return String(customerId);
}

export async function addUtangRecord(data: {
  id?: string;
  customerId: string;
  items: UtangRecord["items"];
  amount: number;
  balance: number;
  date: string;
}) {
  await getDb();
  const id = toNumericId(data.id);
  const customerRef = await resolveExistingId("customers", data.customerId);
  if (!customerRef.exists) {
    throw new Error(`Cannot create utang record: customer not found (${data.customerId})`);
  }

  await run(
    `INSERT INTO utang_records (id, customer_id, amount, balance, date, items_json, updated_at, is_dirty)
     VALUES (:id, :customer_id, :amount, :balance, :date, :items_json, :ts, 1)`,
    {
      ":id": id,
      ":customer_id": customerRef.id,
      ":amount": data.amount,
      ":balance": data.balance,
      ":date": data.date,
      ":items_json": JSON.stringify(data.items || []),
      ":ts": now(),
    }
  );
  return String(id);
}

export async function recordPayment(utangId: string, amount: number, date: string) {
  await getDb();
  const paymentId = generateId();
  const ts = now();
  const utangRef = await resolveExistingId("utang_records", utangId);
  if (!utangRef.exists) {
    throw new Error(`Cannot record payment: utang record not found (${utangId})`);
  }

  await runTransaction(db => {
    db.run(
      `INSERT INTO utang_payments (id, utang_id, amount, date, updated_at, is_dirty)
       VALUES (:id, :utang_id, :amount, :date, :ts, 1)`,
      { ":id": paymentId, ":utang_id": utangRef.id, ":amount": amount, ":date": date, ":ts": ts }
    );
    db.run(
      `UPDATE utang_records SET balance = balance - :amount, updated_at = :ts, is_dirty = 1 WHERE id = :utang_id`,
      { ":amount": amount, ":ts": ts, ":utang_id": utangRef.id }
    );
  });
  return String(paymentId);
}

// ─── Pabili Orders ─────────────────────────────────────────────────────────
export async function getPabiliOrders(): Promise<PabiliOrder[]> {
  await getDb();
  const rows = await queryAll<any>("SELECT * FROM pabili_orders ORDER BY timestamp DESC");
  return rows.map(row => ({
    id: String(row.id),
    customerName: row.customer_name || "Customer",
    customerPhone: row.customer_phone || "",
    items: row.items_json ? JSON.parse(row.items_json) : [],
    status: row.status,
    timestamp: new Date(Number(row.timestamp)).toISOString(),
    date: new Date(Number(row.timestamp)).toISOString(),
    note: row.note || "",
    total: Number(row.total || 0),
  }));
}

export async function createPabiliOrder(order: Omit<PabiliOrder, "id" | "date"> & { id?: string }) {
  await getDb();
  const id = toNumericId(order.id);
  const ts = order.timestamp ? new Date(order.timestamp).getTime() : now();
  await run(
    `INSERT INTO pabili_orders (id, items_json, customer_name, customer_phone, status, timestamp, note, total, updated_at, is_dirty)
     VALUES (:id, :items_json, :customer_name, :customer_phone, :status, :timestamp, :note, :total, :ts, 1)`,
    {
      ":id": id,
      ":items_json": JSON.stringify(order.items || []),
      ":customer_name": order.customerName || "Customer",
      ":customer_phone": order.customerPhone || "",
      ":status": order.status,
      ":timestamp": ts,
      ":note": order.note || "",
      ":total": order.total || 0,
      ":ts": ts,
    }
  );
  return String(id);
}

export async function updatePabiliStatus(id: string, status: PabiliOrder["status"]) {
  await getDb();
  await run(
    `UPDATE pabili_orders SET status = :status, updated_at = :ts, is_dirty = 1 WHERE id = :id`,
    { ":status": status, ":ts": now(), ":id": toNumericId(id) }
  );
}

// ─── Expenses ──────────────────────────────────────────────────────────────
export async function getExpenses(): Promise<Expense[]> {
  await getDb();
  const rows = await queryAll<any>("SELECT * FROM expenses ORDER BY date DESC");
  return rows.map(row => ({
    id: String(row.id),
    date: row.date,
    name: row.name,
    description: row.description || "",
    amount: Number(row.amount),
    category: (row.category || "other") as Expense["category"],
  }));
}

export async function addExpense(expense: Omit<Expense, "id"> & { id?: string }) {
  await getDb();
  const id = toNumericId(expense.id);
  await run(
    `INSERT INTO expenses (id, name, amount, date, category, description, updated_at, is_dirty)
     VALUES (:id, :name, :amount, :date, :category, :description, :ts, 1)`,
    {
      ":id": id,
      ":name": expense.name,
      ":amount": expense.amount,
      ":date": expense.date,
      ":category": expense.category || "other",
      ":description": expense.description || "",
      ":ts": now(),
    }
  );
  return String(id);
}

// ─── Settings ──────────────────────────────────────────────────────────────
export async function getSettings(): Promise<StoreSettings | null> {
  await getDb();
  const row = await queryOne<any>("SELECT * FROM settings WHERE id = 1");
  if (!row) return null;
  return {
    storeName: row.store_name || "My Sari-Sari Store",
    ownerName: row.owner_name || "",
    address: row.address || "",
    theme: (row.theme || "light") as StoreSettings["theme"],
    language: (row.language || "en") as StoreSettings["language"],
    subscription: (row.subscription_tier || "free") as StoreSettings["subscription"],
    gcashNumber: row.gcash_number || "",
    paymayaNumber: row.paymaya_number || "",
    managementPIN: row.management_pin || "0000",
    isOnboardingComplete: !!row.onboarding_complete,
    enableUtang: row.enable_utang !== 0,
    enablePabili: row.enable_pabili !== 0,
    enableBarcodeScanner: row.enable_barcode_scanner !== 0,
    enableReceiptPrinter: row.enable_receipt_printer !== 0,
  };
}

export async function saveSettings(settings: StoreSettings) {
  await getDb();
  await run(
    `INSERT INTO settings (id, store_name, owner_name, address, theme, language, subscription_tier, gcash_number, paymaya_number, management_pin,
      onboarding_complete, enable_utang, enable_pabili, enable_barcode_scanner, enable_receipt_printer, updated_at, is_dirty)
     VALUES (1, :store_name, :owner_name, :address, :theme, :language, :subscription_tier, :gcash_number, :paymaya_number, :management_pin,
      :onboarding_complete, :enable_utang, :enable_pabili, :enable_barcode_scanner, :enable_receipt_printer, :ts, 1)
     ON CONFLICT(id) DO UPDATE SET
      store_name = excluded.store_name,
      owner_name = excluded.owner_name,
      address = excluded.address,
      theme = excluded.theme,
      language = excluded.language,
      subscription_tier = excluded.subscription_tier,
      gcash_number = excluded.gcash_number,
      paymaya_number = excluded.paymaya_number,
      management_pin = excluded.management_pin,
      onboarding_complete = excluded.onboarding_complete,
      enable_utang = excluded.enable_utang,
      enable_pabili = excluded.enable_pabili,
      enable_barcode_scanner = excluded.enable_barcode_scanner,
      enable_receipt_printer = excluded.enable_receipt_printer,
      updated_at = excluded.updated_at,
      is_dirty = 1`,
    {
      ":store_name": settings.storeName,
      ":owner_name": settings.ownerName,
      ":address": settings.address,
      ":theme": settings.theme,
      ":language": settings.language,
      ":subscription_tier": settings.subscription,
      ":gcash_number": settings.gcashNumber,
      ":paymaya_number": settings.paymayaNumber,
      ":management_pin": settings.managementPIN,
      ":onboarding_complete": settings.isOnboardingComplete ? 1 : 0,
      ":enable_utang": settings.enableUtang ? 1 : 0,
      ":enable_pabili": settings.enablePabili ? 1 : 0,
      ":enable_barcode_scanner": settings.enableBarcodeScanner ? 1 : 0,
      ":enable_receipt_printer": settings.enableReceiptPrinter ? 1 : 0,
      ":ts": now(),
    }
  );
}

// ─── Sync helpers (optional for Supabase sync layer) ───────────────────────
export async function getDirtyRows(table: Table) {
  await getDb();
  return queryAll<any>(`SELECT * FROM ${table} WHERE is_dirty = 1`);
}

export async function markSynced(table: Table, ids: string[]) {
  await getDb();
  if (!ids.length) return;
  const placeholders = ids.map((_, idx) => `:id${idx}`).join(", ");
  const params = ids.reduce<Record<string, any>>((acc, id, idx) => {
    acc[`:id${idx}`] = id;
    return acc;
  }, {});
  await run(`UPDATE ${table} SET is_dirty = 0 WHERE id IN (${placeholders})`, params);
}

export async function upsertRemote(table: Table, rows: any[]) {
  await getDb();
  if (!rows.length) return;
  await runTransaction(db => {
    rows.forEach(row => {
      const cols = Object.keys(row);
      const placeholders = cols.map(c => `:${c}`).join(", ");
      const updates = cols.filter(c => c !== "id").map(c => `${c} = excluded.${c}`).join(", ");
      const params: Record<string, any> = {};
      cols.forEach(c => { params[`:${c}`] = row[c]; });
      db.run(
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
        params
      );
    });
  });
}

export async function latestUpdate(table: Table) {
  await getDb();
  const row = await queryOne<{ max_ts: number }>(`SELECT MAX(updated_at) as max_ts FROM ${table}`);
  return row?.max_ts || 0;
}

// Legacy aliases kept for backward compatibility with existing callers
export const updateProductRecord = updateProduct;
export const deleteProductRecord = deleteProduct;
