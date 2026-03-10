import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Search, Plus, ChevronRight, X, Check, Users } from "lucide-react";
import { useStore } from "../context/StoreContext";

export function UtangScreen() {
  const { customers, getCustomerBalance, addCustomer, settings, t } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = settings.theme === "dark";

  // Determine base path (management vs operating mode)
  const basePath = location.pathname.startsWith("/management") ? "/management/utang" : "/utang";

  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saved, setSaved] = useState(false);

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  const totalOutstanding = customers.reduce((sum, c) => sum + getCustomerBalance(c.id), 0);
  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search)
  );

  const handleAddCustomer = () => {
    if (!newName.trim()) return;
    addCustomer(newName.trim(), newPhone.trim());
    setSaved(true);
    setTimeout(() => { setSaved(false); setNewName(""); setNewPhone(""); setShowAddModal(false); }, 1000);
  };

  const getInitials = (name: string) => name.split(" ").map(w => w[0]).join("").toUpperCase().substring(0, 2);
  const avatarColors = [
    { bg: isDark ? "#1e3a8a" : "#eff6ff", text: "#2563eb" },
    { bg: isDark ? "#14532d" : "#f0fdf4", text: "#16a34a" },
    { bg: isDark ? "#3b0764" : "#faf5ff", text: "#7c3aed" },
    { bg: isDark ? "#431407" : "#fff7ed", text: "#ea580c" },
    { bg: isDark ? "#500724" : "#fff1f2", text: "#e11d48" },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div
        style={{ background: "linear-gradient(160deg, #451a03 0%, #92400e 60%, #d97706 100%)" }}
        className="px-4 pt-4 pb-5 flex-shrink-0"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-white font-bold" style={{ fontSize: "20px" }}>{t.utangScreen}</h2>
            <p className="text-amber-300 text-xs mt-0.5">{t.creditTracker}</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-white text-amber-700 px-3 py-2 rounded-xl font-semibold text-sm shadow-sm active:scale-95 transition-transform"
          >
            <Plus size={16} />
            {t.addCustomer}
          </button>
        </div>

        <div className="flex gap-2">
          {[
            { label: t.totalUtang, value: `₱${totalOutstanding.toFixed(2)}`, color: "text-white" },
            { label: t.withUtang, value: customers.filter(c => getCustomerBalance(c.id) > 0).length, color: "text-red-200" },
            { label: t.allCustomers, value: customers.length, color: "text-amber-100" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: "rgba(255,255,255,0.18)" }}>
              <p className={`font-bold ${color} truncate`} style={{ fontSize: typeof value === "string" ? "13px" : "18px" }}>{value}</p>
              <p className="text-amber-300 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 -mt-3 mb-3 flex-shrink-0">
        <div
          className="rounded-2xl flex items-center gap-3 px-4 py-3 border"
          style={{ background: card, borderColor: cardBorder, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
        >
          <Search size={18} style={{ color: textMuted, flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.searchCustomer}
            className="flex-1 outline-none text-sm"
            style={{ background: "transparent", color: text }}
          />
        </div>
      </div>

      {/* Customer list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "none" }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32" style={{ color: textMuted }}>
            <Users size={34} />
            <p className="text-sm mt-2">{t.noCustomers}</p>
          </div>
        ) : (
          filtered
            .sort((a, b) => getCustomerBalance(b.id) - getCustomerBalance(a.id))
            .map((customer, idx) => {
              const balance = getCustomerBalance(customer.id);
              const pendingTx = customer.transactions.filter(tx => tx.balance > 0).length;
              const av = avatarColors[idx % avatarColors.length];

              return (
                <button
                  key={customer.id}
                  onClick={() => navigate(`${basePath}/${customer.id}`)}
                  className="w-full rounded-2xl mb-2 p-4 border flex items-center gap-3 text-left active:scale-98 transition-transform"
                  style={{ background: card, borderColor: cardBorder, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: av.bg }}
                  >
                    <span className="font-bold" style={{ color: av.text }}>{getInitials(customer.name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: text }}>{customer.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                      {customer.phone || t.noPhone2}
                      {pendingTx > 0 && ` • ${pendingTx} ${t.pending}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {balance > 0 ? (
                      <div className="text-right">
                        <p className="font-bold text-sm text-red-500">₱{balance.toFixed(2)}</p>
                        <p className="text-xs" style={{ color: textMuted }}>utang</p>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1 px-2 py-1 rounded-full"
                        style={{ background: isDark ? "#14532d" : "#f0fdf4" }}
                      >
                        <Check size={11} className="text-green-600" />
                        <span className="text-green-600 text-xs font-semibold">{t.paid}</span>
                      </div>
                    )}
                    <ChevronRight size={15} style={{ color: textMuted }} />
                  </div>
                </button>
              );
            })
        )}
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="absolute inset-0 flex items-end z-50" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: card }}>
            {saved ? (
              <div className="flex flex-col items-center py-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                  style={{ background: isDark ? "#451a03" : "#fef3c7" }}>
                  <Check size={32} className="text-amber-600" />
                </div>
                <p className="font-bold" style={{ color: text }}>{t.customerAdded}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-lg" style={{ color: text }}>{t.newCustomer}</h3>
                  <button
                    onClick={() => setShowAddModal(false)}
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
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder={t.customerNamePlaceholder}
                    className="w-full rounded-xl px-4 py-3 outline-none text-sm border"
                    style={{ background: isDark ? "#374151" : "#f9fafb", color: text, borderColor: cardBorder }}
                    autoFocus
                  />
                </div>

                <div className="mb-6">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: textMuted }}>
                    {t.phoneNumber}
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    placeholder={t.phonePlaceholder}
                    className="w-full rounded-xl px-4 py-3 outline-none text-sm border"
                    style={{ background: isDark ? "#374151" : "#f9fafb", color: text, borderColor: cardBorder }}
                  />
                </div>

                <button
                  onClick={handleAddCustomer}
                  disabled={!newName.trim()}
                  className="w-full py-4 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-40"
                  style={{
                    background: newName.trim() ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)" : "#d1d5db",
                    fontSize: "16px",
                    boxShadow: newName.trim() ? "0 4px 12px rgba(217,119,6,0.4)" : "none",
                  }}
                >
                  {t.saveCustomer}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
