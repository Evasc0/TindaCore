import React from "react";
import { Outlet, useNavigate, useLocation, Navigate } from "react-router";
import { LayoutDashboard, Package, BarChart2, DollarSign, Settings, LogOut, ShieldCheck } from "lucide-react";
import { useStore } from "../context/StoreContext";

export function ManagementLayout() {
  const { session, managementUnlocked, settings, exitManagementMode } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = settings.theme === "dark";

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!managementUnlocked) {
    return <Navigate to="/enter-pin" replace />;
  }

  const bg = isDark ? "#111827" : "#f9fafb";
  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#e5e7eb";

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

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "none" }}>
        <Outlet />
      </div>

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
