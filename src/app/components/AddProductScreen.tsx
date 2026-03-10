import React, { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Scan, Save, Trash2, ToggleLeft, ToggleRight, Check } from "lucide-react";
import { useStore, Product, Unit } from "../context/StoreContext";

const categories = ["General", "Beverages", "Noodles", "Canned Goods", "Sweets", "Bread", "Snacks", "Condiments", "Dairy", "Toiletries", "Others"];
const emojis = ["🥤", "🍜", "🐟", "🍬", "🍞", "☕", "🧂", "🥫", "🍟", "🥨", "🧃", "🍫", "🍭", "🧴", "📦", "🌾", "🧃", "🫙", "🛒", "💊"];

export function AddProductScreen() {
  const { addProduct, updateProduct, deleteProduct, products, settings, t } = useStore();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const existing = products.find(p => p.id === id);
  const isDark = settings.theme === "dark";

  const [name, setName] = useState(existing?.name || "");
  const [price, setPrice] = useState(existing?.price?.toString() || "");
  const [cost, setCost] = useState(existing?.cost?.toString() || "");
  const initialUnit: Unit = (existing?.unit as Unit) || "piece";
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const [conversion, setConversion] = useState(existing?.conversion?.toString() || "1");
  const toSellingStock = (product?: Product) => {
    if (!product) return "";
    const factor =
      product.unit === "pack" || product.unit === "box"
        ? product.conversion || 1
        : product.unit === "kg" || product.unit === "liters"
        ? 1000
        : 1;
    const selling = (product.stock || 0) / factor;
    return product.unit === "kg" || product.unit === "liters"
      ? selling.toFixed(2)
      : selling.toString();
  };
  const [stock, setStock] = useState(toSellingStock(existing));
  const [barcode, setBarcode] = useState(existing?.barcode || "");
  const [category, setCategory] = useState(existing?.category || categories[0]);
  const [isQuickItem, setIsQuickItem] = useState(existing?.isQuickItem ?? false);
  const [selectedEmoji, setSelectedEmoji] = useState(existing?.emoji || "📦");
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";
  const subCard = isDark ? "#374151" : "#f9fafb";
  const canUseCategories = settings.subscription !== "free";

  const isValid = name.trim() !== "" && price !== "" && parseFloat(price) > 0 && stock !== "" &&
    (!["pack", "box"].includes(unit) || parseFloat(conversion || "0") > 0);

  const handleSave = () => {
    if (!isValid) return;
    const parsedStock = parseFloat(stock || "0");
    const parsedPrice = parseFloat(price || "0");
    const parsedCost = cost ? parseFloat(cost) : (existing?.cost || parsedPrice * 0.65);
    const conv = ["pack", "box"].includes(unit) ? Math.max(1, parseFloat(conversion || "1")) : 1;
    const baseUnit: "piece" | "grams" | "ml" = unit === "kg" || unit === "grams"
      ? "grams"
      : unit === "liters" || unit === "ml"
      ? "ml"
      : "piece";
    const productData = {
      name: name.trim(),
      price: parsedPrice,
      cost: parsedCost,
      stock: parsedStock,
      unit,
      baseUnit,
      conversion: conv,
      barcode: barcode.trim(),
      category,
      isQuickItem,
      emoji: selectedEmoji,
    };
    if (isEditing && id) updateProduct(id, productData);
    else addProduct(productData);
    setSaved(true);
    setTimeout(() => navigate("/management/inventory"), 800);
  };

  const handleDelete = () => {
    if (id) { deleteProduct(id); navigate("/management/inventory"); }
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ background: bg }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-3"
          style={{ background: isDark ? "#3b0764" : "#f3e8ff" }}>
          <Check size={40} className="text-purple-600" />
        </div>
        <p className="font-bold" style={{ color: text, fontSize: "18px" }}>
          {isEditing ? t.updateProduct : t.saveProduct}!
        </p>
        <p className="mt-1" style={{ color: textMuted }}>{name}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #3b0764 0%, #6d28d9 60%, #7c3aed 100%)" }} className="px-4 pt-4 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/management/inventory")}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <h2 className="text-white font-bold flex-1" style={{ fontSize: "18px" }}>
            {isEditing ? t.editProduct : t.newProduct}
          </h2>
          {isEditing && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.7)" }}
            >
              <Trash2 size={16} className="text-white" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {/* Emoji Picker */}
        <div className="rounded-2xl p-4 mb-4 border" style={{ background: card, borderColor: cardBorder }}>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-3" style={{ color: textMuted }}>{t.productIcon}</label>
          <div className="flex flex-wrap gap-2">
            {emojis.map(e => (
              <button
                key={e}
                onClick={() => setSelectedEmoji(e)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all"
                style={{
                  background: selectedEmoji === e ? (isDark ? "#3b0764" : "#f3e8ff") : subCard,
                  boxShadow: selectedEmoji === e ? "0 0 0 2px #7c3aed" : "none",
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Product Name */}
        <div className="rounded-2xl p-4 mb-3 border" style={{ background: card, borderColor: cardBorder }}>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
            {t.productName} <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t.productNamePlaceholder}
            className="w-full outline-none font-medium text-sm"
            style={{ background: "transparent", color: text }}
          />
        </div>

        {/* Price & Stock */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1 rounded-2xl p-4 border" style={{ background: card, borderColor: cardBorder }}>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
              {t.price} <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-1">
              <span className="font-bold" style={{ color: textMuted }}>₱</span>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full outline-none font-bold"
                style={{ fontSize: "18px", background: "transparent", color: text }}
              />
            </div>
          </div>
          <div className="flex-1 rounded-2xl p-4 border" style={{ background: card, borderColor: cardBorder }}>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
              {t.stock} <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={stock}
              onChange={e => setStock(e.target.value)}
              placeholder="0"
              className="w-full outline-none font-bold"
              style={{ fontSize: "18px", background: "transparent", color: text }}
            />
          </div>
        </div>

        {/* Cost Price */}
        <div className="rounded-2xl p-4 mb-3 border" style={{ background: card, borderColor: cardBorder }}>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
            {t.costPrice} <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center gap-1">
            <span className="font-bold" style={{ color: textMuted }}>₱</span>
            <input
              type="number"
              value={cost}
              onChange={e => setCost(e.target.value)}
              placeholder="0.00"
              className="w-full outline-none font-bold"
              style={{ fontSize: "18px", background: "transparent", color: text }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: textMuted }}>
            Used for COGS and profit calculations.
          </p>
        </div>

        {/* Unit & Conversion */}
        <div className="rounded-2xl p-4 mb-3 border" style={{ background: card, borderColor: cardBorder }}>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-3" style={{ color: textMuted }}>
            Unit Type
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(["piece", "pack", "box", "kg", "grams", "ml", "liters"] as Unit[]).map(u => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: unit === u ? "#16a34a" : subCard,
                  color: unit === u ? "#ffffff" : textMuted,
                  border: `1px solid ${unit === u ? "#16a34a" : cardBorder}`,
                }}
              >
                {u}
              </button>
            ))}
          </div>
          {["pack", "box"].includes(unit) && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
                Pieces per {unit}
              </label>
              <input
                type="number"
                value={conversion}
                onChange={e => setConversion(e.target.value)}
                placeholder="e.g. 24"
                className="w-full outline-none font-bold rounded-xl px-3 py-2 border"
                style={{ fontSize: "16px", background: subCard, color: text, borderColor: cardBorder }}
              />
            </div>
          )}
        </div>

        {/* Barcode */}
        <div className="rounded-2xl p-4 mb-3 border" style={{ background: card, borderColor: cardBorder }}>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>{t.barcode}</label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              placeholder={t.barcodePlaceholder}
              className="flex-1 outline-none text-sm"
              style={{ background: "transparent", color: text }}
            />
            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: isDark ? "#1e3a8a" : "#eff6ff" }}
            >
              <Scan size={17} className="text-blue-600" />
            </button>
          </div>
        </div>

        {/* Category */}
        <div className="rounded-2xl p-4 mb-3 border" style={{ background: card, borderColor: cardBorder }}>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-3" style={{ color: textMuted }}>{t.category}</label>
          {!canUseCategories && (
            <p className="text-[11px] mb-2" style={{ color: textMuted }}>
              Categories are unlocked on Plus. Using "General" for now.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              (() => {
                const disabled = !canUseCategories && cat !== "General";
                return (
              <button
                key={cat}
                onClick={() => !disabled && setCategory(cat)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: category === cat ? "#7c3aed" : subCard,
                  color: category === cat ? "#ffffff" : textMuted,
                  border: `1px solid ${category === cat ? "#7c3aed" : cardBorder}`,
                  opacity: disabled ? 0.4 : 1,
                }}
                disabled={disabled}
              >
                {cat}
              </button>
                );
              })()
            ))}
          </div>
        </div>

        {/* Quick Item Toggle */}
        <div className="rounded-2xl p-4 mb-6 border" style={{ background: card, borderColor: cardBorder }}>
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <p className="text-sm font-semibold" style={{ color: text }}>{t.quickItemToggle}</p>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>{t.quickItemDesc}</p>
            </div>
            <button onClick={() => setIsQuickItem(!isQuickItem)}>
              {isQuickItem
                ? <ToggleRight size={36} className="text-blue-600" />
                : <ToggleLeft size={36} style={{ color: isDark ? "#4b5563" : "#d1d5db" }} />
              }
            </button>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex-shrink-0 p-4 border-t" style={{ background: card, borderColor: cardBorder }}>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="w-full py-4 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
          style={{
            background: isValid ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" : "#d1d5db",
            fontSize: "16px",
            boxShadow: isValid ? "0 4px 16px rgba(124,58,237,0.4)" : "none",
          }}
        >
          <Save size={18} />
          {isEditing ? t.updateProduct : t.saveProduct}
        </button>
      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 flex items-end z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: card }}>
            <h3 className="font-bold text-lg mb-2" style={{ color: text }}>{t.deleteConfirm}</h3>
            <p className="text-sm mb-6" style={{ color: textMuted }}>
              {t.deleteWarning} <span className="font-semibold" style={{ color: text }}>{existing?.name}</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-2xl font-semibold"
                style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
