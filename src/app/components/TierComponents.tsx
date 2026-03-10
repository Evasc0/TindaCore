import React from "react";
import { Lock, Star, Zap } from "lucide-react";
import { useNavigate } from "react-router";
import { SubscriptionTier, canAccess, useStore } from "../context/StoreContext";

// ─── Tier Badge ────────────────────────────────────────────────────────────────
export function TierBadge({ tier, size = "sm" }: { tier: SubscriptionTier; size?: "xs" | "sm" | "md" }) {
  const config = {
    free: { label: "Free", bg: "#6b7280", text: "#fff", icon: null },
    plus: { label: "Plus", bg: "linear-gradient(135deg, #2563eb, #1d4ed8)", text: "#fff", icon: <Zap size={size === "xs" ? 8 : 10} /> },
    premium: { label: "Premium", bg: "linear-gradient(135deg, #d97706, #b45309)", text: "#fff", icon: <Star size={size === "xs" ? 8 : 10} /> },
  };
  const c = config[tier];
  const px = size === "xs" ? "4px 6px" : size === "sm" ? "5px 8px" : "6px 12px";
  const fs = size === "xs" ? "9px" : size === "sm" ? "10px" : "12px";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-bold"
      style={{ background: c.bg, color: c.text, padding: px, fontSize: fs }}
    >
      {c.icon}{c.label}
    </span>
  );
}

// ─── Feature Row (for subscription screen) ────────────────────────────────────
export function FeatureRow({ label, free, plus, premium }: {
  label: string; free: boolean | string; plus: boolean | string; premium: boolean | string;
}) {
  const cell = (val: boolean | string, highlight = false) => (
    <td className="text-center py-2 px-2" style={{ width: "60px" }}>
      {typeof val === "boolean" ? (
        val
          ? <span style={{ color: highlight ? "#d97706" : "#16a34a", fontSize: "16px" }}>✓</span>
          : <span style={{ color: "#9ca3af", fontSize: "14px" }}>–</span>
      ) : (
        <span style={{ fontSize: "10px", color: highlight ? "#d97706" : "#6b7280" }}>{val}</span>
      )}
    </td>
  );
  return (
    <tr className="border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <td className="py-2 pr-2 text-xs" style={{ color: "#9ca3af" }}>{label}</td>
      {cell(free)}
      {cell(plus)}
      {cell(premium, true)}
    </tr>
  );
}

// ─── Tier Gate ────────────────────────────────────────────────────────────────
export function TierGate({
  required,
  children,
  featureName,
  compact = false,
}: {
  required: SubscriptionTier;
  children: React.ReactNode;
  featureName?: string;
  compact?: boolean;
}) {
  const { settings } = useStore();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";
  const hasAccess = canAccess(settings.subscription, required);

  if (hasAccess) return <>{children}</>;

  const tierLabel = required === "plus" ? "Plus" : "Premium";
  const tierColor = required === "plus" ? "#2563eb" : "#d97706";
  const tierBg = required === "plus"
    ? (isDark ? "#1e3a8a" : "#eff6ff")
    : (isDark ? "#451a03" : "#fef3c7");

  if (compact) {
    return (
      <button
        onClick={() => navigate("/subscription")}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl"
        style={{ background: tierBg, border: `1px solid ${tierColor}20` }}
      >
        <div className="flex items-center gap-2">
          <Lock size={13} style={{ color: tierColor }} />
          <span className="text-xs font-semibold" style={{ color: tierColor }}>
            {featureName || `${tierLabel} Feature`}
          </span>
        </div>
        <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ background: tierColor, color: "#fff" }}>
          {tierLabel}
        </span>
      </button>
    );
  }

  return (
    <div
      className="rounded-2xl flex flex-col items-center justify-center text-center p-6"
      style={{ background: tierBg, border: `1px dashed ${tierColor}50` }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: tierColor + "20" }}
      >
        <Lock size={22} style={{ color: tierColor }} />
      </div>
      <p className="font-bold text-sm mb-1" style={{ color: tierColor }}>
        {featureName || "Locked Feature"}
      </p>
      <p className="text-xs mb-4" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
        This requires the <strong>{tierLabel}</strong> plan
      </p>
      <button
        onClick={() => navigate("/subscription")}
        className="px-5 py-2.5 rounded-xl font-bold text-white text-sm"
        style={{ background: `linear-gradient(135deg, ${tierColor}, ${tierColor}cc)` }}
      >
        Upgrade to {tierLabel}
      </button>
    </div>
  );
}

// ─── Section Header with Tier Badge ───────────────────────────────────────────
export function SectionHeader({
  title,
  tier,
  action,
  onAction,
}: {
  title: string;
  tier?: SubscriptionTier;
  action?: string;
  onAction?: () => void;
}) {
  const { settings } = useStore();
  const textMuted = settings.theme === "dark" ? "#9ca3af" : "#6b7280";
  const text = settings.theme === "dark" ? "#f9fafb" : "#111827";
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>{title}</p>
        {tier && <TierBadge tier={tier} size="xs" />}
      </div>
      {action && (
        <button onClick={onAction} className="text-xs font-semibold" style={{ color: "#2563eb" }}>
          {action} →
        </button>
      )}
    </div>
  );
}

// ─── Upgrade Banner ───────────────────────────────────────────────────────────
export function UpgradeBanner({ from, to }: { from: SubscriptionTier; to: SubscriptionTier }) {
  const navigate = useNavigate();
  const isDark = useStore().settings.theme === "dark";
  const isPremium = to === "premium";
  const bg = isPremium
    ? "linear-gradient(135deg, #b45309 0%, #d97706 50%, #f59e0b 100%)"
    : "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)";

  return (
    <button
      onClick={() => navigate("/subscription")}
      className="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
      style={{ background: bg, boxShadow: isPremium ? "0 4px 16px rgba(217,119,6,0.35)" : "0 4px 16px rgba(37,99,235,0.35)" }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.2)" }}>
        {isPremium ? <Star size={20} className="text-white" /> : <Zap size={20} className="text-white" />}
      </div>
      <div className="flex-1">
        <p className="text-white font-bold text-sm">
          Upgrade to {isPremium ? "Premium" : "Plus"}
        </p>
        <p className="text-white text-opacity-80 text-xs" style={{ opacity: 0.8 }}>
          {isPremium ? "Unlock Smart Restock, Financials & Community" : "Unlock Smart Pabili & Analytics"}
        </p>
      </div>
      <span className="text-white font-bold text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.2)" }}>
        {isPremium ? "₱599/mo" : "₱299/mo"}
      </span>
    </button>
  );
}
