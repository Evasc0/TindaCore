import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Minus, Plus, Share2, Download, Receipt, ChevronDown, Check } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useStore, canAccess } from "../context/StoreContext";
import { TierGate, UpgradeBanner, TierBadge } from "./TierComponents";

type Period = "week" | "month";

export function FinancialScreen() {
  const { sales, products, expenses, addExpense, settings, t } = useStore();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";
  const sub = settings.subscription;

  const [period, setPeriod] = useState<Period>("week");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState<"utilities" | "supplies" | "rent" | "other">("utilities");

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const cutoff = period === "week" ? weekStart : monthStart;

  const filteredSales = sales.filter(s => new Date(s.date) >= cutoff);
  const filteredExpenses = expenses.filter(e => new Date(e.date) >= cutoff);

  const revenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const cogs = filteredSales.reduce((sum, s) =>
    sum + s.items.reduce((cs, item) => {
      const p = products.find(x => x.name === item.name);
      return cs + (p?.cost || item.price * 0.65) * item.qty;
    }, 0), 0
  );
  const grossProfit = revenue - cogs;
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netIncome = grossProfit - totalExpenses;
  const grossMargin = revenue > 0 ? (grossProfit / revenue * 100) : 0;
  const netMargin = revenue > 0 ? (netIncome / revenue * 100) : 0;

  // Chart: daily revenue & profit for last 7 days
  const chartDays = period === "week" ? 7 : 30;
  const chartData = Array.from({ length: Math.min(chartDays, 14) }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (chartDays - 1 - i));
    if (d > now) return null;
    const ds = d.toISOString().split("T")[0];
    const dayRevenue = sales.filter(s => s.date.startsWith(ds)).reduce((sum, s) => sum + s.total, 0);
    const dayCOGS = sales.filter(s => s.date.startsWith(ds)).reduce((sum, s) =>
      sum + s.items.reduce((cs, item) => {
        const p = products.find(x => x.name === item.name);
        return cs + (p?.cost || item.price * 0.65) * item.qty;
      }, 0), 0
    );
    return {
      day: d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      revenue: dayRevenue,
      profit: dayRevenue - dayCOGS,
    };
  }).filter(Boolean) as { day: string; revenue: number; profit: number }[];

  // Expense breakdown
  const expByCategory = filteredExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const pnlItems = [
    { label: t.revenue, value: revenue, positive: true, indent: 0 },
    { label: t.cogs, value: -cogs, positive: false, indent: 1 },
    { label: t.grossProfit, value: grossProfit, positive: grossProfit >= 0, indent: 0, bold: true },
    { label: t.expenses, value: -totalExpenses, positive: false, indent: 1 },
    { label: t.netIncome, value: netIncome, positive: netIncome >= 0, indent: 0, bold: true, highlight: true },
  ];

  const handleAddExpense = () => {
    if (!expDesc || !expAmount) return;
    addExpense({
      date: new Date().toISOString().split("T")[0],
      name: expDesc,
      description: expDesc,
      amount: parseFloat(expAmount),
      category: expCategory,
    });
    setExpDesc(""); setExpAmount(""); setShowAddExpense(false);
  };

  if (!canAccess(sub, "premium")) {
    return (
      <div className="flex flex-col h-full" style={{ background: bg }}>
        <div style={{ background: "linear-gradient(160deg, #713f12 0%, #92400e 60%, #d97706 100%)" }} className="px-4 pt-4 pb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
              <ArrowLeft size={18} className="text-white" />
            </button>
            <h2 className="text-white font-bold" style={{ fontSize: "20px" }}>{t.financialStatements}</h2>
          </div>
        </div>
        <div className="flex-1 p-4 flex flex-col gap-4">
          <UpgradeBanner from={sub} to="premium" />
          <TierGate required="premium" featureName={t.financialStatements} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #713f12 0%, #92400e 60%, #d97706 100%)" }} className="px-4 pt-4 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate("/management/dashboard")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="flex-1">
            <h2 className="text-white font-bold" style={{ fontSize: "20px" }}>{t.financialStatements}</h2>
            <p className="text-amber-300 text-xs mt-0.5">{t.profitLoss}</p>
          </div>
          <TierBadge tier="premium" size="sm" />
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          {(["week", "month"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: period === p ? "#ffffff" : "rgba(255,255,255,0.2)",
                color: period === p ? "#92400e" : "#fde68a",
              }}
            >
              {p === "week" ? t.weeklyFinance : t.monthlyFinance}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: t.revenue, value: revenue, icon: TrendingUp, color: "#2563eb", bg: isDark ? "#1e3a8a" : "#eff6ff" },
            { label: t.grossProfit, value: grossProfit, icon: DollarSign, color: "#16a34a", bg: isDark ? "#14532d" : "#f0fdf4" },
            { label: t.expenses, value: totalExpenses, icon: TrendingDown, color: "#ef4444", bg: isDark ? "#450a0a" : "#fef2f2" },
            { label: t.netIncome, value: netIncome, icon: Receipt, color: netIncome >= 0 ? "#16a34a" : "#ef4444", bg: isDark ? "#14532d" : "#f0fdf4" },
          ].map(({ label, value, icon: Icon, color, bg: iconBg }) => (
            <div key={label} className="rounded-2xl p-4 border" style={{ background: card, borderColor: cardBorder }}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <span className="text-xs" style={{ color: textMuted }}>{label}</span>
              </div>
              <p className="font-black" style={{ fontSize: "18px", color: value < 0 ? "#ef4444" : color }}>
                {value < 0 ? "-" : ""}₱{Math.abs(value).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Margin indicators */}
        <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: textMuted }}>Margins</p>
          {[
            { label: "Gross Margin", value: grossMargin, color: "#16a34a" },
            { label: "Net Margin", value: netMargin, color: netMargin >= 0 ? "#2563eb" : "#ef4444" },
          ].map(({ label, value, color }) => (
            <div key={label} className="mb-3 last:mb-0">
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: textMuted }}>{label}</span>
                <span className="text-xs font-bold" style={{ color }}>{value.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? "#374151" : "#f3f4f6" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>

        {/* P&L Table */}
        <div className="rounded-2xl border overflow-hidden mb-4" style={{ background: card, borderColor: cardBorder }}>
          <div className="px-4 py-3" style={{ background: isDark ? "#374151" : "#f9fafb", borderBottom: `1px solid ${cardBorder}` }}>
            <p className="text-sm font-bold" style={{ color: text }}>{t.profitLoss} Statement</p>
          </div>
          {pnlItems.map(({ label, value, positive, indent, bold, highlight }) => (
            <div
              key={label}
              className="flex justify-between items-center px-4 py-3 border-b last:border-0"
              style={{
                borderColor: cardBorder,
                background: highlight ? (isDark ? "#14532d" : "#f0fdf4") : "transparent",
                paddingLeft: indent ? "28px" : "16px",
              }}
            >
              <span className={bold ? "font-bold" : "text-sm"} style={{ color: bold ? text : textMuted }}>{label}</span>
              <span className={bold ? "font-black" : "font-semibold text-sm"} style={{ color: value < 0 ? "#ef4444" : value > 0 ? "#16a34a" : textMuted, fontSize: bold ? "16px" : "14px" }}>
                {value < 0 ? "-" : "+"}₱{Math.abs(value).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Trend Chart */}
        <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
          <p className="text-sm font-semibold mb-3" style={{ color: text }}>{t.salesTrendChart}</p>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={chartData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 8, fill: textMuted }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, name: string) => [`₱${v.toFixed(2)}`, name === "revenue" ? "Revenue" : "Profit"]}
                contentStyle={{ background: card, border: `1px solid ${cardBorder}`, borderRadius: "12px", fontSize: "11px", color: text }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fill="url(#revGradient)" dot={false} />
              <Area type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={2} fill="url(#profGradient)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-1 rounded-full" style={{ background: "#2563eb" }} /><span className="text-xs" style={{ color: textMuted }}>Revenue</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-1 rounded-full" style={{ background: "#16a34a" }} /><span className="text-xs" style={{ color: textMuted }}>Profit</span></div>
          </div>
        </div>

        {/* Expenses section */}
        <div className="rounded-2xl border overflow-hidden mb-4" style={{ background: card, borderColor: cardBorder }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
            <p className="text-sm font-semibold" style={{ color: text }}>{t.expenses}</p>
            <button
              onClick={() => setShowAddExpense(!showAddExpense)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg"
              style={{ background: isDark ? "#374151" : "#f3f4f6", color: "#2563eb" }}
            >
              + {t.addExpense}
            </button>
          </div>

          {showAddExpense && (
            <div className="p-4" style={{ borderBottom: `1px solid ${cardBorder}`, background: isDark ? "#374151" : "#fafafa" }}>
              <input
                type="text"
                value={expDesc}
                onChange={e => setExpDesc(e.target.value)}
                placeholder={t.expenseDesc}
                className="w-full rounded-xl px-3 py-2 text-sm border mb-2 outline-none"
                style={{ background: card, color: text, borderColor: cardBorder }}
              />
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  value={expAmount}
                  onChange={e => setExpAmount(e.target.value)}
                  placeholder="₱ Amount"
                  className="flex-1 rounded-xl px-3 py-2 text-sm border outline-none"
                  style={{ background: card, color: text, borderColor: cardBorder }}
                />
                <select
                  value={expCategory}
                  onChange={e => setExpCategory(e.target.value as any)}
                  className="flex-1 rounded-xl px-3 py-2 text-sm border outline-none"
                  style={{ background: card, color: text, borderColor: cardBorder }}
                >
                  <option value="utilities">Utilities</option>
                  <option value="supplies">Supplies</option>
                  <option value="rent">Rent</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button
                onClick={handleAddExpense}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: "#d97706" }}
              >
                Save Expense
              </button>
            </div>
          )}

          {filteredExpenses.length === 0 ? (
            <div className="py-8 text-center" style={{ color: textMuted }}>
              <p className="text-sm">No expenses recorded</p>
            </div>
          ) : (
            filteredExpenses.map(exp => (
              <div key={exp.id} className="flex justify-between items-center px-4 py-3 border-b last:border-0" style={{ borderColor: cardBorder }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: text }}>{exp.name || exp.description}</p>
                  <p className="text-xs" style={{ color: textMuted }}>{exp.category} · {exp.date}</p>
                </div>
                <p className="font-bold text-red-500 text-sm">-₱{exp.amount.toFixed(2)}</p>
              </div>
            ))
          )}
        </div>

        {/* Export */}
        <div className="flex gap-2 mb-6">
          <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm border" style={{ borderColor: cardBorder, color: textMuted }}>
            <Download size={16} />
            Export PDF
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm border" style={{ borderColor: cardBorder, color: textMuted }}>
            <Share2 size={16} />
            Share Report
          </button>
        </div>
      </div>
    </div>
  );
}
