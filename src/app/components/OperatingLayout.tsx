import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { Home, ShoppingCart, Bell, Users } from "lucide-react";
import { useStore } from "../context/StoreContext";

export function OperatingLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, pabiliOrders, settings, t } = useStore();
  const isDark = settings.theme === "dark";

  const pendingPabili = pabiliOrders.filter(o => o.status === "pending").length;

  const navItems = [
    { path: "/", icon: Home, label: t.home },
    { path: "/pos", icon: ShoppingCart, label: t.sell },
    { path: "/pabili", icon: Bell, label: t.pabili },
    { path: "/utang", icon: Users, label: t.utang },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Main Content */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ scrollbarWidth: "none", background: isDark ? "#111827" : "#f9fafb" }}
      >
        <Outlet />
      </div>

      {/* Bottom Navigation */}
      <div
        className="flex-shrink-0"
        style={{
          background: isDark ? "#1f2937" : "#ffffff",
          borderTop: isDark ? "1px solid #374151" : "1px solid #e5e7eb",
          boxShadow: isDark ? "0 -2px 12px rgba(0,0,0,0.3)" : "0 -2px 12px rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex items-center justify-around px-1 py-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = isActive(path);
            const isPos = path === "/pos";
            const isPabili = path === "/pabili";

            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all"
                style={{ minWidth: "52px" }}
              >
                {isPos ? (
                  <div
                    className="relative flex items-center justify-center w-12 h-12 rounded-2xl"
                    style={{
                      marginTop: "-20px",
                      background: active ? "#2563eb" : "#3b82f6",
                      boxShadow: active ? "0 4px 16px rgba(37,99,235,0.5)" : "0 2px 8px rgba(37,99,235,0.3)",
                    }}
                  >
                    <Icon size={22} className="text-white" />
                    {cart.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {cart.length}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Icon size={20} style={{ color: active ? "#2563eb" : isDark ? "#6b7280" : "#9ca3af" }} />
                    {isPabili && pendingPabili > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center font-bold" style={{ fontSize: "8px" }}>
                        {pendingPabili}
                      </span>
                    )}
                  </div>
                )}
                {!isPos && (
                  <span
                    className="text-xs transition-all"
                    style={{
                      color: active ? "#2563eb" : isDark ? "#6b7280" : "#9ca3af",
                      fontWeight: active ? 600 : 400,
                      fontSize: "10px",
                    }}
                  >
                    {label}
                  </span>
                )}
                {active && !isPos && (
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
