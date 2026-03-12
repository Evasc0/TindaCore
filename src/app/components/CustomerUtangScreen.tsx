import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { ArrowLeft, Plus, CheckCircle, Clock, AlertCircle, ShoppingBag, X, Check, Pencil } from "lucide-react";
import { useStore } from "../context/StoreContext";

export function CustomerUtangScreen() {
  const { customers, sales, getCustomerBalance, getCustomerCreditStatus, updateCustomerProfile, recordPayment, clearCart, settings, t } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isDark = settings.theme === "dark";

  // Determine back path
  const isManagementRoute = location.pathname.startsWith("/management");
  const backPath = isManagementRoute ? "/management/utang" : "/utang";

  const customer = customers.find(c => c.id === id);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [removeLimit, setRemoveLimit] = useState(true);

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  useEffect(() => {
    if (!settings.enableUtang && !isManagementRoute) {
      navigate("/", { replace: true });
    }
  }, [isManagementRoute, navigate, settings.enableUtang]);

  useEffect(() => {
    if (!customer) return;
    setEditName(customer.name);
    setEditPhone(customer.phone || "");
    const noLimit = customer.creditLimit === null || customer.creditLimit === undefined;
    setRemoveLimit(noLimit);
    setEditCreditLimit(noLimit ? "" : String(customer.creditLimit));
  }, [customer]);

  if (!settings.enableUtang && !isManagementRoute) {
    return null;
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ background: bg }}>
        <p style={{ color: textMuted }}>Customer not found</p>
        <button onClick={() => navigate(backPath)} className="mt-3 text-blue-500 text-sm">â† {t.cancelBtn}</button>
      </div>
    );
  }

  const balance = getCustomerBalance(id!);
  const credit = getCustomerCreditStatus(id!);
  const getTxStatus = (tx: typeof customer.transactions[number]) =>
    tx.status || (tx.balance <= 0 ? "paid" : tx.balance < tx.amount ? "partial" : "unpaid");
  const outstandingTx = customer.transactions.filter(tx => getTxStatus(tx) !== "paid");
  const paidTx = customer.transactions.filter(tx => getTxStatus(tx) === "paid");
  const paymentHistory = [...(customer.paymentHistory || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const advanceBalance = customer.advanceBalance || 0;
  const paymentHistoryWithAdvance = (() => {
    let runningAdvance = advanceBalance;
    return paymentHistory.map(entry => {
      const advanceAfterEntry = Math.max(0, runningAdvance);
      runningAdvance = runningAdvance - Number(entry.advanceAmount || 0);
      return {
        ...entry,
        advanceAfterEntry,
      };
    });
  })();

  const handleRecordPayment = () => {
    const amt = Math.max(0, Number(payAmount || 0));
    if (!amt || amt <= 0) return;
    recordPayment(id!, amt);
    setPaidSuccess(true);
    setTimeout(() => {
      setPaidSuccess(false);
      setShowPayModal(false);
      setPayAmount("");
    }, 1300);
  };

  const handleSaveCustomerProfile = () => {
    const name = editName.trim();
    if (!name) return;
    const parsedLimit = Math.max(0, Number(editCreditLimit || 0));
    updateCustomerProfile(id!, {
      name,
      phone: editPhone.trim() || undefined,
      creditLimit: removeLimit ? null : parsedLimit,
    });
    setShowEditCustomerModal(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  };
  const getAmountPaid = (tx: typeof customer.transactions[number]) =>
    Math.max(0, tx.amount - tx.balance);

  const getInitials = (name: string) => name.split(" ").map(w => w[0]).join("").toUpperCase().substring(0, 2);

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div
        style={{ background: "linear-gradient(160deg, #451a03 0%, #92400e 60%, #d97706 100%)" }}
        className="px-4 pt-4 pb-6 flex-shrink-0"
      >
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(backPath)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <h2 className="text-white font-bold flex-1" style={{ fontSize: "18px" }}>{t.utangDetail}</h2>
          {isManagementRoute && (
            <button
              onClick={() => setShowEditCustomerModal(true)}
              className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
            <span className="text-amber-700 font-black text-xl">{getInitials(customer.name)}</span>
          </div>
          <div className="flex-1">
            <p className="text-white font-bold" style={{ fontSize: "20px" }}>{customer.name}</p>
            <p className="text-amber-300 text-sm">{customer.phone || t.noPhone2}</p>
          </div>
        </div>

        {/* Balance card */}
        <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.15)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-200 text-xs">{t.totalOutstanding}</p>
              <p className="text-white font-black" style={{ fontSize: "30px" }}>{`\u20B1${credit.currentBalance.toFixed(2)}`}</p>
            </div>
            {balance === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(34,197,94,0.3)" }}>
                <CheckCircle size={17} className="text-green-300" />
                <span className="text-green-200 text-sm font-semibold">{t.paid}!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(239,68,68,0.3)" }}>
                <AlertCircle size={17} className="text-red-200" />
                <span className="text-red-200 text-sm font-semibold">{outstandingTx.length} {t.pending}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.12)" }}>
              <p className="text-amber-200">Credit Limit</p>
              <p className="text-white font-semibold">
                {credit.creditLimit === null ? "No limit" : `\u20B1${credit.creditLimit.toFixed(2)}`}
              </p>
            </div>
            <div className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.12)" }}>
              <p className="text-amber-200">Available Credit</p>
              <p className="text-white font-semibold">
                {credit.availableCredit === null ? "Unlimited" : `\u20B1${credit.availableCredit.toFixed(2)}`}
              </p>
            </div>
            <div className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.12)" }}>
              <p className="text-amber-200">Advance</p>
              <p className="text-white font-semibold">{`\u20B1${advanceBalance.toFixed(2)}`}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${cardBorder}` }}>
        <button
          onClick={() => { clearCart(); navigate("/pos"); }}
          disabled={!settings.enableUtang}
          className="flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm active:scale-95 transition-transform disabled:opacity-40"
          style={{
            background: settings.enableUtang ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)" : "#d1d5db",
            color: "white",
            boxShadow: settings.enableUtang ? "0 4px 12px rgba(217,119,6,0.3)" : "none",
          }}
        >
          <Plus size={16} />
          {t.newUtang}
        </button>
        <button
          onClick={() => {
            if (balance <= 0) return;
            setPayAmount(balance.toFixed(2));
            setShowPayModal(true);
          }}
          disabled={balance <= 0}
          className="flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm active:scale-95 transition-transform disabled:opacity-40"
          style={{
            background: balance > 0 ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" : "#d1d5db",
            color: "white",
            boxShadow: balance > 0 ? "0 4px 12px rgba(22,163,74,0.3)" : "none",
          }}
        >
          <CheckCircle size={16} />
          {t.recordPayment}
        </button>
      </div>

      {/* Transactions */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
        {outstandingTx.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: textMuted }}>
              <Clock size={11} />
              Outstanding ({outstandingTx.length})
            </p>
            {outstandingTx.map(tx => {
              const status = getTxStatus(tx);
              const isPartial = status === "partial";
              return (
                <div
                  key={tx.id}
                  className="rounded-2xl mb-3 overflow-hidden border"
                  style={{ background: card, borderColor: isPartial ? (isDark ? "#92400e" : "#fdba74") : (isDark ? "#7f1d1d" : "#fecaca") }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b"
                    style={{
                      background: isPartial ? (isDark ? "#451a03" : "#fff7ed") : (isDark ? "#450a0a" : "#fef2f2"),
                      borderColor: isPartial ? (isDark ? "#92400e" : "#fdba74") : (isDark ? "#7f1d1d" : "#fecaca"),
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: isDark ? "#7f1d1d" : "#fee2e2" }}>
                        <ShoppingBag size={13} className="text-red-500" />
                      </div>
                      <span className="text-sm font-semibold text-red-500">{formatDate(tx.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-500 font-black">{`\u20B1${tx.balance.toFixed(2)}`}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: isPartial ? "#fb923c33" : "#ef444433", color: isPartial ? "#f97316" : "#dc2626" }}>
                        {status === "partial" ? "PARTIAL" : "UNPAID"}
                      </span>
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    {tx.items.map((item, i) => (
                      <div key={i} className="flex justify-between py-1.5 border-b last:border-0" style={{ borderColor: cardBorder }}>
                        <span className="text-sm" style={{ color: textMuted }}>{item.name} x {item.qty}</span>
                        <span className="text-sm font-medium" style={{ color: text }}>{`\u20B1${(item.subtotal ?? item.price * item.qty).toFixed(2)}`}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-xs" style={{ color: textMuted }}>
                    <p>{`Total: \u20B1${tx.amount.toFixed(2)}`}</p>
                    <p>{`Paid: \u20B1${getAmountPaid(tx).toFixed(2)}`}</p>
                    <p>{`Remaining: \u20B1${tx.balance.toFixed(2)}`}</p>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {paidTx.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3 mt-3 flex items-center gap-2" style={{ color: textMuted }}>
              <CheckCircle size={11} />
              {t.paid} ({paidTx.length})
            </p>
            {paidTx.map(tx => (
              <div
                key={tx.id}
                className="rounded-2xl mb-3 overflow-hidden border opacity-70"
                style={{ background: card, borderColor: isDark ? "#166534" : "#bbf7d0" }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3 border-b"
                  style={{
                    background: isDark ? "#14532d" : "#f0fdf4",
                    borderColor: isDark ? "#166534" : "#bbf7d0",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: isDark ? "#166534" : "#dcfce7" }}>
                      <CheckCircle size={13} className="text-green-500" />
                    </div>
                    <span className="text-sm font-semibold text-green-500">{formatDate(tx.date)}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: isDark ? "#166534" : "#dcfce7", color: "#16a34a" }}>
                    PAID
                  </span>
                </div>
                <div className="px-4 py-3">
                  {tx.items.map((item, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b last:border-0" style={{ borderColor: cardBorder }}>
                      <span className="text-sm" style={{ color: textMuted }}>{item.name} x {item.qty}</span>
                      <span className="text-sm" style={{ color: textMuted }}>{`\u20B1${(item.subtotal ?? item.price * item.qty).toFixed(2)}`}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-xs" style={{ color: textMuted }}>
                  <p>{`Total: \u20B1${tx.amount.toFixed(2)}`}</p>
                  <p>{`Paid: \u20B1${getAmountPaid(tx).toFixed(2)}`}</p>
                  <p>{`Remaining: \u20B1${tx.balance.toFixed(2)}`}</p>
                </div>
              </div>
            ))}
          </>
        )}

        <p className="text-xs font-semibold uppercase tracking-wider mb-3 mt-3" style={{ color: textMuted }}>
          Payment & Advance History
        </p>
        {paymentHistory.length === 0 ? (
          <div className="rounded-2xl p-4 border text-sm" style={{ background: card, borderColor: cardBorder, color: textMuted }}>
            No payment or advance history yet.
          </div>
        ) : (
          paymentHistoryWithAdvance.map(entry => {
            const isAdvanceDeduction = entry.entryType === "advance_deduction";
            const linkedSale = entry.referenceSaleId
              ? sales.find(sale => String(sale.id) === String(entry.referenceSaleId))
              : null;
            const deductedFromAdvance = Math.abs(entry.advanceAmount || 0) > 0
              ? Math.abs(entry.advanceAmount || 0)
              : entry.amount;
            const displayTotal = linkedSale?.total ?? entry.amount;
            return (
              <div
                key={entry.id}
                className={isAdvanceDeduction ? "rounded-2xl mb-3 overflow-hidden border" : "rounded-2xl mb-2 p-3 border"}
                style={{
                  background: card,
                  borderColor: isAdvanceDeduction
                    ? (isDark ? "#166534" : "#bbf7d0")
                    : cardBorder,
                }}
              >
                {isAdvanceDeduction ? (
                  <>
                    <div
                      className="flex items-center justify-between px-4 py-3 border-b"
                      style={{
                        background: isDark ? "#14532d" : "#f0fdf4",
                        borderColor: isDark ? "#166534" : "#bbf7d0",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: isDark ? "#166534" : "#dcfce7" }}>
                          <CheckCircle size={13} className="text-green-500" />
                        </div>
                        <span className="text-sm font-semibold text-green-500">{formatDate(entry.date)}</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: isDark ? "#166534" : "#dcfce7", color: "#16a34a" }}>
                        PAID
                      </span>
                    </div>
                    {linkedSale?.items?.length ? (
                      <div className="px-4 py-3">
                        {linkedSale.items.map((item, idx) => (
                          <div key={`${entry.id}-item-${idx}`} className="flex justify-between py-1.5 border-b last:border-0" style={{ borderColor: cardBorder }}>
                            <span className="text-sm" style={{ color: textMuted }}>{item.name} x {item.qty}</span>
                            <span className="text-sm" style={{ color: textMuted }}>{`\u20B1${(item.subtotal ?? item.price * item.qty).toFixed(2)}`}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-sm" style={{ color: textMuted }}>
                        {entry.note || "Advance applied in checkout."}
                      </div>
                    )}
                    <div className="px-4 pb-3 grid grid-cols-2 gap-2 text-xs" style={{ color: textMuted }}>
                      <p>{`Total: \u20B1${displayTotal.toFixed(2)}`}</p>
                      <p>{`Paid: \u20B1${deductedFromAdvance.toFixed(2)} (advance)`}</p>
                    </div>
                    <p className="text-xs px-4 pb-2" style={{ color: textMuted }}>
                      {`Remaining Advance Balance: \u20B1${entry.advanceAfterEntry.toFixed(2)}`}
                    </p>
                    {entry.note && (
                      <p className="text-xs px-4 pb-3" style={{ color: textMuted }}>{entry.note}</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold" style={{ color: text }}>{formatDate(entry.date)}</p>
                      <p className="text-sm font-bold" style={{ color: "#16a34a" }}>
                        {`\u20B1${entry.amount.toFixed(2)}`}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs" style={{ color: textMuted }}>
                      <p>{`Applied: \u20B1${entry.appliedAmount.toFixed(2)}`}</p>
                      <p>{`Advance: \u20B1${entry.advanceAmount.toFixed(2)}`}</p>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}

        {customer.transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32" style={{ color: textMuted }}>
            <ShoppingBag size={34} />
            <p className="text-sm mt-2">{t.noTransactions}</p>
          </div>
        )}
      </div>

      {/* Pay Confirm Modal */}
      {showPayModal && (
        <div className="absolute inset-0 flex items-end z-50" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: card }}>
            {paidSuccess ? (
              <div className="flex flex-col items-center py-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                  style={{ background: isDark ? "#14532d" : "#dcfce7" }}>
                  <Check size={32} className="text-green-500" />
                </div>
                <p className="font-bold" style={{ color: text }}>{t.paymentRecorded}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg" style={{ color: text }}>{t.confirmPayment}</h3>
                  <button
                    onClick={() => { setShowPayModal(false); setPayAmount(""); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: isDark ? "#374151" : "#f3f4f6" }}
                  >
                    <X size={16} style={{ color: textMuted }} />
                  </button>
                </div>
                <div
                  className="rounded-2xl p-4 mb-6 border"
                  style={{ background: isDark ? "#14532d" : "#f0fdf4", borderColor: isDark ? "#166534" : "#bbf7d0" }}
                >
                  <p className="text-sm font-medium text-green-600">
                    <span className="font-bold">{customer.name}</span> {t.willPay} {`\u20B1${balance.toFixed(2)}`}
                  </p>
                </div>
                <div className="rounded-2xl p-4 mb-4 border" style={{ background: card, borderColor: cardBorder }}>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
                    Payment Amount
                  </label>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full outline-none font-bold"
                    style={{ fontSize: "20px", background: "transparent", color: text }}
                  />
                  <p className="text-[11px] mt-1" style={{ color: textMuted }}>
                    Total Outstanding: {`\u20B1${balance.toFixed(2)}`}
                  </p>
                  {Number(payAmount || 0) > balance && (
                    <p className="text-[11px] mt-1" style={{ color: "#16a34a" }}>
                      Excess payment will be saved as advance balance.
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowPayModal(false); setPayAmount(""); }}
                    className="flex-1 py-3 rounded-2xl font-semibold"
                    style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }}
                  >
                    {t.cancelBtn}
                  </button>
                  <button
                    onClick={handleRecordPayment}
                    className="flex-1 py-3 rounded-2xl bg-green-500 text-white font-semibold"
                  >
                    âœ“ {t.paidBtn}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showEditCustomerModal && isManagementRoute && (
        <div className="absolute inset-0 flex items-end z-50" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: card }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg" style={{ color: text }}>Edit Customer</h3>
              <button
                onClick={() => setShowEditCustomerModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: isDark ? "#374151" : "#f3f4f6" }}
              >
                <X size={16} style={{ color: textMuted }} />
              </button>
            </div>

            <div className="mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
                {t.customerName}
              </label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full rounded-xl px-4 py-3 outline-none text-sm border"
                style={{ background: isDark ? "#374151" : "#f9fafb", color: text, borderColor: cardBorder }}
              />
            </div>

            <div className="mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
                {t.phoneNumber}
              </label>
              <input
                type="tel"
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                className="w-full rounded-xl px-4 py-3 outline-none text-sm border"
                style={{ background: isDark ? "#374151" : "#f9fafb", color: text, borderColor: cardBorder }}
              />
            </div>

            <div className="mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
                Credit Limit
              </label>
              <input
                type="number"
                value={editCreditLimit}
                onChange={e => setEditCreditLimit(e.target.value)}
                disabled={removeLimit}
                className="w-full rounded-xl px-4 py-3 outline-none text-sm border disabled:opacity-40"
                style={{ background: isDark ? "#374151" : "#f9fafb", color: text, borderColor: cardBorder }}
                placeholder="0.00"
              />
              <button
                onClick={() => setRemoveLimit(prev => !prev)}
                className="mt-2 text-xs font-semibold"
                style={{ color: "#2563eb" }}
              >
                {removeLimit ? "Set credit limit" : "Remove credit limit"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4 text-xs" style={{ color: textMuted }}>
              <p>{`Current: \u20B1${credit.currentBalance.toFixed(2)}`}</p>
              <p>Available: {credit.availableCredit === null ? "Unlimited" : `\u20B1${credit.availableCredit.toFixed(2)}`}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditCustomerModal(false)}
                className="flex-1 py-3 rounded-2xl font-semibold"
                style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }}
              >
                {t.cancelBtn}
              </button>
              <button
                onClick={handleSaveCustomerProfile}
                disabled={!editName.trim()}
                className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-semibold disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

