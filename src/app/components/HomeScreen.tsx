import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  ShoppingCart, Scan, Search, Bell, Users, Shield,
  AlertTriangle, TrendingUp, ChevronRight, X, Package, User
} from "lucide-react";
import { useStore } from "../context/StoreContext";

export function HomeScreen() {
  const navigate = useNavigate();
  const {
    sales, products, customers, getCustomerBalance, pabiliOrders,
    settings, t, operatingUser, setOperatingUser
  } = useStore();

  const isDark = settings.theme === "dark";

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userInput, setUserInput] = useState(operatingUser);

  const bg = isDark ? "#111827" : "#f9fafb";
  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  const todayStr = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter(s => s.date.startsWith(todayStr));
  const totalToday = todaySales.reduce((sum, s) => sum + s.total, 0);
  const pendingPabili = pabiliOrders.filter(o => o.status === "pending").length;
  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= 5);
  const outOfStockProducts = products.filter(p => p.stock === 0);
  const totalUtang = customers.reduce((sum, c) => sum + getCustomerBalance(c.id), 0);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Magandang umaga" : hour < 17 ? "Magandang hapon" : "Magandang gabi";

  const searchResults = searchQuery.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.includes(searchQuery)
      ).slice(0, 8)
    : [];

  const handleUserSave = () => {
    if (userInput.trim()) {
      setOperatingUser(userInput.trim());
    }
    setShowUserPicker(false);
  };

  // Search Modal
  if (showSearch) {
    return (
      <div className="flex flex-col h-full" style={{ background: bg }}>
        <div
          className="px-4 pt-4 pb-3 flex items-center gap-3"
          style={{ background: card, borderBottom: `1px solid ${cardBorder}` }}
        >
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-2xl border"
            style={{ background: isDark ? "#374151" : "#f3f4f6", borderColor: "transparent" }}
          >
            <Search size={15} style={{ color: textMuted }} />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={settings.language === "fil" ? "Hanapin ang produkto..." : "Search products..."}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: text }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}>
                <X size={14} style={{ color: textMuted }} />
              </button>
            )}
          </div>
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(""); }}
            className="text-sm font-semibold"
            style={{ color: "#2563eb" }}
          >
            {settings.language === "fil" ? "Kanselahin" : "Cancel"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
          {searchQuery.trim() === "" ? (
            <div className="flex flex-col items-center justify-center h-48">
              <Search size={36} style={{ color: isDark ? "#374151" : "#e5e7eb", marginBottom: "12px" }} />
              <p className="text-sm" style={{ color: textMuted }}>
                {settings.language === "fil" ? "I-type ang pangalan ng produkto" : "Type a product name to search"}
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48">
              <p className="text-sm" style={{ color: textMuted }}>
                {settings.language === "fil" ? "Walang nahanap" : "No products found"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate("/pos")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all active:scale-[0.98]"
                  style={{ background: card, borderColor: cardBorder }}
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: text }}>{p.name}</p>
                    <p className="text-xs" style={{ color: textMuted }}>
                      {p.category} •
                      <span style={{ color: p.stock <= 5 ? "#f97316" : "#16a34a" }}> {p.stock} left</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm" style={{ color: "#2563eb" }}>₱{p.price}</p>
                    <p className="text-xs text-green-600">Tap to sell</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ background: bg }}>
      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)", paddingBottom: "20px" }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex-1 min-w-0">
            <p className="text-blue-300 text-xs">{greeting}! 👋</p>
            <h1 className="text-white font-black truncate" style={{ fontSize: "20px" }}>{settings.storeName}</h1>
            <p className="text-blue-400 text-xs mt-0.5">
              {settings.language === "fil" ? "Nagbebenta" : "Operating"}: {" "}
              <button
                onClick={() => setShowUserPicker(true)}
                className="text-blue-300 font-semibold underline underline-offset-2"
              >
                {operatingUser}
              </button>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/pabili")}
              className="relative w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <Bell size={17} className="text-white" />
              {pendingPabili > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center font-bold"
                  style={{ fontSize: "9px" }}
                >
                  {pendingPabili}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 px-4">
          {[
            { label: settings.language === "fil" ? "Benta Ngayon" : "Today's Sales", value: `₱${totalToday.toFixed(0)}`, sub: `${todaySales.length} txns` },
            { label: settings.language === "fil" ? "Utang" : "Utang", value: `₱${totalUtang.toFixed(0)}`, sub: `${customers.filter(c => getCustomerBalance(c.id) > 0).length} customers` },
            { label: settings.language === "fil" ? "Pabili Queue" : "Pabili", value: `${pendingPabili}`, sub: "pending orders" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-2xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.1)" }}>
              <p className="text-white font-black text-sm">{value}</p>
              <p className="text-blue-200" style={{ fontSize: "9px" }}>{label}</p>
              <p className="text-blue-400" style={{ fontSize: "8px" }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 -mt-4 pb-4 space-y-3">
        {/* BIG SELL BUTTON */}
        <button
          onClick={() => navigate("/pos")}
          className="w-full flex items-center justify-center gap-3 rounded-3xl font-black text-white transition-all active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
            boxShadow: "0 6px 24px rgba(22,163,74,0.45)",
            padding: "20px",
            fontSize: "20px",
          }}
        >
          <ShoppingCart size={28} />
          <span>{settings.language === "fil" ? "MAGSIMULANG MAGBENTA" : "START SELLING"}</span>
        </button>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Scan Barcode */}
          <button
            onClick={() => navigate("/pos")}
            className="flex items-center gap-3 px-4 py-4 rounded-2xl border text-left transition-all active:scale-[0.98]"
            style={{ background: card, borderColor: cardBorder }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? "#1e3a8a" : "#eff6ff" }}>
              <Scan size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: text }}>
                {settings.language === "fil" ? "Scan" : "Scan"}
              </p>
              <p className="text-xs" style={{ color: textMuted }}>Barcode</p>
            </div>
          </button>

          {/* Search Product */}
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-3 px-4 py-4 rounded-2xl border text-left transition-all active:scale-[0.98]"
            style={{ background: card, borderColor: cardBorder }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? "#14532d" : "#f0fdf4" }}>
              <Search size={18} className="text-green-600" />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: text }}>
                {settings.language === "fil" ? "Hanapin" : "Search"}
              </p>
              <p className="text-xs" style={{ color: textMuted }}>
                {settings.language === "fil" ? "Produkto" : "Product"}
              </p>
            </div>
          </button>

          {/* Pabili Orders */}
          {settings.enablePabili && (
            <button
              onClick={() => navigate("/pabili")}
              className="flex items-center gap-3 px-4 py-4 rounded-2xl border text-left transition-all active:scale-[0.98] relative"
              style={{
                background: pendingPabili > 0 ? (isDark ? "#2d1b69" : "#f5f3ff") : card,
                borderColor: pendingPabili > 0 ? "#7c3aed" : cardBorder,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center relative"
                style={{ background: isDark ? "#3b0764" : "#faf5ff" }}
              >
                <Bell size={18} className="text-purple-600" />
                {pendingPabili > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center font-bold"
                    style={{ fontSize: "9px" }}
                  >
                    {pendingPabili}
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: text }}>Pabili</p>
                <p className="text-xs" style={{ color: pendingPabili > 0 ? "#7c3aed" : textMuted }}>
                  {pendingPabili > 0 ? `${pendingPabili} pending!` : "Orders"}
                </p>
              </div>
            </button>
          )}

          {/* Utang */}
          {settings.enableUtang && (
            <button
              onClick={() => navigate("/utang")}
              className="flex items-center gap-3 px-4 py-4 rounded-2xl border text-left transition-all active:scale-[0.98]"
              style={{ background: card, borderColor: cardBorder }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? "#451a03" : "#fef3c7" }}>
                <Users size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: text }}>Utang</p>
                <p className="text-xs" style={{ color: textMuted }}>
                  ₱{totalUtang.toFixed(0)} owed
                </p>
              </div>
            </button>
          )}
        </div>

        {/* Low Stock Alert (read-only for helpers) */}
        {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
          <div className="rounded-2xl border p-3" style={{ background: isDark ? "#1c1208" : "#fffbeb", borderColor: isDark ? "#92400e" : "#fde68a" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-500" />
                <p className="text-xs font-bold text-amber-600">
                  {settings.language === "fil" ? "Stock Alerts" : "Stock Alerts"}
                </p>
              </div>
              <span className="text-xs" style={{ color: textMuted }}>
                {settings.language === "fil" ? "Read only" : "Read only"}
              </span>
            </div>
            <div className="space-y-1">
              {outOfStockProducts.slice(0, 2).map(p => (
                <p key={p.id} className="text-xs" style={{ color: isDark ? "#fca5a5" : "#dc2626" }}>
                  🔴 {p.name} — OUT OF STOCK
                </p>
              ))}
              {lowStockProducts.slice(0, 3).map(p => (
                <p key={p.id} className="text-xs" style={{ color: isDark ? "#fbbf24" : "#92400e" }}>
                  🟡 {p.name} — {p.stock} left
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Recent Sales */}
        {todaySales.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: textMuted }}>
              {settings.language === "fil" ? "Pinakabagong Benta" : "Recent Sales"}
            </p>
            <div className="rounded-2xl border overflow-hidden" style={{ background: card, borderColor: cardBorder }}>
              {todaySales.slice(0, 3).map(sale => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between px-4 py-3 border-b last:border-0"
                  style={{ borderColor: cardBorder }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: text }}>
                      {sale.items.map(i => i.name).join(", ").substring(0, 22)}{sale.items.map(i => i.name).join(", ").length > 22 ? "…" : ""}
                    </p>
                    <p className="text-xs" style={{ color: textMuted }}>
                      {new Date(sale.date).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <p
                    className="font-bold text-sm"
                    style={{ color: sale.paymentType === "utang" ? "#d97706" : "#16a34a" }}
                  >
                    ₱{sale.total}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Management Mode Button */}
        <button
          onClick={() => navigate("/management")}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-bold transition-all active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #0f172a, #1e3a8a)",
            boxShadow: "0 4px 16px rgba(15,23,42,0.4)",
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
            <Shield size={20} className="text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-white font-black text-sm">Management Mode</p>
            <p className="text-blue-300 text-xs">
              {settings.language === "fil" ? "PIN protektado • Para sa may-ari" : "PIN protected • Owner access only"}
            </p>
          </div>
          <ChevronRight size={16} className="text-blue-400" />
        </button>
      </div>

      {/* User Picker Modal */}
      {showUserPicker && (
        <div
          className="absolute inset-0 flex items-end justify-center z-50"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowUserPicker(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6"
            style={{ background: card }}
            onClick={e => e.stopPropagation()}
          >
            <p className="font-black text-base mb-1" style={{ color: text }}>
              {settings.language === "fil" ? "Sino ang nagbebenta ngayon?" : "Who is selling today?"}
            </p>
            <p className="text-xs mb-4" style={{ color: textMuted }}>
              {settings.language === "fil"
                ? "Ito ay itatala sa bawat transaksyon"
                : "This will be recorded in each transaction"}
            </p>
            <input
              autoFocus
              type="text"
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder={settings.language === "fil" ? "e.g. Ate Rosa" : "e.g. Helper Name"}
              className="w-full px-4 py-3 rounded-2xl border outline-none text-sm mb-4"
              style={{
                background: isDark ? "#374151" : "#f9fafb",
                borderColor: cardBorder,
                color: text,
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowUserPicker(false)}
                className="flex-1 py-3 rounded-2xl border font-semibold text-sm"
                style={{ borderColor: cardBorder, color: textMuted }}
              >
                {settings.language === "fil" ? "Huwag na" : "Cancel"}
              </button>
              <button
                onClick={handleUserSave}
                className="flex-1 py-3 rounded-2xl font-bold text-white text-sm"
                style={{ background: "#2563eb" }}
              >
                {settings.language === "fil" ? "I-save" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
