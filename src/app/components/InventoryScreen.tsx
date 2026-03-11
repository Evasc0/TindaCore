import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Search, Plus, AlertTriangle, Package } from "lucide-react";
import { useStore, Product } from "../context/StoreContext";

const categories_en = ["All", "Beverages", "Noodles", "Canned Goods", "Sweets", "Bread", "Snacks", "Condiments"];
const categories_fil = ["Lahat", "Beverages", "Noodles", "Canned Goods", "Sweets", "Bread", "Snacks", "Condiments"];

export function InventoryScreen() {
  const { products, settings, t } = useStore();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";
  const inputBg = isDark ? "#374151" : "#ffffff";

  const getSellingStock = (p: Product) => {
    const factor =
      p.unit === "pack" || p.unit === "box"
        ? p.conversion || 1
        : p.unit === "kg" || p.unit === "liters"
        ? 1000
        : 1;
    const qty = (p.stock || 0) / factor;
    return p.unit === "kg" || p.unit === "liters" ? parseFloat(qty.toFixed(2)) : Math.floor(qty);
  };

  const categories = settings.language === "fil" ? categories_fil : categories_en;
  const allLabel = settings.language === "fil" ? "Lahat" : "All";

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === allLabel || activeCategory === "All" || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  const totalProducts = products.length;
  const lowStock = products.filter(p => {
    const qty = getSellingStock(p);
    return qty > 0 && qty <= 5;
  }).length;
  const outOfStock = products.filter(p => getSellingStock(p) === 0).length;

  const getStockStyle = (stock: number) => {
    if (stock === 0) return { bg: isDark ? "#450a0a" : "#fef2f2", text: "#ef4444", border: isDark ? "#7f1d1d" : "#fecaca" };
    if (stock <= 5) return { bg: isDark ? "#431407" : "#fff7ed", text: "#f97316", border: isDark ? "#7c2d12" : "#fed7aa" };
    return { bg: isDark ? "#14532d" : "#f0fdf4", text: "#16a34a", border: isDark ? "#166534" : "#bbf7d0" };
  };

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #3b0764 0%, #6d28d9 60%, #7c3aed 100%)" }} className="px-4 pt-4 pb-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-white font-bold" style={{ fontSize: "20px" }}>{t.inventory}</h2>
            <p className="text-purple-300 text-xs mt-0.5">{totalProducts} {t.products.toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/management/inventory/starter-products")}
              className="flex items-center gap-1.5 bg-white text-blue-700 px-3 py-2 rounded-xl font-semibold text-sm shadow-sm active:scale-95 transition-transform"
            >
              Starter
            </button>
            <button
              onClick={() => navigate("/management/inventory/add")}
              className="flex items-center gap-1.5 bg-white text-purple-700 px-3 py-2 rounded-xl font-semibold text-sm shadow-sm active:scale-95 transition-transform"
            >
              <Plus size={16} />
              {t.add}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { label: t.products, value: totalProducts, color: "text-white" },
            { label: t.lowStock, value: lowStock, color: "text-orange-300" },
            { label: t.outOfStock, value: outOfStock, color: "text-red-300" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <p className={`font-bold ${color}`}>{value}</p>
              <p className="text-purple-300 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 -mt-3 mb-3 flex-shrink-0">
        <div
          className="rounded-2xl flex items-center gap-3 px-4 py-3 border"
          style={{ background: inputBg, borderColor: cardBorder, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
        >
          <Search size={18} style={{ color: textMuted, flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.searchProduct}
            className="flex-1 outline-none text-sm"
            style={{ background: "transparent", color: text }}
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 px-4 mb-3 flex-shrink-0" style={{ overflowX: "auto", scrollbarWidth: "none" }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: activeCategory === cat ? "#7c3aed" : card,
              color: activeCategory === cat ? "#ffffff" : textMuted,
              border: `1px solid ${activeCategory === cat ? "#7c3aed" : cardBorder}`,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Low stock warning */}
      {lowStock > 0 && search === "" && (activeCategory === allLabel || activeCategory === "All") && (
        <div
          className="mx-4 mb-3 rounded-2xl px-4 py-3 flex items-center gap-3 flex-shrink-0"
          style={{ background: isDark ? "#431407" : "#fff7ed", border: `1px solid ${isDark ? "#7c2d12" : "#fed7aa"}` }}
        >
          <AlertTriangle size={17} className="text-orange-500 flex-shrink-0" />
          <p className="text-sm" style={{ color: isDark ? "#fdba74" : "#9a3412" }}>
            <span className="font-bold">{lowStock}</span> {t.lowStockAlert}
          </p>
        </div>
      )}

      {/* Product list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "none" }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32" style={{ color: textMuted }}>
            <Package size={34} />
            <p className="text-sm mt-2">{settings.language === "fil" ? "Walang produkto" : "No products found"}</p>
          </div>
        ) : (
          filtered.map(product => {
            const stockStyle = getStockStyle(getSellingStock(product));
            return (
              <button
                key={product.id}
                onClick={() => navigate(`/management/inventory/edit/${product.id}`)}
                className="w-full rounded-2xl mb-2 p-4 border flex items-center gap-3 text-left active:scale-98 transition-transform"
                style={{ background: card, borderColor: cardBorder, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
                  style={{ background: isDark ? "#374151" : "#f9fafb" }}
                >
                  {product.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate" style={{ color: text }}>{product.name}</p>
                    {product.isQuickItem && (
                      <span
                        className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full border"
                        style={{ background: isDark ? "#1e3a8a" : "#eff6ff", color: "#3b82f6", borderColor: isDark ? "#1d4ed8" : "#bfdbfe" }}
                      >⚡</span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                    {product.category}
                    {(product.barcode || (product.barcodes || []).length > 0) && " • 📊"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <p className="font-bold text-sm" style={{ color: text }}>₱{product.price.toFixed(2)}</p>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold border"
                    style={{ background: stockStyle.bg, color: stockStyle.text, borderColor: stockStyle.border }}
                  >
                    {getSellingStock(product) === 0
                      ? t.none
                      : `${getSellingStock(product)} ${t.remaining}`}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
