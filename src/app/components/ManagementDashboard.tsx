import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  Package, BarChart2, DollarSign, Users, RefreshCw, Settings,
  Star, ChevronRight, TrendingUp, ShoppingCart, AlertTriangle,
  Receipt, Clock, User, Zap, Crown, Shield
} from "lucide-react";
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useStore, canAccess } from "../context/StoreContext";
import { TierBadge } from "./TierComponents";

type HistoryTab = "all" | "cash" | "utang" | "gcash";

export function ManagementDashboard() {
  const navigate = useNavigate();
  const {
    sales, products, customers, getCustomerBalance, pabiliOrders,
    expenses, settings, t, getWeeklyRevenue, getWeeklyProfit, getSmartRestockSuggestions
  } = useStore();

  const isDark = settings.theme === "dark";
  const sub = settings.subscription;

  const [historyTab, setHistoryTab] = useState<HistoryTab>("all");
  const [activeSection, setActiveSection] = useState<"overview" | "history" | "helpers">("overview");

  const bg = isDark ? "#111827" : "#f9fafb";
  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  const sellingStock = (p: any) => {
    const factor =
      p.unit === "pack" || p.unit === "box"
        ? p.conversion || 1
        : p.unit === "kg" || p.unit === "liters"
        ? 1000
        : 1;
    const qty = (p.stock || 0) / factor;
    return p.unit === "kg" || p.unit === "liters" ? parseFloat(qty.toFixed(2)) : Math.floor(qty);
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter(s => s.date.startsWith(todayStr));
  const totalToday = todaySales.reduce((sum, s) => sum + s.total, 0);
  const weeklyRevenue = getWeeklyRevenue();
  const weeklyProfit = getWeeklyProfit();
  const lowStockCount = products.filter(p => sellingStock(p) > 0 && sellingStock(p) <= 5).length;
  const outOfStockCount = products.filter(p => sellingStock(p) === 0).length;
  const totalUtang = customers.reduce((sum, c) => sum + getCustomerBalance(c.id), 0);
  const restockSuggestions = getSmartRestockSuggestions();

  // 7-day chart
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split("T")[0];
    const amount = sales.filter(s => s.date.startsWith(ds)).reduce((sum, s) => sum + s.total, 0);
    const profit = sales.filter(s => s.date.startsWith(ds)).reduce((sum, s) =>
      sum + s.items.reduce((cs, item) => {
        const product = products.find(p => p.name === item.name);
        return cs + ((item.price - (product?.cost || item.price * 0.65)) * item.qty);
      }, 0), 0);
    return {
      day: d.toLocaleDateString("en-PH", { weekday: "short" }),
      revenue: amount,
      profit: Math.max(0, profit),
    };
  });

  // Helper accountability
  const helperSales: Record<string, { count: number; total: number }> = {};
  sales.filter(s => s.date >= new Date(Date.now() - 7 * 86400000).toISOString()).forEach(s => {
    const h = s.helperName || "Unknown";
    if (!helperSales[h]) helperSales[h] = { count: 0, total: 0 };
    helperSales[h].count++;
    helperSales[h].total += s.total;
  });

  // Filtered sales for history
  const filteredSales = sales.filter(s => {
    if (historyTab === "all") return true;
    return s.paymentType === historyTab;
  }).slice(0, 20);

  const managementSections = [
    {
      icon: Package,
      color: "#7c3aed",
      iconBg: isDark ? "#3b0764" : "#faf5ff",
      title: "Products & Inventory",
      desc: `${products.length} products • ${lowStockCount > 0 ? `${lowStockCount} low stock` : "Stock OK"}`,
      path: "/management/inventory",
      badge: outOfStockCount > 0 ? String(outOfStockCount) : null,
      badgeColor: "#ef4444",
      tier: null,
    },
    {
      icon: RefreshCw,
      color: "#16a34a",
      iconBg: isDark ? "#14532d" : "#f0fdf4",
      title: "Smart Restock",
      desc: restockSuggestions.length > 0
        ? `${restockSuggestions.length} items need restock`
        : "All stock healthy",
      path: "/management/restock",
      badge: restockSuggestions.length > 0 ? String(restockSuggestions.length) : null,
      badgeColor: "#f97316",
      tier: "premium" as const,
    },
    ...(settings.enableUtang ? [{
      icon: Users,
      color: "#d97706",
      iconBg: isDark ? "#451a03" : "#fef3c7",
      title: "Utang Management",
      desc: `₱${totalUtang.toFixed(0)} total outstanding`,
      path: "/management/utang",
      badge: customers.filter(c => getCustomerBalance(c.id) > 0).length > 0
        ? String(customers.filter(c => getCustomerBalance(c.id) > 0).length)
        : null,
      badgeColor: "#d97706",
      tier: null,
    }] : []),
    {
      icon: BarChart2,
      color: "#059669",
      iconBg: isDark ? "#064e3b" : "#ecfdf5",
      title: "Analytics",
      desc: "Sales trends & top products",
      path: "/management/analytics",
      badge: null,
      badgeColor: null,
      tier: "plus" as const,
    },
    {
      icon: DollarSign,
      color: "#d97706",
      iconBg: isDark ? "#451a03" : "#fefce8",
      title: "Financial Reports",
      desc: canAccess(sub, "premium") ? `Net: ₱${weeklyProfit.toFixed(0)} this week` : "P&L, COGS, Expenses",
      path: "/management/finance",
      badge: null,
      badgeColor: null,
      tier: "premium" as const,
    },
    {
      icon: Settings,
      color: "#6b7280",
      iconBg: isDark ? "#374151" : "#f9fafb",
      title: "Settings",
      desc: "Store profile, PIN, features",
      path: "/management/settings",
      badge: null,
      badgeColor: null,
      tier: null,
    },
    {
      icon: Star,
      color: "#d97706",
      iconBg: isDark ? "#451a03" : "#fef9c3",
      title: "Subscription",
      desc: `Current: ${sub.charAt(0).toUpperCase() + sub.slice(1)} Plan`,
      path: "/management/subscription",
      badge: null,
      badgeColor: null,
      tier: null,
    },
  ];

  return (
    <div className="flex flex-col" style={{ background: bg }}>
      {/* Dashboard Header */}
      <div style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)", paddingBottom: "24px" }}>
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-blue-300 text-xs">Management Dashboard</p>
              <h1 className="text-white font-black" style={{ fontSize: "20px" }}>{settings.storeName}</h1>
              <p className="text-blue-400 text-xs mt-0.5">
                {settings.ownerName} • <TierBadge tier={sub} size="xs" />
              </p>
            </div>
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              <Shield size={20} className="text-white" />
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 px-4 mt-2">
          {[
            { label: "Today's Sales", value: `₱${totalToday.toFixed(0)}`, sub: `${todaySales.length} txns`, color: "#60a5fa" },
            { label: "Weekly Revenue", value: `₱${weeklyRevenue.toFixed(0)}`, sub: "Last 7 days", color: "#34d399" },
            { label: "Weekly Profit", value: canAccess(sub, "premium") ? `₱${weeklyProfit.toFixed(0)}` : "Premium", sub: "Net income", color: "#fbbf24" },
          ].map(({ label, value, sub: s, color }) => (
            <div key={label} className="rounded-2xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.1)" }}>
              <p className="font-black text-sm" style={{ color }}>{value}</p>
              <p className="text-blue-200" style={{ fontSize: "9px" }}>{label}</p>
              <p className="text-blue-400" style={{ fontSize: "8px" }}>{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-nav tabs */}
      <div
        className="flex gap-1 px-4 py-2 -mt-1 flex-shrink-0"
        style={{ background: card, borderBottom: `1px solid ${cardBorder}` }}
      >
        {(["overview", "history", "helpers"] as const).map(sec => (
          <button
            key={sec}
            onClick={() => setActiveSection(sec)}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
            style={{
              background: activeSection === sec ? "#2563eb" : "transparent",
              color: activeSection === sec ? "#fff" : textMuted,
            }}
          >
            {sec === "overview" ? "Overview" : sec === "history" ? "Sales Log" : "Helpers"}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {/* ── OVERVIEW ── */}
        {activeSection === "overview" && (
          <div className="px-4 py-3 space-y-3 pb-4">
            {/* 7-day Chart */}
            <div className="rounded-2xl p-4 border" style={{ background: card, borderColor: cardBorder }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>7-Day Sales Trend</p>
                <TrendingUp size={14} className="text-blue-500" />
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="mgRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="mgProfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 8, fill: textMuted }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number, name: string) => [`₱${v.toFixed(0)}`, name === "revenue" ? "Revenue" : "Profit"]}
                    contentStyle={{ background: card, border: `1px solid ${cardBorder}`, borderRadius: "10px", fontSize: "10px", color: text }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fill="url(#mgRevGrad)" dot={false} />
                  {canAccess(sub, "premium") && (
                    <Area type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={2} fill="url(#mgProfGrad)" dot={false} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-3 mt-1">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span style={{ fontSize: "9px", color: textMuted }}>Revenue</span>
                </div>
                {canAccess(sub, "premium") && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span style={{ fontSize: "9px", color: textMuted }}>Profit</span>
                  </div>
                )}
              </div>
            </div>

            {/* Alerts Row */}
            {(lowStockCount > 0 || outOfStockCount > 0) && (
              <div className="rounded-2xl border p-3" style={{ background: isDark ? "#1c1208" : "#fffbeb", borderColor: isDark ? "#92400e" : "#fde68a" }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <p className="text-xs font-bold text-amber-600">Stock Alerts</p>
                </div>
                {outOfStockCount > 0 && (
                  <p className="text-xs text-red-500 font-semibold">🔴 {outOfStockCount} items OUT OF STOCK</p>
                )}
                {lowStockCount > 0 && (
                  <p className="text-xs text-amber-600 font-semibold">🟡 {lowStockCount} items LOW STOCK</p>
                )}
                <button
                  onClick={() => navigate("/management/restock")}
                  className="mt-2 text-xs font-bold text-amber-700 underline"
                >
                  View Restock Planner →
                </button>
              </div>
            )}

            {/* Management Sections Grid */}
            <div className="space-y-2">
              {managementSections.map(({ icon: Icon, color, iconBg, title, desc, path, badge, badgeColor, tier }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all active:scale-[0.98]"
                  style={{ background: card, borderColor: cardBorder }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                    style={{ background: iconBg }}
                  >
                    <Icon size={18} style={{ color }} />
                    {badge && (
                      <span
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ background: badgeColor!, fontSize: "9px" }}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm" style={{ color: text }}>{title}</p>
                      {tier && <TierBadge tier={tier} size="xs" />}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: textMuted }}>{desc}</p>
                  </div>
                  <ChevronRight size={16} style={{ color: textMuted, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── SALES HISTORY ── */}
        {activeSection === "history" && (
          <div className="px-4 py-3 pb-4">
            {/* Filter tabs */}
            <div className="flex gap-1.5 mb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {(["all", "cash", "utang", "gcash"] as HistoryTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setHistoryTab(tab)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-all"
                  style={{
                    background: historyTab === tab
                      ? tab === "utang" ? "#d97706" : tab === "gcash" ? "#7c3aed" : tab === "cash" ? "#16a34a" : "#2563eb"
                      : (isDark ? "#374151" : "#e5e7eb"),
                    color: historyTab === tab ? "#fff" : textMuted,
                  }}
                >
                  {tab === "all" ? "All" : tab === "cash" ? "💵 Cash" : tab === "utang" ? "📋 Utang" : "💙 GCash"}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ background: card, borderColor: cardBorder }}>
              {filteredSales.length === 0 ? (
                <div className="p-8 text-center">
                  <Receipt size={28} style={{ color: textMuted, margin: "0 auto 8px" }} />
                  <p className="text-sm" style={{ color: textMuted }}>No sales found</p>
                </div>
              ) : (
                filteredSales.map((sale, idx) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between px-4 py-3 border-b last:border-0"
                    style={{ borderColor: cardBorder }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: text }}>
                        {sale.items.map(i => i.name).join(", ").substring(0, 28)}
                        {sale.items.map(i => i.name).join(", ").length > 28 ? "…" : ""}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p style={{ fontSize: "10px", color: textMuted }}>
                          {new Date(sale.date).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {sale.helperName && (
                          <span className="flex items-center gap-0.5" style={{ fontSize: "10px", color: "#7c3aed" }}>
                            <User size={9} />{sale.helperName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p
                        className="font-bold text-sm"
                        style={{
                          color: sale.paymentType === "utang" ? "#d97706"
                            : sale.paymentType === "gcash" ? "#7c3aed" : "#16a34a"
                        }}
                      >
                        ₱{sale.total}
                      </p>
                      <p
                        className="rounded-full px-1.5 py-0.5 inline-block font-bold"
                        style={{
                          fontSize: "8px",
                          background: sale.paymentType === "utang" ? (isDark ? "#451a03" : "#fef3c7")
                            : sale.paymentType === "gcash" ? (isDark ? "#3b0764" : "#faf5ff")
                            : (isDark ? "#14532d" : "#f0fdf4"),
                          color: sale.paymentType === "utang" ? "#d97706"
                            : sale.paymentType === "gcash" ? "#7c3aed" : "#16a34a",
                        }}
                      >
                        {sale.paymentType.toUpperCase()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── HELPERS ── */}
        {activeSection === "helpers" && (
          <div className="px-4 py-3 pb-4">
            <div
              className="rounded-2xl p-3 mb-3 flex items-center gap-2"
              style={{ background: isDark ? "#1e3a5f" : "#eff6ff", border: "1px solid #bfdbfe" }}
            >
              <Shield size={14} className="text-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-700" style={{ color: isDark ? "#93c5fd" : "#1e40af" }}>
                Helper accountability — track who sold what in the last 7 days.
              </p>
            </div>

            <div className="space-y-2">
              {Object.entries(helperSales).length === 0 ? (
                <div className="rounded-2xl p-8 border text-center" style={{ background: card, borderColor: cardBorder }}>
                  <User size={28} style={{ color: textMuted, margin: "0 auto 8px" }} />
                  <p className="text-sm" style={{ color: textMuted }}>No helper data yet</p>
                </div>
              ) : (
                Object.entries(helperSales)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([helperName, data]) => (
                    <div
                      key={helperName}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border"
                      style={{ background: card, borderColor: cardBorder }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm"
                        style={{ background: isDark ? "#1e3a8a" : "#eff6ff", color: "#2563eb" }}
                      >
                        {helperName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm" style={{ color: text }}>{helperName}</p>
                        <p className="text-xs" style={{ color: textMuted }}>{data.count} sales this week</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-green-600">₱{data.total.toFixed(0)}</p>
                        <p className="text-xs" style={{ color: textMuted }}>collected</p>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div
              className="mt-3 rounded-2xl p-4 border"
              style={{ background: isDark ? "#1c1208" : "#fffbeb", borderColor: isDark ? "#92400e" : "#fde68a" }}
            >
              <p className="text-xs font-bold text-amber-600 mb-1">💡 Tip</p>
              <p className="text-xs" style={{ color: isDark ? "#fbbf24" : "#92400e" }}>
                Ask helpers to enter their name when starting their shift. Go to Operating Mode → the seller's name will be tracked per transaction.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
