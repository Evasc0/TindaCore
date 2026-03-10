import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Scan, Plus, Minus, Trash2, X, CheckCircle, Zap, Search } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { startScanner, stopScanner } from "../hardware/barcodeScanner";

type Mode = "cart" | "complete" | "utang_select";

export function POSScreen() {
  const { products, cart, addToCart, removeFromCart, updateCartQty, completeSale, addUtangSale, customers, cartTotal, settings, t } = useStore();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";

  const [mode, setMode] = useState<Mode>("cart");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [paymentInput, setPaymentInput] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedCartItem, setSelectedCartItem] = useState<string | null>(null);
  const [scanFlash, setScanFlash] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash" | "paymaya">("cash");
  const [searchTerm, setSearchTerm] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const quickItems = products.filter(p => p.isQuickItem);
  const change = parseFloat(paymentInput || "0") - cartTotal;
  const searchResults = searchTerm.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode || "").includes(searchTerm)
      ).slice(0, 8)
    : [];
  const displayStock = (p: any) => {
    const factor =
      p.unit === "pack" || p.unit === "box"
        ? p.conversion || 1
        : p.unit === "kg" || p.unit === "liters"
        ? 1000
        : 1;
    const qty = (p.stock || 0) / factor;
    return p.unit === "kg" || p.unit === "liters" ? qty.toFixed(2) : Math.floor(qty);
  };

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";
  const subCard = isDark ? "#374151" : "#f9fafb";

  const handleBarcodeSearch = () => {
    const found = products.find(p => p.barcode === barcodeInput && barcodeInput !== "");
    if (found) {
      addToCart(found.id);
      setBarcodeInput("");
      setScanFlash(true);
      setTimeout(() => setScanFlash(false), 500);
    }
  };

  const handleScanResult = (code: string) => {
    setBarcodeInput(code);
    const found = products.find(p => p.barcode === code);
    if (found) {
      addToCart(found.id);
      setScanFlash(true);
      setTimeout(() => setScanFlash(false), 500);
    }
  };

  const handleStartScan = async () => {
    if (!settings.enableBarcodeScanner) return;
    if (!videoRef.current) return;
    setScanning(true);
    await startScanner(videoRef.current, handleScanResult, () => {}, undefined);
  };

  const handleStopScan = () => {
    stopScanner();
    setScanning(false);
  };

  useEffect(() => {
    return () => handleStopScan();
  }, []);

  const handleCompleteSale = () => {
    completeSale(parseFloat(paymentInput || "0"), paymentMethod);
    setPaymentInput("");
    setShowSuccess(true);
    setTimeout(() => { setShowSuccess(false); setMode("cart"); }, 2200);
  };

  const handleAddUtang = () => {
    if (!selectedCustomer) return;
    addUtangSale(selectedCustomer);
    setSelectedCustomer("");
    setShowSuccess(true);
    setTimeout(() => { setShowSuccess(false); setMode("cart"); }, 2200);
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ background: bg }}>
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-4"
          style={{ background: isDark ? "#14532d" : "#dcfce7" }}>
          <CheckCircle size={52} className="text-green-500" />
        </div>
        <p className="font-bold" style={{ color: text, fontSize: "22px" }}>{t.saleDone}</p>
        <p className="mt-1" style={{ color: textMuted }}>{t.saleDoneMsg}</p>
      </div>
    );
  }

  // ── Utang customer select ───────────────────────────────────────────────────
  if (mode === "utang_select") {
    return (
      <div className="flex flex-col h-full" style={{ background: bg }}>
        {/* Header */}
        <div style={{ background: card, borderBottom: `1px solid ${cardBorder}` }} className="px-5 pt-4 pb-4 flex items-center gap-3">
          <button onClick={() => setMode("cart")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: subCard }}>
            <X size={18} style={{ color: textMuted }} />
          </button>
          <div>
            <p className="font-bold" style={{ color: text, fontSize: "18px" }}>{t.selectCustomer}</p>
            <p className="text-xs" style={{ color: textMuted }}>
              Total: <span style={{ color: "#d97706", fontWeight: 700 }}>₱{cartTotal.toFixed(2)}</span>
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {customers.map(c => {
            const bal = c.transactions.filter(tx => tx.balance > 0).reduce((s, tx) => s + tx.balance, 0);
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCustomer(c.id)}
                className="w-full flex items-center justify-between p-4 mb-3 rounded-2xl border-2 transition-all text-left"
                style={{
                  background: selectedCustomer === c.id ? (isDark ? "#451a03" : "#fffbeb") : card,
                  borderColor: selectedCustomer === c.id ? "#f59e0b" : cardBorder,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: isDark ? "#451a03" : "#fef3c7" }}>
                    <span style={{ color: "#d97706", fontWeight: 700, fontSize: "14px" }}>{c.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: text }}>{c.name}</p>
                    <p className="text-xs" style={{ color: textMuted }}>{c.phone || t.noPhone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-red-500">₱{bal.toFixed(2)}</p>
                  <p className="text-xs" style={{ color: textMuted }}>{t.currentUtang}</p>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => navigate("/utang")}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed"
            style={{ borderColor: isDark ? "#374151" : "#e5e7eb", color: textMuted }}
          >
            <Plus size={16} />
            <span className="text-sm">{t.addNewCustomer}</span>
          </button>
        </div>

        <div className="p-4" style={{ background: card, borderTop: `1px solid ${cardBorder}` }}>
          <button
            onClick={handleAddUtang}
            disabled={!selectedCustomer}
            className="w-full py-4 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: selectedCustomer ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)" : "#d1d5db",
              fontSize: "16px",
              boxShadow: selectedCustomer ? "0 4px 16px rgba(217,119,6,0.4)" : "none",
            }}
          >
            {t.saveUtang} ₱{cartTotal.toFixed(2)}
          </button>
        </div>
      </div>
    );
  }

  // ── Complete sale screen ───────────────────────────────────────────────────
  if (mode === "complete") {
    return (
      <div className="flex flex-col h-full" style={{ background: bg }}>
        {/* Header */}
        <div style={{ background: card, borderBottom: `1px solid ${cardBorder}` }} className="px-5 pt-4 pb-4 flex items-center gap-3">
          <button onClick={() => setMode("cart")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: subCard }}>
            <X size={18} style={{ color: textMuted }} />
          </button>
          <p className="font-bold" style={{ color: text, fontSize: "18px" }}>{t.completeSale}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Order summary */}
          <div className="rounded-2xl p-4 mb-4 border" style={{ background: card, borderColor: cardBorder }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: textMuted }}>Order Summary</p>
            {cart.map(item => (
              <div key={item.productId} className="flex justify-between py-2 border-b last:border-0" style={{ borderColor: cardBorder }}>
                <span className="text-sm" style={{ color: textMuted }}>{item.productName} ×{item.quantity}</span>
                <span className="text-sm font-semibold" style={{ color: text }}>₱{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Total chip */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}>
            <div className="flex justify-between items-center">
              <span className="text-blue-100 font-medium">TOTAL</span>
              <span className="text-white font-black" style={{ fontSize: "28px" }}>₱{cartTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method selector (in complete sale screen) */}
          <div className="rounded-2xl p-4 mb-3 border" style={{ background: card, borderColor: cardBorder }}>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>{t.paymentMethod}</label>
            <div className="flex gap-2">
              {(["cash", "gcash", "paymaya"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold border transition-all"
                  style={{
                    background: paymentMethod === m
                      ? m === "gcash" ? "#2563eb" : m === "paymaya" ? "#16a34a" : "#374151"
                      : "transparent",
                    color: paymentMethod === m ? "#fff" : textMuted,
                    borderColor: paymentMethod === m ? "transparent" : cardBorder,
                  }}
                >
                  {m === "cash" ? "💵 Cash" : m === "gcash" ? "💙 GCash" : "💚 PayMaya"}
                </button>
              ))}
            </div>
          </div>

          {/* Payment input */}
          <div className="rounded-2xl p-4 mb-3 border" style={{ background: card, borderColor: cardBorder }}>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>{t.customerPaid}</label>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl" style={{ color: textMuted }}>₱</span>
              <input
                type="number"
                value={paymentInput}
                onChange={e => setPaymentInput(e.target.value)}
                placeholder="0.00"
                className="flex-1 outline-none font-black"
                style={{ fontSize: "28px", background: "transparent", color: text }}
              />
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2 mb-4">
            {[20, 50, 100, 200, 500].map(amt => (
              <button
                key={amt}
                onClick={() => setPaymentInput(String(amt))}
                className="flex-1 py-2 rounded-xl text-sm font-semibold border"
                style={{ background: card, borderColor: cardBorder, color: text }}
              >
                ₱{amt}
              </button>
            ))}
          </div>

          {/* Change */}
          {paymentInput && (
            <div
              className="rounded-2xl p-4 mb-4 border"
              style={{
                background: change >= 0 ? (isDark ? "#14532d" : "#f0fdf4") : (isDark ? "#450a0a" : "#fef2f2"),
                borderColor: change >= 0 ? (isDark ? "#166534" : "#bbf7d0") : (isDark ? "#7f1d1d" : "#fecaca"),
              }}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold" style={{ color: change >= 0 ? "#16a34a" : "#dc2626" }}>
                  {change >= 0 ? t.change : t.short}
                </span>
                <span className="font-black" style={{ fontSize: "24px", color: change >= 0 ? "#16a34a" : "#dc2626" }}>
                  {change >= 0 ? `₱${change.toFixed(2)}` : `₱${Math.abs(change).toFixed(2)}`}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4" style={{ background: card, borderTop: `1px solid ${cardBorder}` }}>
          <button
            onClick={handleCompleteSale}
            disabled={change < 0 || !paymentInput}
            className="w-full py-4 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: change >= 0 && paymentInput ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" : "#d1d5db",
              fontSize: "16px",
              boxShadow: change >= 0 && paymentInput ? "0 4px 16px rgba(22,163,74,0.4)" : "none",
            }}
          >
            ✓ {t.completeSale}
          </button>
        </div>
      </div>
    );
  }

  // ── Main cart view ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* ── FIXED HEADER: Scanner ── */}
      <div
        className="flex-shrink-0 px-4 pt-3 pb-3"
        style={{ background: "linear-gradient(160deg, #1e3a8a 0%, #2563eb 100%)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white font-bold" style={{ fontSize: "18px" }}>{t.sell_screen}</h2>
          {cart.length > 0 && (
            <span className="text-white text-xs px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
              {cart.length} item{cart.length !== 1 ? "s" : ""} • ₱{cartTotal.toFixed(2)}
            </span>
          )}
        </div>

        {/* Barcode scanner area */}
        <div
          className={`relative rounded-2xl overflow-hidden flex items-center justify-center transition-all ${scanFlash ? "ring-2 ring-green-400" : ""}`}
          style={{ height: "80px", background: "#0f172a" }}
        >
          <video ref={videoRef} className="absolute inset-0 opacity-0 pointer-events-none" muted playsInline />
          <div className="relative z-10 flex items-center gap-3 w-full px-4">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Scan size={18} className="text-white" />
            </div>
            <input
              ref={barcodeRef}
              type="text"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleBarcodeSearch()}
              placeholder={t.scanBarcode}
              className="flex-1 bg-transparent text-white outline-none text-sm"
              style={{ color: "white" }}
            />
            <button
              onClick={scanning ? handleStopScan : handleStartScan}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
              style={{ borderColor: "#1d4ed8", color: "#e0e7ff", background: scanning ? "#1d4ed8" : "transparent" }}
            >
              {scanning ? "Stop" : "Cam"}
            </button>
            {barcodeInput && (
              <button onClick={handleBarcodeSearch} className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
                Add
              </button>
            )}
          </div>
          {/* Scanner overlay lines */}
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-px opacity-60 z-20" style={{ background: "#f87171" }} />
          <div className="absolute left-6 top-3 w-4 h-4 border-l-2 border-t-2 border-white opacity-30 rounded-tl-sm z-20" />
          <div className="absolute right-6 top-3 w-4 h-4 border-r-2 border-t-2 border-white opacity-30 rounded-tr-sm z-20" />
          <div className="absolute left-6 bottom-3 w-4 h-4 border-l-2 border-b-2 border-white opacity-30 rounded-bl-sm z-20" />
          <div className="absolute right-6 bottom-3 w-4 h-4 border-r-2 border-b-2 border-white opacity-30 rounded-br-sm z-20" />
        </div>
      </div>

      {/* ── PINNED QUICK ITEMS (below scanner, above cart) ── */}
      <div
        className="flex-shrink-0 px-4 py-2.5 border-b"
        style={{ background: card, borderColor: cardBorder }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Zap size={12} className="text-blue-500" />
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>{t.quickItems}</p>
        </div>
        <div
          className="flex gap-2 pb-0.5"
          style={{ overflowX: "auto", scrollbarWidth: "none" }}
        >
          {quickItems.map(product => (
            <button
              key={product.id}
              onClick={() => addToCart(product.id)}
              disabled={displayStock(product) === 0}
              className="flex-shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-2xl border-2 transition-all active:scale-95 relative"
              style={{
                minWidth: "64px",
                background: displayStock(product) === 0
                  ? (isDark ? "#1f2937" : "#f9fafb")
                  : (isDark ? "#1e3a8a" : "#eff6ff"),
                borderColor: displayStock(product) === 0
                  ? (isDark ? "#374151" : "#e5e7eb")
                  : (isDark ? "#3b82f6" : "#bfdbfe"),
                opacity: displayStock(product) === 0 ? 0.45 : 1,
              }}
            >
              <span className="text-lg leading-none">{product.emoji}</span>
              <span
                className="text-center leading-tight"
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  maxWidth: "58px",
                  color: isDark ? "#bfdbfe" : "#1e40af",
                }}
              >
                {product.name.split(" ")[0]}
              </span>
              <span
                className="font-bold"
                style={{ fontSize: "11px", color: isDark ? "#60a5fa" : "#2563eb" }}
              >
                ₱{product.price}
              </span>
              {/* In-cart badge */}
              {cart.find(c => c.productId === product.id) && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center"
                  style={{ fontSize: "9px", fontWeight: 700 }}
                >
                  {cart.find(c => c.productId === product.id)?.quantity}
                </span>
              )}
            </button>
          ))}
      </div>
    </div>

      {/* Product search */}
      <div className="flex-shrink-0 px-4 py-2" style={{ background: bg }}>
        <div
          className="rounded-2xl flex items-center gap-3 px-4 py-3 border"
          style={{ background: card, borderColor: cardBorder }}
        >
          <Search size={16} style={{ color: textMuted }} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t.searchProduct}
            className="flex-1 outline-none text-sm"
            style={{ background: "transparent", color: text }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="text-xs font-semibold" style={{ color: textMuted }}>Clear</button>
          )}
        </div>
        {searchTerm && (
          <div className="mt-2 space-y-2" style={{ maxHeight: "160px", overflowY: "auto" }}>
            {searchResults.length === 0 ? (
              <p className="text-xs px-2" style={{ color: textMuted }}>No products found</p>
            ) : (
              searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left"
                  style={{ background: card, borderColor: cardBorder }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{p.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: text }}>{p.name}</p>
                      <p className="text-xs" style={{ color: textMuted }}>₱{p.price} · {displayStock(p)} stock</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: isDark ? "#1e3a8a" : "#eff6ff", color: "#2563eb" }}>Add</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── SCROLLABLE CART ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32" style={{ color: isDark ? "#4b5563" : "#d1d5db" }}>
            <CartEmptyIcon />
            <p className="text-sm mt-2" style={{ color: isDark ? "#4b5563" : "#9ca3af" }}>{t.noItemsInCart}</p>
            <p className="text-xs mt-0.5" style={{ color: isDark ? "#374151" : "#d1d5db" }}>{t.tapToAdd}</p>
          </div>
        ) : (
          cart.map(item => (
            <div
              key={item.productId}
              className="rounded-2xl mb-2 overflow-hidden border transition-all"
              style={{
                background: card,
                borderColor: selectedCartItem === item.productId ? "#2563eb" : cardBorder,
                boxShadow: selectedCartItem === item.productId ? "0 0 0 1px #2563eb" : "none",
              }}
            >
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                onClick={() => setSelectedCartItem(selectedCartItem === item.productId ? null : item.productId)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{products.find(p => p.id === item.productId)?.emoji || "📦"}</span>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: text }}>{item.productName}</p>
                    <p className="text-xs" style={{ color: textMuted }}>₱{item.price} × {item.quantity}</p>
                  </div>
                </div>
                <p className="font-bold" style={{ color: text }}>₱{(item.price * item.quantity).toFixed(2)}</p>
              </button>

              {selectedCartItem === item.productId && (
                <div className="flex items-center justify-between px-4 pb-3 gap-3">
                  <div className="flex items-center gap-2 rounded-xl p-1" style={{ background: subCard }}>
                    <button
                      onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: card, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}
                    >
                      <Minus size={14} style={{ color: textMuted }} />
                    </button>
                    <span className="font-bold w-6 text-center" style={{ color: text }}>{item.quantity}</span>
                    <button
                      onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                      className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"
                    >
                      <Plus size={14} className="text-white" />
                    </button>
                  </div>
                  <button
                    onClick={() => { removeFromCart(item.productId); setSelectedCartItem(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border"
                    style={{
                      background: isDark ? "#450a0a" : "#fef2f2",
                      borderColor: isDark ? "#7f1d1d" : "#fecaca",
                    }}
                  >
                    <Trash2 size={14} className="text-red-500" />
                    <span className="text-red-500 text-xs font-semibold">
                      {settings.language === "fil" ? "Alisin" : "Remove"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── FIXED FOOTER: Total + Buttons ── */}
      <div
        className="flex-shrink-0 px-4 py-3 border-t"
        style={{ background: card, borderColor: cardBorder, boxShadow: "0 -4px 16px rgba(0,0,0,0.06)" }}
      >
        {cart.length > 0 && (
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium" style={{ color: textMuted }}>{t.total}</span>
            <span className="font-black" style={{ fontSize: "24px", color: text }}>₱{cartTotal.toFixed(2)}</span>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setMode("utang_select")}
            disabled={cart.length === 0}
            className="flex-1 py-3.5 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
              boxShadow: cart.length > 0 ? "0 4px 12px rgba(217,119,6,0.35)" : "none",
              fontSize: "14px",
            }}
          >
            📋 {t.addUtangBtn}
          </button>
          <button
            onClick={() => setMode("complete")}
            disabled={cart.length === 0}
            className="flex-[2] py-3.5 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              boxShadow: cart.length > 0 ? "0 4px 12px rgba(22,163,74,0.35)" : "none",
              fontSize: "15px",
            }}
          >
            {cart.length === 0 ? `✓ ${t.completeSale}` : `✓ ${t.paidBadge}${cartTotal.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartEmptyIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
      <path d="M6 8H10L14 28H38L42 12H16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="34" r="3" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="34" cy="34" r="3" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
