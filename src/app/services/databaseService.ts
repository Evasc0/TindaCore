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
import { all, get, run, transaction, getDatabase } from "../database/sqlite";

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

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const now = () => Date.now();

const toBool = (value: any) => value === 1 || value === true || value === "1";

export async function initializeDatabase() {
  await getDatabase();
}

// ─── Products ────────────────────────────────────────────────────────────────
export async function getProducts(): Promise<Product[]> {
  const rows = await all<any>("SELECT * FROM products WHERE deleted = 0");
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    barcode: row.barcode || "",
    price: Number(row.price),
    cost: Number(row.cost || 0),
    stock: Number(row.stock || 0),
    unit: (row.unit || "piece") as Unit,
    baseUnit: (row.base_unit || "piece") as Product["baseUnit"],
    conversion: Number(row.conversion || 1),
    category: row.category || "General",
    isQuickItem: toBool(row.is_quick_item),
    emoji: row.emoji || "🛒",
  }));
}

export async function createProduct(input: Omit<Product, "id"> & { id?: string }) {
  const id = input.id || uuid();
  const ts = now();
  await run(
    `INSERT INTO products (id, name, barcode, price, cost, stock, unit, base_unit, conversion, category, is_quick_item, emoji, updated_at, is_dirty)
     VALUES (:id, :name, :barcode, :price, :cost, :stock, :unit, :base_unit, :conversion, :category, :is_quick_item, :emoji, :ts, 1)`,
    {
      ":id": id,
      ":name": input.name,
      ":barcode": input.barcode || "",
      ":price": input.price,
      ":cost": input.cost,
      ":stock": input.stock,
      ":unit": input.unit,
      ":base_unit": input.baseUnit,
      ":conversion": input.conversion || 1,
      ":category": input.category || "General",
      ":is_quick_item": input.isQuickItem ? 1 : 0,
      ":emoji": input.emoji || "🛒",
      ":ts": ts,
    }
  );
  return { ...input, id };
}

export async function updateProductRecord(id: string, updates: Partial<Product>) {
  const ts = now();
  const fields: string[] = [];
  const params: Record<string, any> = { ":id": id, ":ts": ts };
  const map: Record<keyof Partial<Product>, string> = {
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
  Object.entries(updates).forEach(([key, val]) => {
    const column = map[key as keyof Partial<Product>];
    if (!column) return;
    fields.push(`${column} = :${column}`);
    params[`:${column}`] = key === "isQuickItem" ? (val ? 1 : 0) : val;
  });
  if (!fields.length) return;
  await run(
    `UPDATE products SET ${fields.join(", ")}, updated_at = :ts, is_dirty = 1 WHERE id = :id`,
    params
  );
}

export async function deleteProductRecord(id: string) {
  await run("UPDATE products SET deleted = 1, is_dirty = 1, updated_at = :ts WHERE id = :id", {
    ":id": id,
    ":ts": now(),
  });
}

// ─── Sales ───────────────────────────────────────────────────────────────────
interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id?: string;
  name: string;
  quantity: number;
  unit?: string;
  price: number;
  cost?: number;
  subtotal: number;
}

export async function getSales(): Promise<Sale[]> {
  const sales = await all<any>("SELECT * FROM sales WHERE deleted = 0 ORDER BY timestamp DESC");
  const items = await all<SaleItemRow>("SELECT * FROM sale_items WHERE deleted = 0");
  const itemsBySale = items.reduce<Record<string, SaleItemRow[]>>((acc, item) => {
    acc[item.sale_id] = acc[item.sale_id] || [];
    acc[item.sale_id].push(item);
    return acc;
  }, {});
  return sales.map(sale => ({
    id: sale.id,
    timestamp: new Date(Number(sale.timestamp)).toISOString(),
    date: new Date(Number(sale.timestamp)).toISOString().split("T")[0],
    items: (itemsBySale[sale.id] || []).map(it => ({
      productId: it.product_id,
      name: it.name,
      qty: it.quantity,
      unit: (it.unit || "piece") as Unit,
      price: it.price,
      cost: it.cost,
      subtotal: it.subtotal,
    })),
    total: Number(sale.total),
    paymentType: sale.payment_type,
    isUtang: toBool(sale.is_utang),
    customerId: sale.customer_id,
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
  const saleId = input.id || uuid();
  const ts = input.timestamp ?? now();
  await transaction(async db => {
    db.prepare(
      `INSERT INTO sales (id, total, payment_type, timestamp, customer_id, is_utang, amount_paid, change_due, updated_at, is_dirty)
       VALUES (:id, :total, :payment_type, :timestamp, :customer_id, :is_utang, :amount_paid, :change_due, :ts, 1)`
    ).bind({
      ":id": saleId,
      ":total": input.total,
      ":payment_type": input.paymentType,
      ":timestamp": ts,
      ":customer_id": input.customerId || null,
      ":is_utang": input.isUtang ? 1 : 0,
      ":amount_paid": input.amountPaid ?? input.total,
      ":change_due": input.changeDue ?? 0,
      ":ts": ts,
    }).step();

    const insertItem = db.prepare(
      `INSERT INTO sale_items (id, sale_id, product_id, name, quantity, unit, price, cost, subtotal, updated_at, is_dirty)
       VALUES (:id, :sale_id, :product_id, :name, :quantity, :unit, :price, :cost, :subtotal, :ts, 1)`
    );

    input.items.forEach(item => {
      insertItem.bind({
        ":id": uuid(),
        ":sale_id": saleId,
        ":product_id": item.productId || null,
        ":name": item.name,
        ":quantity": item.qty,
        ":unit": item.unit || "piece",
        ":price": item.price,
        ":cost": item.cost ?? null,
        ":subtotal": item.subtotal,
        ":ts": ts,
      }).step();
      insertItem.reset();

      if (item.productId) {
        const productStmt = db.prepare("SELECT conversion, unit FROM products WHERE id = :pid");
        productStmt.bind({ ":pid": item.productId }).step();
        const productRow = productStmt.getAsObject() as { conversion?: number; unit?: string };
        productStmt.free();
        const factor =
          item.unit === "pack" || item.unit === "box"
            ? productRow.conversion || 1
            : item.unit === "kg" || item.unit === "liters"
            ? 1000
            : 1;
        db.prepare(
          `UPDATE products SET stock = stock - :qty, updated_at = :ts, is_dirty = 1 WHERE id = :pid`
        ).bind({ ":qty": item.qty * factor, ":ts": ts, ":pid": item.productId }).step();
      }
    });
    insertItem.free();
  });
  return saleId;
}

// ─── Customers / Utang ──────────────────────────────────────────────────────
export async function getCustomers(): Promise<Customer[]> {
  const customers = await all<any>("SELECT * FROM customers WHERE deleted = 0");
  const utang = await all<any>("SELECT * FROM utang_records WHERE deleted = 0");
  const payments = await all<any>("SELECT * FROM utang_payments WHERE deleted = 0");

  const paymentsByUtang = payments.reduce<Record<string, any[]>>((acc, p) => {
    acc[p.utang_id] = acc[p.utang_id] || [];
    acc[p.utang_id].push(p);
    return acc;
  }, {});

  const utangByCustomer = utang.reduce<Record<string, UtangRecord[]>>((acc, r) => {
    const rec: UtangRecord = {
      id: r.id,
      date: r.date,
      items: r.items_json ? JSON.parse(r.items_json) : [],
      amount: Number(r.amount),
      balance: Number(r.balance),
      payments: (paymentsByUtang[r.id] || []).map(p => ({
        id: p.id,
        amount: Number(p.amount),
        date: p.date,
      })),
    };
    acc[r.customer_id] = acc[r.customer_id] || [];
    acc[r.customer_id].push(rec);
    return acc;
  }, {});

  return customers.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone || "",
    transactions: utangByCustomer[c.id] || [],
  }));
}

export async function createCustomer(name: string, phone?: string, id?: string) {
  const customerId = id || uuid();
  await run(
    `INSERT INTO customers (id, name, phone, updated_at, is_dirty) VALUES (:id, :name, :phone, :ts, 1)`,
    { ":id": customerId, ":name": name, ":phone": phone || "", ":ts": now() }
  );
  return customerId;
}

export async function addUtangRecord(data: {
  id?: string;
  customerId: string;
  items: UtangRecord["items"];
  amount: number;
  balance: number;
  date: string;
}) {
  const id = data.id || uuid();
  await run(
    `INSERT INTO utang_records (id, customer_id, amount, balance, date, items_json, updated_at, is_dirty)
     VALUES (:id, :customer_id, :amount, :balance, :date, :items_json, :ts, 1)`,
    {
      ":id": id,
      ":customer_id": data.customerId,
      ":amount": data.amount,
      ":balance": data.balance,
      ":date": data.date,
      ":items_json": JSON.stringify(data.items || []),
      ":ts": now(),
    }
  );
  return id;
}

export async function recordPayment(utangId: string, amount: number, date: string) {
  const paymentId = uuid();
  const ts = now();
  await transaction(db => {
    db.prepare(
      `INSERT INTO utang_payments (id, utang_id, amount, date, updated_at, is_dirty)
       VALUES (:id, :utang_id, :amount, :date, :ts, 1)`
    ).bind({ ":id": paymentId, ":utang_id": utangId, ":amount": amount, ":date": date, ":ts": ts }).step();
    db.prepare(
      `UPDATE utang_records SET balance = balance - :amount, updated_at = :ts, is_dirty = 1 WHERE id = :utang_id`
    ).bind({ ":amount": amount, ":ts": ts, ":utang_id": utangId }).step();
  });
  return paymentId;
}

// ─── Pabili Orders ──────────────────────────────────────────────────────────
export async function getPabiliOrders(): Promise<PabiliOrder[]> {
  const rows = await all<any>("SELECT * FROM pabili_orders WHERE deleted = 0 ORDER BY timestamp DESC");
  return rows.map(row => ({
    id: row.id,
    customerName: row.customer_name || "Customer",
    customerPhone: row.customer_phone || "",
    items: row.items_json ? JSON.parse(row.items_json) : [],
    status: row.status,
    timestamp: new Date(Number(row.timestamp)).toISOString(),
    date: new Date(Number(row.timestamp)).toISOString().split("T")[0],
    note: row.note || "",
    total: Number(row.total || 0),
  }));
}

export async function createPabiliOrder(order: Omit<PabiliOrder, "id" | "date"> & { id?: string }) {
  const id = order.id || uuid();
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
  return id;
}

export async function updatePabiliStatus(id: string, status: PabiliOrder["status"]) {
  await run(
    `UPDATE pabili_orders SET status = :status, updated_at = :ts, is_dirty = 1 WHERE id = :id`,
    { ":status": status, ":ts": now(), ":id": id }
  );
}

// ─── Expenses ───────────────────────────────────────────────────────────────
export async function getExpenses(): Promise<Expense[]> {
  const rows = await all<any>("SELECT * FROM expenses WHERE deleted = 0 ORDER BY date DESC");
  return rows.map(row => ({
    id: row.id,
    date: row.date,
    name: row.name,
    description: row.description || "",
    amount: Number(row.amount),
    category: (row.category || "other") as Expense["category"],
  }));
}

export async function addExpense(expense: Omit<Expense, "id"> & { id?: string }) {
  const id = expense.id || uuid();
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
  return id;
}

// ─── Settings ───────────────────────────────────────────────────────────────
export async function getSettings(): Promise<StoreSettings | null> {
  const row = await get<any>("SELECT * FROM settings WHERE id = 1");
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
    isOnboardingComplete: toBool(row.onboarding_complete),
    enableUtang: toBool(row.enable_utang),
    enablePabili: toBool(row.enable_pabili),
    enableBarcodeScanner: toBool(row.enable_barcode_scanner),
    enableReceiptPrinter: toBool(row.enable_receipt_printer),
  };
}

export async function saveSettings(settings: StoreSettings) {
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

// ─── Sync helpers ───────────────────────────────────────────────────────────
export async function getDirtyRows(table: Table) {
  return all<any>(`SELECT * FROM ${table} WHERE is_dirty = 1`);
}

export async function markSynced(table: Table, ids: string[]) {
  if (!ids.length) return;
  const placeholders = ids.map((_, idx) => `:id${idx}`).join(", ");
  const params = ids.reduce<Record<string, any>>((acc, id, idx) => {
    acc[`:id${idx}`] = id;
    return acc;
  }, {});
  await run(`UPDATE ${table} SET is_dirty = 0 WHERE id IN (${placeholders})`, params);
}

export async function upsertRemote(table: Table, rows: any[]) {
  if (!rows.length) return;
  await transaction(db => {
    rows.forEach(row => {
      const cols = Object.keys(row);
      const placeholders = cols.map(c => `:${c}`).join(", ");
      const updates = cols.filter(c => c !== "id").map(c => `${c} = excluded.${c}`).join(", ");
      const stmt = db.prepare(
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates}`
      );
      const params: Record<string, any> = {};
      cols.forEach(c => { params[`:${c}`] = row[c]; });
      stmt.bind(params).step();
      stmt.free();
    });
  });
}

export async function latestUpdate(table: Table) {
  const row = await get<{ max_ts: number }>(`SELECT MAX(updated_at) as max_ts FROM ${table}`);
  return row?.max_ts || 0;
}
