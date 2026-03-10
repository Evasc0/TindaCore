import { isSupabaseConfigured, supabase } from "./supabaseClient";
import {
  getDirtyRows,
  markSynced,
  upsertRemote,
  latestUpdate,
  type Table,
} from "../services/databaseService";
import { getSyncMarker, setSyncMarker } from "../database/sqlite";

const defaultTables: Table[] = [
  "products",
  "customers",
  "sales",
  "sale_items",
  "utang_records",
  "utang_payments",
  "pabili_orders",
  "expenses",
  "settings",
];

const isOnline = () => (typeof navigator !== "undefined" ? navigator.onLine : true);

export async function pushLocalChanges(tables: Table[] = defaultTables) {
  if (!supabase || !isOnline()) return { skipped: true };
  for (const table of tables) {
    const dirty = await getDirtyRows(table);
    if (!dirty.length) continue;
    const { error } = await supabase.from(table).upsert(dirty, { onConflict: "id" });
    if (error) throw error;
    await markSynced(table, dirty.map(r => r.id));
    await setSyncMarker(table, Date.now());
  }
  return { ok: true };
}

export async function pullRemoteChanges(tables: Table[] = defaultTables) {
  if (!supabase || !isOnline()) return { skipped: true };
  for (const table of tables) {
    const marker = await getSyncMarker(table);
    const localLatest = await latestUpdate(table);
    const since = Math.max(marker, localLatest);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .gt("updated_at", since || 0);
    if (error) throw error;
    if (data && data.length) {
      const rows = data.map(row => ({ ...row, is_dirty: 0 }));
      await upsertRemote(table, rows);
    }
    await setSyncMarker(table, Date.now());
  }
  return { ok: true };
}

async function syncTables(tables: Table[]) {
  if (!isSupabaseConfigured || !isOnline()) return { skipped: true };
  await pushLocalChanges(tables);
  await pullRemoteChanges(tables);
  return { ok: true };
}

export const syncProducts = () => syncTables(["products"]);
export const syncSales = () => syncTables(["sales", "sale_items"]);
export const syncCustomers = () => syncTables(["customers"]);
export const syncUtang = () => syncTables(["utang_records", "utang_payments"]);
export const syncExpenses = () => syncTables(["expenses"]);
export const syncPabili = () => syncTables(["pabili_orders"]);

export async function syncAll() {
  if (!isSupabaseConfigured) return { skipped: true };
  return syncTables(defaultTables);
}
