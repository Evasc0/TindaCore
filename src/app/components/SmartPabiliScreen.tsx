import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Bell, QrCode, Check, X, ShoppingCart, Clock, AlertCircle, Download, Printer, Zap, Star, Send, Plus, Minus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useStore, canAccess } from "../context/StoreContext";
import { TierBadge, TierGate, UpgradeBanner } from "./TierComponents";

type Tab = "orders" | "qr" | "customer";

export function SmartPabiliScreen() {
  const { pabiliOrders, updatePabiliStatus, products, settings, t, addPabiliToCart, addPabiliOrder } = useStore();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";
  const sub = settings.subscription;
  const [tab, setTab] = useState<Tab>("orders");

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  const pending = pabiliOrders.filter(o => o.status === "pending");
  const preparing = pabiliOrders.filter(o => o.status === "preparing");
  const done = pabiliOrders.filter(o => o.status === "done" || o.status === "dismissed");

  const storeQRValue = `https://sari-sari-pos.app/pabili/${settings.storeName.replace(/\s+/g, "-").toLowerCase()}`;

  const handleOpenInPOS = (order: (typeof pabiliOrders)[0]) => {
    if (canAccess(sub, "premium") && order.items.length > 0) {
      addPabiliToCart(order);
      updatePabiliStatus(order.id, "preparing");
      navigate("/pos");
    } else {
      updatePabiliStatus(order.id, "preparing");
      navigate("/pos");
    }
  };

  const elapsed = (dateStr: string) => {
    const diff = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    return `${Math.round(diff / 60)}h ago`;
  };

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #2d1b69 0%, #4c1d95 60%, #7c3aed 100%)" }} className="px-4 pt-4 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-white font-bold" style={{ fontSize: "20px" }}>{t.smartPabili}</h2>
            <p className="text-purple-300 text-xs mt-0.5">{t.qrDoorbell}</p>
          </div>
          <div className="flex items-center gap-2">
            <TierBadge tier="plus" size="sm" />
            {pending.length > 0 && (
              <span className="w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{pending.length}</span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-2">
          {[
            { label: "Pending", value: pending.length, color: "text-red-300" },
            { label: "Preparing", value: preparing.length, color: "text-yellow-300" },
            { label: "Done Today", value: done.length, color: "text-green-300" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <p className={`font-bold ${color}`}>{value}</p>
              <p className="text-purple-300 text-xs">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 rounded-xl overflow-hidden p-1" style={{ background: "rgba(0,0,0,0.2)" }}>
          {(["orders", "qr", "customer"] as Tab[]).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: tab === tabKey ? "#ffffff" : "transparent",
                color: tab === tabKey ? "#4c1d95" : "#c4b5fd",
              }}
            >
              {tabKey === "orders" ? t.pabiliTab : tabKey === "qr" ? t.qrTab : "Mini-Store"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Orders Tab ── */}
      {tab === "orders" && (
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
          {!canAccess(sub, "plus") ? (
            <div className="mt-4">
              <UpgradeBanner from="free" to="plus" />
              <div className="mt-4 rounded-2xl p-4 border" style={{ background: card, borderColor: cardBorder }}>
                <div className="flex items-center gap-2 mb-3">
                  <Bell size={16} className="text-purple-500" />
                  <p className="font-semibold text-sm" style={{ color: text }}>Free: Basic Pabili Po</p>
                </div>
                <p className="text-xs mb-3" style={{ color: textMuted }}>In Free tier, customers can only send a "Pabili Po" notification without pre-selecting items.</p>
                <div className="rounded-xl p-3" style={{ background: isDark ? "#2d1b69" : "#f5f3ff" }}>
                  <p className="text-xs font-semibold" style={{ color: "#7c3aed" }}>🔔 New notification: "Pabili Po" from Unknown Customer</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Pending */}
              {pending.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: textMuted }}>
                    <AlertCircle size={11} />New Orders ({pending.length})
                  </p>
                  {pending.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isDark={isDark} text={text} textMuted={textMuted} card={card} cardBorder={cardBorder}
                      sub={sub}
                      elapsed={elapsed}
                      onOpenPOS={() => handleOpenInPOS(order)}
                      onPrepare={() => updatePabiliStatus(order.id, "preparing")}
                      onDismiss={() => updatePabiliStatus(order.id, "dismissed")}
                    />
                  ))}
                </>
              )}

              {/* Preparing */}
              {preparing.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3 mt-4 flex items-center gap-2" style={{ color: textMuted }}>
                    <Clock size={11} />Preparing ({preparing.length})
                  </p>
                  {preparing.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isDark={isDark} text={text} textMuted={textMuted} card={card} cardBorder={cardBorder}
                      sub={sub}
                      elapsed={elapsed}
                      isPreparingMode
                      onOpenPOS={() => handleOpenInPOS(order)}
                      onDone={() => updatePabiliStatus(order.id, "done")}
                      onDismiss={() => updatePabiliStatus(order.id, "dismissed")}
                    />
                  ))}
                </>
              )}

              {pending.length === 0 && preparing.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16" style={{ color: textMuted }}>
                  <Bell size={40} style={{ marginBottom: "12px", opacity: 0.4 }} />
                  <p className="text-sm font-medium">{t.noPendingOrders}</p>
                  <p className="text-xs mt-1">Share the QR code for customers to order!</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── QR Code Tab ── */}
      {tab === "qr" && (
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
          <div className="rounded-2xl p-5 border mb-4 flex flex-col items-center" style={{ background: card, borderColor: cardBorder }}>
            <p className="font-bold mb-1" style={{ color: text, fontSize: "16px" }}>{t.qrStore}</p>
            <p className="text-xs text-center mb-4" style={{ color: textMuted }}>{t.qrInstructions}</p>

            {/* QR Code */}
            <div className="p-4 rounded-2xl mb-4" style={{ background: isDark ? "#ffffff" : "#ffffff" }}>
              <QRCodeSVG
                value={storeQRValue}
                size={160}
                level="H"
                includeMargin={false}
                fgColor="#1e1e2e"
                bgColor="#ffffff"
              />
            </div>

            <p className="text-xs font-semibold mb-1" style={{ color: text }}>{settings.storeName}</p>
            <p className="text-xs mb-5" style={{ color: textMuted }}>{settings.address || "Scan to order"}</p>

            {/* Action buttons */}
            <div className="flex gap-2 w-full">
              <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm" style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff" }}>
                <Download size={15} />
                {t.downloadQR}
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm" style={{ borderColor: cardBorder, color: textMuted }}>
                <Printer size={15} />
                {t.printQR}
              </button>
            </div>
          </div>

          {/* Instructions card */}
          <div className="rounded-2xl p-4 border" style={{ background: isDark ? "#2d1b69" : "#f5f3ff", borderColor: isDark ? "#4c1d95" : "#e9d5ff" }}>
            <p className="font-bold text-sm mb-3" style={{ color: isDark ? "#e9d5ff" : "#4c1d95" }}>How it works</p>
            {[
              { step: "1", text: "Print or display the QR code outside your store" },
              { step: "2", text: "Customer scans the QR code with their phone" },
              { step: "3", text: `Plus/Premium: Customer selects items → sends order` },
              { step: "4", text: "You receive notification on this screen" },
              { step: "5", text: canAccess(sub, "premium") ? "Premium: Items auto-added to POS cart! 🚀" : "Open in POS and process manually" },
            ].map(({ step, text: stepText }) => (
              <div key={step} className="flex items-start gap-3 mb-2 last:mb-0">
                <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0" style={{ background: "#7c3aed", color: "#fff" }}>{step}</span>
                <p className="text-xs" style={{ color: isDark ? "#c4b5fd" : "#6d28d9" }}>{stepText}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Customer Mini Store Tab ── */}
      {tab === "customer" && (
        <CustomerMiniStore isDark={isDark} text={text} textMuted={textMuted} card={card} cardBorder={cardBorder} sub={sub} />
      )}
    </div>
  );
}

// ── Order Card Component ────────────────────────────────────────────────────────
function OrderCard({ order, isDark, text, textMuted, card, cardBorder, sub, elapsed, onOpenPOS, onPrepare, onDone, onDismiss, isPreparingMode = false }: any) {
  return (
    <div className="rounded-2xl border mb-3 overflow-hidden" style={{ background: card, borderColor: isDark ? "#4c1d95" : "#e9d5ff" }}>
      {/* Order header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: isDark ? "#2d1b69" : "#f5f3ff" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#7c3aed" }}>
            <span className="text-white font-bold text-xs">{order.customerName.charAt(0)}</span>
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: isDark ? "#e9d5ff" : "#4c1d95" }}>{order.customerName}</p>
            <p className="text-xs" style={{ color: isDark ? "#a78bfa" : "#7c3aed" }}>
              {elapsed(order.date)}
              {order.customerPhone && ` · ${order.customerPhone}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-sm" style={{ color: isDark ? "#e9d5ff" : "#4c1d95" }}>
            {order.total > 0 ? `₱${order.total}` : "Basic"}
          </p>
          {isPreparingMode && (
            <span className="text-xs font-semibold" style={{ color: "#f59e0b" }}>Preparing...</span>
          )}
        </div>
      </div>

      {/* Items */}
      {order.items.length > 0 ? (
        <div className="px-4 py-3">
          {order.items.map((item: any, i: number) => (
            <div key={i} className="flex justify-between py-1.5 border-b last:border-0" style={{ borderColor: cardBorder }}>
              <span className="text-sm" style={{ color: textMuted }}>{item.name} × {item.qty}</span>
              <span className="text-sm font-medium" style={{ color: text }}>₱{(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-3">
          <p className="text-xs italic" style={{ color: textMuted }}>"{order.note || "Pabili po"}"</p>
        </div>
      )}

      {/* Premium auto-add badge */}
      {canAccess(sub, "premium") && order.items.length > 0 && !isPreparingMode && (
        <div className="px-4 pb-2">
          <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "#d97706" }}>
            <Star size={10} />Auto-add to POS when opened (Premium)
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-4 py-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
        {!isPreparingMode ? (
          <>
            <button
              onClick={onOpenPOS}
              className="flex-[2] py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}
            >
              <ShoppingCart size={13} />Open in POS
            </button>
            {onPrepare && (
              <button
                onClick={onPrepare}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border"
                style={{ color: "#f59e0b", borderColor: "#f59e0b40", background: isDark ? "#451a03" : "#fffbeb" }}
              >
                Prepare
              </button>
            )}
            <button
              onClick={onDismiss}
              className="w-10 h-10 rounded-xl flex items-center justify-center border"
              style={{ borderColor: cardBorder, color: textMuted }}
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onOpenPOS}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold border"
              style={{ color: text, borderColor: cardBorder }}
            >
              View in POS
            </button>
            <button
              onClick={onDone}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white"
              style={{ background: "#16a34a" }}
            >
              ✓ Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Customer Mini Store ─────────────────────────────────────────────────────────
function CustomerMiniStore({ isDark, text, textMuted, card, cardBorder, sub }: any) {
  const { products, addPabiliOrder, settings, t } = useStore();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash" | "paymaya">("cash");

  const canSelectItems = canAccess(sub, "plus");
  const quickProducts = products.slice(0, 8);
  const total = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find(x => x.id === id);
    return sum + (p?.price || 0) * qty;
  }, 0);

  const handleSend = () => {
    const items = Object.entries(cart)
      .map(([id, qty]) => {
        const p = products.find(x => x.id === id)!;
        return { name: p.name, qty, price: p.price };
      })
      .filter(i => i.qty > 0);

    addPabiliOrder({
      customerName: customerName || "Customer",
      items: canSelectItems ? items : [],
      status: "pending",
      date: new Date().toISOString(),
      note: note || "Pabili po",
      total: canSelectItems ? total : 0,
    });
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: isDark ? "#2d1b69" : "#f5f3ff" }}>
          <Send size={36} className="text-purple-500" />
        </div>
        <p className="font-bold text-lg mb-2" style={{ color: text }}>{t.pabiliSent}</p>
        <p className="text-sm" style={{ color: textMuted }}>{t.pabiliSentMsg}</p>
        <button
          onClick={() => { setSent(false); setCart({}); setCustomerName(""); setNote(""); }}
          className="mt-6 px-6 py-3 rounded-2xl font-bold text-white"
          style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
        >
          Send Another Order
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      <div className="p-4">
        <div className="rounded-2xl p-4 border mb-4" style={{ background: isDark ? "#2d1b69" : "#f5f3ff", borderColor: isDark ? "#4c1d95" : "#e9d5ff" }}>
          <p className="font-bold text-sm mb-1" style={{ color: isDark ? "#e9d5ff" : "#4c1d95" }}>{t.customerMiniStore}</p>
          <p className="text-xs" style={{ color: isDark ? "#a78bfa" : "#7c3aed" }}>Preview of what customers see when they scan the QR code</p>
        </div>

        {/* Customer Name */}
        <div className="rounded-2xl p-4 border mb-3" style={{ background: card, borderColor: cardBorder }}>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>Your Name (Optional)</label>
          <input
            type="text"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            placeholder="e.g. Ate Nena"
            className="w-full outline-none text-sm"
            style={{ background: "transparent", color: text }}
          />
        </div>

        {/* Item selection (Plus/Premium) */}
        {canSelectItems ? (
          <div className="rounded-2xl border mb-3 overflow-hidden" style={{ background: card, borderColor: cardBorder }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${cardBorder}` }}>
              <p className="text-sm font-semibold" style={{ color: text }}>{t.selectItems}</p>
              <TierBadge tier="plus" size="xs" />
            </div>
            {quickProducts.map(product => (
              <div key={product.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0" style={{ borderColor: cardBorder }}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{product.emoji}</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: text }}>{product.name}</p>
                    <p className="text-xs" style={{ color: textMuted }}>₱{product.price}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(cart[product.id] || 0) > 0 ? (
                    <>
                      <button
                        onClick={() => setCart(c => ({ ...c, [product.id]: Math.max(0, (c[product.id] || 0) - 1) }))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: isDark ? "#374151" : "#f3f4f6" }}
                      >
                        <Minus size={12} style={{ color: textMuted }} />
                      </button>
                      <span className="w-5 text-center text-sm font-bold" style={{ color: text }}>{cart[product.id]}</span>
                    </>
                  ) : null}
                  <button
                    onClick={() => setCart(c => ({ ...c, [product.id]: (c[product.id] || 0) + 1 }))}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: (cart[product.id] || 0) > 0 ? "#7c3aed" : isDark ? "#374151" : "#f3f4f6" }}
                  >
                    <Plus size={12} style={{ color: (cart[product.id] || 0) > 0 ? "#fff" : textMuted }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border mb-3 overflow-hidden" style={{ background: card, borderColor: cardBorder }}>
            <TierGate required="plus" featureName="Item Pre-Selection" />
          </div>
        )}

        {/* Payment Method (Premium) */}
        {canAccess(sub, "premium") ? (
          <div className="rounded-2xl border mb-3 overflow-hidden" style={{ background: card, borderColor: cardBorder }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${cardBorder}` }}>
              <p className="text-sm font-semibold" style={{ color: text }}>{t.paymentMethod}</p>
              <TierBadge tier="premium" size="xs" />
            </div>
            <div className="flex gap-2 p-3">
              {(["cash", "gcash", "paymaya"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all"
                  style={{
                    background: paymentMethod === m ? (m === "gcash" ? "#1d4ed8" : m === "paymaya" ? "#15803d" : "#2563eb") : "transparent",
                    color: paymentMethod === m ? "#fff" : textMuted,
                    borderColor: paymentMethod === m ? "transparent" : cardBorder,
                  }}
                >
                  {m === "cash" ? "💵 Cash" : m === "gcash" ? "💙 GCash" : "💚 PayMaya"}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Note */}
        <div className="rounded-2xl p-4 border mb-4" style={{ background: card, borderColor: cardBorder }}>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>{t.addNote}</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t.notePlaceholder}
            className="w-full outline-none text-sm"
            style={{ background: "transparent", color: text }}
          />
        </div>
      </div>

      {/* Send Button */}
      <div className="px-4 pb-4">
        {(total > 0 || !canSelectItems) && (
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-sm font-medium" style={{ color: textMuted }}>{t.totalOrder}</span>
            <span className="font-black text-lg" style={{ color: text }}>
              {canSelectItems && total > 0 ? `₱${total.toFixed(2)}` : "Pabili Po"}
            </span>
          </div>
        )}
        <button
          onClick={handleSend}
          className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", boxShadow: "0 4px 16px rgba(124,58,237,0.4)", fontSize: "16px" }}
        >
          <Send size={18} />
          {t.sendOrder}
        </button>
      </div>
    </div>
  );
}
