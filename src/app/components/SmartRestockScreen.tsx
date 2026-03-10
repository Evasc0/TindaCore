import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { RefreshCw, Check, Share2, ArrowLeft, Package, ShoppingCart, AlertTriangle, Download, MessageSquare, Printer } from "lucide-react";
import { useStore, canAccess, RestockItem, Product } from "../context/StoreContext";
import { TierBadge, TierGate, UpgradeBanner } from "./TierComponents";

export function SmartRestockScreen() {
  const {
    settings, t, getSmartRestockSuggestions, restockList,
    updateRestockList, checkRestockItem, products,
    suppliers, placeRestockOrder, restockOrders,
  } = useStore();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";
  const sub = settings.subscription;

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

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

  const suggestions = getSmartRestockSuggestions();
  const shownSuggestions = canAccess(sub, "premium") ? suggestions : [];

  const [editedQtys, setEditedQtys] = useState<Record<string, number>>(() =>
    Object.fromEntries(suggestions.map(s => [s.product.id, s.suggestedQty]))
  );
  const [shoppingList, setShoppingList] = useState<RestockItem[]>(restockList);
  const [tab, setTab] = useState<"suggestions" | "list">("suggestions");
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  const totalBudget = shoppingList.filter(i => !i.checked).reduce((sum, i) => sum + i.estimatedCost, 0);
  const recentOrder = lastOrderId ? restockOrders.find(o => o.id === lastOrderId) : restockOrders[0];

  const addToShoppingList = (s: (typeof suggestions)[0]) => {
    const qty = editedQtys[s.product.id] || s.suggestedQty;
    const existing = shoppingList.find(i => i.productId === s.product.id);
    if (existing) return;
    const newItem: RestockItem = {
      productId: s.product.id,
      productName: s.product.name,
      emoji: s.product.emoji,
      suggestedQty: s.suggestedQty,
      editedQty: qty,
      estimatedCost: qty * s.product.cost,
      checked: false,
    };
    const updated = [...shoppingList, newItem];
    setShoppingList(updated);
    updateRestockList(updated);
  };

  const toggleCheck = (productId: string) => {
    const item = shoppingList.find(i => i.productId === productId);
    if (!item) return;
    const newChecked = !item.checked;
    const updated = shoppingList.map(i => i.productId === productId ? { ...i, checked: newChecked } : i);
    setShoppingList(updated);
    if (newChecked) {
      checkRestockItem(productId, true, item.editedQty);
    }
    updateRestockList(updated);
  };

  const updateQty = (productId: string, qty: number) => {
    const updated = shoppingList.map(i => {
      if (i.productId === productId) {
        const p = products.find(x => x.id === productId);
        return { ...i, editedQty: qty, estimatedCost: qty * (p?.cost || 0) };
      }
      return i;
    });
    setShoppingList(updated);
    updateRestockList(updated);
  };

  const handleSendOrder = () => {
    const supplier = suppliers[0];
    if (!supplier || shoppingList.length === 0) return;
    const items = shoppingList.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        productId: item.productId,
        name: item.productName,
        quantity: item.editedQty || item.suggestedQty,
        unit: product?.unit || "piece",
        price: product?.cost || 0,
      };
    });
    const order = placeRestockOrder(supplier.id, items);
    if (order) {
      setLastOrderId(order.id);
    }
  };

  const getStockBadge = (stock: number, avgDaily: number) => {
    const daysLeft = avgDaily > 0 ? stock / avgDaily : Infinity;
    if (stock === 0) return { label: "OUT", bg: isDark ? "#450a0a" : "#fef2f2", color: "#ef4444" };
    if (daysLeft < 3) return { label: "CRITICAL", bg: isDark ? "#450a0a" : "#fef2f2", color: "#ef4444" };
    if (daysLeft < 7) return { label: "LOW", bg: isDark ? "#431407" : "#fff7ed", color: "#f97316" };
    return { label: "OK", bg: isDark ? "#14532d" : "#f0fdf4", color: "#16a34a" };
  };

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
      {/* Header */}
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
            { label: "In Shopping List", value: shoppingList.length, color: "text-yellow-200" },
            { label: "Est. Budget", value: `₱${totalBudget.toFixed(0)}`, color: "text-white" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex-1 rounded-xl px-2 py-2 text-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <p className={`font-bold ${color} text-sm`}>{value}</p>
              <p className="text-green-300" style={{ fontSize: "9px" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
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
              {tabKey === "suggestions" ? `${t.suggestedRestock} (${shownSuggestions.length})` : `${t.restockList} (${shoppingList.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Suggestions Tab ── */}
      {tab === "suggestions" && (
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
          {shownSuggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: textMuted }}>
              <Package size={40} style={{ marginBottom: "12px", opacity: 0.4 }} />
              <p className="text-sm font-medium">{t.noRestockNeeded}</p>
            </div>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: textMuted }}>{t.restockDescription}</p>
              {shownSuggestions.map(s => {
                const badge = getStockBadge(getSellingStock(s.product), s.avgDailySales);
                const isInList = shoppingList.some(i => i.productId === s.product.id);
                return (
                  <div key={s.product.id} className="rounded-2xl border mb-3 overflow-hidden" style={{ background: card, borderColor: cardBorder }}>
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{s.product.emoji}</span>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: text }}>{s.product.name}</p>
                            <p className="text-xs" style={{ color: textMuted }}>{s.product.category}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 my-3">
                        {[
                          { label: "Current Stock", value: `${getSellingStock(s.product)}`, accent: badge.color },
                          { label: t.avgDailySales, value: `${s.avgDailySales.toFixed(1)}/day`, accent: text },
                          { label: t.suggestedQty, value: `${editedQtys[s.product.id] || s.suggestedQty}`, accent: "#2563eb" },
                        ].map(({ label, value, accent }) => (
                          <div key={label} className="text-center rounded-xl py-2" style={{ background: isDark ? "#374151" : "#f9fafb" }}>
                            <p className="font-bold text-sm" style={{ color: accent }}>{value}</p>
                            <p style={{ fontSize: "9px", color: textMuted }}>{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Edit qty */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs" style={{ color: textMuted }}>
                          {t.estimatedCost}: <span style={{ color: text, fontWeight: 700 }}>₱{((editedQtys[s.product.id] || s.suggestedQty) * s.product.cost).toFixed(2)}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditedQtys(prev => ({ ...prev, [s.product.id]: Math.max(1, (prev[s.product.id] || s.suggestedQty) - 1) }))}
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: isDark ? "#374151" : "#f3f4f6" }}
                          >
                            <span style={{ color: textMuted, fontWeight: 700, fontSize: "14px" }}>−</span>
                          </button>
                          <input
                            type="number"
                            value={editedQtys[s.product.id] || s.suggestedQty}
                            onChange={e => setEditedQtys(prev => ({ ...prev, [s.product.id]: parseInt(e.target.value) || 1 }))}
                            className="w-12 text-center outline-none rounded-lg py-1 text-sm font-bold border"
                            style={{ background: isDark ? "#374151" : "#f3f4f6", color: text, borderColor: cardBorder }}
                          />
                          <button
                            onClick={() => setEditedQtys(prev => ({ ...prev, [s.product.id]: (prev[s.product.id] || s.suggestedQty) + 1 }))}
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: "#2563eb" }}
                          >
                            <span className="text-white font-bold" style={{ fontSize: "14px" }}>+</span>
                          </button>
                        </div>
                      </div>

                      {/* Add to list button */}
                      {canAccess(sub, "premium") ? (
                        <button
                          onClick={() => !isInList && addToShoppingList(s)}
                          className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                          style={{
                            background: isInList ? (isDark ? "#374151" : "#f3f4f6") : "linear-gradient(135deg, #16a34a, #15803d)",
                            color: isInList ? textMuted : "#fff",
                            boxShadow: isInList ? "none" : "0 4px 12px rgba(22,163,74,0.3)",
                          }}
                        >
                          {isInList ? "✓ Added to Shopping List" : `+ ${t.addToList}`}
                        </button>
                      ) : (
                        <TierGate required="premium" featureName="Restock Shopping List" compact />
                      )}
                    </div>
                  </div>
                );
              })}

              {!canAccess(sub, "premium") && (
                <div className="mt-2 mb-4">
                  <UpgradeBanner from="plus" to="premium" />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Shopping List Tab ── */}
      {tab === "list" && (
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
          {!canAccess(sub, "premium") ? (
            <div className="mt-4">
              <TierGate required="premium" featureName={t.restockList} />
            </div>
          ) : shoppingList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: textMuted }}>
              <ShoppingCart size={40} style={{ marginBottom: "12px", opacity: 0.4 }} />
              <p className="text-sm font-medium">Shopping list is empty</p>
              <p className="text-xs mt-1">Add items from Suggestions tab</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border mb-4" style={{ background: isDark ? "#14532d" : "#f0fdf4", borderColor: isDark ? "#166534" : "#bbf7d0" }}>
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold" style={{ color: isDark ? "#86efac" : "#15803d" }}>{t.updateStockOnCheck}</p>
                </div>
              </div>

              {shoppingList.map(item => (
                <div
                  key={item.productId}
                  className="rounded-2xl border mb-3 overflow-hidden transition-all"
                  style={{
                    background: item.checked ? (isDark ? "#14532d" : "#f0fdf4") : card,
                    borderColor: item.checked ? (isDark ? "#166534" : "#86efac") : cardBorder,
                    opacity: item.checked ? 0.75 : 1,
                  }}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleCheck(item.productId)}
                      className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        background: item.checked ? "#16a34a" : "transparent",
                        borderColor: item.checked ? "#16a34a" : cardBorder,
                      }}
                    >
                      {item.checked && <Check size={13} className="text-white" />}
                    </button>
                    <span className="text-xl">{item.emoji}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: text, textDecoration: item.checked ? "line-through" : "none" }}>{item.productName}</p>
                      <p className="text-xs" style={{ color: textMuted }}>Est. cost: ₱{item.estimatedCost.toFixed(2)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {!item.checked ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQty(item.productId, Math.max(1, item.editedQty - 1))}
                            className="w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ background: isDark ? "#374151" : "#f3f4f6" }}
                          >
                            <span style={{ color: textMuted, fontSize: "12px", fontWeight: 700 }}>−</span>
                          </button>
                          <span className="font-bold text-sm w-6 text-center" style={{ color: text }}>{item.editedQty}</span>
                          <button
                            onClick={() => updateQty(item.productId, item.editedQty + 1)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ background: "#2563eb" }}
                          >
                            <span className="text-white font-bold" style={{ fontSize: "12px" }}>+</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-green-500">+{item.editedQty} stocked</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Total Budget */}
              <div className="rounded-2xl border p-4 mt-2 mb-4" style={{ background: card, borderColor: cardBorder }}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium" style={{ color: textMuted }}>{t.totalBudget}</span>
                  <span className="font-black text-xl" style={{ color: text }}>₱{totalBudget.toFixed(2)}</span>
                </div>
                <p className="text-xs mt-1" style={{ color: textMuted }}>
                  {shoppingList.filter(i => i.checked).length}/{shoppingList.length} items purchased
                </p>
              </div>

              {/* Supplier order */}
              <div className="rounded-2xl border p-4 mb-4" style={{ background: card, borderColor: cardBorder }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: text }}>Send to supplier</p>
                    <p className="text-xs" style={{ color: textMuted }}>{suppliers[0]?.storeName || "No supplier available"}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: isDark ? "#111827" : "#eef2ff", color: "#1d4ed8" }}>
                    Premium
                  </span>
                </div>
                <button
                  onClick={handleSendOrder}
                  disabled={!suppliers.length || shoppingList.length === 0}
                  className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                  style={{ background: "#1d4ed8", color: "#fff" }}
                >
                  Send restock request
                </button>
                {recentOrder && (
                  <p className="text-xs mt-2" style={{ color: textMuted }}>
                    Last order: {recentOrder.status} · {new Date(recentOrder.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>

              {/* Export Options */}
              <div className="rounded-2xl border overflow-hidden mb-4" style={{ background: card, borderColor: cardBorder }}>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <p className="text-sm font-semibold" style={{ color: text }}>{t.exportList}</p>
                </div>
                <div className="grid grid-cols-3 gap-0">
                  {[
                    { icon: MessageSquare, label: "SMS", color: "#16a34a" },
                    { icon: Share2, label: "Share", color: "#2563eb" },
                    { icon: Printer, label: "Print", color: "#7c3aed" },
                  ].map(({ icon: Icon, label, color }) => (
                    <button key={label} className="flex flex-col items-center justify-center py-4 gap-1.5" style={{ borderRight: label !== "Print" ? `1px solid ${cardBorder}` : "none" }}>
                      <Icon size={20} style={{ color }} />
                      <span className="text-xs font-semibold" style={{ color: textMuted }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
