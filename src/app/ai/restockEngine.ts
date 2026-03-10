import { Product, Sale, Unit } from "../context/StoreContext";

export interface RestockSuggestion {
  product: Product;
  productId: string;
  productName: string;
  currentStock: number; // in selling units
  suggestedQuantity: number; // in selling units
  suggestedQty?: number; // backwards compatibility
  daysUntilStockout: number;
  averageDailySales: number; // in selling units
  avgDailySales?: number; // backwards compatibility
  estimatedCost: number;
}

export interface RestockOptions {
  lookbackDays?: number;
  bufferDays?: number;
  thresholdDays?: number;
}

const toBaseUnits = (product: Product, qty: number, unit?: Unit) => {
  const targetUnit = unit || product.unit;
  const factor =
    targetUnit === "pack" || targetUnit === "box"
      ? product.conversion || 1
      : targetUnit === "kg" || targetUnit === "liters"
      ? 1000
      : 1;
  return qty * factor;
};

const fromBaseUnits = (product: Product, baseQty: number) => {
  const factor =
    product.unit === "pack" || product.unit === "box"
      ? product.conversion || 1
      : product.unit === "kg" || product.unit === "liters"
      ? 1000
      : 1;
  const sellingQty = baseQty / factor;
  if (product.unit === "kg" || product.unit === "liters") {
    return parseFloat(sellingQty.toFixed(2));
  }
  return Math.max(0, Math.round(sellingQty));
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
  const lookbackDays = options.lookbackDays ?? 7;
  const bufferDays = options.bufferDays ?? 7; // aim to hold a week of stock
  const thresholdDays = options.thresholdDays ?? 3;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  const soldBase: Record<string, number> = {};
  sales
    .filter(s => new Date(s.timestamp || s.date) >= cutoff)
    .forEach(sale => {
      sale.items.forEach(item => {
        const product = matchProduct(products, item);
        if (!product) return;
        soldBase[product.id] = (soldBase[product.id] || 0) + toBaseUnits(product, item.qty, item.unit);
      });
    });

  return products
    .map(product => {
      const totalSoldBase = soldBase[product.id] || 0;
      const avgDailyBase = totalSoldBase / lookbackDays;
      const currentStockBase = product.stock || 0;
      const daysUntilStockout = avgDailyBase > 0 ? currentStockBase / avgDailyBase : Infinity;
      const desiredBase = avgDailyBase * bufferDays;
      const neededBase = Math.max(0, Math.ceil(desiredBase - currentStockBase));
      const suggestedQuantity = neededBase > 0 ? Math.max(1, fromBaseUnits(product, neededBase)) : 0;
      return {
        product,
        productId: product.id,
        productName: product.name,
        currentStock: fromBaseUnits(product, currentStockBase),
        suggestedQuantity,
        suggestedQty: suggestedQuantity,
        daysUntilStockout: Number(daysUntilStockout.toFixed(1)),
        averageDailySales: fromBaseUnits(product, avgDailyBase),
        avgDailySales: fromBaseUnits(product, avgDailyBase),
        estimatedCost: suggestedQuantity * (product.cost || 0),
      } as RestockSuggestion;
    })
    .filter(s => s.averageDailySales > 0 && s.daysUntilStockout < thresholdDays && s.suggestedQuantity > 0)
    .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout || b.averageDailySales - a.averageDailySales);
}
