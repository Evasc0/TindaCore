import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { useStore, Unit } from "../context/StoreContext";
import { starterProducts, type StarterProduct } from "../data/starterProducts";
import {
  ProductInputErrors,
  ProductInputRow,
  ProductInputValue,
  SUPPORTED_UNITS,
} from "./ProductInputRow";

const CATEGORY_ORDER = [
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
];

const CATEGORY_EMOJI: Record<string, string> = {
  Beverages: "🥤",
  "Instant Noodles": "🍜",
  "Canned Goods": "🥫",
  Snacks: "🍟",
  Biscuits: "🍪",
  Bread: "🍞",
  "Rice & Grains": "🌾",
  "Coffee & Powdered Drinks": "☕",
  "Milk Products": "🥛",
  "Cooking Ingredients": "🧂",
  Condiments: "🥣",
  "Frozen Goods": "🧊",
  "Ice Cream": "🍦",
  "Personal Care": "🧼",
  "Laundry Products": "🧺",
  "Household Supplies": "🧽",
  "School Supplies": "✏️",
  Cigarettes: "🚬",
  "Mobile Load": "📱",
  Medicines: "💊",
  "Pet Food": "🐾",
};

type ProductErrors = ProductInputErrors;
type ProductDraft = ProductInputValue;

const PAGE_SIZE = 20;

const normalizeUnit = (value: string): Unit => {
  const normalized = value.toLowerCase() as Unit;
  return SUPPORTED_UNITS.includes(normalized) ? normalized : "piece";
};

const sanitizeBarcodes = (barcodes: string[]) =>
  Array.from(new Set(barcodes.map(code => code.trim()).filter(Boolean)));

const makeDefaultDraft = (product: StarterProduct): ProductDraft => ({
  emoji: CATEGORY_EMOJI[product.category] || "📦",
  name: product.name,
  category: product.category,
  cost: "",
  price: "",
  stock: "",
  unit: normalizeUnit(product.default_unit),
  conversion: "1",
  barcodes: [""],
});

export function StarterProductsScreen() {
  const { settings, importStarterProducts } = useStore();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, ProductDraft>>({});
  const [errors, setErrors] = useState<Record<string, ProductErrors>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() =>
    CATEGORY_ORDER.reduce<Record<string, boolean>>((acc, category, index) => {
      acc[category] = index === 0;
      return acc;
    }, {})
  );
  const [visibleByCategory, setVisibleByCategory] = useState<Record<string, number>>(() =>
    CATEGORY_ORDER.reduce<Record<string, number>>((acc, category) => {
      acc[category] = PAGE_SIZE;
      return acc;
    }, {})
  );

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#e5e7eb";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  const productMap = useMemo(() => {
    const map = new Map<string, StarterProduct>();
    starterProducts.forEach(product => map.set(product.id, product));
    return map;
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return starterProducts;
    return starterProducts.filter(product => {
      return (
        product.name.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q)
      );
    });
  }, [search]);

  const groupedProducts = useMemo(() => {
    return CATEGORY_ORDER.map(category => ({
      category,
      products: filteredProducts.filter(product => product.category === category),
    })).filter(group => group.products.length > 0);
  }, [filteredProducts]);

  const selectedCount = selectedIds.size;
  const selectedInFilter = filteredProducts.reduce((count, product) => {
    return count + (selectedIds.has(product.id) ? 1 : 0);
  }, 0);
  const allFilteredSelected =
    filteredProducts.length > 0 && selectedInFilter === filteredProducts.length;

  const getDraft = (product: StarterProduct) => drafts[product.id] || makeDefaultDraft(product);

  const updateDraft = (productId: string, next: ProductDraft) => {
    setDrafts(prev => ({ ...prev, [productId]: next }));
    setErrors(prev => {
      if (!prev[productId]) return prev;
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
    setSummaryError("");
    setResultMessage("");
  };

  const toggleProductSelection = (productId: string, checked?: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const shouldCheck = checked ?? !next.has(productId);
      if (shouldCheck) next.add(productId);
      else next.delete(productId);
      return next;
    });
    setSummaryError("");
    setResultMessage("");
  };

  const toggleCategorySelection = (products: StarterProduct[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = products.every(product => next.has(product.id));
      products.forEach(product => {
        if (allSelected) next.delete(product.id);
        else next.add(product.id);
      });
      return next;
    });
    setSummaryError("");
    setResultMessage("");
  };

  const toggleFilteredSelection = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredProducts.forEach(product => next.delete(product.id));
      } else {
        filteredProducts.forEach(product => next.add(product.id));
      }
      return next;
    });
    setSummaryError("");
    setResultMessage("");
  };

  const handleConfirmImport = async () => {
    setSummaryError("");
    setResultMessage("");

    const selectedProducts = Array.from(selectedIds)
      .map(id => productMap.get(id))
      .filter((product): product is StarterProduct => !!product);

    if (!selectedProducts.length) {
      setSummaryError("Select at least one product to import.");
      return;
    }

    const nextErrors: Record<string, ProductErrors> = {};
    const toImport: Array<{
      name: string;
      category: string;
      price: number;
      cost: number;
      stock: number;
      unit: Unit;
      conversion?: number;
      barcodes?: string[];
    }> = [];

    selectedProducts.forEach(product => {
      const draft = getDraft(product);
      const productErrors: ProductErrors = {};

      if (!draft.cost.trim()) productErrors.cost = "Cost price is required.";
      if (!draft.price.trim()) productErrors.price = "Selling price is required.";
      if (!draft.stock.trim()) productErrors.stock = "Stock quantity is required.";
      if (!draft.unit.trim()) productErrors.unit = "Unit is required.";

      const parsedCost = Number(draft.cost);
      const parsedPrice = Number(draft.price);
      const parsedStock = Number(draft.stock);
      const parsedConversion = Number(draft.conversion || "1");

      if (draft.cost.trim() && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
        productErrors.cost = "Enter a valid cost price.";
      }
      if (draft.price.trim() && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
        productErrors.price = "Enter a valid selling price.";
      }
      if (draft.stock.trim() && (!Number.isFinite(parsedStock) || parsedStock < 0)) {
        productErrors.stock = "Enter a valid stock quantity.";
      }
      if (!SUPPORTED_UNITS.includes(draft.unit)) {
        productErrors.unit = "Select a valid unit.";
      }
      if (
        (draft.unit === "pack" || draft.unit === "box") &&
        (!Number.isFinite(parsedConversion) || parsedConversion <= 0)
      ) {
        productErrors.conversion = `Enter valid pieces per ${draft.unit}.`;
      }

      if (
        productErrors.cost ||
        productErrors.price ||
        productErrors.stock ||
        productErrors.unit ||
        productErrors.conversion
      ) {
        nextErrors[product.id] = productErrors;
        return;
      }

      toImport.push({
        name: product.name,
        category: product.category,
        price: parsedPrice,
        cost: parsedCost,
        stock: parsedStock,
        unit: draft.unit,
        conversion:
          draft.unit === "pack" || draft.unit === "box" ? parsedConversion : 1,
        barcodes: sanitizeBarcodes(draft.barcodes),
      });
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSummaryError(
        "Complete cost, selling price, stock, and unit for all selected products."
      );
      setOpenCategories(prev => {
        const next = { ...prev };
        Object.keys(nextErrors).forEach(productId => {
          const product = productMap.get(productId);
          if (product) next[product.category] = true;
        });
        return next;
      });
      return;
    }

    setIsImporting(true);
    try {
      const result = await importStarterProducts(toImport);
      setResultMessage(
        result.failed
          ? `Imported ${result.imported} products. ${result.failed} failed to import.`
          : `Imported ${result.imported} products successfully.`
      );
      setSelectedIds(new Set());
      setErrors({});
    } catch (error) {
      console.error("Starter import failed", error);
      setSummaryError("Import failed. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      <div
        className="px-4 pt-4 pb-5 flex-shrink-0"
        style={{
          background: "linear-gradient(160deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/management/inventory")}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="flex-1">
            <h2 className="text-white font-bold" style={{ fontSize: "18px" }}>
              Starter Product Catalog
            </h2>
            <p className="text-blue-100 text-xs mt-0.5">
              Select - Edit - Confirm Import ({starterProducts.length} starter items)
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 flex-shrink-0">
        <div
          className="rounded-2xl border px-3 py-2"
          style={{ background: card, borderColor: cardBorder }}
        >
          <input
            type="text"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search starter products..."
            className="w-full outline-none text-sm"
            style={{ background: "transparent", color: text }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs" style={{ color: textMuted }}>
            Selected: {selectedCount} | Filtered: {filteredProducts.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFilteredSelection}
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{
                background: isDark ? "#1e3a8a" : "#eff6ff",
                color: "#2563eb",
                border: "1px solid rgba(37,99,235,0.25)",
              }}
            >
              {allFilteredSelected ? "Unselect Filtered" : "Select Filtered"}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{
                background: isDark ? "#374151" : "#f3f4f6",
                color: textMuted,
                border: `1px solid ${cardBorder}`,
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24" style={{ scrollbarWidth: "none" }}>
        {groupedProducts.map(group => {
          const isOpen = openCategories[group.category] ?? false;
          const selectedInCategory = group.products.filter(product =>
            selectedIds.has(product.id)
          ).length;
          const visible = visibleByCategory[group.category] ?? PAGE_SIZE;
          const visibleProducts = isOpen ? group.products.slice(0, visible) : [];

          return (
            <div
              key={group.category}
              className="rounded-2xl border mb-3 overflow-hidden"
              style={{ background: card, borderColor: cardBorder }}
            >
              <button
                onClick={() =>
                  setOpenCategories(prev => ({
                    ...prev,
                    [group.category]: !isOpen,
                  }))
                }
                className="w-full px-4 py-3 flex items-center justify-between"
                style={{ background: isDark ? "#111827" : "#f8fafc" }}
              >
                <div className="text-left">
                  <p className="font-semibold text-sm" style={{ color: text }}>
                    Category: {group.category}
                  </p>
                  <p className="text-xs" style={{ color: textMuted }}>
                    {selectedInCategory} selected of {group.products.length}
                  </p>
                </div>
                {isOpen ? (
                  <ChevronDown size={16} style={{ color: textMuted }} />
                ) : (
                  <ChevronRight size={16} style={{ color: textMuted }} />
                )}
              </button>

              {isOpen && (
                <div className="px-3 pb-3">
                  <div className="flex justify-end py-2">
                    <button
                      onClick={() => toggleCategorySelection(group.products)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{
                        background: isDark ? "#1f2937" : "#f3f4f6",
                        color: textMuted,
                        border: `1px solid ${cardBorder}`,
                      }}
                    >
                      {selectedInCategory === group.products.length
                        ? "Unselect Category"
                        : "Select Category"}
                    </button>
                  </div>

                  {visibleProducts.map(product => (
                    <ProductInputRow
                      key={product.id}
                      value={getDraft(product)}
                      selected={selectedIds.has(product.id)}
                      errors={errors[product.id]}
                      isDark={isDark}
                      showCategory
                      onSelectedChange={checked => toggleProductSelection(product.id, checked)}
                      onChange={next => updateDraft(product.id, next)}
                    />
                  ))}

                  {visible < group.products.length && (
                    <button
                      onClick={() =>
                        setVisibleByCategory(prev => ({
                          ...prev,
                          [group.category]:
                            (prev[group.category] || PAGE_SIZE) + PAGE_SIZE,
                        }))
                      }
                      className="w-full mt-1 py-2 rounded-xl text-xs font-semibold"
                      style={{
                        background: isDark ? "#1f2937" : "#f8fafc",
                        color: textMuted,
                        border: `1px solid ${cardBorder}`,
                      }}
                    >
                      Load more ({group.products.length - visible} remaining)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="flex-shrink-0 px-4 py-3 border-t"
        style={{ background: card, borderColor: cardBorder }}
      >
        {summaryError && (
          <p className="text-xs mb-2" style={{ color: "#ef4444" }}>
            {summaryError}
          </p>
        )}
        {resultMessage && (
          <p className="text-xs mb-2" style={{ color: "#16a34a" }}>
            {resultMessage}
          </p>
        )}
        <button
          onClick={handleConfirmImport}
          disabled={isImporting}
          className="w-full py-3 rounded-2xl font-bold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}
        >
          {isImporting ? "Importing..." : `Confirm Import (${selectedCount})`}
        </button>
      </div>
    </div>
  );
}
