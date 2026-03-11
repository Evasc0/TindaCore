import { isSupabaseConfigured, supabase } from "./supabaseClient";
import {
  getDirtyRows,
  getDataScope,
  markSynced,
  upsertRemote,
  latestUpdate,
  type Table,
} from "../services/databaseService";
import { getSyncMarker, setSyncMarker } from "../database/sqlite";

const defaultTables: Table[] = [
  "accounts",
  "stores",
  "store_settings",
  "products",
  "product_barcodes",
  "customers",
  "sales",
  "sale_items",
  "utang_records",
  "utang_payments",
  "pabili_orders",
  "expenses",
];

const isOnline = () => (typeof navigator !== "undefined" ? navigator.onLine : true);

const markerKey = (table: Table, accountId: string, storeId: string) => `${table}:${accountId}:${storeId}`;

function applyScopeFilter(query: any, table: Table, accountId: string, storeId: string) {
  if (table === "accounts") {
    return query.eq("id", accountId);
  }
  if (table === "stores") {
    return query.eq("id", storeId).eq("account_id", accountId);
  }
  if (table === "store_settings") {
    return query.eq("store_id", storeId);
  }
  return query.eq("account_id", accountId).eq("store_id", storeId);
}

export async function pushLocalChanges(tables: Table[] = defaultTables) {
  if (!supabase || !isOnline()) return { skipped: true };
  const scope = getDataScope();
  if (!scope) return { skipped: true };

  for (const table of tables) {
    const dirty = await getDirtyRows(table);
    if (!dirty.length) continue;
    const deduped = Array.from(new Map(dirty.map(row => [String(row.id), row])).values());
    const { error } = await supabase.from(table).upsert(deduped, { onConflict: "id" });
    if (error) throw error;
    await markSynced(table, deduped.map(r => String(r.id)));
    await setSyncMarker(markerKey(table, scope.accountId, scope.storeId), Date.now());
  }
  return { ok: true };
}

export async function pullRemoteChanges(tables: Table[] = defaultTables) {
  if (!supabase || !isOnline()) return { skipped: true };
  const scope = getDataScope();
  if (!scope) return { skipped: true };

  for (const table of tables) {
    const syncKey = markerKey(table, scope.accountId, scope.storeId);
    const marker = await getSyncMarker(syncKey);
    const localLatest = await latestUpdate(table);
    const since = Math.max(marker, localLatest);
    let query: any = supabase
      .from(table)
      .select("*")
      .gt("updated_at", since || 0);
    query = applyScopeFilter(query, table, scope.accountId, scope.storeId);
    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length) {
      const rows = data.map(row => ({ ...row, is_dirty: 0 }));
      await upsertRemote(table, rows);
    }
    await setSyncMarker(syncKey, Date.now());
  }
  return { ok: true };
}

async function syncTables(tables: Table[]) {
  if (!isSupabaseConfigured || !isOnline()) return { skipped: true };
  await pushLocalChanges(tables);
  await pullRemoteChanges(tables);
  return { ok: true };
}

export const syncProducts = () => syncTables(["products", "product_barcodes"]);
export const syncSales = () => syncTables(["sales", "sale_items"]);
export const syncCustomers = () => syncTables(["customers"]);
export const syncUtang = () => syncTables(["utang_records", "utang_payments"]);
export const syncExpenses = () => syncTables(["expenses"]);
export const syncPabili = () => syncTables(["pabili_orders"]);

export async function syncAll() {
  if (!isSupabaseConfigured) return { skipped: true };
  return syncTables(defaultTables);
}
