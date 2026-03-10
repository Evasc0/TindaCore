import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Check, X, Star, Zap, ArrowLeft, Crown } from "lucide-react";
import { useStore, SubscriptionTier } from "../context/StoreContext";
import { TierBadge } from "./TierComponents";

const TIERS: Array<{
  id: SubscriptionTier;
  price: string;
  desc: string;
  color: string;
  gradient: string;
  shadow: string;
  icon: React.ReactNode;
  badge?: string;
  features: Array<{ text: string; included: boolean }>;
}> = [
  {
    id: "free",
    price: "₱0",
    desc: "Basic store tools",
    color: "#6b7280",
    gradient: "linear-gradient(135deg, #374151, #6b7280)",
    shadow: "rgba(107,114,128,0.3)",
    icon: <span style={{ fontSize: "20px" }}>🏪</span>,
    features: [
      { text: "POS & barcode selling", included: true },
      { text: "Inventory tracking", included: true },
      { text: "Utang / customer credit", included: true },
      { text: "Basic analytics (sales summary)", included: true },
      { text: "Advanced analytics & margins", included: false },
      { text: "Chat with suppliers/customers", included: false },
      { text: "Smart Restock AI", included: false },
      { text: "Supplier marketplace", included: false },
    ],
  },
  {
    id: "plus",
    price: "₱299",
    desc: "Smart tools for growing stores",
    color: "#2563eb",
    gradient: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
    shadow: "rgba(37,99,235,0.4)",
    icon: <Zap size={20} className="text-white" />,
    badge: "Most Popular",
    features: [
      { text: "Everything in Free", included: true },
      { text: "Category management", included: true },
      { text: "Advanced analytics (hourly, profitability)", included: true },
      { text: "Chat system (pabili & suppliers)", included: true },
      { text: "Predicted low stock alerts", included: true },
      { text: "Smart Restock AI", included: false },
      { text: "Supplier marketplace", included: false },
      { text: "Benchmark analytics", included: false },
    ],
  },
  {
    id: "premium",
    price: "₱599",
    desc: "Full suite for serious owners",
    color: "#d97706",
    gradient: "linear-gradient(135deg, #92400e, #d97706, #f59e0b)",
    shadow: "rgba(217,119,6,0.45)",
    icon: <Crown size={20} className="text-white" />,
    badge: "Best Value",
    features: [
      { text: "Everything in Plus", included: true },
      { text: "Smart Restock AI & shopping list", included: true },
      { text: "Financial reports & P&L", included: true },
      { text: "Supplier marketplace", included: true },
      { text: "Benchmark analytics", included: true },
      { text: "Priority chat & auto-sync orders", included: true },
    ],
  },
];

export function SubscriptionScreen() {
  const { settings, updateSettings, t } = useStore();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";
  const [selected, setSelected] = useState<SubscriptionTier>(settings.subscription);
  const [saved, setSaved] = useState(false);

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  const handleApply = () => {
    updateSettings({ subscription: selected });
    setSaved(true);
    setTimeout(() => { setSaved(false); navigate("/management/dashboard"); }, 1500);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)" }} className="px-4 pt-4 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate(-1 as any)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h2 className="text-white font-bold" style={{ fontSize: "20px" }}>{t.manageSubscription}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-blue-300 text-xs">{t.currentPlan}:</p>
              <TierBadge tier={settings.subscription} size="xs" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {/* Tier selector */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: textMuted }}>Choose Your Plan</p>

        {TIERS.map(tier => (
          <button
            key={tier.id}
            onClick={() => setSelected(tier.id)}
            className="w-full rounded-2xl mb-3 overflow-hidden border-2 text-left transition-all active:scale-98"
            style={{
              borderColor: selected === tier.id ? tier.color : cardBorder,
              boxShadow: selected === tier.id ? `0 4px 20px ${tier.shadow}` : "none",
            }}
          >
            {/* Tier Header */}
            <div className="p-4" style={{ background: selected === tier.id ? tier.gradient : card }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: selected === tier.id ? "rgba(255,255,255,0.2)" : (isDark ? "#374151" : "#f3f4f6") }}
                  >
                    {tier.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold" style={{ color: selected === tier.id ? "#ffffff" : text, fontSize: "16px" }}>
                        {tier.id.charAt(0).toUpperCase() + tier.id.slice(1)}
                      </p>
                      {tier.badge && (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.25)", color: selected === tier.id ? "#fff" : tier.color }}
                        >
                          {tier.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: selected === tier.id ? "rgba(255,255,255,0.75)" : textMuted }}>
                      {tier.desc}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black" style={{ fontSize: "20px", color: selected === tier.id ? "#ffffff" : text }}>
                    {tier.price}
                  </p>
                  <p style={{ fontSize: "10px", color: selected === tier.id ? "rgba(255,255,255,0.6)" : textMuted }}>
                    {tier.price !== "₱0" ? "/month" : "forever"}
                  </p>
                </div>
              </div>

              {/* Selection indicator */}
              {selected === tier.id && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white border-opacity-20">
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                    <Check size={12} style={{ color: tier.color }} />
                  </div>
                  <p className="text-white text-xs font-semibold">Selected Plan</p>
                </div>
              )}
            </div>

            {/* Feature list */}
            <div style={{ background: card }}>
              {tier.features.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0"
                  style={{ borderColor: cardBorder }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: f.included ? `${tier.color}20` : isDark ? "#374151" : "#f3f4f6",
                    }}
                  >
                    {f.included
                      ? <Check size={10} style={{ color: tier.color }} />
                      : <X size={10} style={{ color: isDark ? "#4b5563" : "#d1d5db" }} />
                    }
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: f.included ? text : textMuted, textDecoration: f.included ? "none" : "none" }}
                  >
                    {f.text}
                  </p>
                </div>
              ))}
            </div>
          </button>
        ))}

        {/* Feature comparison note */}
        <div className="rounded-2xl p-4 border mb-4" style={{ background: isDark ? "#1e3a8a" : "#eff6ff", borderColor: isDark ? "#1d4ed8" : "#bfdbfe" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: isDark ? "#bfdbfe" : "#1d4ed8" }}>This is a prototype demo</p>
          <p className="text-xs" style={{ color: isDark ? "#93c5fd" : "#2563eb" }}>
            Changing the plan below instantly shows/hides features for demo purposes. In production, this would require payment.
          </p>
        </div>

        <div style={{ height: "8px" }} />
      </div>

      {/* Apply button */}
      <div className="flex-shrink-0 p-4 border-t" style={{ background: card, borderColor: cardBorder }}>
        <button
          onClick={handleApply}
          disabled={selected === settings.subscription && !saved}
          className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-all"
          style={{
            background: saved
              ? "#16a34a"
              : selected === settings.subscription
              ? "#d1d5db"
              : TIERS.find(t => t.id === selected)?.gradient || "#2563eb",
            fontSize: "16px",
            boxShadow: saved || selected !== settings.subscription ? "0 4px 16px rgba(0,0,0,0.2)" : "none",
          }}
        >
          {saved ? (
            <><Check size={18} />Plan Applied!</>
          ) : selected === settings.subscription ? (
            "Current Plan"
          ) : (
            `Switch to ${selected.charAt(0).toUpperCase() + selected.slice(1)}`
          )}
        </button>
      </div>
    </div>
  );
}
