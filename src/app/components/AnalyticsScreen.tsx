import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { TrendingUp, ShoppingBag, Users, DollarSign, TrendingDown, Zap, AlertTriangle } from "lucide-react";
import { useStore, canAccess, Product } from "../context/StoreContext";
import { TierBadge, TierGate, SectionHeader } from "./TierComponents";

type Period = "today" | "week" | "all";
const COLORS = ["#2563eb", "#7c3aed", "#d97706", "#16a34a", "#dc2626", "#06b6d4"];

export function AnalyticsScreen() {
  const {
    sales, customers, getCustomerBalance, products, settings, t,
    getProductAnalytics, getSmartRestockSuggestions,
    getHourlySales, getDailySales, getWeeklyTrends,
    getTopSellingProducts, getProductProfitability, getLeastProfitable,
    getCommunityInsights, getBenchmarkSnapshot,
  } = useStore();
  const isDark = settings.theme === "dark";
  const sub = settings.subscription;

  const [period, setPeriod] = useState<Period>("week");

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  const sellingStock = (p: Product) => {
    const factor =
      p.unit === "pack" || p.unit === "box"
        ? p.conversion || 1
        : p.unit === "kg" || p.unit === "liters"
        ? 1000
        : 1;
    const qty = (p.stock || 0) / factor;
    return p.unit === "kg" || p.unit === "liters" ? parseFloat(qty.toFixed(2)) : Math.floor(qty);
  };

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const canAdvanced = canAccess(sub, "plus");
  const canPremium = canAccess(sub, "premium");

  const filteredSales = sales.filter(s => {
    if (period === "today") return s.date.startsWith(todayStr);
    if (period === "week") return new Date(s.date) >= weekAgo;
    return true;
  });

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const cashSales = filteredSales.filter(s => s.paymentType === "cash").reduce((sum, s) => sum + s.total, 0);
  const utangSales = filteredSales.filter(s => s.paymentType === "utang").reduce((sum, s) => sum + s.total, 0);
  const gcashSales = filteredSales.filter(s => s.paymentType === "gcash").reduce((sum, s) => sum + s.total, 0);
  const totalUtang = customers.reduce((sum, c) => sum + getCustomerBalance(c.id), 0);
  const txCount = filteredSales.length;

  // 7-day chart
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split("T")[0];
    const amount = sales.filter(s => s.date.startsWith(ds)).reduce((sum, s) => sum + s.total, 0);
    return { day: d.toLocaleDateString("en-PH", { weekday: "short" }), amount };
  });

  const hourlyChartData = getHourlySales().map(h => ({
    hour: `${h.hour.toString().padStart(2, "0")}:00`,
    amount: (h as any).totalSales ?? (h as any).total ?? 0,
    tx: (h as any).numberOfTransactions ?? 0,
  }));

  const weeklyTrendData = getWeeklyTrends(4);

  const productProfitability = getProductProfitability(5);
  const leastProfitable = getLeastProfitable(5);

  const productAnalytics = getProductAnalytics(period);
  const topSelling = productAnalytics.slice(0, 5);
  const fastestMoving = [...productAnalytics].sort((a, b) => b.avgDaily - a.avgDaily).slice(0, 5);
  const slowMoving = productAnalytics.filter(p => p.qty > 0).sort((a, b) => a.avgDaily - b.avgDaily).slice(0, 5);
  const predictedLowStock = getSmartRestockSuggestions().slice(0, 5);
  const communityInsights = getCommunityInsights().slice(0, 3);
  const benchmark = getBenchmarkSnapshot();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="rounded-xl px-3 py-2 border" style={{ background: card, borderColor: cardBorder }}>
          <p className="text-xs" style={{ color: textMuted }}>{label}</p>
          <p className="font-bold text-blue-500">₱{payload[0].value?.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  const periodOptions: { key: Period; label: string }[] = [
    { key: "today", label: t.today },
    { key: "week", label: t.week },
    { key: "all", label: t.allTime },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #052e16 0%, #065f46 60%, #059669 100%)" }} className="px-4 pt-4 pb-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-white font-bold" style={{ fontSize: "20px" }}>{t.analytics}</h2>
            <p className="text-green-300 text-xs mt-0.5">{t.last7Days}</p>
          </div>
          <TierBadge tier={canAccess(sub, "premium") ? "premium" : canAccess(sub, "plus") ? "plus" : "free"} size="sm" />
        </div>
        <div className="flex gap-2">
          {periodOptions.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: period === key ? "#ffffff" : "rgba(255,255,255,0.2)",
                color: period === key ? "#065f46" : "#ffffff",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: t.totalRevenue, value: `₱${totalRevenue.toFixed(2)}`, sub: `${txCount} tx`, icon: TrendingUp, color: "#2563eb", iconBg: isDark ? "#1e3a8a" : "#eff6ff" },
            { label: t.cashSales, value: `₱${cashSales.toFixed(2)}`, sub: `${filteredSales.filter(s => s.paymentType === "cash").length} tx`, icon: DollarSign, color: "#16a34a", iconBg: isDark ? "#14532d" : "#f0fdf4" },
            { label: "GCash Sales", value: `₱${gcashSales.toFixed(2)}`, sub: `${filteredSales.filter(s => s.paymentType === "gcash").length} tx`, icon: Zap, color: "#7c3aed", iconBg: isDark ? "#3b0764" : "#faf5ff" },
            { label: t.pendingUtangReport, value: `₱${totalUtang.toFixed(2)}`, sub: `${customers.filter(c => getCustomerBalance(c.id) > 0).length} cust`, icon: Users, color: "#d97706", iconBg: isDark ? "#451a03" : "#fef3c7" },
          ].map(({ label, value, sub: subText, icon: Icon, color, iconBg }) => (
            <div key={label} className="rounded-2xl p-4 border" style={{ background: card, borderColor: cardBorder }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <span className="text-xs truncate" style={{ color: textMuted }}>{label}</span>
              </div>
              <p className="font-black" style={{ fontSize: "17px", color: text }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>{subText}</p>
            </div>
          ))}
        </div>

        {/* 7-day chart */}
        <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
          <SectionHeader title={t.earningsPerDay} />
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: textMuted }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="amount" stroke="#059669" strokeWidth={2.5} fill="url(#analyticsGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly sales */}
        {canAdvanced ? (
          <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
            <SectionHeader title={t.earningsPerHour} tier="plus" />
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={hourlyChartData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: textMuted }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] mt-1" style={{ color: textMuted }}>Transactions: {hourlyChartData.reduce((s, h) => s + (h.tx || 0), 0)}</p>
          </div>
        ) : (
          <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
            <SectionHeader title={t.earningsPerHour} tier="plus" />
            <TierGate required="plus" featureName={t.earningsPerHour} compact />
          </div>
        )}

        {/* Weekly trends */}
        {canAdvanced ? (
          <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
            <SectionHeader title="Weekly Trends" tier="plus" />
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={weeklyTrendData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: textMuted }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="totalSales" stroke="#2563eb" strokeWidth={2.5} fill="url(#weeklyGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[11px] mt-1" style={{ color: textMuted }}>Avg ticket PHP{weeklyTrendData.length ? weeklyTrendData[weeklyTrendData.length - 1].averageTicket.toFixed(2) : "0.00"}</p>
          </div>
        ) : (
          <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
            <SectionHeader title="Weekly Trends" tier="plus" />
            <TierGate required="plus" featureName="Weekly analytics" compact />
          </div>
        )}

        {/* Top Selling */}
        <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
          <SectionHeader title={t.topSelling} />
          {topSelling.map((item, idx) => (
            <div key={item.name} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: cardBorder }}>
              <span className="text-xs font-bold w-5 text-center" style={{ color: textMuted }}>#{idx + 1}</span>
              <span className="text-lg">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: text }}>{item.name}</p>
                <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: isDark ? "#374151" : "#f3f4f6" }}>
                  <div className="h-full rounded-full" style={{ width: `${topSelling[0].revenue > 0 ? (item.revenue / topSelling[0].revenue * 100) : 0}%`, background: COLORS[idx] }} />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-sm" style={{ color: text }}>₱{item.revenue.toFixed(0)}</p>
                <p className="text-xs" style={{ color: textMuted }}>{item.qty} pcs</p>
              </div>
            </div>
          ))}
        </div>

        {/* Fastest Moving - Plus+ */}
        {canAccess(sub, "plus") ? (
          <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
            <SectionHeader title={t.fastestMoving} tier="plus" />
            {fastestMoving.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: cardBorder }}>
                <span className="text-lg">{item.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: text }}>{item.name}</p>
                  <p className="text-xs" style={{ color: textMuted }}>{item.avgDaily.toFixed(1)} {t.avgDailySales.toLowerCase()}</p>
                </div>
                <div
                  className="px-2 py-1 rounded-full text-xs font-bold"
                  style={{ background: isDark ? "#1e3a8a" : "#eff6ff", color: "#2563eb" }}
                >
                  {item.qty} sold
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-4">
            <TierGate required="plus" featureName={t.fastestMoving} compact />
          </div>
        )}

        {/* Predicted Low Stock - Plus+ */}
        {canAccess(sub, "plus") ? (
          <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
            <SectionHeader title={t.predictedLowStock} tier="plus" />
            {predictedLowStock.length === 0 ? (
              <p className="text-sm text-center py-2" style={{ color: textMuted }}>All stock levels healthy!</p>
            ) : (
              predictedLowStock.map(s => {
                const currentStock = sellingStock(s.product);
                const daysLeft = s.avgDailySales > 0 ? Math.floor(currentStock / s.avgDailySales) : 999;
                return (
                  <div key={s.product.id} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: cardBorder }}>
                    <span className="text-lg">{s.product.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: text }}>{s.product.name}</p>
                      <p className="text-xs" style={{ color: textMuted }}>
                        {currentStock} left · {s.avgDailySales.toFixed(1)}/day
                      </p>
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-1 rounded-full"
                      style={{
                        background: daysLeft <= 2 ? (isDark ? "#450a0a" : "#fef2f2") : (isDark ? "#431407" : "#fff7ed"),
                        color: daysLeft <= 2 ? "#ef4444" : "#f97316",
                      }}
                    >
                      {daysLeft <= 0 ? "OUT" : `${daysLeft}d left`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="mb-4">
            <TierGate required="plus" featureName={t.predictedLowStock} compact />
          </div>
        )}

        {/* Profitability */}
        {canAdvanced ? (
          <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
            <SectionHeader title="Product Profitability" tier="plus" />
            {productProfitability.length === 0 ? (
              <p className="text-sm text-center py-2" style={{ color: textMuted }}>No sales yet</p>
            ) : (
              productProfitability.map(item => (
                <div key={item.productName || item.name} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: cardBorder }}>
                  <span className="text-lg">{(item as any).emoji || "📦"}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: text }}>{item.productName || item.name}</p>
                    <p className="text-xs" style={{ color: textMuted }}>Margin {((item.margin ?? item.profitMargin) * 100).toFixed(1)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm" style={{ color: (item.grossProfit ?? item.profit ?? 0) >= 0 ? "#16a34a" : "#ef4444" }}>PHP{(item.grossProfit ?? item.profit ?? 0).toFixed(2)}</p>
                    <p className="text-[11px]" style={{ color: textMuted }}>PHP{item.totalRevenue?.toFixed?.(0) ?? item.revenue?.toFixed?.(0) ?? "0"} sales</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="mb-4">
            <TierGate required="plus" featureName="Profitability analytics" compact />
          </div>
        )}

        {/* Least profitable */}
        {canAdvanced ? (
          <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
            <SectionHeader title="Least Profitable" tier="plus" />
            {leastProfitable.length === 0 ? (
              <p className="text-sm text-center py-2" style={{ color: textMuted }}>No sales yet</p>
            ) : (
              leastProfitable.map(item => (
                <div key={(item as any).productId || item.productName || item.name} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: cardBorder }}>
                  <span className="text-lg">{(item as any).emoji || "⚠️"}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: text }}>{item.productName || item.name}</p>
                    <p className="text-xs" style={{ color: textMuted }}>Margin {((item.margin ?? item.profitMargin) * 100).toFixed(1)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm" style={{ color: "#ef4444" }}>PHP{(item.grossProfit ?? item.profit ?? 0).toFixed(2)}</p>
                    <p className="text-[11px]" style={{ color: textMuted }}>PHP{item.totalRevenue?.toFixed?.(0) ?? item.revenue?.toFixed?.(0) ?? "0"} sales</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {/* Slow Moving - Premium */}
        {canAccess(sub, "premium") ? (
          <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
            <SectionHeader title={t.slowMoving} tier="premium" />
            {slowMoving.length === 0 ? (
              <p className="text-sm text-center py-2" style={{ color: textMuted }}>{t.noSlowMoving}</p>
            ) : (
              slowMoving.map(item => (
                <div key={item.name} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: cardBorder }}>
                  <span className="text-lg">{item.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: text }}>{item.name}</p>
                    <p className="text-xs" style={{ color: textMuted }}>{item.avgDaily.toFixed(2)}/day avg</p>
                  </div>
                  <div className="px-2 py-1 rounded-full text-xs font-bold" style={{ background: isDark ? "#431407" : "#fff7ed", color: "#f97316" }}>
                    slow
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="mb-4">
            <TierGate required="premium" featureName={t.slowMoving} compact />
          </div>
        )}

        {/* Community Insights - Premium */}
        {canPremium ? (
          <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
            <SectionHeader title="Community Insights" tier="premium" />
            {communityInsights.length === 0 ? (
              <p className="text-sm text-center py-2" style={{ color: textMuted }}>No community data yet</p>
            ) : (
              communityInsights.map(stat => (
                <div key={stat.productName} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: cardBorder }}>
                  <span className="text-lg">📊</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: text }}>{stat.productName}</p>
                    <p className="text-xs" style={{ color: textMuted }}>
                      {stat.totalSalesVolume} units · PHP{stat.averagePrice.toFixed(2)} avg
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: isDark ? "#1e3a8a" : "#e0e7ff", color: "#1d4ed8" }}>
                    {stat.totalStoresSelling} stores
                  </span>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="mb-4">
            <TierGate required="premium" featureName={t.communityDashboard} compact />
          </div>
        )}

        {/* Benchmark Analytics - Premium */}
        {canPremium ? (
          <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
            <SectionHeader title="Store Benchmark" tier="premium" />
            {benchmark.map(row => (
              <div key={row.metric} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: cardBorder }}>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: text }}>{row.metric}</p>
                  <p className="text-xs" style={{ color: textMuted }}>{row.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: row.direction === "above" ? "#16a34a" : row.direction === "below" ? "#ef4444" : text }}>
                    PHP{row.storeValue.toFixed(2)}
                  </p>
                  <p className="text-[11px]" style={{ color: textMuted }}>Peers: PHP{row.communityAverage.toFixed(2)}</p>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: row.direction === "above" ? "#dcfce7" : "#fef2f2", color: row.direction === "above" ? "#166534" : "#b91c1c" }}>
                  {row.delta >= 0 ? "+" : ""}{row.delta.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Recent Transactions */}
        <div className="rounded-2xl border overflow-hidden mb-4" style={{ background: card, borderColor: cardBorder }}>
          <SectionHeader title={t.transactions} />
          {filteredSales.length === 0 ? (
            <div className="py-8 text-center" style={{ color: textMuted }}>
              <ShoppingBag size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
              <p className="text-sm">{t.noSales}</p>
            </div>
          ) : (
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: cardBorder }}>
              {filteredSales.slice(0, 8).map(sale => (
                <div key={sale.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0" style={{ borderColor: cardBorder }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: text }}>
                      {sale.items.map(i => i.name).join(", ").substring(0, 22)}
                      {sale.items.map(i => i.name).join(", ").length > 22 ? "…" : ""}
                    </p>
                    <p className="text-xs" style={{ color: textMuted }}>
                      {new Date(sale.date).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                      {sale.customerName && ` · ${sale.customerName}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm" style={{ color: sale.paymentType === "utang" ? "#d97706" : sale.paymentType === "gcash" ? "#7c3aed" : "#16a34a" }}>
                      ₱{sale.total}
                    </p>
                    <p className="text-xs uppercase font-semibold" style={{ color: textMuted }}>{sale.paymentType}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ height: "8px" }} />
      </div>
    </div>
  );
}
