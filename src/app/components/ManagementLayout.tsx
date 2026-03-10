import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard, Package, BarChart2, DollarSign, Users,
  Settings, RefreshCw, LogOut, ChevronLeft, Star, ShieldCheck, Delete
} from "lucide-react";
import { useStore } from "../context/StoreContext";
import { OnboardingScreen } from "./OnboardingScreen";

// ─── PIN Entry ────────────────────────────────────────────────────────────────
function PINEntry() {
  const { enterManagementMode, settings } = useStore();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const bg = isDark ? "#111827" : "#f9fafb";
  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + d;
    setPin(newPin);
    setError(false);
    if (newPin.length === 4) {
      setTimeout(() => {
        const ok = enterManagementMode(newPin);
        if (!ok) {
          setError(true);
          setShake(true);
          setTimeout(() => { setShake(false); setPin(""); }, 600);
        } else {
          navigate("/management/dashboard");
        }
      }, 150);
    }
  };

  const handleDelete = () => {
    setPin(p => p.slice(0, -1));
    setError(false);
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div
        className="px-5 pt-5 pb-6 text-center"
        style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)" }}
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 mb-4 text-blue-300 text-sm"
        >
          <ChevronLeft size={16} />
          <span>{settings.language === "fil" ? "Bumalik" : "Back"}</span>
        </button>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <ShieldCheck size={32} className="text-white" />
        </div>
        <h1 className="text-white font-black text-xl">Management Mode</h1>
        <p className="text-blue-300 text-sm mt-1">
          {settings.language === "fil" ? "Ilagay ang iyong PIN" : "Enter your management PIN"}
        </p>
        <p className="text-blue-400 text-xs mt-0.5">{settings.storeName}</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* PIN Display */}
        <div className={`flex gap-4 mb-8 transition-all ${shake ? "animate-bounce" : ""}`}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="w-5 h-5 rounded-full border-2 transition-all"
              style={{
                background: pin.length > i ? (error ? "#ef4444" : "#2563eb") : "transparent",
                borderColor: pin.length > i ? (error ? "#ef4444" : "#2563eb") : (isDark ? "#374151" : "#d1d5db"),
                transform: pin.length > i ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-500 text-sm font-semibold mb-4">
            {settings.language === "fil" ? "Maling PIN. Subukan ulit." : "Wrong PIN. Try again."}
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
          {digits.map((d, i) => (
            <button
              key={i}
              onClick={() => d === "⌫" ? handleDelete() : d !== "" ? handleDigit(d) : undefined}
              disabled={d === ""}
              className="h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95"
              style={{
                background: d === "" ? "transparent" : card,
                boxShadow: d === "" ? "none" : isDark ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.08)",
                border: d === "" ? "none" : `1px solid ${cardBorder}`,
                fontSize: d === "⌫" ? "20px" : "22px",
                fontWeight: 700,
                color: d === "⌫" ? "#ef4444" : text,
              }}
            >
              {d === "⌫" ? <Delete size={20} className="text-red-500" /> : d}
            </button>
          ))}
        </div>

        <p className="text-xs mt-6" style={{ color: textMuted }}>
          {settings.language === "fil"
            ? "Default PIN: 1234 (palitan sa Settings)"
            : "Default PIN: 1234 (change in Settings)"}
        </p>
      </div>
    </div>
  );
}

// ─── Management Layout ────────────────────────────────────────────────────────
export function ManagementLayout() {
  const { isManagementMode, settings, exitManagementMode } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = settings.theme === "dark";

  // Show onboarding if not complete
  if (!settings.isOnboardingComplete) {
    return <OnboardingScreen />;
  }

  // Show PIN entry if not in management mode
  if (!isManagementMode) {
    return <PINEntry />;
  }

  const bg = isDark ? "#111827" : "#f9fafb";
  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#e5e7eb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  const navItems = [
    { path: "/management/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/management/inventory", icon: Package, label: "Products" },
    { path: "/management/analytics", icon: BarChart2, label: "Analytics" },
    { path: "/management/finance", icon: DollarSign, label: "Finance" },
    { path: "/management/settings", icon: Settings, label: "Settings" },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleExit = () => {
    exitManagementMode();
    navigate("/");
  };

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Management Mode Header Bar */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #0f172a, #1e3a8a)", minHeight: "44px" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
            <ShieldCheck size={13} className="text-blue-300" />
          </div>
          <span className="text-white font-bold text-xs">MANAGEMENT MODE</span>
          <span className="px-1.5 py-0.5 rounded-full text-blue-300 font-semibold" style={{ fontSize: "9px", background: "rgba(255,255,255,0.1)" }}>
            {settings.ownerName}
          </span>
        </div>
        <button
          onClick={handleExit}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white"
          style={{ background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.4)" }}
        >
          <LogOut size={12} />
          <span>{settings.language === "fil" ? "Lumabas" : "Exit"}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "none" }}>
        <Outlet />
      </div>

      {/* Management Bottom Nav */}
      <div
        className="flex-shrink-0"
        style={{
          background: card,
          borderTop: `1px solid ${cardBorder}`,
          boxShadow: isDark ? "0 -2px 12px rgba(0,0,0,0.3)" : "0 -2px 12px rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex items-center justify-around px-1 py-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="relative flex flex-col items-center gap-0.5 px-1 py-1 rounded-xl"
                style={{ minWidth: "44px" }}
              >
                <Icon
                  size={18}
                  style={{ color: active ? "#2563eb" : isDark ? "#6b7280" : "#9ca3af" }}
                />
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: active ? 700 : 400,
                    color: active ? "#2563eb" : isDark ? "#6b7280" : "#9ca3af",
                  }}
                >
                  {label}
                </span>
                {active && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex justify-center pb-1">
          <div className="w-24 h-1 rounded-full" style={{ background: isDark ? "#374151" : "#d1d5db" }} />
        </div>
      </div>
    </div>
  );
}
