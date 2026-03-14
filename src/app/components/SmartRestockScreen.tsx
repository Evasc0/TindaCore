import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Package, ShoppingCart, Check, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useStore, canAccess } from "../context/StoreContext";
import { TierBadge, TierGate, UpgradeBanner } from "./TierComponents";

type ConfirmDraft = { purchasedQty: number; actualUnitCost: number };

export function SmartRestockScreen() {
  const {
    settings,
    t,
    products,
    smartRestockSuggestions,
    getSmartRestockSuggestions,
    generateSmartRestockSuggestions,
    createRestockList,
    activeRestockListId,
    activeRestockSupplierId,
    restockList,
    addProductToRestockList,
    updateRestockItem,
    removeRestockItem,
    suppliers,
    loadSuppliers,
    createSupplier,
    assignSupplierToRestockList,
    restockBudget,
    calculateRestockBudget,
    confirmRestock,
  } = useStore();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";
  const sub = settings.subscription;

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  const [tab, setTab] = useState<"suggestions" | "list">("suggestions");
  const [editedSuggestionQtys, setEditedSuggestionQtys] = useState<Record<string, number>>({});
  const [confirmDrafts, setConfirmDrafts] = useState<Record<string, ConfirmDraft>>({});
  const [isReviewingCheckedItems, setIsReviewingCheckedItems] = useState(false);
  const [isConfirmCardZoomed, setIsConfirmCardZoomed] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [manualProductId, setManualProductId] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [supplierName, setSupplierName] = useState("");
  const [supplierLocation, setSupplierLocation] = useState("");
  const [supplierContact, setSupplierContact] = useState("");

  const suggestions = smartRestockSuggestions.length ? smartRestockSuggestions : getSmartRestockSuggestions();

  useEffect(() => {
    void generateSmartRestockSuggestions();
    void loadSuppliers();
  }, [generateSmartRestockSuggestions, loadSuppliers]);

  useEffect(() => {
    if (!activeRestockListId) return;
    void calculateRestockBudget();
  }, [activeRestockListId, calculateRestockBudget]);

  useEffect(() => {
    setEditedSuggestionQtys(prev => {
      const next = { ...prev };
      suggestions.forEach(item => {
        if (!next[item.productId]) {
          next[item.productId] = item.suggestedQty;
        }
      });
      return next;
    });
  }, [suggestions]);

  useEffect(() => {
    setConfirmDrafts(prev => {
      const next = { ...prev };
      restockList.forEach(item => {
        if (!next[item.id]) {
          next[item.id] = {
            purchasedQty: item.purchasedQty > 0 ? item.purchasedQty : Math.max(1, item.editedQty),
            actualUnitCost: item.actualUnitCost > 0 ? item.actualUnitCost : Math.max(0, item.estimatedUnitCost),
          };
        }
      });
      return next;
    });
  }, [restockList]);

  const estimatedTotal = restockBudget?.estimatedTotal
    ?? restockList.reduce((sum, item) => sum + item.estimatedCost, 0);
  const missingPriceCount = restockBudget?.missingPriceCount
    ?? restockList.filter(item => item.estimatedUnitCost <= 0).length;
  const checkedItems = restockList.filter(item => item.checked);
  const isConfirmSuccess = (confirmMessage || "").startsWith("Restock confirmed");
  const confirmationStep = isConfirmSuccess ? 3 : isReviewingCheckedItems ? 2 : 1;

  const manualProduct = useMemo(
    () => products.find(p => p.id === manualProductId),
    [manualProductId, products]
  );

  const ensureRestockList = async () => {
    if (!activeRestockListId) {
      await createRestockList(activeRestockSupplierId || undefined);
    }
  };

  const handleAddSuggestion = async (productId: string, fallbackUnit: string) => {
    const qty = Math.max(1, editedSuggestionQtys[productId] || 1);
    await ensureRestockList();
    await addProductToRestockList(productId, qty, fallbackUnit);
    await calculateRestockBudget();
  };

  const handleToggleChecked = async (restockItemId: string, checked: boolean, editedQty: number) => {
    setIsReviewingCheckedItems(false);
    await updateRestockItem(restockItemId, {
      checked,
      purchasedQty: checked ? Math.max(1, editedQty) : 0,
    });
  };

  const buildConfirmPayload = () => {
    const payload: Record<string, { actualUnitCost: number; purchasedQty: number }> = {};
    checkedItems.forEach(item => {
      const draft = confirmDrafts[item.id] || { purchasedQty: item.editedQty, actualUnitCost: item.estimatedUnitCost };
      payload[item.id] = {
        purchasedQty: Math.max(0, Number(draft.purchasedQty || 0)),
        actualUnitCost: Math.max(0, Number(draft.actualUnitCost || 0)),
      };
    });
    return payload;
  };

  const hasValidConfirmPayload = (payload: Record<string, { actualUnitCost: number; purchasedQty: number }>) =>
    checkedItems.every(item => {
      const data = payload[item.id];
      return data && data.purchasedQty > 0 && data.actualUnitCost > 0;
    });

  const handleReviewCheckedItems = () => {
    if (checkedItems.length === 0) {
      setConfirmMessage("Please check purchased items before confirming.");
      return;
    }
    const payload = buildConfirmPayload();
    if (!hasValidConfirmPayload(payload)) {
      setConfirmMessage("Each checked item needs purchased qty > 0 and actual unit cost.");
      return;
    }
    setConfirmMessage(null);
    setIsReviewingCheckedItems(true);
  };

  const handleConfirmRestock = async () => {
    const payload = buildConfirmPayload();
    if (!hasValidConfirmPayload(payload)) {
      setConfirmMessage("Each checked item needs purchased qty > 0 and actual unit cost.");
      setIsReviewingCheckedItems(false);
      return;
    }
    setIsConfirming(true);
    setConfirmMessage(null);
    const ok = await confirmRestock(payload);
    setIsConfirming(false);
    if (ok) {
      await generateSmartRestockSuggestions();
      setConfirmDrafts({});
      setIsReviewingCheckedItems(false);
      setTab("suggestions");
      setConfirmMessage("Restock confirmed. Inventory updated and shopping list reset.");
    } else {
      setConfirmMessage("Restock confirmation failed. Please try again.");
    }
  };

  const reviewPayload = buildConfirmPayload();
  const reviewTotal = checkedItems.reduce((sum, item) => {
    const data = reviewPayload[item.id];
    if (!data) return sum;
    return sum + (data.purchasedQty * data.actualUnitCost);
  }, 0);

  useEffect(() => {
    if (tab !== "list") return;
    if (!checkedItems.length && !isConfirmSuccess) return;
    setIsConfirmCardZoomed(true);
    const timer = window.setTimeout(() => setIsConfirmCardZoomed(false), 260);
    return () => window.clearTimeout(timer);
  }, [tab, checkedItems.length, isReviewingCheckedItems, isConfirming, isConfirmSuccess]);

  if (!canAccess(sub, "premium")) {
    return (
      <div className="flex flex-col h-full" style={{ background: bg }}>
        <div style={{ background: "linear-gradient(160deg, #14532d 0%, #166534 60%, #16a34a 100%)" }} className="px-4 pt-4 pb-6 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => navigate("/")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
              <ArrowLeft size={18} className="text-white" />
            </button>
            <h2 className="text-white font-bold" style={{ fontSize: "20px" }}>{t.smartRestock}</h2>
          </div>
        </div>
        <div className="flex-1 p-4 flex flex-col gap-4">
          <UpgradeBanner from={sub} to="premium" />
          <TierGate required="premium" featureName={t.smartRestock} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      <div style={{ background: "linear-gradient(160deg, #14532d 0%, #166534 60%, #16a34a 100%)" }} className="px-4 pt-4 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate("/management/dashboard")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="flex-1">
            <h2 className="text-white font-bold" style={{ fontSize: "20px" }}>{t.smartRestock}</h2>
            <p className="text-green-300 text-xs mt-0.5">{t.restockDescription}</p>
          </div>
          <TierBadge tier={sub} size="sm" />
        </div>

        <div className="flex gap-2">
          {[
            { label: "Need Restock", value: suggestions.length, color: "text-red-200" },
            { label: "In Restock List", value: restockList.length, color: "text-yellow-200" },
            { label: "Est. Budget", value: `₱${estimatedTotal.toFixed(0)}`, color: "text-white" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex-1 rounded-xl px-2 py-2 text-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <p className={`font-bold ${color} text-sm`}>{value}</p>
              <p className="text-green-300" style={{ fontSize: "9px" }}>{label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mt-3 rounded-xl overflow-hidden p-1" style={{ background: "rgba(0,0,0,0.2)" }}>
          {(["suggestions", "list"] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: tab === tabKey ? "#ffffff" : "transparent",
                color: tab === tabKey ? "#166534" : "#86efac",
              }}
            >
              {tabKey === "suggestions"
                ? `${t.suggestedRestock} (${suggestions.length})`
                : `${t.restockList} (${restockList.length})`}
            </button>
          ))}
        </div>
      </div>

      {tab === "suggestions" && (
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
          {suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: textMuted }}>
              <Package size={40} style={{ marginBottom: "12px", opacity: 0.4 }} />
              <p className="text-sm font-medium">{t.noRestockNeeded}</p>
            </div>
          ) : (
            suggestions.map(s => {
              const inList = restockList.some(item => item.productId === s.productId);
              const qty = Math.max(1, editedSuggestionQtys[s.productId] || s.suggestedQty);
              return (
                <div key={s.productId} className="rounded-2xl border mb-3 overflow-hidden" style={{ background: card, borderColor: cardBorder }}>
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{s.product.emoji}</span>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: text }}>{s.product.name}</p>
                          <p className="text-xs" style={{ color: textMuted }}>{s.product.category}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: isDark ? "#111827" : "#eff6ff", color: "#1d4ed8" }}>
                        {s.unit}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 my-3">
                      <div className="text-center rounded-xl py-2" style={{ background: isDark ? "#374151" : "#f9fafb" }}>
                        <p className="font-bold text-sm" style={{ color: text }}>{s.currentStock}</p>
                        <p style={{ fontSize: "9px", color: textMuted }}>Current Stock</p>
                      </div>
                      <div className="text-center rounded-xl py-2" style={{ background: isDark ? "#374151" : "#f9fafb" }}>
                        <p className="font-bold text-sm" style={{ color: text }}>{s.avgDailySales.toFixed(1)}/day</p>
                        <p style={{ fontSize: "9px", color: textMuted }}>{t.avgDailySales}</p>
                      </div>
                      <div className="text-center rounded-xl py-2" style={{ background: isDark ? "#374151" : "#f9fafb" }}>
                        <p className="font-bold text-sm" style={{ color: "#2563eb" }}>{qty}</p>
                        <p style={{ fontSize: "9px", color: textMuted }}>{t.suggestedQty}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={e => setEditedSuggestionQtys(prev => ({ ...prev, [s.productId]: Math.max(1, Number(e.target.value || 1)) }))}
                        className="w-20 text-center outline-none rounded-lg py-1 text-sm font-bold border"
                        style={{ background: isDark ? "#374151" : "#f3f4f6", color: text, borderColor: cardBorder }}
                      />
                      <span className="text-xs" style={{ color: textMuted }}>Est. Cost: ₱{(qty * (s.product.cost || 0)).toFixed(2)}</span>
                    </div>
                    <button
                      onClick={() => void handleAddSuggestion(s.productId, s.unit)}
                      className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: inList ? (isDark ? "#374151" : "#f3f4f6") : "linear-gradient(135deg, #16a34a, #15803d)",
                        color: inList ? textMuted : "#fff",
                      }}
                    >
                      {inList ? "Added to Restock List" : `+ ${t.addToList}`}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "list" && (
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
          {confirmMessage && (
            <div
              className="rounded-2xl border p-3 mb-3"
              style={{
                background: confirmMessage.startsWith("Restock confirmed")
                  ? (isDark ? "#14532d" : "#f0fdf4")
                  : (isDark ? "#450a0a" : "#fef2f2"),
                borderColor: confirmMessage.startsWith("Restock confirmed")
                  ? (isDark ? "#166534" : "#86efac")
                  : (isDark ? "#7f1d1d" : "#fecaca"),
              }}
            >
              <p className="text-xs font-semibold" style={{ color: confirmMessage.startsWith("Restock confirmed") ? "#16a34a" : "#ef4444" }}>
                {confirmMessage}
              </p>
            </div>
          )}
          {restockList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: textMuted }}>
              <ShoppingCart size={40} style={{ marginBottom: "12px", opacity: 0.4 }} />
              <p className="text-sm font-medium">Restock list is empty</p>
              <p className="text-xs mt-1">Add items from Suggestions tab</p>
            </div>
          ) : (
            <>
              {restockList.map(item => (
                <div key={item.id} className="rounded-2xl border mb-3 overflow-hidden" style={{ background: card, borderColor: cardBorder }}>
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        onClick={() => void handleToggleChecked(item.id, !item.checked, item.editedQty)}
                        className="w-7 h-7 rounded-full border-2 flex items-center justify-center"
                        style={{ background: item.checked ? "#16a34a" : "transparent", borderColor: item.checked ? "#16a34a" : cardBorder }}
                      >
                        {item.checked && <Check size={12} className="text-white" />}
                      </button>
                      <span className="text-xl">{item.emoji}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm" style={{ color: text }}>{item.productName}</p>
                        <p className="text-xs" style={{ color: textMuted }}>Suggested: {item.suggestedQty} {item.unit}</p>
                      </div>
                      <button onClick={() => void removeRestockItem(item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: isDark ? "#7f1d1d" : "#fee2e2" }}>
                        <Trash2 size={13} style={{ color: "#ef4444" }} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="rounded-xl p-2" style={{ background: isDark ? "#374151" : "#f9fafb" }}>
                        <p className="text-[10px]" style={{ color: textMuted }}>Editable Qty</p>
                        <input
                          type="number"
                          min={0}
                          value={item.editedQty}
                          onChange={e => void updateRestockItem(item.id, { editedQty: Math.max(0, Number(e.target.value || 0)) })}
                          className="w-full mt-1 text-sm font-bold bg-transparent outline-none"
                          style={{ color: text }}
                        />
                      </div>
                      <div className="rounded-xl p-2" style={{ background: isDark ? "#374151" : "#f9fafb" }}>
                        <p className="text-[10px]" style={{ color: textMuted }}>Est. Unit Cost</p>
                        <p className="text-sm font-bold" style={{ color: item.estimatedUnitCost > 0 ? text : "#ef4444" }}>
                          ₱{item.estimatedUnitCost.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: textMuted }}>
                      Est. Total: <span style={{ color: text, fontWeight: 700 }}>₱{item.estimatedCost.toFixed(2)}</span>
                    </p>
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border p-4 mb-3" style={{ background: card, borderColor: cardBorder }}>
                <p className="text-sm font-semibold mb-2" style={{ color: text }}>Add Product Manually</p>
                <div className="flex gap-2 mb-2">
                  <select value={manualProductId} onChange={e => setManualProductId(e.target.value)} className="flex-1 rounded-xl px-2 py-2 text-sm" style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }}>
                    <option value="">Select product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" min={1} value={manualQty} onChange={e => setManualQty(Math.max(1, Number(e.target.value || 1)))} className="w-20 rounded-xl px-2 py-2 text-sm" style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }} />
                  <button
                    onClick={() => {
                      if (!manualProduct) return;
                      void (async () => {
                        await ensureRestockList();
                        await addProductToRestockList(manualProduct.id, manualQty, manualProduct.unit);
                        await calculateRestockBudget();
                      })();
                    }}
                    className="rounded-xl px-3 py-2 text-sm font-bold text-white"
                    style={{ background: "#2563eb" }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border p-4 mb-3" style={{ background: card, borderColor: cardBorder }}>
                <p className="text-sm font-semibold mb-2" style={{ color: text }}>Supplier</p>
                <select
                  value={activeRestockSupplierId || ""}
                  onChange={e => e.target.value && void assignSupplierToRestockList(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm mb-2"
                  style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }}
                >
                  <option value="">Choose supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="grid grid-cols-1 gap-2">
                  <input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Supplier name" className="rounded-xl px-3 py-2 text-sm" style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }} />
                  <input value={supplierLocation} onChange={e => setSupplierLocation(e.target.value)} placeholder="Location (optional)" className="rounded-xl px-3 py-2 text-sm" style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }} />
                  <input value={supplierContact} onChange={e => setSupplierContact(e.target.value)} placeholder="Contact (optional)" className="rounded-xl px-3 py-2 text-sm" style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }} />
                  <button
                    onClick={() => {
                      if (!supplierName.trim()) return;
                      void createSupplier({ name: supplierName, location: supplierLocation, contactNumber: supplierContact });
                      setSupplierName("");
                      setSupplierLocation("");
                      setSupplierContact("");
                    }}
                    className="w-full py-2 rounded-xl text-sm font-bold text-white"
                    style={{ background: "#16a34a" }}
                  >
                    Add Supplier
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border p-4 mb-3" style={{ background: card, borderColor: cardBorder }}>
                <p className="text-sm font-semibold" style={{ color: text }}>Budget Summary</p>
                <p className="text-xl font-black mt-1" style={{ color: text }}>₱{estimatedTotal.toFixed(2)}</p>
                {missingPriceCount > 0 && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#ef4444" }}>
                    <AlertTriangle size={12} /> {missingPriceCount} item(s) missing supplier or history price
                  </p>
                )}
              </div>

              <div
                className="rounded-2xl border p-4 mb-4"
                style={{
                  background: card,
                  borderColor: cardBorder,
                  transform: isConfirmCardZoomed ? "scale(1.02)" : "scale(1)",
                  transformOrigin: "center",
                  transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease",
                  boxShadow: isConfirmCardZoomed
                    ? (isDark ? "0 12px 28px rgba(0,0,0,0.35)" : "0 12px 28px rgba(22,163,74,0.2)")
                    : "none",
                }}
              >
                <p className="text-sm font-semibold mb-2" style={{ color: text }}>Confirmation (Checked Items)</p>
                <div className="rounded-xl p-2 mb-2" style={{ background: isDark ? "#111827" : "#f8fafc" }}>
                  <p className="text-[11px] font-semibold mb-2" style={{ color: textMuted }}>On-screen Flow</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 1, label: "Prepare" },
                      { key: 2, label: "Review" },
                      { key: 3, label: "Confirm" },
                    ].map(step => (
                      <div
                        key={step.key}
                        className="rounded-lg px-2 py-1.5 text-center"
                        style={{
                          background: confirmationStep >= step.key
                            ? (isDark ? "#14532d" : "#dcfce7")
                            : (isDark ? "#1f2937" : "#e5e7eb"),
                          color: confirmationStep >= step.key ? "#16a34a" : textMuted,
                          fontWeight: 700,
                          fontSize: "11px",
                        }}
                      >
                        {step.label}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] mt-2" style={{ color: textMuted }}>
                    {confirmationStep === 1
                      ? "Step 1: Set purchased quantity and actual cost for checked products."
                      : confirmationStep === 2
                      ? "Step 2: Review all checked products before final confirm."
                      : "Step 3: Restock confirmed and inventory updated."}
                  </p>
                </div>
                {checkedItems.length === 0 ? (
                  <p className="text-xs" style={{ color: textMuted }}>Check purchased items first.</p>
                ) : (
                  <>
                    {!isReviewingCheckedItems ? (
                      <>
                        {checkedItems.map(item => (
                          <div key={item.id} className="rounded-xl p-2 mb-2" style={{ background: isDark ? "#374151" : "#f9fafb" }}>
                            <p className="text-xs font-semibold" style={{ color: text }}>{item.productName}</p>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <div>
                                <p className="text-[10px] mb-1" style={{ color: textMuted }}>Purchased Qty</p>
                                <input
                                  type="number"
                                  min={0}
                                  value={confirmDrafts[item.id]?.purchasedQty ?? item.editedQty}
                                  onChange={e => {
                                    setIsReviewingCheckedItems(false);
                                    setConfirmDrafts(prev => ({ ...prev, [item.id]: { ...(prev[item.id] || { actualUnitCost: 0 }), purchasedQty: Math.max(0, Number(e.target.value || 0)) } }));
                                  }}
                                  className="w-full rounded-lg px-2 py-1 text-sm"
                                  style={{ background: isDark ? "#1f2937" : "#ffffff", color: text }}
                                />
                              </div>
                              <div>
                                <p className="text-[10px] mb-1" style={{ color: textMuted }}>Actual Unit Cost</p>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={confirmDrafts[item.id]?.actualUnitCost ?? item.estimatedUnitCost}
                                  onChange={e => {
                                    setIsReviewingCheckedItems(false);
                                    setConfirmDrafts(prev => ({ ...prev, [item.id]: { ...(prev[item.id] || { purchasedQty: item.editedQty }), actualUnitCost: Math.max(0, Number(e.target.value || 0)) } }));
                                  }}
                                  className="w-full rounded-lg px-2 py-1 text-sm"
                                  style={{ background: isDark ? "#1f2937" : "#ffffff", color: text }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={handleReviewCheckedItems}
                          className="w-full py-2.5 rounded-xl text-sm font-bold text-white mt-1"
                          style={{ background: "#2563eb" }}
                        >
                          Review Checked Items
                        </button>
                      </>
                    ) : (
                      <>
                        {checkedItems.map(item => {
                          const data = reviewPayload[item.id];
                          const itemTotal = (data?.purchasedQty || 0) * (data?.actualUnitCost || 0);
                          return (
                            <div key={item.id} className="rounded-xl p-2 mb-2" style={{ background: isDark ? "#374151" : "#f9fafb" }}>
                              <p className="text-xs font-semibold" style={{ color: text }}>{item.productName}</p>
                              <p className="text-xs mt-1" style={{ color: textMuted }}>
                                Qty: {data?.purchasedQty || 0} {item.unit} · Unit Cost: ₱{(data?.actualUnitCost || 0).toFixed(2)}
                              </p>
                              <p className="text-xs font-bold mt-1" style={{ color: text }}>Item Total: ₱{itemTotal.toFixed(2)}</p>
                            </div>
                          );
                        })}
                        <div className="rounded-xl p-2 mb-2" style={{ background: isDark ? "#111827" : "#ecfdf5" }}>
                          <p className="text-xs font-semibold" style={{ color: text }}>Review Total: ₱{reviewTotal.toFixed(2)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsReviewingCheckedItems(false)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                            style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }}
                          >
                            Back
                          </button>
                          <button
                            onClick={() => void handleConfirmRestock()}
                            disabled={isConfirming}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                            style={{ background: "#16a34a", opacity: isConfirming ? 0.7 : 1 }}
                          >
                            {isConfirming ? "Confirming..." : "Confirm Restock"}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
