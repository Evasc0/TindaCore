import { Product, Sale } from "../context/StoreContext";

export interface CommunityProductStats {
  productName: string;
  totalStoresSelling: number;
  averagePrice: number;
  totalSalesVolume: number; // units
  totalRevenue: number;
}

export interface CommunityDataset {
  storeId: string;
  sales: Sale[];
  products?: Product[];
}

const matchProduct = (products: Product[] | undefined, item: Sale["items"][number]) => {
  if (!products) return undefined;
  return (
    products.find(p => p.id === item.productId) ||
    products.find(p => p.name.toLowerCase() === item.name.toLowerCase())
  );
};

export function computeCommunityProductStats(params: {
  sales: Sale[];
  products: Product[];
  storeId?: string;
  peers?: CommunityDataset[];
}): CommunityProductStats[] {
  const datasets: CommunityDataset[] = [
    { storeId: params.storeId || "local", sales: params.sales, products: params.products },
    ...(params.peers || []),
  ];

  const stats: Record<string, { stores: Set<string>; qty: number; revenue: number; priceAccumulator: number }> = {};

  datasets.forEach(dataset => {
    dataset.sales.forEach(sale => {
      sale.items.forEach(item => {
        const key = item.name.toLowerCase();
        const product = matchProduct(dataset.products, item);
        if (!stats[key]) {
          stats[key] = { stores: new Set(), qty: 0, revenue: 0, priceAccumulator: 0 };
        }
        stats[key].stores.add(dataset.storeId);
        const qty = item.qty;
        const price = item.price;
        stats[key].qty += qty;
        stats[key].revenue += price * qty;
        stats[key].priceAccumulator += price * qty;
      });
    });
  });

  return Object.entries(stats)
    .map(([name, data]) => ({
      productName: name,
      totalStoresSelling: data.stores.size,
      averagePrice: data.qty > 0 ? data.priceAccumulator / data.qty : 0,
      totalSalesVolume: data.qty,
      totalRevenue: data.revenue,
    }))
    .sort((a, b) => b.totalSalesVolume - a.totalSalesVolume);
}

