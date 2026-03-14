import { generateRestockSuggestions, type RestockSuggestion } from "../ai/restockEngine";
import {
  getDataScope,
  getProducts as loadProducts,
  getSales as loadSales,
} from "./databaseService";
import { queryAll, queryOne, run, runTransaction, execRows } from "../database/sqlite";

type Scope = { accountId: string; storeId: string };

export type RestockListStatus = "draft" | "partial" | "confirmed" | "draft_complete";
export type RestockItemStatus = "draft" | "confirmed";
export type SyncStatus = "pending" | "synced";

export interface RestockListItem {
  id: string;
  restockListId: string;
  accountId: string;
  storeId: string;
  productId: string;
  productName: string;
  productEmoji: string;
  suggestedQty: number;
  editedQty: number;
  purchasedQty: number;
  unit: string;
  estimatedUnitCost: number;
  actualUnitCost: number;
  estimatedItemTotal: number;
  actualItemTotal: number;
  isChecked: boolean;
  status: RestockItemStatus;
  createdAt: string;
  updatedAt: number;
  syncStatus: SyncStatus;
}

export interface RestockListRecord {
  id: string;
  accountId: string;
  storeId: string;
  supplierId: string | null;
  status: RestockListStatus;
  createdAt: string;
  updatedAt: number;
  estimatedTotal: number;
  confirmedTotal: number;
  syncStatus: SyncStatus;
  items: RestockListItem[];
}

export interface SupplierRecord {
  id: string;
  accountId: string;
  storeId: string;
  name: string;
  location: string;
  contactNumber: string;
  notes: string;
  createdAt: string;
  updatedAt: number;
  syncStatus: SyncStatus;
}

export interface SupplierPriceRecord {
  id: string;
  supplierId: string;
  productId: string;
  accountId: string;
  storeId: string;
  unit: string;
  price: number;
  createdAt: string;
  updatedAt: number;
  syncStatus: SyncStatus;
}

export interface RestockHistoryRecord {
  id: string;
  accountId: string;
  storeId: string;
  productId: string;
  productName: string;
  productEmoji: string;
  supplierId: string | null;
  supplierName: string | null;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  restockListId: string | null;
  createdAt: string;
  syncStatus: SyncStatus;
}

export interface RestockBudgetItem {
  restockItemId: string;
  productId: string;
  unit: string;
  editedQty: number;
  estimatedUnitCost: number;
  estimatedItemTotal: number;
  source: "supplier_price" | "last_restock" | "none";
  missingPrice: boolean;
}

export interface RestockBudgetSummary {
  restockListId: string;
  estimatedTotal: number;
  missingPriceCount: number;
  items: RestockBudgetItem[];
}

export interface ConfirmRestockInput {
  [restockItemId: string]: {
    actualUnitCost: number;
    purchasedQty?: number;
  };
}

export interface ConfirmRestockResult {
  restockListId: string;
  confirmedTotal: number;
  status: RestockListStatus;
  confirmedItemIds: string[];
}

export interface CreateSupplierInput {
  storeId?: string;
  name: string;
  location?: string;
  contactNumber?: string;
  notes?: string;
  id?: string;
}

export interface SaveSupplierPriceInput {
  id?: string;
  supplierId: string;
  productId: string;
  unit: string;
  price: number;
  storeId?: string;
}

export interface UpdateRestockItemFields {
  suggestedQty?: number;
  editedQty?: number;
  purchasedQty?: number;
  unit?: string;
  estimatedUnitCost?: number;
  actualUnitCost?: number;
  isChecked?: boolean;
  status?: RestockItemStatus;
}

type ProductCostRow = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  stock: number;
  unit: string;
  conversion: number;
};

const nowIso = () => new Date().toISOString();
const nowMs = () => Date.now();
const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const toNumber = (value: any, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const unitFactor = (unit?: string, conversion = 1) => {
  if (unit === "pack" || unit === "box" || unit === "case") return conversion || 1;
  if (unit === "kg" || unit === "liters") return 1000;
  return 1;
};

const toBaseUnits = (qty: number, unit: string, conversion = 1) => toNumber(qty) * unitFactor(unit, conversion);

const convertUnitCost = (
  unitCost: number,
  fromUnit: string,
  toUnit: string,
  conversion: number
) => {
  const fromFactor = unitFactor(fromUnit, conversion);
  const toFactor = unitFactor(toUnit, conversion);
  if (fromFactor <= 0 || toFactor <= 0) return toNumber(unitCost);
  const baseCost = toNumber(unitCost) / fromFactor;
  return baseCost * toFactor;
};

const mapRestockItem = (row: any): RestockListItem => {
  const editedQty = toNumber(row.edited_qty);
  const purchasedQty = toNumber(row.purchased_qty);
  const estimatedUnitCost = toNumber(row.estimated_unit_cost);
  const actualUnitCost = toNumber(row.actual_unit_cost);
  return {
    id: String(row.id),
    restockListId: String(row.restock_list_id),
    accountId: String(row.account_id),
    storeId: String(row.store_id),
    productId: String(row.product_id),
    productName: row.product_name || "Unknown Product",
    productEmoji: row.product_emoji || "??",
    suggestedQty: toNumber(row.suggested_qty),
    editedQty,
    purchasedQty,
    unit: row.unit || "piece",
    estimatedUnitCost,
    actualUnitCost,
    estimatedItemTotal: editedQty * estimatedUnitCost,
    actualItemTotal: purchasedQty * actualUnitCost,
    isChecked: Number(row.is_checked || 0) === 1,
    status: (row.status || "draft") as RestockItemStatus,
    createdAt: row.created_at || "",
    updatedAt: toNumber(row.updated_at),
    syncStatus: (row.sync_status || "pending") as SyncStatus,
  };
};

const mapRestockList = (row: any, items: RestockListItem[]): RestockListRecord => ({
  id: String(row.id),
  accountId: String(row.account_id),
  storeId: String(row.store_id),
  supplierId: row.supplier_id ? String(row.supplier_id) : null,
  status: (row.status || "draft") as RestockListStatus,
  createdAt: row.created_at || "",
  updatedAt: toNumber(row.updated_at),
  estimatedTotal: toNumber(row.estimated_total),
  confirmedTotal: toNumber(row.confirmed_total),
  syncStatus: (row.sync_status || "pending") as SyncStatus,
  items,
});

const scopeParams = (scope: Scope) => ({
  ":account_id": scope.accountId,
  ":store_id": scope.storeId,
});

function requireScopedStore(storeId?: string): Scope {
  const scope = getDataScope();
  if (!scope) throw new Error("No active account/store scope.");
  if (storeId && scope.storeId !== storeId) {
    throw new Error("Active store scope does not match the requested store.");
  }
  return scope;
}

async function getProductCostRow(scope: Scope, productId: string): Promise<ProductCostRow | null> {
  const row = await queryOne<any>(
    `SELECT
       CAST(id AS TEXT) as id,
       name,
       emoji,
       cost,
       stock,
       unit,
       conversion
     FROM products
     WHERE account_id = :account_id
       AND store_id = :store_id
       AND CAST(id AS TEXT) = :product_id
     LIMIT 1`,
    {
      ...scopeParams(scope),
      ":product_id": String(productId),
    }
  );
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name || "Unknown Product",
    emoji: row.emoji || "??",
    cost: toNumber(row.cost),
    stock: toNumber(row.stock),
    unit: row.unit || "piece",
    conversion: toNumber(row.conversion, 1) || 1,
  };
}

async function getRestockListById(scope: Scope, restockListId: string) {
  return queryOne<any>(
    `SELECT * FROM restock_lists
     WHERE id = :id
       AND account_id = :account_id
       AND store_id = :store_id
     LIMIT 1`,
    {
      ...scopeParams(scope),
      ":id": restockListId,
    }
  );
}

async function getRestockItemsByList(scope: Scope, restockListId: string): Promise<RestockListItem[]> {
  const rows = await queryAll<any>(
    `SELECT
       ri.*,
       p.name as product_name,
       p.emoji as product_emoji
     FROM restock_items ri
     LEFT JOIN products p
       ON CAST(p.id AS TEXT) = ri.product_id
      AND p.account_id = ri.account_id
      AND p.store_id = ri.store_id
     WHERE ri.restock_list_id = :restock_list_id
       AND ri.account_id = :account_id
       AND ri.store_id = :store_id
     ORDER BY ri.created_at ASC`,
    {
      ...scopeParams(scope),
      ":restock_list_id": restockListId,
    }
  );
  return rows.map(mapRestockItem);
}

async function resolveEstimatedUnitCost(
  scope: Scope,
  product: ProductCostRow,
  unit: string,
  supplierId?: string | null
): Promise<{ cost: number; source: "supplier_price" | "last_restock" | "none" }> {
  if (supplierId) {
    const supplierPrice = await queryOne<any>(
      `SELECT price
       FROM supplier_prices
       WHERE supplier_id = :supplier_id
         AND product_id = :product_id
         AND account_id = :account_id
         AND store_id = :store_id
         AND unit = :unit
       ORDER BY updated_at DESC
       LIMIT 1`,
      {
        ...scopeParams(scope),
        ":supplier_id": supplierId,
        ":product_id": product.id,
        ":unit": unit,
      }
    );
    if (supplierPrice) {
      return { cost: toNumber(supplierPrice.price), source: "supplier_price" };
    }
  }

  const historyRows = await queryAll<any>(
    `SELECT unit, unit_cost
     FROM restock_history
     WHERE account_id = :account_id
       AND store_id = :store_id
       AND product_id = :product_id
       ${supplierId ? "AND (supplier_id = :supplier_id OR supplier_id IS NULL)" : ""}
     ORDER BY created_at DESC
     LIMIT 5`,
    {
      ...scopeParams(scope),
      ":product_id": product.id,
      ...(supplierId ? { ":supplier_id": supplierId } : {}),
    }
  );
  if (historyRows.length) {
    const exact = historyRows.find(row => String(row.unit || "piece") === unit);
    if (exact) {
      return { cost: toNumber(exact.unit_cost), source: "last_restock" };
    }
    const latest = historyRows[0];
    return {
      cost: convertUnitCost(toNumber(latest.unit_cost), String(latest.unit || "piece"), unit, product.conversion),
      source: "last_restock",
    };
  }

  const fallbackCost = convertUnitCost(product.cost, product.unit, unit, product.conversion);
  return { cost: Math.max(0, fallbackCost), source: "none" };
}

async function refreshRestockListEstimatedTotal(scope: Scope, restockListId: string) {
  const row = await queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(edited_qty * estimated_unit_cost), 0) as total
     FROM restock_items
     WHERE restock_list_id = :restock_list_id
       AND account_id = :account_id
       AND store_id = :store_id`,
    {
      ...scopeParams(scope),
      ":restock_list_id": restockListId,
    }
  );
  const total = toNumber(row?.total);
  await run(
    `UPDATE restock_lists
     SET estimated_total = :total,
         updated_at = :updated_at,
         sync_status = 'pending',
         is_dirty = 1
     WHERE id = :id
       AND account_id = :account_id
       AND store_id = :store_id`,
    {
      ...scopeParams(scope),
      ":id": restockListId,
      ":total": total,
      ":updated_at": nowMs(),
    }
  );
  return total;
}

export async function generateSmartRestockSuggestions(storeId: string): Promise<RestockSuggestion[]> {
  requireScopedStore(storeId);
  const [products, sales] = await Promise.all([loadProducts(), loadSales()]);
  return generateRestockSuggestions(products, sales, {
    lookbackDays: 7,
    targetRestockDays: 7,
    thresholdDays: 7,
    includeNoSalesFallback: true,
  });
}

export async function createRestockList(storeId: string, supplierId?: string): Promise<RestockListRecord> {
  const scope = requireScopedStore(storeId);
  const now = nowIso();
  const ts = nowMs();
  const restockListId = makeId("rlist");

  await run(
    `INSERT INTO restock_lists (
      id, account_id, store_id, supplier_id, status, created_at, updated_at,
      estimated_total, confirmed_total, sync_status, is_dirty
    ) VALUES (
      :id, :account_id, :store_id, :supplier_id, :status, :created_at, :updated_at,
      0, 0, 'pending', 1
    )`,
    {
      ...scopeParams(scope),
      ":id": restockListId,
      ":supplier_id": supplierId || null,
      ":status": "draft",
      ":created_at": now,
      ":updated_at": ts,
    }
  );

  const suggestions = await generateSmartRestockSuggestions(storeId);
  if (suggestions.length) {
    await runTransaction(db => {
      suggestions.forEach(suggestion => {
        const itemId = makeId("ritm");
        db.run(
          `INSERT INTO restock_items (
            id, restock_list_id, account_id, store_id, product_id,
            suggested_qty, edited_qty, purchased_qty, unit,
            estimated_unit_cost, actual_unit_cost, is_checked, status,
            created_at, updated_at, sync_status, is_dirty
          ) VALUES (
            :id, :restock_list_id, :account_id, :store_id, :product_id,
            :suggested_qty, :edited_qty, 0, :unit,
            0, 0, 0, 'draft',
            :created_at, :updated_at, 'pending', 1
          )`,
          {
            ...scopeParams(scope),
            ":id": itemId,
            ":restock_list_id": restockListId,
            ":product_id": suggestion.productId,
            ":suggested_qty": suggestion.suggestedQty,
            ":edited_qty": suggestion.suggestedQty,
            ":unit": suggestion.unit,
            ":created_at": now,
            ":updated_at": ts,
          }
        );
      });
    });
    await calculateRestockBudget(restockListId);
  }

  const list = await getActiveRestockList(storeId, restockListId);
  if (!list) throw new Error("Failed to create restock list.");
  return list;
}

export async function getActiveRestockList(
  storeId: string,
  preferredRestockListId?: string
): Promise<RestockListRecord | null> {
  const scope = requireScopedStore(storeId);
  const row = preferredRestockListId
    ? await queryOne<any>(
        `SELECT * FROM restock_lists
         WHERE id = :id
           AND account_id = :account_id
           AND store_id = :store_id
           AND status IN ('draft', 'partial', 'draft_complete')
         LIMIT 1`,
        {
          ...scopeParams(scope),
          ":id": preferredRestockListId,
        }
      )
    : await queryOne<any>(
        `SELECT * FROM restock_lists
         WHERE account_id = :account_id
           AND store_id = :store_id
           AND status IN ('draft', 'partial', 'draft_complete')
         ORDER BY created_at DESC
         LIMIT 1`,
        scopeParams(scope)
      );
  if (!row) return null;
  const items = await getRestockItemsByList(scope, String(row.id));
  return mapRestockList(row, items);
}

export async function addProductToRestockList(
  restockListId: string,
  productId: string,
  qty: number,
  unit: string
): Promise<RestockListItem> {
  const scope = requireScopedStore();
  const list = await getRestockListById(scope, restockListId);
  if (!list) throw new Error("Restock list not found.");

  const product = await getProductCostRow(scope, productId);
  if (!product) throw new Error("Product not found for restock.");

  const normalizedQty = Math.max(0, toNumber(qty));
  const normalizedUnit = unit || product.unit || "piece";
  const estimate = await resolveEstimatedUnitCost(scope, product, normalizedUnit, list.supplier_id);
  const existing = await queryOne<any>(
    `SELECT id
     FROM restock_items
     WHERE restock_list_id = :restock_list_id
       AND account_id = :account_id
       AND store_id = :store_id
       AND product_id = :product_id
     LIMIT 1`,
    {
      ...scopeParams(scope),
      ":restock_list_id": restockListId,
      ":product_id": String(productId),
    }
  );
  const ts = nowMs();

  if (existing) {
    await run(
      `UPDATE restock_items
       SET edited_qty = :edited_qty,
           unit = :unit,
           estimated_unit_cost = :estimated_unit_cost,
           updated_at = :updated_at,
           sync_status = 'pending',
           is_dirty = 1
       WHERE id = :id
         AND account_id = :account_id
         AND store_id = :store_id`,
      {
        ...scopeParams(scope),
        ":id": String(existing.id),
        ":edited_qty": normalizedQty,
        ":unit": normalizedUnit,
        ":estimated_unit_cost": estimate.cost,
        ":updated_at": ts,
      }
    );
    await refreshRestockListEstimatedTotal(scope, restockListId);
    const updated = await queryOne<any>(
      `SELECT
         ri.*,
         p.name as product_name,
         p.emoji as product_emoji
       FROM restock_items ri
       LEFT JOIN products p
         ON CAST(p.id AS TEXT) = ri.product_id
        AND p.account_id = ri.account_id
        AND p.store_id = ri.store_id
       WHERE ri.id = :id
         AND ri.account_id = :account_id
         AND ri.store_id = :store_id
       LIMIT 1`,
      {
        ...scopeParams(scope),
        ":id": String(existing.id),
      }
    );
    if (!updated) throw new Error("Failed to update restock item.");
    return mapRestockItem(updated);
  }

  const itemId = makeId("ritm");
  const createdAt = nowIso();
  await run(
    `INSERT INTO restock_items (
      id, restock_list_id, account_id, store_id, product_id,
      suggested_qty, edited_qty, purchased_qty, unit,
      estimated_unit_cost, actual_unit_cost, is_checked, status,
      created_at, updated_at, sync_status, is_dirty
    ) VALUES (
      :id, :restock_list_id, :account_id, :store_id, :product_id,
      :suggested_qty, :edited_qty, 0, :unit,
      :estimated_unit_cost, 0, 0, 'draft',
      :created_at, :updated_at, 'pending', 1
    )`,
    {
      ...scopeParams(scope),
      ":id": itemId,
      ":restock_list_id": restockListId,
      ":product_id": String(productId),
      ":suggested_qty": normalizedQty,
      ":edited_qty": normalizedQty,
      ":unit": normalizedUnit,
      ":estimated_unit_cost": estimate.cost,
      ":created_at": createdAt,
      ":updated_at": ts,
    }
  );
  await refreshRestockListEstimatedTotal(scope, restockListId);
  return {
    id: itemId,
    restockListId,
    accountId: scope.accountId,
    storeId: scope.storeId,
    productId: String(productId),
    productName: product.name,
    productEmoji: product.emoji || "??",
    suggestedQty: normalizedQty,
    editedQty: normalizedQty,
    purchasedQty: 0,
    unit: normalizedUnit,
    estimatedUnitCost: estimate.cost,
    actualUnitCost: 0,
    estimatedItemTotal: normalizedQty * estimate.cost,
    actualItemTotal: 0,
    isChecked: false,
    status: "draft",
    createdAt,
    updatedAt: ts,
    syncStatus: "pending",
  };
}

export async function updateRestockItem(
  restockItemId: string,
  fields: UpdateRestockItemFields
): Promise<void> {
  const scope = requireScopedStore();
  const existing = await queryOne<{ restock_list_id: string }>(
    `SELECT restock_list_id
     FROM restock_items
     WHERE id = :id
       AND account_id = :account_id
       AND store_id = :store_id
     LIMIT 1`,
    {
      ...scopeParams(scope),
      ":id": restockItemId,
    }
  );
  if (!existing) throw new Error("Restock item not found.");

  const sets: string[] = [];
  const params: Record<string, any> = {
    ...scopeParams(scope),
    ":id": restockItemId,
    ":updated_at": nowMs(),
  };
  if (fields.suggestedQty !== undefined) {
    sets.push("suggested_qty = :suggested_qty");
    params[":suggested_qty"] = Math.max(0, toNumber(fields.suggestedQty));
  }
  if (fields.editedQty !== undefined) {
    sets.push("edited_qty = :edited_qty");
    params[":edited_qty"] = Math.max(0, toNumber(fields.editedQty));
  }
  if (fields.purchasedQty !== undefined) {
    sets.push("purchased_qty = :purchased_qty");
    params[":purchased_qty"] = Math.max(0, toNumber(fields.purchasedQty));
  }
  if (fields.unit !== undefined) {
    sets.push("unit = :unit");
    params[":unit"] = fields.unit || "piece";
  }
  if (fields.estimatedUnitCost !== undefined) {
    sets.push("estimated_unit_cost = :estimated_unit_cost");
    params[":estimated_unit_cost"] = Math.max(0, toNumber(fields.estimatedUnitCost));
  }
  if (fields.actualUnitCost !== undefined) {
    sets.push("actual_unit_cost = :actual_unit_cost");
    params[":actual_unit_cost"] = Math.max(0, toNumber(fields.actualUnitCost));
  }
  if (fields.isChecked !== undefined) {
    sets.push("is_checked = :is_checked");
    params[":is_checked"] = fields.isChecked ? 1 : 0;
  }
  if (fields.status !== undefined) {
    sets.push("status = :status");
    params[":status"] = fields.status;
  }
  if (!sets.length) return;

  await run(
    `UPDATE restock_items
     SET ${sets.join(", ")},
         updated_at = :updated_at,
         sync_status = 'pending',
         is_dirty = 1
     WHERE id = :id
       AND account_id = :account_id
       AND store_id = :store_id`,
    params
  );
  await refreshRestockListEstimatedTotal(scope, String(existing.restock_list_id));
}

export async function removeRestockItem(restockItemId: string): Promise<void> {
  const scope = requireScopedStore();
  const row = await queryOne<{ restock_list_id: string }>(
    `SELECT restock_list_id
     FROM restock_items
     WHERE id = :id
       AND account_id = :account_id
       AND store_id = :store_id
     LIMIT 1`,
    {
      ...scopeParams(scope),
      ":id": restockItemId,
    }
  );
  if (!row) return;
  await run(
    `DELETE FROM restock_items
     WHERE id = :id
       AND account_id = :account_id
       AND store_id = :store_id`,
    {
      ...scopeParams(scope),
      ":id": restockItemId,
    }
  );
  await refreshRestockListEstimatedTotal(scope, String(row.restock_list_id));
}

export async function assignSupplierToRestockList(restockListId: string, supplierId: string): Promise<void> {
  const scope = requireScopedStore();
  const list = await getRestockListById(scope, restockListId);
  if (!list) throw new Error("Restock list not found.");
  await run(
    `UPDATE restock_lists
     SET supplier_id = :supplier_id,
         updated_at = :updated_at,
         sync_status = 'pending',
         is_dirty = 1
     WHERE id = :id
       AND account_id = :account_id
       AND store_id = :store_id`,
    {
      ...scopeParams(scope),
      ":id": restockListId,
      ":supplier_id": supplierId || null,
      ":updated_at": nowMs(),
    }
  );
  await calculateRestockBudget(restockListId);
}

export async function calculateRestockBudget(restockListId: string): Promise<RestockBudgetSummary> {
  const scope = requireScopedStore();
  const list = await getRestockListById(scope, restockListId);
  if (!list) throw new Error("Restock list not found.");

  const items = await getRestockItemsByList(scope, restockListId);
  const updates: Array<{ id: string; estimatedUnitCost: number }> = [];
  const budgetItems: RestockBudgetItem[] = [];

  for (const item of items) {
    const product = await getProductCostRow(scope, item.productId);
    if (!product) {
      budgetItems.push({
        restockItemId: item.id,
        productId: item.productId,
        unit: item.unit,
        editedQty: item.editedQty,
        estimatedUnitCost: 0,
        estimatedItemTotal: 0,
        source: "none",
        missingPrice: true,
      });
      updates.push({ id: item.id, estimatedUnitCost: 0 });
      continue;
    }
    const estimate = await resolveEstimatedUnitCost(scope, product, item.unit, list.supplier_id);
    updates.push({ id: item.id, estimatedUnitCost: estimate.cost });
    budgetItems.push({
      restockItemId: item.id,
      productId: item.productId,
      unit: item.unit,
      editedQty: item.editedQty,
      estimatedUnitCost: estimate.cost,
      estimatedItemTotal: item.editedQty * estimate.cost,
      source: estimate.source,
      missingPrice: estimate.cost <= 0,
    });
  }

  const ts = nowMs();
  await runTransaction(db => {
    updates.forEach(update => {
      db.run(
        `UPDATE restock_items
         SET estimated_unit_cost = :estimated_unit_cost,
             updated_at = :updated_at,
             sync_status = 'pending',
             is_dirty = 1
         WHERE id = :id
           AND account_id = :account_id
           AND store_id = :store_id`,
        {
          ...scopeParams(scope),
          ":id": update.id,
          ":estimated_unit_cost": update.estimatedUnitCost,
          ":updated_at": ts,
        }
      );
    });
  });

  const estimatedTotal = budgetItems.reduce((sum, item) => sum + item.estimatedItemTotal, 0);
  const missingPriceCount = budgetItems.filter(item => item.missingPrice).length;

  await run(
    `UPDATE restock_lists
     SET estimated_total = :estimated_total,
         updated_at = :updated_at,
         sync_status = 'pending',
         is_dirty = 1
     WHERE id = :id
       AND account_id = :account_id
       AND store_id = :store_id`,
    {
      ...scopeParams(scope),
      ":id": restockListId,
      ":estimated_total": estimatedTotal,
      ":updated_at": ts,
    }
  );

  return {
    restockListId,
    estimatedTotal,
    missingPriceCount,
    items: budgetItems,
  };
}

export async function confirmRestockList(
  restockListId: string,
  actualCostsByItem: ConfirmRestockInput
): Promise<ConfirmRestockResult> {
  const scope = requireScopedStore();
  const list = await getRestockListById(scope, restockListId);
  if (!list) throw new Error("Restock list not found.");

  const confirmedItemIds: string[] = [];
  let confirmedTotal = 0;
  const ts = nowMs();
  const now = nowIso();

  await runTransaction(db => {
    const restockItems = execRows(
      db as any,
      `SELECT *
       FROM restock_items
       WHERE restock_list_id = :restock_list_id
         AND account_id = :account_id
         AND store_id = :store_id`,
      {
        ...scopeParams(scope),
        ":restock_list_id": restockListId,
      }
    );

    for (const item of restockItems) {
      const isChecked = Number(item.is_checked || 0) === 1;
      if (!isChecked) continue;

      const itemId = String(item.id);
      const input = actualCostsByItem[itemId];
      const purchasedQty = toNumber(input?.purchasedQty ?? item.purchased_qty ?? item.edited_qty);
      const actualUnitCost = toNumber(input?.actualUnitCost ?? item.actual_unit_cost);
      if (purchasedQty <= 0) {
        throw new Error(`Purchased quantity must be greater than zero for item ${itemId}.`);
      }
      if (actualUnitCost <= 0) {
        throw new Error(`Actual unit cost is required for item ${itemId}.`);
      }

      const productRows = execRows(
        db as any,
        `SELECT
           CAST(id AS TEXT) as id,
           stock,
           cost,
           unit,
           conversion
         FROM products
         WHERE account_id = :account_id
           AND store_id = :store_id
           AND CAST(id AS TEXT) = :product_id
         LIMIT 1`,
        {
          ...scopeParams(scope),
          ":product_id": String(item.product_id),
        }
      );
      if (!productRows.length) {
        throw new Error(`Cannot confirm restock: product ${item.product_id} not found.`);
      }
      const product = productRows[0];
      const conversion = toNumber(product.conversion, 1) || 1;
      const productUnit = String(product.unit || "piece");
      const itemUnit = String(item.unit || productUnit);

      const oldStockBase = toNumber(product.stock);
      const oldCostSelling = toNumber(product.cost);
      const oldCostBase = oldCostSelling / unitFactor(productUnit, conversion);

      const purchasedQtyBase = toBaseUnits(purchasedQty, itemUnit, conversion);
      const purchasedCostBase = actualUnitCost / unitFactor(itemUnit, conversion);
      const newStockBase = oldStockBase + purchasedQtyBase;
      const newAvgCostBase =
        oldStockBase > 0
          ? ((oldStockBase * oldCostBase) + (purchasedQtyBase * purchasedCostBase)) / newStockBase
          : purchasedCostBase;
      const newAvgCostSelling = newAvgCostBase * unitFactor(productUnit, conversion);
      const itemTotal = purchasedQty * actualUnitCost;

      db.run(
        `UPDATE products
         SET stock = :stock,
             cost = :cost,
             updated_at = :updated_at,
             is_dirty = 1
         WHERE account_id = :account_id
           AND store_id = :store_id
           AND CAST(id AS TEXT) = :product_id`,
        {
          ...scopeParams(scope),
          ":product_id": String(item.product_id),
          ":stock": newStockBase,
          ":cost": newAvgCostSelling,
          ":updated_at": ts,
        }
      );

      db.run(
        `UPDATE restock_items
         SET purchased_qty = :purchased_qty,
             actual_unit_cost = :actual_unit_cost,
             status = 'confirmed',
             updated_at = :updated_at,
             sync_status = 'pending',
             is_dirty = 1
         WHERE id = :id
           AND account_id = :account_id
           AND store_id = :store_id`,
        {
          ...scopeParams(scope),
          ":id": itemId,
          ":purchased_qty": purchasedQty,
          ":actual_unit_cost": actualUnitCost,
          ":updated_at": ts,
        }
      );

      db.run(
        `INSERT INTO restock_history (
          id, account_id, store_id, product_id, supplier_id, quantity, unit, unit_cost,
          total_cost, restock_list_id, created_at, updated_at, sync_status, is_dirty
        ) VALUES (
          :id, :account_id, :store_id, :product_id, :supplier_id, :quantity, :unit, :unit_cost,
          :total_cost, :restock_list_id, :created_at, :updated_at, 'pending', 1
        )`,
        {
          ...scopeParams(scope),
          ":id": makeId("rhist"),
          ":product_id": String(item.product_id),
          ":supplier_id": list.supplier_id || null,
          ":quantity": purchasedQty,
          ":unit": itemUnit,
          ":unit_cost": actualUnitCost,
          ":total_cost": itemTotal,
          ":restock_list_id": restockListId,
          ":created_at": now,
          ":updated_at": ts,
        }
      );

      if (list.supplier_id) {
        db.run(
          `INSERT INTO supplier_prices (
            id, supplier_id, product_id, account_id, store_id, unit, price,
            created_at, updated_at, sync_status, is_dirty
          ) VALUES (
            :id, :supplier_id, :product_id, :account_id, :store_id, :unit, :price,
            :created_at, :updated_at, 'pending', 1
          )
          ON CONFLICT(supplier_id, product_id, unit, account_id, store_id) DO UPDATE SET
            price = excluded.price,
            updated_at = excluded.updated_at,
            sync_status = 'pending',
            is_dirty = 1`,
          {
            ...scopeParams(scope),
            ":id": makeId("sprc"),
            ":supplier_id": list.supplier_id,
            ":product_id": String(item.product_id),
            ":unit": itemUnit,
            ":price": actualUnitCost,
            ":created_at": now,
            ":updated_at": ts,
          }
        );
      }

      confirmedItemIds.push(itemId);
      confirmedTotal += itemTotal;
    }

    if (!confirmedItemIds.length) {
      throw new Error("No checked items found. Check purchased items before confirming.");
    }

    const nextStatus: RestockListStatus = "confirmed";

    db.run(
      `UPDATE restock_lists
       SET status = :status,
           confirmed_total = :confirmed_total,
           updated_at = :updated_at,
           sync_status = 'pending',
           is_dirty = 1
       WHERE id = :id
         AND account_id = :account_id
         AND store_id = :store_id`,
      {
        ...scopeParams(scope),
        ":id": restockListId,
        ":status": nextStatus,
        ":confirmed_total": confirmedTotal,
        ":updated_at": ts,
      }
    );
  });

  const refreshed = await getRestockListById(scope, restockListId);
  return {
    restockListId,
    confirmedTotal,
    status: (refreshed?.status || "partial") as RestockListStatus,
    confirmedItemIds,
  };
}

export async function getRestockHistory(storeId: string): Promise<RestockHistoryRecord[]> {
  const scope = requireScopedStore(storeId);
  const rows = await queryAll<any>(
    `SELECT
       h.*,
       p.name as product_name,
       p.emoji as product_emoji,
       s.name as supplier_name
     FROM restock_history h
     LEFT JOIN products p
       ON CAST(p.id AS TEXT) = h.product_id
      AND p.account_id = h.account_id
      AND p.store_id = h.store_id
     LEFT JOIN suppliers s
       ON s.id = h.supplier_id
      AND s.account_id = h.account_id
      AND s.store_id = h.store_id
     WHERE h.account_id = :account_id
       AND h.store_id = :store_id
     ORDER BY h.created_at DESC`,
    scopeParams(scope)
  );
  return rows.map(row => ({
    id: String(row.id),
    accountId: String(row.account_id),
    storeId: String(row.store_id),
    productId: String(row.product_id),
    productName: row.product_name || "Unknown Product",
    productEmoji: row.product_emoji || "??",
    supplierId: row.supplier_id ? String(row.supplier_id) : null,
    supplierName: row.supplier_name || null,
    quantity: toNumber(row.quantity),
    unit: row.unit || "piece",
    unitCost: toNumber(row.unit_cost),
    totalCost: toNumber(row.total_cost),
    restockListId: row.restock_list_id ? String(row.restock_list_id) : null,
    createdAt: row.created_at || "",
    syncStatus: (row.sync_status || "pending") as SyncStatus,
  }));
}

export async function getSuppliers(storeId: string): Promise<SupplierRecord[]> {
  const scope = requireScopedStore(storeId);
  const rows = await queryAll<any>(
    `SELECT *
     FROM suppliers
     WHERE account_id = :account_id
       AND store_id = :store_id
     ORDER BY name ASC`,
    scopeParams(scope)
  );
  return rows.map(row => ({
    id: String(row.id),
    accountId: String(row.account_id),
    storeId: String(row.store_id),
    name: row.name || "",
    location: row.location || "",
    contactNumber: row.contact_number || "",
    notes: row.notes || "",
    createdAt: row.created_at || "",
    updatedAt: toNumber(row.updated_at),
    syncStatus: (row.sync_status || "pending") as SyncStatus,
  }));
}

export async function createSupplier(data: CreateSupplierInput): Promise<SupplierRecord> {
  const scope = requireScopedStore(data.storeId);
  const id = data.id || makeId("sup");
  const createdAt = nowIso();
  const ts = nowMs();
  await run(
    `INSERT INTO suppliers (
      id, account_id, store_id, name, location, contact_number, notes,
      created_at, updated_at, sync_status, is_dirty
    ) VALUES (
      :id, :account_id, :store_id, :name, :location, :contact_number, :notes,
      :created_at, :updated_at, 'pending', 1
    )`,
    {
      ...scopeParams(scope),
      ":id": id,
      ":name": data.name.trim(),
      ":location": data.location || "",
      ":contact_number": data.contactNumber || "",
      ":notes": data.notes || "",
      ":created_at": createdAt,
      ":updated_at": ts,
    }
  );
  return {
    id,
    accountId: scope.accountId,
    storeId: scope.storeId,
    name: data.name.trim(),
    location: data.location || "",
    contactNumber: data.contactNumber || "",
    notes: data.notes || "",
    createdAt,
    updatedAt: ts,
    syncStatus: "pending",
  };
}

export async function getSupplierPrices(supplierId: string): Promise<SupplierPriceRecord[]> {
  const scope = requireScopedStore();
  const rows = await queryAll<any>(
    `SELECT *
     FROM supplier_prices
     WHERE supplier_id = :supplier_id
       AND account_id = :account_id
       AND store_id = :store_id
     ORDER BY updated_at DESC`,
    {
      ...scopeParams(scope),
      ":supplier_id": supplierId,
    }
  );
  return rows.map(row => ({
    id: String(row.id),
    supplierId: String(row.supplier_id),
    productId: String(row.product_id),
    accountId: String(row.account_id),
    storeId: String(row.store_id),
    unit: row.unit || "piece",
    price: toNumber(row.price),
    createdAt: row.created_at || "",
    updatedAt: toNumber(row.updated_at),
    syncStatus: (row.sync_status || "pending") as SyncStatus,
  }));
}

export async function saveSupplierPrice(data: SaveSupplierPriceInput): Promise<SupplierPriceRecord> {
  const scope = requireScopedStore(data.storeId);
  const id = data.id || makeId("sprc");
  const createdAt = nowIso();
  const ts = nowMs();
  await run(
    `INSERT INTO supplier_prices (
      id, supplier_id, product_id, account_id, store_id, unit, price,
      created_at, updated_at, sync_status, is_dirty
    ) VALUES (
      :id, :supplier_id, :product_id, :account_id, :store_id, :unit, :price,
      :created_at, :updated_at, 'pending', 1
    )
    ON CONFLICT(supplier_id, product_id, unit, account_id, store_id) DO UPDATE SET
      price = excluded.price,
      updated_at = excluded.updated_at,
      sync_status = 'pending',
      is_dirty = 1`,
    {
      ...scopeParams(scope),
      ":id": id,
      ":supplier_id": data.supplierId,
      ":product_id": String(data.productId),
      ":unit": data.unit || "piece",
      ":price": Math.max(0, toNumber(data.price)),
      ":created_at": createdAt,
      ":updated_at": ts,
    }
  );
  const row = await queryOne<any>(
    `SELECT *
     FROM supplier_prices
     WHERE supplier_id = :supplier_id
       AND product_id = :product_id
       AND unit = :unit
       AND account_id = :account_id
       AND store_id = :store_id
     LIMIT 1`,
    {
      ...scopeParams(scope),
      ":supplier_id": data.supplierId,
      ":product_id": String(data.productId),
      ":unit": data.unit || "piece",
    }
  );
  return {
    id: String(row?.id || id),
    supplierId: data.supplierId,
    productId: String(data.productId),
    accountId: scope.accountId,
    storeId: scope.storeId,
    unit: data.unit || "piece",
    price: Math.max(0, toNumber(data.price)),
    createdAt: row?.created_at || createdAt,
    updatedAt: toNumber(row?.updated_at, ts),
    syncStatus: (row?.sync_status || "pending") as SyncStatus,
  };
}
