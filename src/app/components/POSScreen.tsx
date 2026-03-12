import React, { useState, useRef, useEffect } from "react";
import { Scan, Plus, Minus, Trash2, X, CheckCircle, Zap, Search, ShieldAlert } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { startScanner, stopScanner } from "../hardware/barcodeScanner";

type Mode = "cart" | "complete" | "utang_select";
type UtangType = "full" | "partial";

export function POSScreen() {
  const { products, cart, addToCart, removeFromCart, updateCartQty, completeSale, addUtangSale, addCustomer, customers, cartTotal, settings, t, getCustomerCreditStatus, verifyManagementPinForAction } = useStore();
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
  const [utangType, setUtangType] = useState<UtangType>("full");
  const [customerSearch, setCustomerSearch] = useState("");
  const [partialPaidInput, setPartialPaidInput] = useState("");
  const [utangWarning, setUtangWarning] = useState<string | null>(null);
  const [overrideAttempt, setOverrideAttempt] = useState<{ customerId: string; amountPaid: number; applyAdvanceFirst: boolean } | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerNote, setNewCustomerNote] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const utangScrollRef = useRef<HTMLDivElement>(null);
  const matchesBarcode = (product: { barcode?: string; barcodes?: string[] }, code: string) => {
    if (!code) return false;
    if ((product.barcode || "") === code) return true;
    return (product.barcodes || []).some(value => value === code);
  };

  const quickItems = products.filter(p => p.isQuickItem);
  const change = parseFloat(paymentInput || "0") - cartTotal;
  const searchResults = searchTerm.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode || "").includes(searchTerm) ||
        (p.barcodes || []).some(code => code.includes(searchTerm))
      ).slice(0, 8)
    : [];
  const filteredCustomers = customerSearch.trim()
    ? customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.phone || "").includes(customerSearch)
      )
    : customers;
  const partialPaid = Math.max(0, Number(partialPaidInput || 0));
  const remainingBalance = Math.max(0, cartTotal - partialPaid);
  const partialInvalid = utangType === "partial" && (partialPaid <= 0 || partialPaid >= cartTotal);
  const selectedCustomerData = selectedCustomer ? customers.find(customer => customer.id === selectedCustomer) : null;
  const selectedAdvanceBalance = Math.max(0, Number(selectedCustomerData?.advanceBalance || 0));
  const selectedUtangAmount = Math.max(0, cartTotal - (utangType === "partial" ? partialPaid : 0));
  const selectedAdvanceUsed = Math.min(selectedAdvanceBalance, selectedUtangAmount);
  const selectedRemainingAfterAdvance = Math.max(0, selectedUtangAmount - selectedAdvanceUsed);
  const showAdvanceActions = !!selectedCustomer && selectedAdvanceBalance > 0 && selectedUtangAmount > 0;
  const selectedCustomerCredit = selectedCustomer ? getCustomerCreditStatus(selectedCustomer) : null;
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
    const code = barcodeInput.trim();
    const found = products.find(p => matchesBarcode(p, code));
    if (found) {
      addToCart(found.id);
      setBarcodeInput("");
      setScanFlash(true);
      setTimeout(() => setScanFlash(false), 500);
    }
  };

  const handleScanResult = (code: string) => {
    setBarcodeInput(code);
    const found = products.find(p => matchesBarcode(p, code));
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

  useEffect(() => {
    if (!settings.enableUtang && mode === "utang_select") {
      setMode("cart");
    }
  }, [mode, settings.enableUtang]);

  const handleCompleteSale = () => {
    completeSale(parseFloat(paymentInput || "0"), paymentMethod);
    setPaymentInput("");
    setShowSuccess(true);
    setTimeout(() => { setShowSuccess(false); setMode("cart"); }, 2200);
  };

  const openUtangSelect = (type: UtangType) => {
    setUtangType(type);
    setMode("utang_select");
    setSelectedCustomer("");
    setCustomerSearch("");
    setPartialPaidInput("");
    setUtangWarning(null);
    setOverrideAttempt(null);
    setShowPinModal(false);
    setPinInput("");
    setPinError(null);
    setShowAddCustomerModal(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerNote("");
  };

  const handleAddUtang = (
    forceOverride = false,
    attempt?: { customerId: string; amountPaid: number; applyAdvanceFirst: boolean },
    applyAdvanceFirst = false
  ) => {
    const customerId = attempt?.customerId || selectedCustomer;
    if (!customerId) return;
    const amountPaid = attempt ? attempt.amountPaid : utangType === "partial" ? partialPaid : 0;
    const shouldApplyAdvance = attempt ? attempt.applyAdvanceFirst : applyAdvanceFirst;
    if (utangType === "partial" && amountPaid <= 0) {
      setUtangWarning(
        settings.language === "fil"
          ? "Ilagay ang halagang binayad para sa partial payment."
          : "Enter an amount paid for partial payment."
      );
      return;
    }
    if (utangType === "partial" && amountPaid >= cartTotal) {
      setUtangWarning(
        settings.language === "fil"
          ? "Ang halagang binayad ay dapat mas mababa sa total."
          : "Amount paid must be lower than total for partial payment."
      );
      return;
    }

    const result = addUtangSale(customerId, amountPaid, forceOverride, shouldApplyAdvance);
    if (result.ok) {
      setSelectedCustomer("");
      setCustomerSearch("");
      setPartialPaidInput("");
      setUtangWarning(null);
      setOverrideAttempt(null);
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); setMode("cart"); }, 2200);
      return;
    }

    if (result.code === "credit_limit_exceeded") {
      const available = result.credit?.availableCredit ?? 0;
      setUtangWarning(
        settings.language === "fil"
          ? `Lumagpas sa credit limit. Natitirang available credit: \u20B1${available.toFixed(2)}.`
          : `Credit limit exceeded. This customer has only \u20B1${available.toFixed(2)} available credit remaining.`
      );
      setOverrideAttempt({ customerId, amountPaid, applyAdvanceFirst: shouldApplyAdvance });
      return;
    }

    if (result.code === "utang_disabled") {
      setUtangWarning(settings.language === "fil" ? "Disabled ang utang feature." : "Utang feature is disabled.");
      return;
    }

    setUtangWarning(settings.language === "fil" ? "Hindi ma-save ang utang." : "Unable to save utang transaction.");
  };

  const handleVerifyPinOverride = async () => {
    if (!overrideAttempt) return;
    if (!pinInput.trim()) {
      setPinError(settings.language === "fil" ? "Ilagay ang management PIN." : "Enter management PIN.");
      return;
    }
    setVerifyingPin(true);
    setPinError(null);
    try {
      const ok = await verifyManagementPinForAction(pinInput.trim());
      if (!ok) {
        setPinError(settings.language === "fil" ? "Maling PIN." : "Invalid management PIN.");
        return;
      }
      setShowPinModal(false);
      setPinInput("");
      handleAddUtang(true, overrideAttempt);
    } finally {
      setVerifyingPin(false);
    }
  };

  const closeAddCustomerModal = () => {
    setShowAddCustomerModal(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerNote("");
  };

  const handleSaveNewCustomer = () => {
    const name = newCustomerName.trim();
    if (!name) return;
    const customerId = addCustomer(
      name,
      newCustomerPhone.trim() || undefined,
      newCustomerNote.trim() || undefined
    );
    setSelectedCustomer(customerId);
    setCustomerSearch(name);
    setUtangWarning(null);
    setOverrideAttempt(null);
    closeAddCustomerModal();
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
      <div className="relative flex flex-col h-full" style={{ background: bg }}>
        {/* Header */}
        <div style={{ background: card, borderBottom: `1px solid ${cardBorder}` }} className="px-5 pt-4 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setMode("cart")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: subCard }}>
              <X size={18} style={{ color: textMuted }} />
            </button>
            <div>
              <p className="font-bold" style={{ color: text, fontSize: "18px" }}>{t.selectCustomer}</p>
              <p className="text-xs" style={{ color: textMuted }}>
                Total: <span style={{ color: "#d97706", fontWeight: 700 }}>{`\u20B1${cartTotal.toFixed(2)}`}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => { setUtangType("full"); setPartialPaidInput(""); setUtangWarning(null); setOverrideAttempt(null); }}
              className="py-2.5 rounded-xl font-semibold text-sm border transition-all"
              style={{
                background: utangType === "full" ? (isDark ? "#451a03" : "#fffbeb") : card,
                borderColor: utangType === "full" ? "#d97706" : cardBorder,
                color: utangType === "full" ? "#b45309" : textMuted,
              }}
            >
              {t.addUtangBtn}
            </button>
            <button
              onClick={() => { setUtangType("partial"); setUtangWarning(null); setOverrideAttempt(null); }}
              className="py-2.5 rounded-xl font-semibold text-sm border transition-all"
              style={{
                background: utangType === "partial" ? (isDark ? "#1e3a8a" : "#eff6ff") : card,
                borderColor: utangType === "partial" ? "#2563eb" : cardBorder,
                color: utangType === "partial" ? "#1d4ed8" : textMuted,
              }}
            >
              {t.partialPaymentBtn}
            </button>
          </div>
        </div>

        <div ref={utangScrollRef} className="flex-1 overflow-y-auto p-4">
          {utangType === "partial" && (
            <div className="rounded-2xl p-4 mb-3 border" style={{ background: card, borderColor: cardBorder }}>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
                {t.amountPaidLabel}
              </label>
              <input
                type="number"
                min="0"
                value={partialPaidInput}
                onChange={e => {
                  setPartialPaidInput(e.target.value);
                  setUtangWarning(null);
                  setOverrideAttempt(null);
                }}
                placeholder="0.00"
                className="w-full outline-none font-black"
                style={{ fontSize: "28px", background: "transparent", color: text }}
              />
              <p className="text-xs mt-2" style={{ color: textMuted }}>
                {t.remainingBalance}: <span style={{ color: "#d97706", fontWeight: 700 }}>{`\u20B1${remainingBalance.toFixed(2)}`}</span>
              </p>
            </div>
          )}

          <div className="rounded-2xl flex items-center gap-3 px-4 py-3 border mb-3" style={{ background: card, borderColor: cardBorder }}>
            <Search size={16} style={{ color: textMuted }} />
            <input
              type="text"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              placeholder={t.searchCustomer}
              className="flex-1 outline-none text-sm"
              style={{ background: "transparent", color: text }}
            />
            {customerSearch && (
              <button onClick={() => setCustomerSearch("")} className="text-xs font-semibold" style={{ color: textMuted }}>
                Clear
              </button>
            )}
          </div>

          {selectedCustomerCredit && (
            <div className="rounded-2xl p-3 mt-3 border" style={{ background: card, borderColor: cardBorder }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: textMuted }}>
                {settings.language === "fil" ? "Customer Summary" : "Customer Summary"}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl p-2" style={{ background: subCard }}>
                  <p style={{ color: textMuted }}>{settings.language === "fil" ? "Outstanding Utang" : "Outstanding Utang"}</p>
                  <p className="font-semibold" style={{ color: text }}>{`\u20B1${selectedCustomerCredit.currentBalance.toFixed(2)}`}</p>
                </div>
                <div className="rounded-xl p-2" style={{ background: subCard }}>
                  <p style={{ color: textMuted }}>{settings.language === "fil" ? "Advance Balance" : "Advance Balance"}</p>
                  <p className="font-semibold" style={{ color: text }}>{`\u20B1${selectedAdvanceBalance.toFixed(2)}`}</p>
                </div>
                <div className="rounded-xl p-2" style={{ background: subCard }}>
                  <p style={{ color: textMuted }}>{settings.language === "fil" ? "Credit Limit" : "Credit Limit"}</p>
                  <p className="font-semibold" style={{ color: text }}>
                    {selectedCustomerCredit.creditLimit === null ? "No limit" : `\u20B1${selectedCustomerCredit.creditLimit.toFixed(2)}`}
                  </p>
                </div>
                <div className="rounded-xl p-2" style={{ background: subCard }}>
                  <p style={{ color: textMuted }}>{settings.language === "fil" ? "Cart Total" : "Cart Total"}</p>
                  <p className="font-semibold" style={{ color: text }}>{`\u20B1${cartTotal.toFixed(2)}`}</p>
                </div>
                <div className="rounded-xl p-2 col-span-2" style={{ background: subCard }}>
                  <p style={{ color: textMuted }}>{settings.language === "fil" ? "Available Credit" : "Available Credit"}</p>
                  <p className="font-semibold" style={{ color: text }}>
                    {selectedCustomerCredit.availableCredit === null ? "Unlimited" : `\u20B1${selectedCustomerCredit.availableCredit.toFixed(2)}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {showAdvanceActions && (
            <div className="rounded-2xl p-3 mt-3 border" style={{ background: card, borderColor: cardBorder }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: textMuted }}>
                {settings.language === "fil" ? "Advance Balance Action" : "Advance Balance Action"}
              </p>
              <p className="text-xs mb-3" style={{ color: textMuted }}>
                {selectedRemainingAfterAdvance <= 0
                  ? (settings.language === "fil"
                      ? `Maaaring i-cover ng advance ang buong \u20B1${selectedUtangAmount.toFixed(2)}. Walang bagong utang na gagawin.`
                      : `Advance can fully cover \u20B1${selectedUtangAmount.toFixed(2)}. No new utang will be created.`)
                  : (settings.language === "fil"
                      ? `Advance na magagamit: \u20B1${selectedAdvanceUsed.toFixed(2)}. Natitirang utang: \u20B1${selectedRemainingAfterAdvance.toFixed(2)}.`
                      : `Advance to use: \u20B1${selectedAdvanceUsed.toFixed(2)}. Remaining utang: \u20B1${selectedRemainingAfterAdvance.toFixed(2)}.`)}
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => handleAddUtang(false, undefined, true)}
                  disabled={partialInvalid}
                  className="w-full py-2.5 rounded-xl font-semibold text-white disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)" }}
                >
                  {settings.language === "fil" ? "Use Advance First" : "Use Advance First"}
                </button>
                <button
                  onClick={() => handleAddUtang(false, undefined, false)}
                  disabled={partialInvalid}
                  className="w-full py-2.5 rounded-xl font-semibold border disabled:opacity-40"
                  style={{ borderColor: cardBorder, color: text }}
                >
                  {settings.language === "fil" ? "Create Full Utang" : "Create Full Utang"}
                </button>
                <button
                  onClick={() => {
                    setSelectedCustomer("");
                    setUtangWarning(null);
                    setOverrideAttempt(null);
                  }}
                  className="w-full py-2.5 rounded-xl font-semibold"
                  style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }}
                >
                  {settings.language === "fil" ? "Cancel" : "Cancel"}
                </button>
              </div>
            </div>
          )}

          {filteredCustomers.length === 0 ? (
            <div className="rounded-2xl p-4 text-sm text-center border" style={{ background: card, borderColor: cardBorder, color: textMuted }}>
              {settings.language === "fil" ? "Walang customer na nakita." : "No customers found."}
            </div>
          ) : (
            filteredCustomers.map(c => {
              const credit = getCustomerCreditStatus(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomer(c.id);
                    setUtangWarning(null);
                    setOverrideAttempt(null);
                    requestAnimationFrame(() => {
                      utangScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                    });
                  }}
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
                    <p className="font-bold text-sm text-red-500">{`\u20B1${credit.currentBalance.toFixed(2)}`}</p>
                    <p className="text-[11px]" style={{ color: textMuted }}>
                      {settings.language === "fil" ? "Available" : "Available"}: {credit.availableCredit === null ? "Unlimited" : `\u20B1${credit.availableCredit.toFixed(2)}`}
                    </p>
                  </div>
                </button>
              );
            })
          )}

          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed"
            style={{ borderColor: isDark ? "#374151" : "#e5e7eb", color: textMuted }}
          >
            <Plus size={16} />
            <span className="text-sm">{t.addNewCustomer}</span>
          </button>

          {utangWarning && (
            <div
              className="rounded-2xl p-3 mt-3 border"
              style={{
                background: isDark ? "#450a0a" : "#fff7ed",
                borderColor: isDark ? "#7f1d1d" : "#fed7aa",
              }}
            >
              <div className="flex items-start gap-2">
                <ShieldAlert size={16} className="mt-0.5" style={{ color: "#d97706" }} />
                <p className="text-sm" style={{ color: isDark ? "#fed7aa" : "#9a3412" }}>{utangWarning}</p>
              </div>
              {overrideAttempt && (
                <button
                  onClick={() => {
                    setShowPinModal(true);
                    setPinError(null);
                    setPinInput("");
                  }}
                  className="mt-3 px-3 py-2 rounded-xl text-xs font-semibold border"
                  style={{ borderColor: "#d97706", color: "#d97706" }}
                >
                  {settings.language === "fil" ? "Override gamit ang Management PIN" : "Override with Management PIN"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="p-4" style={{ background: card, borderTop: `1px solid ${cardBorder}` }}>
          {showAdvanceActions ? (
            <div className="text-center text-xs" style={{ color: textMuted }}>
              {settings.language === "fil"
                ? "Pumili ng action sa Advance Balance options sa itaas."
                : "Choose an action in the Advance Balance options above."}
            </div>
          ) : (
            <button
              onClick={() => handleAddUtang()}
              disabled={!selectedCustomer || partialInvalid}
              className="w-full py-4 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: selectedCustomer && !partialInvalid
                  ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)"
                  : "#d1d5db",
                fontSize: "16px",
                boxShadow: selectedCustomer && !partialInvalid ? "0 4px 16px rgba(217,119,6,0.4)" : "none",
              }}
            >
              {utangType === "partial"
                ? `${t.savePartialPayment} \u20B1${remainingBalance.toFixed(2)}`
                : `${t.saveUtang} \u20B1${cartTotal.toFixed(2)}`}
            </button>
          )}
        </div>

        {showAddCustomerModal && (
          <div className="absolute inset-0 flex items-end z-50" style={{ background: "rgba(0,0,0,0.55)" }}>
            <div className="w-full rounded-t-3xl p-6" style={{ background: card }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg" style={{ color: text }}>{t.newCustomer}</h3>
                <button
                  onClick={closeAddCustomerModal}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: isDark ? "#374151" : "#f3f4f6" }}
                >
                  <X size={16} style={{ color: textMuted }} />
                </button>
              </div>

              <div className="mb-4">
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
                  {t.customerName} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={e => setNewCustomerName(e.target.value)}
                  placeholder={t.customerNamePlaceholder}
                  className="w-full rounded-xl px-4 py-3 outline-none text-sm border"
                  style={{ background: isDark ? "#374151" : "#f9fafb", color: text, borderColor: cardBorder }}
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
                  {t.phoneNumber}
                </label>
                <input
                  type="tel"
                  value={newCustomerPhone}
                  onChange={e => setNewCustomerPhone(e.target.value)}
                  placeholder={t.phonePlaceholder}
                  className="w-full rounded-xl px-4 py-3 outline-none text-sm border"
                  style={{ background: isDark ? "#374151" : "#f9fafb", color: text, borderColor: cardBorder }}
                />
              </div>

              <div className="mb-6">
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
                  {t.customerNote}
                </label>
                <textarea
                  value={newCustomerNote}
                  onChange={e => setNewCustomerNote(e.target.value)}
                  placeholder={t.customerNotePlaceholder}
                  className="w-full rounded-xl px-4 py-3 outline-none text-sm border resize-none"
                  style={{ background: isDark ? "#374151" : "#f9fafb", color: text, borderColor: cardBorder }}
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closeAddCustomerModal}
                  className="flex-1 py-3 rounded-2xl font-semibold"
                  style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }}
                >
                  {t.cancelBtn}
                </button>
                <button
                  onClick={handleSaveNewCustomer}
                  disabled={!newCustomerName.trim()}
                  className="flex-1 py-3 rounded-2xl font-semibold text-white disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)" }}
                >
                  {t.saveCustomer}
                </button>
              </div>
            </div>
          </div>
        )}

        {showPinModal && (
          <div className="absolute inset-0 flex items-end z-50" style={{ background: "rgba(0,0,0,0.55)" }}>
            <div className="w-full rounded-t-3xl p-6" style={{ background: card }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold" style={{ color: text, fontSize: "18px" }}>
                  {settings.language === "fil" ? "Management Override" : "Management Override"}
                </h3>
                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput("");
                    setPinError(null);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: isDark ? "#374151" : "#f3f4f6" }}
                >
                  <X size={16} style={{ color: textMuted }} />
                </button>
              </div>
              <p className="text-sm mb-3" style={{ color: textMuted }}>
                {settings.language === "fil"
                  ? "Ilagay ang management PIN para ituloy ang utang na lampas sa limit."
                  : "Enter the management PIN to continue this over-limit utang."}
              </p>
              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                placeholder={settings.language === "fil" ? "Management PIN" : "Management PIN"}
                className="w-full rounded-xl px-4 py-3 outline-none text-sm border"
                style={{ background: isDark ? "#374151" : "#f9fafb", color: text, borderColor: cardBorder }}
              />
              {pinError && <p className="text-xs mt-2" style={{ color: "#dc2626" }}>{pinError}</p>}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput("");
                    setPinError(null);
                  }}
                  className="flex-1 py-3 rounded-2xl font-semibold"
                  style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }}
                >
                  {t.cancelBtn}
                </button>
                <button
                  onClick={handleVerifyPinOverride}
                  disabled={verifyingPin}
                  className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-semibold disabled:opacity-40"
                >
                  {verifyingPin
                    ? (settings.language === "fil" ? "Verifying..." : "Verifying...")
                    : (settings.language === "fil" ? "Verify PIN" : "Verify PIN")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Complete sale screen ───────────────────────────────────────────────────
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
          {settings.enableUtang && (
            <>
              <button
                onClick={() => openUtangSelect("full")}
                disabled={cart.length === 0}
                className="flex-1 py-3.5 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                  boxShadow: cart.length > 0 ? "0 4px 12px rgba(217,119,6,0.35)" : "none",
                  fontSize: "14px",
                }}
              >
                {t.addUtangBtn}
              </button>
              <button
                onClick={() => openUtangSelect("partial")}
                disabled={cart.length === 0}
                className="flex-1 py-3.5 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  boxShadow: cart.length > 0 ? "0 4px 12px rgba(37,99,235,0.35)" : "none",
                  fontSize: "14px",
                }}
              >
                {t.partialPaymentBtn}
              </button>
            </>
          )}
          <button
            onClick={() => setMode("complete")}
            disabled={cart.length === 0}
            className={`${settings.enableUtang ? "flex-[2]" : "flex-1"} py-3.5 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-40`}
            style={{
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              boxShadow: cart.length > 0 ? "0 4px 12px rgba(22,163,74,0.35)" : "none",
              fontSize: "15px",
            }}
          >
            {cart.length === 0 ? t.completeSale : `${t.paidBadge}${cartTotal.toFixed(2)}`}
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
