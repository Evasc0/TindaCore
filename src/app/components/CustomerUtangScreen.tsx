import React, { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { ArrowLeft, Plus, CheckCircle, Clock, AlertCircle, ShoppingBag, X, Check } from "lucide-react";
import { useStore } from "../context/StoreContext";

export function CustomerUtangScreen() {
  const { customers, getCustomerBalance, recordPayment, clearCart, settings, t } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isDark = settings.theme === "dark";

  // Determine back path
  const backPath = location.pathname.startsWith("/management") ? "/management/utang" : "/utang";

  const customer = customers.find(c => c.id === id);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingTxId, setPayingTxId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paidSuccess, setPaidSuccess] = useState(false);

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ background: bg }}>
        <p style={{ color: textMuted }}>Customer not found</p>
        <button onClick={() => navigate(backPath)} className="mt-3 text-blue-500 text-sm">← {t.cancelBtn}</button>
      </div>
    );
  }

  const balance = getCustomerBalance(id!);
  const unpaidTx = customer.transactions.filter(tx => tx.balance > 0);
  const paidTx = customer.transactions.filter(tx => tx.balance === 0);

  const handleRecordPayment = () => {
    if (!payingTxId) return;
    const tx = customer.transactions.find(t => t.id === payingTxId);
    const amt = parseFloat(payAmount || "") || tx?.balance || 0;
    if (!amt || amt <= 0) return;
    recordPayment(id!, payingTxId, amt);
    setPaidSuccess(true);
    setTimeout(() => {
      setPaidSuccess(false);
      setShowPayModal(false);
      setPayingTxId(null);
      setPayAmount("");
    }, 1300);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  };

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
          <h2 className="text-white font-bold" style={{ fontSize: "18px" }}>{t.utangDetail}</h2>
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
              <p className="text-white font-black" style={{ fontSize: "30px" }}>₱{balance.toFixed(2)}</p>
            </div>
            {balance === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(34,197,94,0.3)" }}>
                <CheckCircle size={17} className="text-green-300" />
                <span className="text-green-200 text-sm font-semibold">{t.paid}!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(239,68,68,0.3)" }}>
                <AlertCircle size={17} className="text-red-200" />
                <span className="text-red-200 text-sm font-semibold">{unpaidTx.length} {t.pending}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${cardBorder}` }}>
        <button
          onClick={() => { clearCart(); navigate("/pos"); }}
          className="flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm active:scale-95 transition-transform"
          style={{
            background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
            color: "white",
            boxShadow: "0 4px 12px rgba(217,119,6,0.3)",
          }}
        >
          <Plus size={16} />
          {t.newUtang}
        </button>
        <button
          onClick={() => balance > 0 && setShowPayModal(true)}
          disabled={balance === 0}
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
        {/* Unpaid */}
        {unpaidTx.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: textMuted }}>
              <Clock size={11} />
              {t.unpaid} ({unpaidTx.length})
            </p>
            {unpaidTx.map(tx => (
              <div
                key={tx.id}
                className="rounded-2xl mb-3 overflow-hidden border"
                style={{ background: card, borderColor: isDark ? "#7f1d1d" : "#fecaca" }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3 border-b"
                  style={{
                    background: isDark ? "#450a0a" : "#fef2f2",
                    borderColor: isDark ? "#7f1d1d" : "#fecaca",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: isDark ? "#7f1d1d" : "#fee2e2" }}>
                      <ShoppingBag size={13} className="text-red-500" />
                    </div>
                    <span className="text-sm font-semibold text-red-500">{formatDate(tx.date)}</span>
                  </div>
                  <span className="text-red-500 font-black">₱{tx.balance.toFixed(2)}</span>
                </div>
                <div className="px-4 py-3">
                  {tx.items.map((item, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b last:border-0" style={{ borderColor: cardBorder }}>
                      <span className="text-sm" style={{ color: textMuted }}>{item.name} × {item.qty}</span>
                      <span className="text-sm font-medium" style={{ color: text }}>₱{(item.subtotal ?? item.price * item.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-3">
                  <button
                    onClick={() => { setPayingTxId(tx.id); setPayAmount(tx.balance.toString()); setShowPayModal(true); }}
                    className="w-full py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold active:scale-95 transition-transform"
                  >
                    ✓ {t.paidBtn} ₱{tx.balance.toFixed(2)}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Paid */}
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
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 font-bold">₱{tx.amount.toFixed(2)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: isDark ? "#166534" : "#dcfce7", color: "#16a34a" }}>
                      {t.paid}
                    </span>
                  </div>
                </div>
                <div className="px-4 py-3">
                  {tx.items.map((item, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b last:border-0" style={{ borderColor: cardBorder }}>
                      <span className="text-sm" style={{ color: textMuted }}>{item.name} × {item.qty}</span>
                      <span className="text-sm" style={{ color: textMuted }}>₱{(item.subtotal ?? item.price * item.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
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
                    onClick={() => { setShowPayModal(false); setPayingTxId(null); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: isDark ? "#374151" : "#f3f4f6" }}
                  >
                    <X size={16} style={{ color: textMuted }} />
                  </button>
                </div>
                {payingTxId && (
                  <>
                    <div
                      className="rounded-2xl p-4 mb-6 border"
                      style={{ background: isDark ? "#14532d" : "#f0fdf4", borderColor: isDark ? "#166534" : "#bbf7d0" }}
                    >
                      <p className="text-sm font-medium text-green-600">
                        <span className="font-bold">{customer.name}</span>{" "}
                        {t.willPay} ₱{customer.transactions.find(tx => tx.id === payingTxId)?.balance.toFixed(2)}
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
                        Remaining: ₱{customer.transactions.find(tx => tx.id === payingTxId)?.balance.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setShowPayModal(false); setPayingTxId(null); }}
                        className="flex-1 py-3 rounded-2xl font-semibold"
                        style={{ background: isDark ? "#374151" : "#f3f4f6", color: text }}
                      >
                        {t.cancelBtn}
                      </button>
                      <button
                        onClick={handleRecordPayment}
                        className="flex-1 py-3 rounded-2xl bg-green-500 text-white font-semibold"
                      >
                        ✓ {t.paidBtn}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
