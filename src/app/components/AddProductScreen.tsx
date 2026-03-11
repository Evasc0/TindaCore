import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Check,
  Save,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Product, Unit, useStore } from "../context/StoreContext";
import {
  ProductInputErrors,
  ProductInputRow,
  ProductInputValue,
} from "./ProductInputRow";

const categories = [
  "General",
  "Beverages",
  "Instant Noodles",
  "Canned Goods",
  "Snacks",
  "Biscuits",
  "Bread",
  "Rice & Grains",
  "Coffee & Powdered Drinks",
  "Milk Products",
  "Cooking Ingredients",
  "Condiments",
  "Frozen Goods",
  "Ice Cream",
  "Personal Care",
  "Laundry Products",
  "Household Supplies",
  "School Supplies",
  "Cigarettes",
  "Mobile Load",
  "Medicines",
  "Pet Food",
  "Others",
];

const emojis = [
  "📦",
  "🥤",
  "🍜",
  "🥫",
  "🍟",
  "🍪",
  "🍞",
  "☕",
  "🥛",
  "🧂",
  "🧼",
  "🧺",
  "🧽",
  "✏️",
  "🚬",
  "📱",
  "💊",
  "🐾",
];

const sanitizeBarcodes = (barcodes: string[]) =>
  Array.from(new Set(barcodes.map(code => code.trim()).filter(Boolean)));

const toBaseUnit = (unit: Unit): Product["baseUnit"] => {
  if (unit === "kg" || unit === "grams") return "grams";
  if (unit === "liters" || unit === "ml") return "ml";
  return "piece";
};

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

export function AddProductScreen() {
  const { addProduct, updateProduct, deleteProduct, products, settings, t } = useStore();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const existing = products.find(p => p.id === id);
  const isDark = settings.theme === "dark";

  const initialBarcodes = useMemo(() => {
    if (existing?.barcodes?.length) return existing.barcodes;
    if (existing?.barcode) return [existing.barcode];
    return [""];
  }, [existing]);

  const [rowSelected, setRowSelected] = useState(true);
  const [draft, setDraft] = useState<ProductInputValue>({
    emoji: existing?.emoji || "📦",
    name: existing?.name || "",
    category: existing?.category || categories[0],
    cost: existing?.cost?.toString() || "",
    price: existing?.price?.toString() || "",
    stock: toSellingStock(existing),
    unit: (existing?.unit as Unit) || "piece",
    conversion:
      existing?.unit === "pack" || existing?.unit === "box"
        ? String(existing?.conversion || 1)
        : "1",
    barcodes: initialBarcodes,
  });
  const [isQuickItem, setIsQuickItem] = useState(existing?.isQuickItem ?? false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<ProductInputErrors>({});
  const [summaryError, setSummaryError] = useState("");

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";
  const subCard = isDark ? "#374151" : "#f9fafb";
  const canUseCategories = settings.subscription !== "free";

  const validate = () => {
    const nextErrors: ProductInputErrors = {};
    if (!draft.name.trim()) nextErrors.name = "Product name is required.";
    if (!draft.cost.trim()) nextErrors.cost = "Cost price is required.";
    if (!draft.price.trim()) nextErrors.price = "Selling price is required.";
    if (!draft.stock.trim()) nextErrors.stock = "Stock quantity is required.";
    if (!draft.unit.trim()) nextErrors.unit = "Unit is required.";

    const parsedCost = Number(draft.cost);
    const parsedPrice = Number(draft.price);
    const parsedStock = Number(draft.stock);
    const parsedConversion = Number(draft.conversion || "1");

    if (draft.cost.trim() && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
      nextErrors.cost = "Enter a valid cost price.";
    }
    if (draft.price.trim() && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      nextErrors.price = "Enter a valid selling price.";
    }
    if (draft.stock.trim() && (!Number.isFinite(parsedStock) || parsedStock < 0)) {
      nextErrors.stock = "Enter a valid stock quantity.";
    }
    if (
      (draft.unit === "pack" || draft.unit === "box") &&
      (!Number.isFinite(parsedConversion) || parsedConversion <= 0)
    ) {
      nextErrors.conversion = `Enter valid pieces per ${draft.unit}.`;
    }

    return nextErrors;
  };

  const handleSave = () => {
    setSummaryError("");
    if (!rowSelected) {
      setSummaryError("Check the product row to edit and save.");
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSummaryError("Complete the required fields before saving.");
      return;
    }

    const parsedStock = Number(draft.stock);
    const parsedPrice = Number(draft.price);
    const parsedCost = Number(draft.cost);
    const conversion =
      draft.unit === "pack" || draft.unit === "box"
        ? Math.max(1, Number(draft.conversion || "1"))
        : 1;
    const barcodes = sanitizeBarcodes(draft.barcodes);

    const productData = {
      name: draft.name.trim(),
      price: parsedPrice,
      cost: parsedCost,
      stock: parsedStock,
      unit: draft.unit,
      baseUnit: toBaseUnit(draft.unit),
      conversion,
      barcode: barcodes[0] || "",
      barcodes,
      category: draft.category || "General",
      isQuickItem,
      emoji: draft.emoji || "📦",
    };

    if (isEditing && id) updateProduct(id, productData);
    else addProduct(productData);

    setSaved(true);
    setTimeout(() => navigate("/management/inventory"), 800);
  };

  const handleDelete = () => {
    if (id) {
      deleteProduct(id);
      navigate("/management/inventory");
    }
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ background: bg }}>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-3"
          style={{ background: isDark ? "#3b0764" : "#f3e8ff" }}
        >
          <Check size={40} className="text-purple-600" />
        </div>
        <p className="font-bold" style={{ color: text, fontSize: "18px" }}>
          {isEditing ? t.updateProduct : t.saveProduct}!
        </p>
        <p className="mt-1" style={{ color: textMuted }}>
          {draft.name}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      <div
        style={{
          background: "linear-gradient(160deg, #3b0764 0%, #6d28d9 60%, #7c3aed 100%)",
        }}
        className="px-4 pt-4 pb-5 flex-shrink-0"
      >
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
        <div className="rounded-2xl p-4 mb-3 border" style={{ background: card, borderColor: cardBorder }}>
          <label
            className="text-xs font-semibold uppercase tracking-wider block mb-3"
            style={{ color: textMuted }}
          >
            Product Icon
          </label>
          <div className="flex flex-wrap gap-2">
            {emojis.map(icon => (
              <button
                key={icon}
                onClick={() => setDraft(prev => ({ ...prev, emoji: icon }))}
                className="w-9 h-9 rounded-lg text-lg flex items-center justify-center border"
                style={{
                  background: draft.emoji === icon ? (isDark ? "#3b0764" : "#f3e8ff") : subCard,
                  borderColor: draft.emoji === icon ? "#7c3aed" : cardBorder,
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <ProductInputRow
          value={draft}
          selected={rowSelected}
          errors={errors}
          isDark={isDark}
          nameEditable
          showCategory={false}
          onSelectedChange={checked => {
            setRowSelected(checked);
            setSummaryError("");
          }}
          onChange={next => {
            setDraft(next);
            setErrors({});
            setSummaryError("");
          }}
        />

        <div className="rounded-2xl p-4 mb-3 border" style={{ background: card, borderColor: cardBorder }}>
          <label
            className="text-xs font-semibold uppercase tracking-wider block mb-3"
            style={{ color: textMuted }}
          >
            Category
          </label>
          {!canUseCategories && (
            <p className="text-[11px] mb-2" style={{ color: textMuted }}>
              Categories are unlocked on Plus. Using "General" for now.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {categories.map(category => {
              const disabled = !canUseCategories && category !== "General";
              return (
                <button
                  key={category}
                  onClick={() => !disabled && setDraft(prev => ({ ...prev, category }))}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: draft.category === category ? "#7c3aed" : subCard,
                    color: draft.category === category ? "#ffffff" : textMuted,
                    border: `1px solid ${draft.category === category ? "#7c3aed" : cardBorder}`,
                    opacity: disabled ? 0.4 : 1,
                  }}
                  disabled={disabled}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl p-4 mb-6 border" style={{ background: card, borderColor: cardBorder }}>
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <p className="text-sm font-semibold" style={{ color: text }}>
                {t.quickItemToggle}
              </p>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                {t.quickItemDesc}
              </p>
            </div>
            <button onClick={() => setIsQuickItem(!isQuickItem)}>
              {isQuickItem ? (
                <ToggleRight size={36} className="text-blue-600" />
              ) : (
                <ToggleLeft size={36} style={{ color: isDark ? "#4b5563" : "#d1d5db" }} />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 p-4 border-t" style={{ background: card, borderColor: cardBorder }}>
        {summaryError && (
          <p className="text-xs mb-2" style={{ color: "#ef4444" }}>
            {summaryError}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={!rowSelected}
          className="w-full py-4 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
          style={{
            background: rowSelected
              ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)"
              : "#d1d5db",
            fontSize: "16px",
            boxShadow: rowSelected ? "0 4px 16px rgba(124,58,237,0.4)" : "none",
          }}
        >
          <Save size={18} />
          {isEditing ? t.updateProduct : t.saveProduct}
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="absolute inset-0 flex items-end z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: card }}>
            <h3 className="font-bold text-lg mb-2" style={{ color: text }}>
              {t.deleteConfirm}
            </h3>
            <p className="text-sm mb-6" style={{ color: textMuted }}>
              {t.deleteWarning}{" "}
              <span className="font-semibold" style={{ color: text }}>
                {existing?.name}
              </span>
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
