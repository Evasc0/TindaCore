import { Product, Sale } from "../context/StoreContext";
import { CommunityProductStats } from "./communityAnalytics";

export interface StorePerformance {
  metric: string;
  storeValue: number;
  communityAverage: number;
  delta: number;
  direction: "above" | "below" | "equal";
  description?: string;
}

interface BenchmarkOptions {
  recentDays?: number;
  communityWindowDays?: number;
  communityStats?: CommunityProductStats[];
}

const isWithinDays = (date: Date, days: number) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
};

const revenueSum = (sales: Sale[]) => sales.reduce((sum, s) => sum + s.total, 0);

const groupRevenueByCategory = (sales: Sale[], products: Product[]) => {
  const map: Record<string, number> = {};
  sales.forEach(s => {
    s.items.forEach(item => {
      const product = products.find(p => p.id === item.productId) || products.find(p => p.name === item.name);
      const category = product?.category || "Uncategorized";
      map[category] = (map[category] || 0) + item.price * item.qty;
    });
  });
  return map;
};

export function buildBenchmark(
  sales: Sale[],
  products: Product[],
  opts: BenchmarkOptions = {}
): StorePerformance[] {
  const recentDays = opts.recentDays ?? 7;
  const communityWindowDays = opts.communityWindowDays ?? 30;

  const recentSales = sales.filter(s => isWithinDays(new Date(s.timestamp || s.date), recentDays));
  const communityWindowSales = sales.filter(s => isWithinDays(new Date(s.timestamp || s.date), communityWindowDays));

  const storeDailyRevenue = recentSales.length > 0 ? revenueSum(recentSales) / recentDays : 0;

  const communityRevenue = opts.communityStats
    ? opts.communityStats.reduce((sum, s) => sum + s.totalRevenue, 0)
    : revenueSum(communityWindowSales);
  const communityStoreCount = opts.communityStats
    ? Math.max(1, Math.max(...opts.communityStats.map(s => s.totalStoresSelling || 1)))
    : 1;
  const communityAverageDaily = communityStoreCount > 0
    ? communityRevenue / communityStoreCount / communityWindowDays
    : 0;

  const storeAvgTicket = recentSales.length > 0 ? revenueSum(recentSales) / recentSales.length : 0;
  const communityAvgTicket = communityWindowSales.length > 0
    ? revenueSum(communityWindowSales) / communityWindowSales.length
    : storeAvgTicket;

  const categoryRecent = groupRevenueByCategory(recentSales, products);
  const categoryCommunity = groupRevenueByCategory(communityWindowSales, products);
  const topCategory = Object.entries(categoryRecent).sort((a, b) => b[1] - a[1])[0];
  const communityTopShare = topCategory
    ? (categoryCommunity[topCategory[0]] || 0) / Math.max(1, revenueSum(communityWindowSales))
    : 0;
  const storeTopShare = topCategory
    ? topCategory[1] / Math.max(1, revenueSum(recentSales))
    : 0;

  const metrics: StorePerformance[] = [
    {
      metric: "Daily revenue",
      storeValue: storeDailyRevenue,
      communityAverage: communityAverageDaily,
      delta: storeDailyRevenue - communityAverageDaily,
      direction: storeDailyRevenue > communityAverageDaily ? "above" : storeDailyRevenue < communityAverageDaily ? "below" : "equal",
      description: "Average revenue per day",
    },
    {
      metric: "Average transaction size",
      storeValue: storeAvgTicket,
      communityAverage: communityAvgTicket,
      delta: storeAvgTicket - communityAvgTicket,
      direction: storeAvgTicket > communityAvgTicket ? "above" : storeAvgTicket < communityAvgTicket ? "below" : "equal",
      description: "Revenue divided by transactions",
    },
    {
      metric: topCategory ? `${topCategory[0]} share` : "Top category share",
      storeValue: storeTopShare * 100,
      communityAverage: communityTopShare * 100,
      delta: (storeTopShare - communityTopShare) * 100,
      direction: storeTopShare > communityTopShare ? "above" : storeTopShare < communityTopShare ? "below" : "equal",
      description: "Revenue share of your strongest category",
    },
  ];

  return metrics;
}

