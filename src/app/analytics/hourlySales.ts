import { Sale } from "../context/StoreContext";

export interface HourlySalesBucket {
  hour: number;
  totalSales: number;
  numberOfTransactions: number;
}

export interface DailySalesPoint {
  date: string; // YYYY-MM-DD
  totalSales: number;
  numberOfTransactions: number;
}

export interface WeeklyTrendPoint {
  label: string; // e.g., "Week 10"
  totalSales: number;
  averageTicket: number;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function groupSalesByHour(sales: Sale[], targetDate: Date = new Date()): HourlySalesBucket[] {
  const dayStart = startOfDay(targetDate).toISOString().split("T")[0];
  const buckets: HourlySalesBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    totalSales: 0,
    numberOfTransactions: 0,
  }));

  sales
    .filter(s => (s.timestamp || s.date).startsWith(dayStart))
    .forEach(sale => {
      const hour = new Date(sale.timestamp || sale.date).getHours();
      const bucket = buckets[hour];
      bucket.totalSales += sale.total;
      bucket.numberOfTransactions += 1;
    });

  return buckets;
}

export function aggregateDailySales(sales: Sale[], days: number = 7): DailySalesPoint[] {
  return Array.from({ length: days }, (_, idx) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - idx));
    const ds = d.toISOString().split("T")[0];
    const daySales = sales.filter(s => (s.timestamp || s.date).startsWith(ds));
    const totalSales = daySales.reduce((sum, s) => sum + s.total, 0);
    return {
      date: ds,
      totalSales,
      numberOfTransactions: daySales.length,
    };
  });
}

export function aggregateWeeklyTrends(sales: Sale[], weeks: number = 4): WeeklyTrendPoint[] {
  const now = new Date();
  const points: WeeklyTrendPoint[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(now);
    start.setDate(start.getDate() - (i * 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const label = `Week ${getWeekNumber(start)}`;
    const weekSales = sales.filter(s => {
      const dt = new Date(s.timestamp || s.date);
      return dt >= startOfDay(start) && dt <= end;
    });
    const totalSales = weekSales.reduce((sum, s) => sum + s.total, 0);
    const averageTicket = weekSales.length > 0 ? totalSales / weekSales.length : 0;
    points.push({ label, totalSales, averageTicket });
  }
  return points;
}

function getWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

