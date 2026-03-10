import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { OperatingLayout } from "./components/OperatingLayout";
import { ManagementLayout } from "./components/ManagementLayout";
import { HomeScreen } from "./components/HomeScreen";
import { POSScreen } from "./components/POSScreen";
import { InventoryScreen } from "./components/InventoryScreen";
import { AddProductScreen } from "./components/AddProductScreen";
import { UtangScreen } from "./components/UtangScreen";
import { CustomerUtangScreen } from "./components/CustomerUtangScreen";
import { AnalyticsScreen } from "./components/AnalyticsScreen";
import { SmartPabiliScreen } from "./components/SmartPabiliScreen";
import { SmartRestockScreen } from "./components/SmartRestockScreen";
import { FinancialScreen } from "./components/FinancialScreen";
import { SubscriptionScreen } from "./components/SubscriptionScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { ManagementDashboard } from "./components/ManagementDashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      // ── Operating Mode ──────────────────────────────────────────────────────
      {
        Component: OperatingLayout,
        children: [
          { index: true, Component: HomeScreen },
          { path: "pos", Component: POSScreen },
          { path: "pabili", Component: SmartPabiliScreen },
          { path: "utang", Component: UtangScreen },
          { path: "utang/:id", Component: CustomerUtangScreen },
        ],
      },
      // ── Management Mode ─────────────────────────────────────────────────────
      {
        path: "management",
        Component: ManagementLayout,
        children: [
          { index: true, Component: ManagementDashboard },
          { path: "dashboard", Component: ManagementDashboard },
          { path: "inventory", Component: InventoryScreen },
          { path: "inventory/add", Component: AddProductScreen },
          { path: "inventory/edit/:id", Component: AddProductScreen },
          { path: "restock", Component: SmartRestockScreen },
          { path: "analytics", Component: AnalyticsScreen },
          { path: "finance", Component: FinancialScreen },
          { path: "utang", Component: UtangScreen },
          { path: "utang/:id", Component: CustomerUtangScreen },
          { path: "settings", Component: SettingsScreen },
          { path: "subscription", Component: SubscriptionScreen },
        ],
      },
      // ── Legacy redirects (keep old links working) ───────────────────────────
      { path: "inventory", element: <Navigate to="/management/inventory" replace /> },
      { path: "inventory/add", element: <Navigate to="/management/inventory/add" replace /> },
      { path: "reports", element: <Navigate to="/management/analytics" replace /> },
      { path: "restock", element: <Navigate to="/management/restock" replace /> },
      { path: "finance", element: <Navigate to="/management/finance" replace /> },
      { path: "subscription", element: <Navigate to="/management/subscription" replace /> },
      { path: "settings", element: <Navigate to="/management/settings" replace /> },
    ],
  },
]);
