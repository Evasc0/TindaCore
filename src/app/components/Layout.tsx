import React from "react";
import { Outlet } from "react-router";
import { useStore } from "../context/StoreContext";

export function Layout() {
  const { settings } = useStore();
  const isDark = settings.theme === "dark";

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
    >
      {/* Phone Frame */}
      <div
        className="relative flex flex-col overflow-hidden shadow-2xl"
        style={{
          width: "390px",
          height: "844px",
          borderRadius: "44px",
          border: "8px solid #1a1a2e",
          boxShadow: "0 0 0 2px #333, 0 30px 80px rgba(0,0,0,0.5)",
          background: isDark ? "#111827" : "#f9fafb",
        }}
      >
        {/* Status Bar */}
        <div
          className="flex items-center justify-between px-6 pt-2 pb-1 flex-shrink-0"
          style={{ minHeight: "36px", background: isDark ? "#1f2937" : "#ffffff" }}
        >
          <span className="text-xs font-semibold" style={{ color: isDark ? "#e5e7eb" : "#1f2937" }}>9:41</span>
          <div
            className="rounded-full absolute left-1/2 -translate-x-1/2"
            style={{ width: "96px", height: "16px", top: "8px", background: isDark ? "#374151" : "#111827" }}
          />
          <div className="flex items-center gap-1">
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <rect x="0" y="4" width="3" height="8" rx="1" fill={isDark ? "#9ca3af" : "#1a1a2e"} />
              <rect x="4.5" y="2.5" width="3" height="9.5" rx="1" fill={isDark ? "#9ca3af" : "#1a1a2e"} />
              <rect x="9" y="0.5" width="3" height="11.5" rx="1" fill={isDark ? "#9ca3af" : "#1a1a2e"} />
              <rect x="13.5" y="0" width="2" height="12" rx="1" fill="#d1d5db" />
            </svg>
            <svg width="14" height="12" viewBox="0 0 14 12">
              <path d="M7 2.5C9.5 2.5 11.7 3.7 13 5.5L14 4.3C12.4 2.2 9.9 1 7 1C4.1 1 1.6 2.2 0 4.3L1 5.5C2.3 3.7 4.5 2.5 7 2.5Z" fill={isDark ? "#9ca3af" : "#1a1a2e"} />
              <path d="M7 5.5C8.7 5.5 10.2 6.3 11.1 7.6L12.1 6.4C10.9 4.8 9 3.9 7 3.9C5 3.9 3.1 4.8 1.9 6.4L2.9 7.6C3.8 6.3 5.3 5.5 7 5.5Z" fill={isDark ? "#9ca3af" : "#1a1a2e"} />
              <circle cx="7" cy="10" r="1.5" fill={isDark ? "#9ca3af" : "#1a1a2e"} />
            </svg>
            <div className="flex items-center">
              <div className={`border rounded-sm p-0.5 flex ${isDark ? "border-gray-500" : "border-gray-800"}`} style={{ width: "22px", height: "12px" }}>
                <div className="bg-green-500 rounded-sm" style={{ width: "70%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div
          className="flex-1 overflow-hidden"
          style={{ background: isDark ? "#111827" : "#f9fafb" }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
