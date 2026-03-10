import { Product, Sale } from "../context/StoreContext";

export interface ProfitabilityRow {
  productId?: string;
  productName: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number; // 0-1
  unitsSold: number;
  profit?: number; // alias for UI compatibility
  margin?: number;
}

export interface ProfitabilityOptions {
  startDate?: Date;
  endDate?: Date;
}

const withinRange = (date: Date, opts: ProfitabilityOptions) => {
  if (opts.startDate && date < opts.startDate) return false;
  if (opts.endDate && date > opts.endDate) return false;
  return true;
};

export function computeProductProfitability(
  products: Product[],
  sales: Sale[],
  options: ProfitabilityOptions = {}
): ProfitabilityRow[] {
  const rows: Record<string, ProfitabilityRow> = {};

  sales.forEach(sale => {
    const saleDate = new Date(sale.timestamp || sale.date);
    if (!withinRange(saleDate, options)) return;

    sale.items.forEach(item => {
      const product = products.find(p => p.id === item.productId) || products.find(p => p.name === item.name);
      const key = product?.id || item.productId || item.name;
      const costPerUnit = product?.cost ?? item.cost ?? item.price * 0.65;
      const revenue = item.price * item.qty;
      const cost = costPerUnit * item.qty;
      if (!rows[key]) {
        rows[key] = {
          productId: product?.id || item.productId,
          productName: product?.name || item.name,
          totalRevenue: 0,
          totalCost: 0,
          grossProfit: 0,
          profitMargin: 0,
          unitsSold: 0,
        };
      }
      rows[key].totalRevenue += revenue;
      rows[key].totalCost += cost;
      rows[key].unitsSold += item.qty;
    });
  });

  return Object.values(rows)
    .map(r => ({
      ...r,
      grossProfit: r.totalRevenue - r.totalCost,
      profitMargin: r.totalRevenue > 0 ? (r.totalRevenue - r.totalCost) / r.totalRevenue : 0,
      profit: r.totalRevenue - r.totalCost,
      margin: r.totalRevenue > 0 ? (r.totalRevenue - r.totalCost) / r.totalRevenue : 0,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit);
}

export function topProfitable(products: Product[], sales: Sale[], limit = 5, opts?: ProfitabilityOptions) {
  return computeProductProfitability(products, sales, opts).slice(0, limit);
}

export function leastProfitable(products: Product[], sales: Sale[], limit = 5, opts?: ProfitabilityOptions) {
  return computeProductProfitability(products, sales, opts)
    .sort((a, b) => a.grossProfit - b.grossProfit)
    .slice(0, limit);
}
