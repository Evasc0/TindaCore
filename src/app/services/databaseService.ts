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
  | "accounts"
  | "stores"
  | "store_settings"
  | "products"
  | "sales"
  | "sale_items"
  | "customers"
  | "utang_records"
  | "utang_payments"
  | "pabili_orders"
  | "expenses";

export interface DataScope {
  accountId: string;
  storeId: string;
}

let currentScope: DataScope | null = null;

const now = () => Date.now();
const generateId = () => Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`);
type DbId = string | number;
type ResolvedId = { id: DbId; exists: boolean };

const stableHash = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return 1_000_000 + (hash % 9_000_000_000);
};

const toNumericId = (value?: string | number) => {
  if (value === undefined || value === null) return generateId();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  return stableHash(String(value));
};

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

function requireScope() {
  if (!currentScope) {
    throw new Error("No active account/store scope.");
  }
  return currentScope;
}

function scopeParams(scope: DataScope) {
  return {
    ":account_id": scope.accountId,
    ":store_id": scope.storeId,
  };
}

function scopeFilterForTable(table: Table, scope: DataScope) {
  if (table === "accounts") {
    return { clause: "id = :account_id", params: { ":account_id": scope.accountId } };
  }
  if (table === "stores") {
    return {
      clause: "id = :store_id AND account_id = :account_id",
      params: scopeParams(scope),
    };
  }
  if (table === "store_settings") {
    return { clause: "store_id = :store_id", params: { ":store_id": scope.storeId } };
  }
  return {
    clause: "account_id = :account_id AND store_id = :store_id",
    params: scopeParams(scope),
  };
}

function rowMatchesScope(table: Table, row: any, scope: DataScope) {
  if (table === "accounts") return String(row.id) === scope.accountId;
  if (table === "stores") return String(row.id) === scope.storeId && String(row.account_id) === scope.accountId;
  if (table === "store_settings") return String(row.store_id) === scope.storeId;
  return String(row.account_id) === scope.accountId && String(row.store_id) === scope.storeId;
}

function resolveExistingIdInTx(
  db: { exec: (sql: string, params?: Record<string, any>) => any[] },
  table: "products" | "customers" | "utang_records",
  incoming: DbId,
  scope: DataScope
): ResolvedId {
  const numeric = toNumericId(incoming);
  const byNumeric = execRows(
    db as any,
    `SELECT id FROM ${table} WHERE id = :id AND account_id = :account_id AND store_id = :store_id`,
    { ":id": numeric, ...scopeParams(scope) }
  );
  if (byNumeric.length) return { id: byNumeric[0].id, exists: true };

  if (typeof incoming === "string") {
    const byRaw = execRows(
      db as any,
      `SELECT id FROM ${table} WHERE id = :id AND account_id = :account_id AND store_id = :store_id`,
      { ":id": incoming, ...scopeParams(scope) }
    );
    if (byRaw.length) return { id: byRaw[0].id, exists: true };
  }

  return { id: numeric, exists: false };
}

async function resolveExistingId(
  table: "products" | "customers" | "utang_records",
  incoming: DbId,
  scope: DataScope
): Promise<ResolvedId> {
  const numeric = toNumericId(incoming);
  const byNumeric = await queryOne<{ id: DbId }>(
    `SELECT id FROM ${table} WHERE id = :id AND account_id = :account_id AND store_id = :store_id`,
    { ":id": numeric, ...scopeParams(scope) }
  );
  if (byNumeric) return { id: byNumeric.id, exists: true };

  if (typeof incoming === "string") {
    const byRaw = await queryOne<{ id: DbId }>(
      `SELECT id FROM ${table} WHERE id = :id AND account_id = :account_id AND store_id = :store_id`,
      { ":id": incoming, ...scopeParams(scope) }
    );
    if (byRaw) return { id: byRaw.id, exists: true };
  }

  return { id: numeric, exists: false };
}

export const initializeDatabase = initDb;

export function setDataScope(scope: DataScope) {
  currentScope = scope;
}

export function clearDataScope() {
  currentScope = null;
}

export function getDataScope() {
  return currentScope;
}

// Products
export async function getProducts(): Promise<Product[]> {
  await getDb();
  const scope = requireScope();
  const rows = await queryAll<any>(
    "SELECT * FROM products WHERE account_id = :account_id AND store_id = :store_id ORDER BY name ASC",
    scopeParams(scope)
  );
  return rows.map(mapProduct);
}

export async function createProduct(input: Omit<Product, "id"> & { id?: string }): Promise<Product> {
  await getDb();
  const scope = requireScope();
  const id = toNumericId(input.id);
  const ts = now();
  await run(
    `INSERT INTO products (
      id, account_id, store_id, name, barcode, price, cost, stock, unit, base_unit, conversion, category, is_quick_item, emoji, updated_at, is_dirty
    ) VALUES (
      :id, :account_id, :store_id, :name, :barcode, :price, :cost, :stock, :unit, :base_unit, :conversion, :category, :is_quick_item, :emoji, :ts, 1
    )`,
    {
      ":id": id,
      ...scopeParams(scope),
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
    }
  );
  return { ...input, id: String(id) };
}

export async function updateProduct(input: Partial<Product> & { id: string }) {
  await getDb();
  const scope = requireScope();
  const fields: string[] = [];
  const params: Record<string, any> = {
    ":id": toNumericId(input.id),
    ":ts": now(),
    ...scopeParams(scope),
  };
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
  await run(
    `UPDATE products
     SET ${fields.join(", ")}, updated_at = :ts, is_dirty = 1
     WHERE id = :id AND account_id = :account_id AND store_id = :store_id`,
    params
  );
}

export async function deleteProduct(id: string) {
  await getDb();
  const scope = requireScope();
  await run(
    "DELETE FROM products WHERE id = :id AND account_id = :account_id AND store_id = :store_id",
    { ":id": toNumericId(id), ...scopeParams(scope) }
  );
}

// Sales
export async function getSales(): Promise<Sale[]> {
  await getDb();
  const scope = requireScope();
  const sales = await queryAll<any>(
    "SELECT * FROM sales WHERE account_id = :account_id AND store_id = :store_id ORDER BY timestamp DESC",
    scopeParams(scope)
  );
  const items = await queryAll<any>(
    "SELECT * FROM sale_items WHERE account_id = :account_id AND store_id = :store_id",
    scopeParams(scope)
  );
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
  const scope = requireScope();
  const saleId = toNumericId(input.id);
  const ts = input.timestamp ?? now();

  await runTransaction(async db => {
    const customerRef = input.customerId
      ? resolveExistingIdInTx(db as any, "customers", input.customerId, scope)
      : null;

    db.run(
      `INSERT INTO sales (
        id, account_id, store_id, total, payment_type, timestamp, customer_id, is_utang, amount_paid, change_due, updated_at, is_dirty
      ) VALUES (
        :id, :account_id, :store_id, :total, :payment_type, :timestamp, :customer_id, :is_utang, :amount_paid, :change_due, :ts, 1
      )`,
      {
        ":id": saleId,
        ...scopeParams(scope),
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
        ? resolveExistingIdInTx(db as any, "products", item.productId, scope)
        : null;

      db.run(
        `INSERT INTO sale_items (
          id, account_id, store_id, sale_id, product_id, name, quantity, unit, price, cost, subtotal, updated_at, is_dirty
        ) VALUES (
          :id, :account_id, :store_id, :sale_id, :product_id, :name, :quantity, :unit, :price, :cost, :subtotal, :ts, 1
        )`,
        {
          ":id": itemId,
          ...scopeParams(scope),
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
        const rows = execRows(
          db as any,
          "SELECT conversion, unit FROM products WHERE id = :pid AND account_id = :account_id AND store_id = :store_id",
          { ":pid": productRef.id, ...scopeParams(scope) }
        );
        const product = rows[0] || { conversion: 1, unit: "piece" };
        const factor = unitFactor(item.unit, product.conversion);
        db.run(
          `UPDATE products
           SET stock = stock - :qty, updated_at = :ts, is_dirty = 1
           WHERE id = :pid AND account_id = :account_id AND store_id = :store_id`,
          {
            ":qty": item.qty * factor,
            ":ts": ts,
            ":pid": productRef.id,
            ...scopeParams(scope),
          }
        );
      }
    }
  });

  return String(saleId);
}

// Customers / Utang
export async function getCustomers(): Promise<Customer[]> {
  await getDb();
  const scope = requireScope();
  const customers = await queryAll<any>(
    "SELECT * FROM customers WHERE account_id = :account_id AND store_id = :store_id ORDER BY name ASC",
    scopeParams(scope)
  );
  const utang = await queryAll<any>(
    "SELECT * FROM utang_records WHERE account_id = :account_id AND store_id = :store_id",
    scopeParams(scope)
  );
  const payments = await queryAll<any>(
    "SELECT * FROM utang_payments WHERE account_id = :account_id AND store_id = :store_id",
    scopeParams(scope)
  );

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
  const scope = requireScope();
  const customerId = toNumericId(id);
  await run(
    `INSERT INTO customers (id, account_id, store_id, name, phone, updated_at, is_dirty)
     VALUES (:id, :account_id, :store_id, :name, :phone, :ts, 1)`,
    {
      ":id": customerId,
      ...scopeParams(scope),
      ":name": name,
      ":phone": phone || "",
      ":ts": now(),
    }
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
  const scope = requireScope();
  const id = toNumericId(data.id);
  const customerRef = await resolveExistingId("customers", data.customerId, scope);
  if (!customerRef.exists) {
    throw new Error(`Cannot create utang record: customer not found (${data.customerId})`);
  }

  await run(
    `INSERT INTO utang_records (
      id, account_id, store_id, customer_id, amount, balance, date, items_json, updated_at, is_dirty
    ) VALUES (
      :id, :account_id, :store_id, :customer_id, :amount, :balance, :date, :items_json, :ts, 1
    )`,
    {
      ":id": id,
      ...scopeParams(scope),
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
  const scope = requireScope();
  const paymentId = generateId();
  const ts = now();
  const utangRef = await resolveExistingId("utang_records", utangId, scope);
  if (!utangRef.exists) {
    throw new Error(`Cannot record payment: utang record not found (${utangId})`);
  }

  await runTransaction(db => {
    db.run(
      `INSERT INTO utang_payments (id, account_id, store_id, utang_id, amount, date, updated_at, is_dirty)
       VALUES (:id, :account_id, :store_id, :utang_id, :amount, :date, :ts, 1)`,
      {
        ":id": paymentId,
        ...scopeParams(scope),
        ":utang_id": utangRef.id,
        ":amount": amount,
        ":date": date,
        ":ts": ts,
      }
    );
    db.run(
      `UPDATE utang_records
       SET balance = balance - :amount, updated_at = :ts, is_dirty = 1
       WHERE id = :utang_id AND account_id = :account_id AND store_id = :store_id`,
      {
        ":amount": amount,
        ":ts": ts,
        ":utang_id": utangRef.id,
        ...scopeParams(scope),
      }
    );
  });
  return String(paymentId);
}

// Pabili orders
export async function getPabiliOrders(): Promise<PabiliOrder[]> {
  await getDb();
  const scope = requireScope();
  const rows = await queryAll<any>(
    "SELECT * FROM pabili_orders WHERE account_id = :account_id AND store_id = :store_id ORDER BY timestamp DESC",
    scopeParams(scope)
  );
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
  const scope = requireScope();
  const id = toNumericId(order.id);
  const ts = order.timestamp ? new Date(order.timestamp).getTime() : now();
  await run(
    `INSERT INTO pabili_orders (
      id, account_id, store_id, items_json, customer_name, customer_phone, status, timestamp, note, total, updated_at, is_dirty
    ) VALUES (
      :id, :account_id, :store_id, :items_json, :customer_name, :customer_phone, :status, :timestamp, :note, :total, :ts, 1
    )`,
    {
      ":id": id,
      ...scopeParams(scope),
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
  const scope = requireScope();
  await run(
    `UPDATE pabili_orders
     SET status = :status, updated_at = :ts, is_dirty = 1
     WHERE id = :id AND account_id = :account_id AND store_id = :store_id`,
    {
      ":status": status,
      ":ts": now(),
      ":id": toNumericId(id),
      ...scopeParams(scope),
    }
  );
}

// Expenses
export async function getExpenses(): Promise<Expense[]> {
  await getDb();
  const scope = requireScope();
  const rows = await queryAll<any>(
    "SELECT * FROM expenses WHERE account_id = :account_id AND store_id = :store_id ORDER BY date DESC",
    scopeParams(scope)
  );
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
  const scope = requireScope();
  const id = toNumericId(expense.id);
  await run(
    `INSERT INTO expenses (
      id, account_id, store_id, name, amount, date, category, description, updated_at, is_dirty
    ) VALUES (
      :id, :account_id, :store_id, :name, :amount, :date, :category, :description, :ts, 1
    )`,
    {
      ":id": id,
      ...scopeParams(scope),
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

// Settings
export async function getSettings(): Promise<StoreSettings | null> {
  await getDb();
  const scope = requireScope();
  const account = await queryOne<any>("SELECT * FROM accounts WHERE id = :account_id LIMIT 1", {
    ":account_id": scope.accountId,
  });
  const store = await queryOne<any>(
    "SELECT * FROM stores WHERE id = :store_id AND account_id = :account_id LIMIT 1",
    scopeParams(scope)
  );
  if (!account || !store) return null;

  const row = await queryOne<any>(
    "SELECT * FROM store_settings WHERE store_id = :store_id LIMIT 1",
    { ":store_id": scope.storeId }
  );

  return {
    storeName: store.store_name || "My Sari-Sari Store",
    ownerName: account.owner_name || "",
    address: row?.address || "",
    theme: (row?.theme || "light") as StoreSettings["theme"],
    language: (row?.language || "fil") as StoreSettings["language"],
    subscription: (store.subscription_tier || "free") as StoreSettings["subscription"],
    gcashNumber: row?.gcash_number || "",
    paymayaNumber: row?.maya_number || "",
    managementPIN: "",
    hasManagementPin: !!row?.management_pin_hash,
    isOnboardingComplete: Number(row?.onboarding_complete || 0) === 1,
    enableUtang: Number(row?.utang_enabled ?? 1) === 1,
    enablePabili: Number(row?.pabili_enabled ?? 1) === 1,
    enableBarcodeScanner: Number(row?.enable_barcode_scanner ?? 1) === 1,
    enableReceiptPrinter: Number(row?.enable_receipt_printer ?? 0) === 1,
  };
}

export async function saveSettings(settings: StoreSettings) {
  await getDb();
  const scope = requireScope();
  const ts = now();
  const settingsId = `stg_${scope.storeId}`;

  await runTransaction(db => {
    db.run(
      `UPDATE accounts
       SET owner_name = :owner_name, updated_at = :ts, is_dirty = 1
       WHERE id = :account_id`,
      {
        ":owner_name": settings.ownerName,
        ":ts": ts,
        ":account_id": scope.accountId,
      }
    );

    db.run(
      `UPDATE stores
       SET store_name = :store_name, subscription_tier = :subscription_tier, updated_at = :ts, is_dirty = 1
       WHERE id = :store_id AND account_id = :account_id`,
      {
        ":store_name": settings.storeName,
        ":subscription_tier": settings.subscription,
        ":ts": ts,
        ...scopeParams(scope),
      }
    );

    db.run(
      `INSERT INTO store_settings (
        id, store_id, management_pin_hash, language, theme, utang_enabled, pabili_enabled,
        gcash_number, maya_number, address, onboarding_complete, enable_barcode_scanner,
        enable_receipt_printer, updated_at, is_dirty
      ) VALUES (
        :id, :store_id,
        (SELECT management_pin_hash FROM store_settings WHERE store_id = :store_id),
        :language, :theme, :utang_enabled, :pabili_enabled,
        :gcash_number, :maya_number, :address, :onboarding_complete, :enable_barcode_scanner,
        :enable_receipt_printer, :updated_at, 1
      )
      ON CONFLICT(store_id) DO UPDATE SET
        language = excluded.language,
        theme = excluded.theme,
        utang_enabled = excluded.utang_enabled,
        pabili_enabled = excluded.pabili_enabled,
        gcash_number = excluded.gcash_number,
        maya_number = excluded.maya_number,
        address = excluded.address,
        onboarding_complete = excluded.onboarding_complete,
        enable_barcode_scanner = excluded.enable_barcode_scanner,
        enable_receipt_printer = excluded.enable_receipt_printer,
        updated_at = excluded.updated_at,
        is_dirty = 1`,
      {
        ":id": settingsId,
        ":store_id": scope.storeId,
        ":language": settings.language,
        ":theme": settings.theme,
        ":utang_enabled": settings.enableUtang ? 1 : 0,
        ":pabili_enabled": settings.enablePabili ? 1 : 0,
        ":gcash_number": settings.gcashNumber,
        ":maya_number": settings.paymayaNumber,
        ":address": settings.address,
        ":onboarding_complete": settings.isOnboardingComplete ? 1 : 0,
        ":enable_barcode_scanner": settings.enableBarcodeScanner ? 1 : 0,
        ":enable_receipt_printer": settings.enableReceiptPrinter ? 1 : 0,
        ":updated_at": ts,
      }
    );
  });
}

// Sync helpers
export async function getDirtyRows(table: Table) {
  await getDb();
  const scope = currentScope;
  if (!scope) return [];
  const filter = scopeFilterForTable(table, scope);
  return queryAll<any>(
    `SELECT * FROM ${table} WHERE is_dirty = 1 AND ${filter.clause}`,
    filter.params
  );
}

export async function markSynced(table: Table, ids: string[]) {
  await getDb();
  const scope = currentScope;
  if (!scope || !ids.length) return;
  const placeholders = ids.map((_, idx) => `:id${idx}`).join(", ");
  const idParams = ids.reduce<Record<string, any>>((acc, id, idx) => {
    acc[`:id${idx}`] = id;
    return acc;
  }, {});
  const filter = scopeFilterForTable(table, scope);
  await run(
    `UPDATE ${table} SET is_dirty = 0 WHERE id IN (${placeholders}) AND ${filter.clause}`,
    { ...idParams, ...filter.params }
  );
}

export async function upsertRemote(table: Table, rows: any[]) {
  await getDb();
  const scope = currentScope;
  if (!scope || !rows.length) return;
  const scopedRows = rows.filter(row => rowMatchesScope(table, row, scope));
  if (!scopedRows.length) return;
  await runTransaction(db => {
    scopedRows.forEach(row => {
      const cols = Object.keys(row);
      if (!cols.length) return;
      const placeholders = cols.map(c => `:${c}`).join(", ");
      const conflictTarget = table === "store_settings" ? "store_id" : "id";
      const updates = cols
        .filter(c => c !== conflictTarget)
        .map(c => `${c} = excluded.${c}`)
        .join(", ");
      const params: Record<string, any> = {};
      cols.forEach(c => {
        params[`:${c}`] = row[c];
      });
      db.run(
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})
         ON CONFLICT(${conflictTarget}) DO UPDATE SET ${updates}`,
        params
      );
    });
  });
}

export async function latestUpdate(table: Table) {
  await getDb();
  const scope = currentScope;
  if (!scope) return 0;
  const filter = scopeFilterForTable(table, scope);
  const row = await queryOne<{ max_ts: number }>(
    `SELECT MAX(updated_at) as max_ts FROM ${table} WHERE ${filter.clause}`,
    filter.params
  );
  return row?.max_ts || 0;
}

// Legacy aliases kept for backward compatibility with existing callers
export const updateProductRecord = updateProduct;
export const deleteProductRecord = deleteProduct;
