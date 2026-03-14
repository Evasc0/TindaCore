import type { Product, Sale, Unit } from "../context/StoreContext";

export interface RestockSuggestion {
  product: Product;
  productId: string;
  productName: string;
  unit: Unit;
  currentStock: number; // in display/selling unit
  currentStockBase: number; // in base unit
  suggestedQuantity: number; // in display/selling unit
  suggestedQty: number; // compatibility alias
  suggestedQtyBase: number; // in base unit
  targetStock: number; // in display/selling unit
  targetStockBase: number; // in base unit
  targetRestockDays: number;
  daysUntilStockout: number;
  averageDailySales: number; // in display/selling unit
  avgDailySales: number; // compatibility alias
  averageDailySalesBase: number; // in base unit
  estimatedCost: number;
  reason: "sales_velocity" | "low_stock_fallback";
}

export interface RestockOptions {
  lookbackDays?: number;
  targetRestockDays?: number;
  bufferDays?: number; // compatibility alias for targetRestockDays
  thresholdDays?: number;
  includeNoSalesFallback?: boolean;
  lowStockThreshold?: number; // in display/selling unit
}

const supportsFractionalUnit = (unit: string) => unit === "kg" || unit === "liters";

const toBaseUnits = (product: Product, qty: number, unit?: string) => {
  const targetUnit = unit || product.unit;
  const factor =
    targetUnit === "pack" || targetUnit === "box" || targetUnit === "case"
      ? product.conversion || 1
      : targetUnit === "kg" || targetUnit === "liters"
      ? 1000
      : 1;
  return Math.max(0, Number(qty || 0) * factor);
};

const fromBaseUnits = (product: Product, baseQty: number) => {
  const factor =
    product.unit === "pack" || product.unit === "box" || (product.unit as string) === "case"
      ? product.conversion || 1
      : product.unit === "kg" || product.unit === "liters"
      ? 1000
      : 1;
  const qty = Math.max(0, Number(baseQty || 0)) / factor;
  if (supportsFractionalUnit(product.unit)) {
    return Number(qty.toFixed(2));
  }
  return Math.max(0, Math.ceil(qty));
};

const fallbackThresholdInSellingUnit = (product: Product, override?: number) => {
  if (override !== undefined) return Math.max(0, Number(override || 0));
  if (product.unit === "kg" || product.unit === "liters") return 1;
  if (product.unit === "pack" || product.unit === "box") return 2;
  return 5;
};

const matchProduct = (products: Product[], item: Sale["items"][number]) => {
  return (
    products.find(p => p.id === item.productId) ||
    products.find(p => p.name.toLowerCase() === item.name.toLowerCase())
  );
};

export function generateRestockSuggestions(
  products: Product[],
  sales: Sale[],
  options: RestockOptions = {}
): RestockSuggestion[] {
  const lookbackDays = Math.max(1, options.lookbackDays ?? 7);
  const targetRestockDays = Math.max(1, options.targetRestockDays ?? options.bufferDays ?? 7);
  const thresholdDays = Math.max(0, options.thresholdDays ?? 7);
  const includeNoSalesFallback = options.includeNoSalesFallback ?? true;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  const soldBaseByProduct: Record<string, number> = {};
  sales
    .filter(sale => new Date(sale.timestamp || sale.date) >= cutoff)
    .forEach(sale => {
      sale.items.forEach(item => {
        const product = matchProduct(products, item);
        if (!product) return;
        soldBaseByProduct[product.id] =
          (soldBaseByProduct[product.id] || 0) + toBaseUnits(product, item.qty, item.unit);
      });
    });

  return products
    .map(product => {
      const currentStockBase = Math.max(0, Number(product.stock || 0));
      const totalSoldLastWindowBase = soldBaseByProduct[product.id] || 0;
      const averageDailySalesBase = totalSoldLastWindowBase / lookbackDays;
      const targetStockBase = averageDailySalesBase * targetRestockDays;
      let suggestedQtyBase = Math.max(0, targetStockBase - currentStockBase);
      let reason: RestockSuggestion["reason"] = "sales_velocity";

      if (averageDailySalesBase <= 0) {
        if (!includeNoSalesFallback) return null;
        const thresholdSellingQty = fallbackThresholdInSellingUnit(product, options.lowStockThreshold);
        const thresholdBaseQty = toBaseUnits(product, thresholdSellingQty);
        if (currentStockBase >= thresholdBaseQty) return null;
        suggestedQtyBase = Math.max(0, thresholdBaseQty - currentStockBase);
        reason = "low_stock_fallback";
      } else {
        const daysUntilStockout = currentStockBase / averageDailySalesBase;
        if (thresholdDays > 0 && daysUntilStockout > thresholdDays && suggestedQtyBase <= 0) {
          return null;
        }
      }

      if (suggestedQtyBase <= 0) return null;

      const suggestedQuantity = fromBaseUnits(product, suggestedQtyBase);
      if (suggestedQuantity <= 0) return null;

      const averageDailySales = fromBaseUnits(product, averageDailySalesBase);
      const targetStock = fromBaseUnits(product, targetStockBase);
      const daysUntilStockout = averageDailySalesBase > 0 ? currentStockBase / averageDailySalesBase : Infinity;

      const suggestion: RestockSuggestion = {
        product,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        currentStock: fromBaseUnits(product, currentStockBase),
        currentStockBase,
        suggestedQuantity,
        suggestedQty: suggestedQuantity,
        suggestedQtyBase,
        targetStock,
        targetStockBase,
        targetRestockDays,
        daysUntilStockout: Number.isFinite(daysUntilStockout) ? Number(daysUntilStockout.toFixed(1)) : Infinity,
        averageDailySales,
        avgDailySales: averageDailySales,
        averageDailySalesBase,
        estimatedCost: suggestedQuantity * Number(product.cost || 0),
        reason,
      };
      return suggestion;
    })
    .filter((item): item is RestockSuggestion => !!item)
    .sort((a, b) => {
      if (a.reason !== b.reason) {
        return a.reason === "sales_velocity" ? -1 : 1;
      }
      const aDays = Number.isFinite(a.daysUntilStockout) ? a.daysUntilStockout : 999999;
      const bDays = Number.isFinite(b.daysUntilStockout) ? b.daysUntilStockout : 999999;
      if (aDays !== bDays) return aDays - bDays;
      return b.averageDailySales - a.averageDailySales;
    });
}
