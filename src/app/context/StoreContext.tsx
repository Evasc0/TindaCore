import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import {
  initializeDatabase,
  setDataScope,
  clearDataScope,
  getProducts as loadProducts,
  createProduct as persistProduct,
  updateProductRecord,
  deleteProductRecord,
  createSale as persistSale,
  getSales as loadSales,
  createCustomer as persistCustomer,
  updateCustomer as persistCustomerUpdate,
  consumeCustomerAdvance as persistCustomerAdvanceUse,
  addUtangRecord as persistUtangRecord,
  recordPayment as persistPayment,
  createPabiliOrder as persistPabiliOrder,
  updatePabiliStatus as persistPabiliStatus,
  addExpense as persistExpense,
  getExpenses as loadExpenses,
  getCustomers as loadCustomers,
  getPabiliOrders as loadPabiliOrders,
  saveSettings as persistSettings,
  getSettings as loadSettings,
} from "../services/databaseService";
import {
  type AccountRecord,
  type StoreRecord,
  type SessionRecord,
  type AuthSessionBundle,
  createAccount as createAccountRecord,
  login as loginAccount,
  logout as logoutAccount,
  getCurrentSession as loadCurrentSession,
  setManagementPin,
  verifyManagementPinForStore,
} from "../services/authService";
import { syncAll } from "../sync/syncService";
import { generateRestockSuggestions, RestockSuggestion } from "../ai/restockEngine";
import {
  computeProductProfitability,
  topProfitable,
  leastProfitable,
  ProfitabilityRow,
} from "../analytics/profitabilityEngine";
import {
  groupSalesByHour,
  aggregateDailySales,
  aggregateWeeklyTrends,
  HourlySalesBucket,
  DailySalesPoint,
  WeeklyTrendPoint,
} from "../analytics/hourlySales";
import { computeCommunityProductStats, CommunityProductStats } from "../analytics/communityAnalytics";
import { buildBenchmark, StorePerformance } from "../analytics/benchmarkEngine";
import {
  Supplier,
  SupplierProduct,
  RestockOrder,
  RestockOrderItem,
  RestockOrderStatus,
  buildSuggestedSuppliers,
  createRestockOrder,
  updateRestockOrderStatus as applyRestockOrderStatus,
  formatRestockMessage,
} from "../marketplace/marketplaceService";
import { ChatMessage, sendMessage as sendChatMessage, getConversation, getAllMessages } from "../marketplace/chatService";

export type Unit = "piece" | "pack" | "box" | "cavan" | "kg" | "grams" | "ml" | "liters";
type BaseUnit = "piece" | "grams" | "ml";

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  price: number;
  cost: number; // purchase cost for COGS
  stock: number; // stored in base units
  unit: Unit; // selling unit displayed in UI
  baseUnit: BaseUnit; // canonical unit for stock tracking
  conversion?: number; // number of base units per selling unit
  barcode?: string;
  barcodes?: string[];
  category: string;
  isQuickItem: boolean;
  emoji: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  unit: Unit;
  subtotal: number;
}

export interface UtangRecord {
  id: string;
  date: string;
  items: { productId?: string; name: string; qty: number; unit: Unit; price: number; subtotal: number }[];
  amount: number;
  balance: number;
  status?: "unpaid" | "partial" | "paid";
  payments: { id: string; amount: number; date: string }[];
}

export interface CustomerPaymentHistoryEntry {
  id: string;
  date: string;
  amount: number;
  appliedAmount: number;
  advanceAmount: number;
  entryType?: "payment" | "advance_deduction";
  referenceSaleId?: string;
  note?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  note?: string;
  creditLimit?: number | null;
  advanceBalance?: number;
  paymentHistory?: CustomerPaymentHistoryEntry[];
  transactions: UtangRecord[];
}

export interface CustomerCreditStatus {
  currentBalance: number;
  creditLimit: number | null;
  availableCredit: number | null;
}

export type AddUtangSaleResult =
  | { ok: true }
  | {
      ok: false;
      code: "utang_disabled" | "cart_empty" | "customer_not_found" | "credit_limit_exceeded";
      credit?: CustomerCreditStatus & { newBalance: number };
    };

export interface Sale {
  id: string;
  timestamp: string;
  date: string; // retained for existing UI filters
  items: { productId?: string; name: string; qty: number; unit: Unit; price: number; cost?: number; subtotal: number }[];
  total: number;
  paymentType: "cash" | "utang" | "gcash" | "paymaya";
  isUtang: boolean;
  customerName?: string;
  customerId?: string;
  helperName?: string;
}

export interface PabiliOrder {
  id: string;
  customerName: string;
  customerPhone?: string;
  items: { name: string; qty: number; price: number; unit?: Unit }[];
  status: "pending" | "preparing" | "done" | "dismissed";
  date: string; // legacy
  timestamp: string;
  note?: string;
  total: number;
}

export interface Expense {
  id: string;
  date: string;
  name: string;
  description?: string;
  amount: number;
  category: "utilities" | "supplies" | "rent" | "other";
}

export interface RestockItem {
  productId: string;
  productName: string;
  emoji: string;
  suggestedQty: number;
  editedQty: number;
  estimatedCost: number;
  checked: boolean;
}

export type SubscriptionTier = "free" | "plus" | "premium";

export interface StoreSettings {
  storeName: string;
  ownerName: string;
  address: string;
  theme: "light" | "dark";
  language: "en" | "fil";
  subscription: SubscriptionTier;
  gcashNumber: string;
  paymayaNumber: string;
  managementPIN: string;
  hasManagementPin: boolean;
  isOnboardingComplete: boolean;
  enableUtang: boolean;
  enablePabili: boolean;
  enableBarcodeScanner: boolean;
  enableReceiptPrinter: boolean;
}

// ─── Translations ──────────────────────────────────────────────────────────────
export const translations = {
  en: {
    // General
    greeting: "Good morning! 👋",
    offline: "Offline",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    close: "Close",
    edit: "Edit",
    add: "Add",
    back: "Back",
    viewAll: "View All",
    yes: "Yes",
    no: "No",
    loading: "Loading...",
    // Nav
    home: "Home",
    sell: "Sell",
    pabili: "Pabili",
    items: "Items",
    reports: "Reports",
    // Home Dashboard
    todayEarnings: "Today's Sales",
    todayCustomers: "Customers Today",
    pendingPabili: "Pabili Queue",
    weeklyRevenue: "Weekly Revenue",
    weeklyProfit: "Weekly Profit",
    lowStockItems: "Low Stock Items",
    quickActions: "Quick Actions",
    recentSales: "Recent Sales",
    salesTrend: "7-Day Sales Trend",
    last7Days: "Last 7 Days",
    menu: "Menu",
    startSelling: "Start Selling",
    inventory: "Inventory",
    utang: "Utang",
    salesReport: "Analytics",
    posBarcode: "POS & Barcode",
    manageProducts: "Manage Products",
    customerCredit: "Customer Credit",
    viewAnalytics: "View Analytics",
    topProductToday: "Top Product Today",
    piecesSold: "pcs sold",
    lowStockAlert: "low stock items",
    updateInventory: "Update inventory",
    sales: "sales",
    customers: "customers",
    greeting2: "Welcome back,",
    noSalesYet: "No sales yet today",
    // Subscription
    subscriptionTier: "Subscription",
    free: "Free",
    plus: "Plus",
    premium: "Premium",
    currentPlan: "Current Plan",
    upgradeTo: "Upgrade to",
    upgradeNow: "Upgrade Now",
    lockedFeature: "Locked Feature",
    requiresTier: "Requires",
    plan: "plan",
    unlockFeatures: "Unlock all features",
    perMonth: "/month",
    mostPopular: "Most Popular",
    bestValue: "Best Value",
    manageSubscription: "Manage Subscription",
    freeDesc: "Basic store tools",
    plusDesc: "Smart tools for growing stores",
    premiumDesc: "Full suite for serious owners",
    freePrice: "₱0",
    plusPrice: "₱299",
    premiumPrice: "₱599",
    // POS
    sell_screen: "Sell",
    scanBarcode: "Scan barcode...",
    quickItems: "Quick Items",
    noItemsInCart: "Cart is empty",
    tapToAdd: "Tap quick items or scan",
    total: "Total",
    customerPaid: "Customer Paid",
    change: "Change",
    short: "Short!",
    completeSale: "Complete Sale",
    addUtangBtn: "Utang",
    partialPaymentBtn: "Partial Payment",
    paidBadge: "Paid — ₱",
    selectCustomer: "Select Customer",
    saveUtang: "Save Utang",
    savePartialPayment: "Save Partial Payment",
    amountPaidLabel: "Amount Paid",
    remainingBalance: "Remaining Balance",
    noPhone: "No phone number",
    currentUtang: "current utang",
    addNewCustomer: "Add new customer",
    saleDone: "Done!",
    saleDoneMsg: "Sale completed successfully",
    paymentMethod: "Payment Method",
    cash: "Cash",
    gcash: "GCash",
    paymaya: "PayMaya",
    // Inventory
    products: "Products",
    lowStock: "Low",
    outOfStock: "Out",
    searchProduct: "Search product...",
    all: "All",
    lowStockBadge: "Low Stock",
    remaining: "remaining",
    none: "None",
    // Add Product
    editProduct: "Edit Product",
    newProduct: "New Product",
    productIcon: "Product Icon",
    productName: "Product Name",
    productNamePlaceholder: "e.g. Lucky Me Pancit Canton",
    price: "Selling Price",
    costPrice: "Cost Price",
    stock: "Stock",
    barcode: "Barcode (optional)",
    barcodePlaceholder: "Scan or type barcode",
    category: "Category",
    quickItemToggle: "Quick Item in POS",
    quickItemDesc: "Show in quick-select on POS screen",
    saveProduct: "Save Product",
    updateProduct: "Update Product",
    deleteProduct: "Delete Product",
    deleteConfirm: "Delete Product?",
    deleteWarning: "This cannot be undone.",
    // Utang
    utangScreen: "Utang",
    creditTracker: "Customer Credit Tracker",
    totalUtang: "Total Utang",
    withUtang: "With Utang",
    allCustomers: "All",
    searchCustomer: "Search customer...",
    addCustomer: "Add",
    noPhone2: "No number",
    pending: "pending",
    paid: "Paid",
    newCustomer: "New Customer",
    customerName: "Name",
    customerNamePlaceholder: "e.g. Aling Nena",
    phoneNumber: "Phone (optional)",
    customerNote: "Note (optional)",
    customerNotePlaceholder: "Optional note about this customer",
    phonePlaceholder: "09xxxxxxxxx",
    saveCustomer: "Save Customer",
    customerAdded: "Customer added!",
    noCustomers: "No customers",
    utangDetail: "Utang Details",
    totalOutstanding: "Total Outstanding",
    unpaid: "Unpaid",
    recordPayment: "Record Payment",
    newUtang: "New Utang",
    confirmPayment: "Confirm Payment",
    willPay: "will pay",
    cancelBtn: "Cancel",
    paidBtn: "Paid!",
    paymentRecorded: "Payment recorded!",
    noTransactions: "No transactions yet",
    // Smart Pabili
    smartPabili: "Smart Pabili",
    qrDoorbell: "QR Doorbell",
    pabiliOrders: "Pabili Orders",
    openInPOS: "Open in POS",
    prepareOrder: "Prepare",
    dismiss: "Dismiss",
    noPendingOrders: "No pending orders",
    generateQR: "Generate QR",
    downloadQR: "Download QR",
    printQR: "Print QR",
    qrInstructions: "Place this QR code outside your store. Customers scan it to send Pabili orders.",
    pabiliTab: "Orders",
    qrTab: "QR Code",
    newPabiliAlert: "New Pabili Order!",
    autoAddedToCart: "Auto-added to POS cart",
    preparingOrder: "Preparing...",
    orderDone: "Done",
    orderDismissed: "Dismissed",
    qrStore: "Store QR Code",
    customerMiniStore: "Customer Mini-Store",
    sendPabili: "Send Pabili Order",
    selectItems: "Select Items",
    yourOrder: "Your Order",
    totalOrder: "Order Total",
    sendOrder: "Send Order Now",
    pabiliSent: "Pabili Sent!",
    pabiliSentMsg: "The store owner will prepare your order.",
    addNote: "Add a note (optional)",
    notePlaceholder: "e.g. Yung malaki na Coke",
    orderHistory: "Order History",
    premiumAutoAdd: "Premium: Auto-add to POS",
    // Smart Restock
    smartRestock: "Smart Restock",
    restockPlanner: "Restock Planner",
    suggestedRestock: "Suggested Restock",
    avgDailySales: "Avg Daily",
    suggestedQty: "Suggested Qty",
    addToList: "Add to List",
    restockList: "Restock Shopping List",
    totalBudget: "Total Budget",
    exportList: "Export List",
    editQty: "Edit Qty",
    checkToBuy: "Check when purchased",
    estimatedCost: "Est. Cost",
    restockAlert: "items need restocking",
    noRestockNeeded: "All stock levels are healthy!",
    restockDescription: "Based on last 7 days average sales",
    updateStockOnCheck: "Checking updates stock automatically",
    itemsPurchased: "Items purchased will update inventory",
    // Financial
    financialStatements: "Financial Statements",
    revenue: "Revenue",
    cogs: "Cost of Goods Sold",
    grossProfit: "Gross Profit",
    expenses: "Expenses",
    netIncome: "Net Income",
    weeklyFinance: "This Week",
    monthlyFinance: "This Month",
    exportReport: "Export Report",
    profitLoss: "Profit & Loss",
    cashFlow: "Cash Flow",
    salesTrendChart: "Sales & Profit Trend",
    addExpense: "Add Expense",
    expenseDesc: "Description",
    expenseAmount: "Amount",
    expenseCategory: "Category",
    // Analytics
    analytics: "Analytics",
    topSelling: "Top Selling Products",
    fastestMoving: "Fastest Moving",
    slowMoving: "Slow Moving Products",
    predictedLowStock: "Predicted Low Stock (7 days)",
    noSlowMoving: "No slow-moving products",
    basicSummary: "Sales Summary",
    totalRevenue: "Total Revenue",
    cashSales: "Cash Sales",
    utangSales: "Utang Sales",
    pendingUtangReport: "Pending Utang",
    transactions: "Transactions",
    topProducts: "Top Products",
    noSales: "No sales yet",
    earningsPerHour: "Earnings per Hour",
    earningsPerDay: "Daily Earnings",
    today: "Today",
    week: "7 Days",
    allTime: "All Time",
    barLabel: "Bar",
    pieLabel: "Pie",
    // Community
    communityDashboard: "Community Dashboard",
    nearbyDemand: "Nearby Store Demand",
    localTrending: "Trending in Your Area",
    topLocalItems: "Top Items Locally",
    communityDesc: "See what's selling near you and optimize your inventory.",
    // Settings
    profileSettings: "Profile & Settings",
    editProfile: "Personalize your store",
    settings: "Settings",
    storeName: "Store Name",
    ownerName: "Owner Name",
    address: "Address (optional)",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    language: "Language",
    saveSettings: "Save Settings",
    settingsSaved: "Settings saved!",
    paymentInfo: "Payment Information",
    gcashNumber: "GCash Number",
    paymayaNumber: "PayMaya Number",
    generatePaymentQR: "Generate Payment QR",
    paymentQRDesc: "Customers can scan to pay",
    downloadPaymentQR: "Download QR",
    generatePabiliQR: "Generate Pabili QR",
    support: "Contact Support",
    changePassword: "Change Password",
    subscriptionInfo: "Subscription",
    viewPlans: "View Plans",
  },
  fil: {
    // General
    greeting: "Magandang umaga! 👋",
    offline: "Offline",
    save: "I-save",
    cancel: "Huwag na",
    delete: "I-delete",
    close: "Isara",
    edit: "I-edit",
    add: "Dagdag",
    back: "Bumalik",
    viewAll: "Tingnan Lahat",
    yes: "Oo",
    no: "Hindi",
    loading: "Naglo-load...",
    // Nav
    home: "Home",
    sell: "Benta",
    pabili: "Pabili",
    items: "Item",
    reports: "Ulat",
    // Home Dashboard
    todayEarnings: "Benta Ngayon",
    todayCustomers: "Customer Ngayon",
    pendingPabili: "Pabili Queue",
    weeklyRevenue: "Kita sa Linggo",
    weeklyProfit: "Tubo sa Linggo",
    lowStockItems: "Mababang Stock",
    quickActions: "Mabilis na Aksyon",
    recentSales: "Pinakabagong Benta",
    salesTrend: "7-Araw na Trend ng Benta",
    last7Days: "Huling 7 Araw",
    menu: "Menu",
    startSelling: "Magsimulang Magbenta",
    inventory: "Imbentaryo",
    utang: "Utang",
    salesReport: "Analytics",
    posBarcode: "POS at Barcode",
    manageProducts: "Pamahalaan ang Produkto",
    customerCredit: "Utang ng Customer",
    viewAnalytics: "Tingnan ang Ulat",
    topProductToday: "Top Produkto Ngayon",
    piecesSold: "piraso",
    lowStockAlert: "mababang stock",
    updateInventory: "I-update ang inventory",
    sales: "benta",
    customers: "customer",
    greeting2: "Maligayang pagbabalik,",
    noSalesYet: "Walang benta pa ngayon",
    // Subscription
    subscriptionTier: "Subscription",
    free: "Libre",
    plus: "Plus",
    premium: "Premium",
    currentPlan: "Kasalukuyang Plano",
    upgradeTo: "Mag-upgrade sa",
    upgradeNow: "Mag-upgrade Ngayon",
    lockedFeature: "Naka-lock na Feature",
    requiresTier: "Kailangan ng",
    plan: "plano",
    unlockFeatures: "I-unlock ang lahat ng feature",
    perMonth: "/buwan",
    mostPopular: "Pinakasikat",
    bestValue: "Pinakamura",
    manageSubscription: "Pamahalaan ang Subscription",
    freeDesc: "Batayang tools sa tindahan",
    plusDesc: "Smart tools para sa lumalagong tindahan",
    premiumDesc: "Buong suite para sa seryosong tindero",
    freePrice: "₱0",
    plusPrice: "₱299",
    premiumPrice: "₱599",
    // POS
    sell_screen: "Benta",
    scanBarcode: "I-scan ang barcode...",
    quickItems: "Mabilis na Pagpili",
    noItemsInCart: "Walang item sa cart",
    tapToAdd: "I-tap ang quick items o mag-scan",
    total: "Kabuuan",
    customerPaid: "Binayad ng Customer",
    change: "Sukli",
    short: "Kulang!",
    completeSale: "I-complete ang Benta",
    addUtangBtn: "Utang",
    partialPaymentBtn: "Bahagyang Bayad",
    paidBadge: "Bayad Na — ₱",
    selectCustomer: "Piliin ang Customer",
    saveUtang: "I-save ang Utang",
    savePartialPayment: "I-save ang Bahagyang Bayad",
    amountPaidLabel: "Halagang Binayad",
    remainingBalance: "Natitirang Balanse",
    noPhone: "Walang numero",
    currentUtang: "kasalukuyang utang",
    addNewCustomer: "Dagdag bagong customer",
    saleDone: "Tapos na!",
    saleDoneMsg: "Matagumpay na nabenta",
    paymentMethod: "Paraan ng Bayad",
    cash: "Cash",
    gcash: "GCash",
    paymaya: "PayMaya",
    // Inventory
    products: "Produkto",
    lowStock: "Mababa",
    outOfStock: "Wala",
    searchProduct: "Hanapin ang produkto...",
    all: "Lahat",
    lowStockBadge: "Mababang Stock",
    remaining: "natirang",
    none: "Wala",
    // Add Product
    editProduct: "I-edit ang Produkto",
    newProduct: "Bagong Produkto",
    productIcon: "Icon ng Produkto",
    productName: "Pangalan ng Produkto",
    productNamePlaceholder: "hal. Lucky Me Pancit Canton",
    price: "Presyo ng Benta",
    costPrice: "Presyo ng Gastos",
    stock: "Stock",
    barcode: "Barcode (opsyonal)",
    barcodePlaceholder: "I-scan o i-type ang barcode",
    category: "Kategorya",
    quickItemToggle: "Quick Item sa POS",
    quickItemDesc: "Makikita sa mabilis na pagpili sa POS",
    saveProduct: "I-save ang Produkto",
    updateProduct: "I-update ang Produkto",
    deleteProduct: "I-delete ang Produkto",
    deleteConfirm: "I-delete ang Produkto?",
    deleteWarning: "Hindi na maibabalik.",
    // Utang
    utangScreen: "Utang",
    creditTracker: "Customer Credit Tracker",
    totalUtang: "Kabuuang Utang",
    withUtang: "May Utang",
    allCustomers: "Lahat",
    searchCustomer: "Hanapin ang customer...",
    addCustomer: "Dagdag",
    noPhone2: "Walang numero",
    pending: "pending",
    paid: "Bayad na",
    newCustomer: "Bagong Customer",
    customerName: "Pangalan",
    customerNamePlaceholder: "hal. Aling Nena",
    phoneNumber: "Numero (opsyonal)",
    customerNote: "Note (opsyonal)",
    customerNotePlaceholder: "Opsyonal na tala para sa customer",
    phonePlaceholder: "09xxxxxxxxx",
    saveCustomer: "I-save ang Customer",
    customerAdded: "Na-add ang customer!",
    noCustomers: "Walang customer",
    utangDetail: "Detalye ng Utang",
    totalOutstanding: "Kabuuang Utang",
    unpaid: "Hindi pa Bayad",
    recordPayment: "I-record Bayad",
    newUtang: "Bagong Utang",
    confirmPayment: "I-confirm ang Bayad",
    willPay: "babayaran",
    cancelBtn: "Huwag na",
    paidBtn: "Bayad Na!",
    paymentRecorded: "Na-record ang bayad!",
    noTransactions: "Walang transaksyon pa",
    // Smart Pabili
    smartPabili: "Smart Pabili",
    qrDoorbell: "QR Doorbell",
    pabiliOrders: "Mga Order sa Pabili",
    openInPOS: "Buksan sa POS",
    prepareOrder: "Ihanda",
    dismiss: "I-dismiss",
    noPendingOrders: "Walang pending na order",
    generateQR: "Gumawa ng QR",
    downloadQR: "I-download ang QR",
    printQR: "I-print ang QR",
    qrInstructions: "Ilagay ang QR na ito sa labas ng tindahan. I-scan ng customer para mag-order.",
    pabiliTab: "Mga Order",
    qrTab: "QR Code",
    newPabiliAlert: "Bagong Pabili Order!",
    autoAddedToCart: "Naka-add na sa POS cart",
    preparingOrder: "Ihinahanda...",
    orderDone: "Tapos",
    orderDismissed: "Dismissed",
    qrStore: "QR ng Tindahan",
    customerMiniStore: "Customer Mini-Store",
    sendPabili: "Mag-send ng Pabili Order",
    selectItems: "Piliin ang Items",
    yourOrder: "Ang Iyong Order",
    totalOrder: "Kabuuan ng Order",
    sendOrder: "Ipadala ang Order",
    pabiliSent: "Na-send ang Pabili!",
    pabiliSentMsg: "Ihahanda ng may-ari ang iyong order.",
    addNote: "Dagdag ng note (opsyonal)",
    notePlaceholder: "hal. Yung malaki na Coke",
    orderHistory: "Kasaysayan ng Order",
    premiumAutoAdd: "Premium: Auto-add sa POS",
    // Smart Restock
    smartRestock: "Smart Restock",
    restockPlanner: "Planner ng Restock",
    suggestedRestock: "Suhestiyon sa Restock",
    avgDailySales: "Avg Araw-araw",
    suggestedQty: "Suhestiyong Dami",
    addToList: "Idagdag sa Listahan",
    restockList: "Listahan ng Restock",
    totalBudget: "Kabuuang Budget",
    exportList: "I-export ang Listahan",
    editQty: "Baguhin ang Dami",
    checkToBuy: "I-check kapag nabili",
    estimatedCost: "Est. Gastos",
    restockAlert: "items kailangan ng restock",
    noRestockNeeded: "Ayos ang lahat ng stock!",
    restockDescription: "Batay sa average na benta sa huling 7 araw",
    updateStockOnCheck: "Kapag nag-check, awtomatikong ma-a-update ang stock",
    itemsPurchased: "Mga nabiling item ay ina-update ang imbentaryo",
    // Financial
    financialStatements: "Financial Statements",
    revenue: "Kita",
    cogs: "Gastos sa Produkto (COGS)",
    grossProfit: "Gross Profit",
    expenses: "Mga Gastos",
    netIncome: "Net Income",
    weeklyFinance: "Ngayong Linggo",
    monthlyFinance: "Ngayong Buwan",
    exportReport: "I-export ang Ulat",
    profitLoss: "Profit at Loss",
    cashFlow: "Cash Flow",
    salesTrendChart: "Trend ng Benta at Tubo",
    addExpense: "Dagdag ng Gastos",
    expenseDesc: "Paglalarawan",
    expenseAmount: "Halaga",
    expenseCategory: "Kategorya",
    // Analytics
    analytics: "Analytics",
    topSelling: "Pinaka-Mabentang Produkto",
    fastestMoving: "Pinaka-Mabilis na Lumikas",
    slowMoving: "Mabagal na Lumikas",
    predictedLowStock: "Mahuhulaan na Mababang Stock (7 araw)",
    noSlowMoving: "Walang mabagal na produkto",
    basicSummary: "Buod ng Benta",
    totalRevenue: "Kabuuang Kita",
    cashSales: "Cash",
    utangSales: "Utang Benta",
    pendingUtangReport: "Pending Utang",
    transactions: "Mga Transaksyon",
    topProducts: "Top Produkto",
    noSales: "Walang benta pa",
    earningsPerHour: "Kita sa Bawat Oras",
    earningsPerDay: "Kita Bawat Araw",
    today: "Ngayon",
    week: "7 Araw",
    allTime: "Lahat",
    barLabel: "Bar",
    pieLabel: "Pie",
    // Community
    communityDashboard: "Community Dashboard",
    nearbyDemand: "Demand ng Kalapit na Tindahan",
    localTrending: "Trending sa Iyong Lugar",
    topLocalItems: "Top Items sa Inyong Lugar",
    communityDesc: "Tingnan kung ano ang nagtitinda malapit sa iyo at i-optimize ang iyong imbentaryo.",
    // Settings
    profileSettings: "Profile at Setting",
    editProfile: "I-personalize ang iyong tindahan",
    settings: "Mga Setting",
    storeName: "Pangalan ng Tindahan",
    ownerName: "Pangalan ng May-ari",
    address: "Address (opsyonal)",
    theme: "Tema",
    light: "Maliwanag",
    dark: "Madilim",
    language: "Wika",
    saveSettings: "I-save ang Settings",
    settingsSaved: "Na-save ang settings!",
    paymentInfo: "Impormasyon sa Bayad",
    gcashNumber: "Numero ng GCash",
    paymayaNumber: "Numero ng PayMaya",
    generatePaymentQR: "Gumawa ng Payment QR",
    paymentQRDesc: "I-scan ng customer para magbayad",
    downloadPaymentQR: "I-download ang QR",
    generatePabiliQR: "Gumawa ng Pabili QR",
    support: "Makipag-ugnayan sa Support",
    changePassword: "Baguhin ang Password",
    subscriptionInfo: "Subscription",
    viewPlans: "Tingnan ang Mga Plano",
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const getBaseUnit = (unit: Unit): BaseUnit => {
  if (unit === "kg" || unit === "grams") return "grams";
  if (unit === "ml" || unit === "liters") return "ml";
  return "piece";
};

const toBaseUnits = (product: Product, qty: number) => {
  const factor =
    product.unit === "pack" || product.unit === "box"
      ? product.conversion || 1
      : product.unit === "kg" || product.unit === "liters"
      ? 1000
      : 1;
  return qty * factor;
};

const fromBaseUnits = (product: Product, baseQty: number) => {
  const factor =
    product.unit === "pack" || product.unit === "box"
      ? product.conversion || 1
      : product.unit === "kg" || product.unit === "liters"
      ? 1000
      : 1;
  return baseQty / factor;
};

const normalizeBarcodes = (barcodes?: string[], barcode?: string) => {
  const combined = [...(barcodes || []), ...(barcode ? [barcode] : [])];
  return Array.from(new Set(combined.map(code => code.trim()).filter(Boolean)));
};

const getUtangStatus = (amount: number, balance: number): UtangRecord["status"] => {
  if (balance <= 0) return "paid";
  if (balance < amount) return "partial";
  return "unpaid";
};

const formatStockDisplay = (product: Product) => {
  const sellingQty = fromBaseUnits(product, product.stock);
  if (product.unit === "kg" || product.unit === "liters") {
    return parseFloat(sellingQty.toFixed(2));
  }
  return Math.floor(sellingQty);
};
export function canAccess(subscription: SubscriptionTier, required: SubscriptionTier): boolean {
  const order: SubscriptionTier[] = ["free", "plus", "premium"];
  return order.indexOf(subscription) >= order.indexOf(required);
}

// ─── Context ───────────────────────────────────────────────────────────────────
interface StoreContextType {
  products: Product[];
  cart: CartItem[];
  customers: Customer[];
  sales: Sale[];
  pabiliOrders: PabiliOrder[];
  expenses: Expense[];
  restockList: RestockItem[];
  suppliers: Supplier[];
  restockOrders: RestockOrder[];
  chatMessages: ChatMessage[];
  settings: StoreSettings;
  t: typeof translations["en"];
  currentAccount: AccountRecord | null;
  currentStore: StoreRecord | null;
  session: SessionRecord | null;
  managementUnlocked: boolean;
  isHydrated: boolean;
  createAccount: (
    ownerName: string,
    storeName: string,
    emailOrMobile: string,
    password: string
  ) => Promise<void>;
  login: (emailOrMobile: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyManagementPin: (pin: string) => Promise<boolean>;
  verifyManagementPinForAction: (pin: string) => Promise<boolean>;
  createManagementPin: (pin: string) => Promise<boolean>;
  // Mode
  isManagementMode: boolean;
  operatingUser: string;
  enterManagementMode: (pin: string) => boolean;
  exitManagementMode: () => void;
  completeOnboarding: (data: {
    storeName: string; ownerName: string; address?: string;
    pin: string; enableUtang?: boolean; enablePabili?: boolean;
    enableBarcodeScanner?: boolean; enableReceiptPrinter?: boolean;
    subscription?: SubscriptionTier;
  }) => void;
  setOperatingUser: (name: string) => void;
  // Products
  addProduct: (p: Omit<Product, "id">) => void;
  importStarterProducts: (items: Array<{
    name: string;
    category: string;
    price: number;
    cost: number;
    stock: number;
    unit: Unit;
    conversion?: number;
    barcodes?: string[];
  }>) => Promise<{ imported: number; failed: number }>;
  updateProduct: (id: string, p: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addStock: (id: string, qty: number, unit?: Unit) => void;
  searchProducts?: (query: string) => Product[];
  // Cart
  addToCart: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  updateCartQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  addPabiliToCart: (order: PabiliOrder) => void;
  // Sales
  completeSale: (amountPaid: number, method?: Sale["paymentType"]) => void;
  addUtangSale: (customerId: string, amountPaid?: number, forceOverride?: boolean, applyAdvanceFirst?: boolean) => AddUtangSaleResult;
  // Customers
  addCustomer: (name: string, phone?: string, note?: string, creditLimit?: number | null) => string;
  updateCustomerProfile: (customerId: string, changes: { name: string; phone?: string; creditLimit?: number | null }) => void;
  recordPayment: (customerId: string, amount: number) => void;
  getCustomerBalance: (customerId: string) => number;
  getCustomerCreditStatus: (customerId: string) => CustomerCreditStatus;
  // Pabili
  addPabiliOrder: (order: Omit<PabiliOrder, "id">) => void;
  updatePabiliStatus: (id: string, status: PabiliOrder["status"]) => void;
  // Restock
  updateRestockList: (items: RestockItem[]) => void;
  checkRestockItem: (productId: string, checked: boolean, purchasedQty: number) => void;
  // Marketplace
  placeRestockOrder: (supplierId: string, items: RestockOrderItem[]) => RestockOrder | null;
  updateRestockOrderStatus: (orderId: string, status: RestockOrderStatus) => void;
  getSupplierCatalog: () => SupplierProduct[];
  sendChat: (input: Omit<ChatMessage, "id" | "timestamp"> & { id?: string; timestamp?: string }) => ChatMessage;
  getConversation: (a: string, b: string) => ChatMessage[];
  // Expenses
  addExpense: (e: Omit<Expense, "id">) => void;
  // Analytics
  getWeeklyRevenue: () => number;
  getWeeklyProfit: () => number;
  getHourlySales: (date?: Date) => HourlySalesBucket[];
  getDailySales: (days?: number) => DailySalesPoint[];
  getWeeklyTrends: (weeks?: number) => WeeklyTrendPoint[];
  getTopSellingProducts: (limit?: number) => Array<{ name: string; qty: number; revenue: number; profit: number; emoji: string }>;
  getProductProfitability: (limit?: number) => ProfitabilityRow[];
  getLeastProfitable: (limit?: number) => ProfitabilityRow[];
  getSmartRestockSuggestions: () => RestockSuggestion[];
  getProductAnalytics: (period: "today" | "week" | "all") => Array<{
    name: string;
    emoji: string;
    qty: number;
    revenue: number;
    avgDaily: number;
  }>;
  getCommunityInsights: () => CommunityProductStats[];
  getBenchmarkSnapshot: () => StorePerformance[];
  // Settings
  updateSettings: (s: Partial<StoreSettings>) => void;
  cartTotal: number;
}

const StoreContext = createContext<StoreContextType | null>(null);

const newId = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

// ─── Initial data ──────────────────────────────────────────────────────────────
const seedProducts = [
  { id: "p1", name: "Coke Mismo", price: 15, cost: 10, stock: 48, barcode: "4800888114919", category: "Beverages", isQuickItem: true, emoji: "🥤" },
  { id: "p2", name: "Lucky Me Pancit", price: 14, cost: 9, stock: 36, barcode: "4800016150014", category: "Noodles", isQuickItem: true, emoji: "🍜" },
  { id: "p3", name: "Sardinas (555)", price: 22, cost: 15, stock: 4, barcode: "4806029030012", category: "Canned Goods", isQuickItem: true, emoji: "🐟" },
  { id: "p4", name: "Candy (1pc)", price: 1, cost: 0.5, stock: 200, barcode: "", category: "Sweets", isQuickItem: true, emoji: "🍬" },
  { id: "p5", name: "Tasty Bread", price: 58, cost: 42, stock: 3, barcode: "4800016180011", category: "Bread", isQuickItem: true, emoji: "🍞" },
  { id: "p6", name: "Milo Sachet", price: 7, cost: 4.5, stock: 60, barcode: "4800195622032", category: "Beverages", isQuickItem: true, emoji: "☕" },
  { id: "p7", name: "Knorr Cube", price: 5, cost: 3, stock: 2, barcode: "4800016181019", category: "Condiments", isQuickItem: false, emoji: "🧂" },
  { id: "p8", name: "Magic Sarap", price: 5, cost: 3, stock: 40, barcode: "", category: "Condiments", isQuickItem: false, emoji: "🧂" },
  { id: "p9", name: "Chippy (Barbeque)", price: 12, cost: 8, stock: 30, barcode: "4800016113014", category: "Snacks", isQuickItem: false, emoji: "🍟" },
  { id: "p10", name: "Royal Tru-Orange", price: 15, cost: 10, stock: 5, barcode: "", category: "Beverages", isQuickItem: false, emoji: "🧃" },
  { id: "p11", name: "Century Tuna", price: 32, cost: 22, stock: 18, barcode: "4806029061013", category: "Canned Goods", isQuickItem: false, emoji: "🥫" },
  { id: "p12", name: "Skyflakes (Small)", price: 10, cost: 7, stock: 45, barcode: "", category: "Snacks", isQuickItem: false, emoji: "🥨" },
];

const initialProducts: Product[] = seedProducts.map(p => ({
  unit: "piece",
  baseUnit: "piece",
  conversion: 1,
  ...p,
}));

const today = new Date();
const fmt = (d: Date) => d.toISOString().split("T")[0];
const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
const twoDaysAgo = new Date(today); twoDaysAgo.setDate(today.getDate() - 2);
const threeDaysAgo = new Date(today); threeDaysAgo.setDate(today.getDate() - 3);
const fourDaysAgo = new Date(today); fourDaysAgo.setDate(today.getDate() - 4);
const fiveDaysAgo = new Date(today); fiveDaysAgo.setDate(today.getDate() - 5);
const sixDaysAgo = new Date(today); sixDaysAgo.setDate(today.getDate() - 6);

const seedCustomers = [
  { id: "c1", name: "Aling Nena", phone: "09171234567", transactions: [
    { id: "t1", date: fmt(today), items: [{ name: "Lucky Me Pancit", qty: 2, price: 14 }, { name: "Coke Mismo", qty: 1, price: 15 }], total: 43, paid: false },
    { id: "t2", date: fmt(yesterday), items: [{ name: "Tasty Bread", qty: 1, price: 58 }], total: 58, paid: false },
  ]},
  { id: "c2", name: "Kuya Ben", phone: "09281234567", transactions: [
    { id: "t3", date: fmt(yesterday), items: [{ name: "Sardinas (555)", qty: 3, price: 22 }], total: 66, paid: false },
    { id: "t4", date: fmt(twoDaysAgo), items: [{ name: "Milo Sachet", qty: 5, price: 7 }], total: 35, paid: true },
  ]},
  { id: "c3", name: "Ate Rosa", phone: "", transactions: [
    { id: "t5", date: fmt(twoDaysAgo), items: [{ name: "Coke Mismo", qty: 3, price: 15 }, { name: "Candy (1pc)", qty: 10, price: 1 }], total: 55, paid: false },
  ]},
  { id: "c4", name: "Mang Ernie", phone: "09091234567", transactions: [
    { id: "t6", date: fmt(yesterday), items: [{ name: "Chippy (Barbeque)", qty: 2, price: 12 }, { name: "Royal Tru-Orange", qty: 2, price: 15 }], total: 54, paid: false },
  ]},
];

const initialCustomers: Customer[] = seedCustomers.map(c => ({
  ...c,
  advanceBalance: 0,
  paymentHistory: [],
  transactions: c.transactions.map(tx => ({
    id: tx.id,
    date: tx.date,
    customerId: c.id,
    items: tx.items.map(item => ({
      ...item,
      unit: "piece",
      subtotal: item.price * item.qty,
    })),
    amount: tx.total,
    balance: tx.paid ? 0 : tx.total,
    status: tx.paid ? "paid" : "unpaid",
    payments: tx.paid ? [{ id: `pay-${tx.id}`, amount: tx.total, date: tx.date }] : [],
  })),
}));

const mkSale = (date: Date, hour: number, items: { name: string; qty: number; price: number }[], type: Sale["paymentType"] = "cash"): Sale => {
  const timestamp = `${fmt(date)}T${String(hour).padStart(2, "0")}:${String(Math.floor(Math.random() * 59)).padStart(2, "0")}:00`;
  return {
    id: `s${Date.now()}-${Math.random()}`,
    timestamp,
    date: timestamp,
    items: items.map(item => {
      const product = initialProducts.find(p => p.name === item.name);
      const cost = product?.cost ?? item.price * 0.65;
      return {
        productId: product?.id,
        name: item.name,
        qty: item.qty,
        unit: product?.unit || "piece",
        price: item.price,
        cost,
        subtotal: item.price * item.qty,
      };
    }),
    total: items.reduce((s, i) => s + i.price * i.qty, 0),
    paymentType: type,
    isUtang: type === "utang",
  };
};

const initialSales: Sale[] = [
  mkSale(today, 8, [{ name: "Coke Mismo", qty: 2, price: 15 }, { name: "Lucky Me Pancit", qty: 1, price: 14 }]),
  mkSale(today, 9, [{ name: "Tasty Bread", qty: 1, price: 58 }]),
  mkSale(today, 10, [{ name: "Milo Sachet", qty: 3, price: 7 }, { name: "Candy (1pc)", qty: 5, price: 1 }]),
  mkSale(today, 11, [{ name: "Sardinas (555)", qty: 2, price: 22 }], "utang"),
  mkSale(today, 13, [{ name: "Coke Mismo", qty: 3, price: 15 }]),
  mkSale(today, 14, [{ name: "Chippy (Barbeque)", qty: 2, price: 12 }], "gcash"),
  mkSale(yesterday, 8, [{ name: "Lucky Me Pancit", qty: 4, price: 14 }]),
  mkSale(yesterday, 10, [{ name: "Chippy (Barbeque)", qty: 3, price: 12 }, { name: "Royal Tru-Orange", qty: 2, price: 15 }]),
  mkSale(yesterday, 13, [{ name: "Sardinas (555)", qty: 1, price: 22 }, { name: "Coke Mismo", qty: 2, price: 15 }]),
  mkSale(yesterday, 16, [{ name: "Milo Sachet", qty: 5, price: 7 }]),
  mkSale(twoDaysAgo, 9, [{ name: "Coke Mismo", qty: 4, price: 15 }, { name: "Candy (1pc)", qty: 10, price: 1 }]),
  mkSale(twoDaysAgo, 11, [{ name: "Century Tuna", qty: 2, price: 32 }, { name: "Skyflakes (Small)", qty: 3, price: 10 }]),
  mkSale(twoDaysAgo, 15, [{ name: "Lucky Me Pancit", qty: 5, price: 14 }]),
  mkSale(threeDaysAgo, 8, [{ name: "Milo Sachet", qty: 6, price: 7 }, { name: "Tasty Bread", qty: 1, price: 58 }]),
  mkSale(threeDaysAgo, 12, [{ name: "Coke Mismo", qty: 5, price: 15 }]),
  mkSale(fourDaysAgo, 9, [{ name: "Lucky Me Pancit", qty: 3, price: 14 }, { name: "Sardinas (555)", qty: 2, price: 22 }]),
  mkSale(fourDaysAgo, 14, [{ name: "Chippy (Barbeque)", qty: 4, price: 12 }, { name: "Royal Tru-Orange", qty: 3, price: 15 }]),
  mkSale(fiveDaysAgo, 10, [{ name: "Coke Mismo", qty: 6, price: 15 }, { name: "Candy (1pc)", qty: 20, price: 1 }]),
  mkSale(fiveDaysAgo, 15, [{ name: "Century Tuna", qty: 3, price: 32 }]),
  mkSale(sixDaysAgo, 8, [{ name: "Lucky Me Pancit", qty: 4, price: 14 }, { name: "Milo Sachet", qty: 4, price: 7 }]),
  mkSale(sixDaysAgo, 13, [{ name: "Tasty Bread", qty: 2, price: 58 }, { name: "Coke Mismo", qty: 2, price: 15 }]),
];

const initialPabiliOrders: PabiliOrder[] = [
  {
    id: "pab1",
    customerName: "Nena (Kanto)",
    customerPhone: "09171234567",
    items: [{ name: "Coke Mismo", qty: 2, price: 15 }, { name: "Lucky Me Pancit", qty: 3, price: 14 }],
    status: "pending",
    date: new Date(Date.now() - 5 * 60000).toISOString(),
    note: "Yung malamig na Coke",
    total: 72,
  },
  {
    id: "pab2",
    customerName: "Unknown Customer",
    items: [],
    status: "pending",
    date: new Date(Date.now() - 12 * 60000).toISOString(),
    note: "Pabili po",
    total: 0,
  },
  {
    id: "pab3",
    customerName: "Ben (Kapitbahay)",
    customerPhone: "09281234567",
    items: [{ name: "Sardinas (555)", qty: 2, price: 22 }, { name: "Milo Sachet", qty: 3, price: 7 }],
    status: "preparing",
    date: new Date(Date.now() - 25 * 60000).toISOString(),
    total: 65,
  },
].map(o => ({
  ...o,
  timestamp: o.date,
  items: o.items.map(i => ({ unit: "piece", ...i })),
}));

const initialExpenses: Expense[] = [
  { id: "exp1", date: `${fmt(today).substring(0, 7)}-01`, name: "Electricity Bill", amount: 1200, category: "utilities" },
  { id: "exp2", date: `${fmt(today).substring(0, 7)}-01`, name: "Water Bill", amount: 350, category: "utilities" },
  { id: "exp3", date: `${fmt(today).substring(0, 7)}-03`, name: "Plastic Bags & Supplies", amount: 220, category: "supplies" },
  { id: "exp4", date: `${fmt(today).substring(0, 7)}-05`, name: "Store Rent", amount: 2500, category: "rent" },
];

const initialSettings: StoreSettings = {
  storeName: "Tindahan ni Ate",
  ownerName: "Maria Santos",
  address: "Brgy. 123, Maynila",
  theme: "light",
  language: "fil",
  subscription: "free",
  gcashNumber: "09171234567",
  paymayaNumber: "",
  managementPIN: "",
  hasManagementPin: false,
  isOnboardingComplete: false,
  enableUtang: true,
  enablePabili: true,
  enableBarcodeScanner: true,
  enableReceiptPrinter: false,
};

// ─── Provider ──────────────────────────────────────────────────────────────────
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [pabiliOrders, setPabiliOrders] = useState<PabiliOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [restockList, setRestockList] = useState<RestockItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [restockOrders, setRestockOrders] = useState<RestockOrder[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({
    ...initialSettings,
    managementPIN: "",
    hasManagementPin: false,
  });
  const [currentAccount, setCurrentAccount] = useState<AccountRecord | null>(null);
  const [currentStore, setCurrentStore] = useState<StoreRecord | null>(null);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [managementUnlocked, setManagementUnlocked] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [operatingUser, setOperatingUserState] = useState("Helper");

  const t = translations[settings.language];
  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const communityStats = useMemo(() => computeCommunityProductStats({ sales, products }), [sales, products]);

  const resetScopedState = useCallback(() => {
    setCurrentAccount(null);
    setCurrentStore(null);
    setSession(null);
    setProducts([]);
    setCart([]);
    setCustomers([]);
    setSales([]);
    setPabiliOrders([]);
    setExpenses([]);
    setRestockList([]);
    setSuppliers([]);
    setRestockOrders([]);
    setManagementUnlocked(false);
    setOperatingUserState("Helper");
    setSettings({
      ...initialSettings,
      managementPIN: "",
      hasManagementPin: false,
    });
  }, []);

  const buildScopedDefaultSettings = useCallback((account: AccountRecord, store: StoreRecord): StoreSettings => ({
    ...initialSettings,
    storeName: store.storeName || initialSettings.storeName,
    ownerName: account.ownerName || initialSettings.ownerName,
    subscription: store.subscriptionTier || initialSettings.subscription,
    managementPIN: "",
    hasManagementPin: false,
    gcashNumber: "",
    paymayaNumber: "",
    address: "",
    isOnboardingComplete: false,
  }), []);

  const hydrateScopedData = useCallback(async (bundle: AuthSessionBundle) => {
    setDataScope({ accountId: bundle.account.id, storeId: bundle.store.id });
    const [dbProducts, dbCustomers, dbSales, dbPabili, dbExpenses, savedSettings] = await Promise.all([
      loadProducts(),
      loadCustomers(),
      loadSales(),
      loadPabiliOrders(),
      loadExpenses(),
      loadSettings(),
    ]);
    const fallback = buildScopedDefaultSettings(bundle.account, bundle.store);
    const resolved = savedSettings
      ? {
          ...fallback,
          ...savedSettings,
          storeName: bundle.store.storeName,
          ownerName: bundle.account.ownerName,
          subscription: bundle.store.subscriptionTier,
          managementPIN: "",
        }
      : fallback;
    setCurrentAccount(bundle.account);
    setCurrentStore(bundle.store);
    setSession(bundle.session);
    setSettings(resolved);
    setProducts(dbProducts);
    setCustomers(dbCustomers);
    setSales(dbSales);
    setPabiliOrders(dbPabili);
    setExpenses(dbExpenses);
    setSuppliers(buildSuggestedSuppliers(dbProducts));
    setOperatingUserState(bundle.account.ownerName || "Helper");
    setManagementUnlocked(false);
    await syncAll().catch(err => console.debug("Initial sync skipped", err));
  }, [buildScopedDefaultSettings]);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      setIsHydrated(false);
      try {
        await initializeDatabase();
        const activeSession = await loadCurrentSession();
        if (!active) return;
        if (!activeSession) {
          clearDataScope();
          resetScopedState();
          return;
        }
        await hydrateScopedData(activeSession);
      } catch (err) {
        console.error("StoreProvider hydration failed", err);
        clearDataScope();
        resetScopedState();
      } finally {
        if (active) setIsHydrated(true);
      }
    };
    void hydrate();
    return () => {
      active = false;
    };
  }, [hydrateScopedData, resetScopedState]);

  useEffect(() => {
    if (!session || typeof window === "undefined") return;
    const interval = window.setInterval(() => {
      syncAll().catch(() => {});
    }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [session]);

  const createAccount = useCallback(async (
    ownerName: string,
    storeName: string,
    emailOrMobile: string,
    password: string
  ) => {
    const bundle = await createAccountRecord(ownerName, storeName, emailOrMobile, password);
    await hydrateScopedData(bundle);
  }, [hydrateScopedData]);

  const login = useCallback(async (emailOrMobile: string, password: string) => {
    const bundle = await loginAccount(emailOrMobile, password);
    await hydrateScopedData(bundle);
  }, [hydrateScopedData]);

  const logout = useCallback(async () => {
    await logoutAccount();
    clearDataScope();
    resetScopedState();
  }, [resetScopedState]);

  const updateSettings = useCallback((s: Partial<StoreSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...s };
      void persistSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setSuppliers(buildSuggestedSuppliers(products));
  }, [products]);

  useEffect(() => {
    setChatMessages(getAllMessages());
  }, []);

  const verifyManagementPin = useCallback(async (pin: string) => {
    if (!currentStore) return false;
    const ok = await verifyManagementPinForStore(currentStore.id, pin);
    if (ok) setManagementUnlocked(true);
    return ok;
  }, [currentStore]);

  const verifyManagementPinForAction = useCallback(async (pin: string) => {
    if (!currentStore) return false;
    return verifyManagementPinForStore(currentStore.id, pin);
  }, [currentStore]);

  const createManagementPin = useCallback(async (pin: string) => {
    if (!currentStore) return false;
    await setManagementPin(currentStore.id, pin);
    setSettings(prev => ({ ...prev, hasManagementPin: true, managementPIN: "" }));
    setManagementUnlocked(true);
    return true;
  }, [currentStore]);

  // Legacy mode methods retained for compatibility with existing components.
  const enterManagementMode = useCallback((_pin: string): boolean => false, []);

  const exitManagementMode = useCallback(() => {
    setManagementUnlocked(false);
  }, []);

  const completeOnboarding = useCallback((data: {
    storeName: string; ownerName: string; address?: string;
    pin: string; enableUtang?: boolean; enablePabili?: boolean;
    enableBarcodeScanner?: boolean; enableReceiptPrinter?: boolean;
    subscription?: SubscriptionTier;
  }) => {
    const next: StoreSettings = {
      ...settings,
      storeName: data.storeName,
      ownerName: data.ownerName,
      address: data.address || settings.address,
      managementPIN: "",
      hasManagementPin: settings.hasManagementPin || /^\d{4}$/.test(data.pin),
      isOnboardingComplete: true,
      enableUtang: data.enableUtang ?? true,
      enablePabili: data.enablePabili ?? true,
      enableBarcodeScanner: data.enableBarcodeScanner ?? true,
      enableReceiptPrinter: data.enableReceiptPrinter ?? false,
      subscription: data.subscription ?? settings.subscription,
    };
    setSettings(next);
    void persistSettings(next);
    if (/^\d{4}$/.test(data.pin)) {
      setManagementUnlocked(true);
      void createManagementPin(data.pin);
    } else {
      setManagementUnlocked(true);
    }
  }, [createManagementPin, settings]);

  const setOperatingUser = useCallback((name: string) => {
    setOperatingUserState(name);
  }, []);

  // Products
  const importStarterProducts = useCallback(async (items: Array<{
    name: string;
    category: string;
    price: number;
    cost: number;
    stock: number;
    unit: Unit;
    conversion?: number;
    barcodes?: string[];
  }>) => {
    if (!items.length) {
      return { imported: 0, failed: 0 };
    }

    const imported: Product[] = [];
    for (const item of items) {
      const unit = item.unit || "piece";
      const conversion =
        unit === "pack" || unit === "box"
          ? Math.max(1, Number(item.conversion || 1))
          : 1;
      const baseUnit = getBaseUnit(unit);
      const stockBase =
        unit === "pack" || unit === "box"
          ? item.stock * conversion
          : unit === "kg" || unit === "liters"
          ? item.stock * 1000
          : item.stock;
      const barcodes = normalizeBarcodes(item.barcodes);

      const product: Product = {
        id: newId(),
        name: item.name,
        price: item.price,
        cost: item.cost,
        stock: stockBase,
        unit,
        baseUnit,
        conversion,
        barcode: barcodes[0] || "",
        barcodes,
        category: item.category || "General",
        isQuickItem: false,
        emoji: "📦",
      };

      try {
        await persistProduct(product);
        imported.push(product);
      } catch (err) {
        console.error("Starter import failed", item.name, err);
      }
    }

    if (imported.length) {
      setProducts(prev => [...prev, ...imported].sort((a, b) => a.name.localeCompare(b.name)));
      void syncAll().catch(() => {});
    }

    return {
      imported: imported.length,
      failed: items.length - imported.length,
    };
  }, []);
  const addProduct = useCallback((p: Omit<Product, "id">) => {
    const unit = p.unit || "piece";
    const conversion = p.conversion || (unit === "pack" || unit === "box" ? 1 : 1);
    const baseUnit = p.baseUnit || getBaseUnit(unit);
    const stockBase = unit === "pack" || unit === "box"
      ? (p.stock || 0) * conversion
      : unit === "kg" || unit === "liters"
      ? (p.stock || 0) * 1000
      : p.stock || 0;
    const barcodes = normalizeBarcodes(p.barcodes, p.barcode);
    const id = newId();
    const product: Product = {
      ...p,
      id,
      unit,
      baseUnit,
      conversion,
      stock: stockBase,
      barcode: barcodes[0] || "",
      barcodes,
    };
    setProducts(prev => [...prev, product]);
    void persistProduct(product);
    void syncAll().catch(() => {});
  }, []);

  const updateProduct = useCallback((id: string, p: Partial<Product>) => {
    let updated: Product | null = null;
    setProducts(prev => prev.map(x => {
      if (x.id !== id) return x;
      const unit = p.unit || x.unit;
      const conversion = p.conversion || x.conversion || 1;
      const baseUnit = p.baseUnit || x.baseUnit || getBaseUnit(unit);
      const stockProvided = p.stock;
      const stockBase = stockProvided === undefined
        ? x.stock
        : unit === "pack" || unit === "box"
        ? stockProvided * conversion
        : unit === "kg" || unit === "liters"
        ? stockProvided * 1000
        : stockProvided;
      const hasBarcodeUpdates = p.barcodes !== undefined || p.barcode !== undefined;
      const nextBarcodes = hasBarcodeUpdates
        ? normalizeBarcodes(p.barcodes, p.barcode)
        : normalizeBarcodes(x.barcodes, x.barcode);
      updated = {
        ...x,
        ...p,
        unit,
        baseUnit,
        conversion,
        stock: stockBase,
        barcode: hasBarcodeUpdates ? nextBarcodes[0] || "" : x.barcode || "",
        barcodes: nextBarcodes,
      };
      return updated;
    }));
    if (updated) {
      void updateProductRecord(id, updated);
      void syncAll().catch(() => {});
    }
  }, []);

  const addStock = useCallback((productId: string, qty: number, unit?: Unit) => {
    if (qty <= 0) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const targetUnit = unit || p.unit;
      const factor =
        targetUnit === "pack" || targetUnit === "box"
          ? p.conversion || 1
          : targetUnit === "kg" || targetUnit === "liters"
          ? 1000
          : 1;
      return { ...p, stock: p.stock + qty * factor };
    }));
    const factor =
      (unit || product.unit) === "pack" || (unit || product.unit) === "box"
        ? product.conversion || 1
        : (unit || product.unit) === "kg" || (unit || product.unit) === "liters"
        ? 1000
        : 1;
    const updatedStock = product.stock + qty * factor;
    void updateProductRecord(productId, { stock: updatedStock });
    void syncAll().catch(() => {});
  }, [products]);

  const deleteProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(x => x.id !== id));
    void deleteProductRecord(id);
    void syncAll().catch(() => {});
  }, []);

  const searchProducts = useCallback((query: string) => {
    const q = query.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode || "").includes(query) ||
      (p.barcodes || []).some(code => code.includes(query))
    );
  }, [products]);

  // Cart
  const addToCart = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(i => i.productId === productId);
      const nextQty = (existing?.quantity || 0) + 1;
      const neededBase = toBaseUnits(product, nextQty);
      if (neededBase > product.stock) return prev; // not enough stock
      if (existing) {
        return prev.map(i => i.productId === productId
          ? { ...i, quantity: nextQty, subtotal: nextQty * i.price }
          : i);
      }
      return [...prev, { productId, productName: product.name, price: product.price, quantity: 1, unit: product.unit, subtotal: product.price }];
    });
  }, [products]);
  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  }, []);
  const updateCartQty = useCallback((productId: string, qty: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.productId !== productId));
      return;
    }
    const maxQty = Math.floor(product.stock / (toBaseUnits(product, 1) || 1));
    const safeQty = Math.min(qty, Math.max(0, maxQty));
    setCart(prev => prev.map(i => i.productId === productId
      ? { ...i, quantity: safeQty, subtotal: safeQty * i.price }
      : i));
  }, [products]);
  const clearCart = useCallback(() => setCart([]), []);
  const addPabiliToCart = useCallback((order: PabiliOrder) => {
    setCart([]);
    order.items.forEach(item => {
      const product = products.find(p => p.name === item.name);
      if (product) {
        setCart(prev => {
          const existing = prev.find(i => i.productId === product.id);
          const nextQty = (existing?.quantity || 0) + item.qty;
          const neededBase = toBaseUnits(product, nextQty);
          if (neededBase > product.stock) return prev;
          if (existing) return prev.map(i => i.productId === product.id ? { ...i, quantity: nextQty, subtotal: nextQty * i.price } : i);
          return [...prev, { productId: product.id, productName: product.name, price: product.price, quantity: item.qty, unit: product.unit, subtotal: product.price * item.qty }];
        });
      }
    });
  }, [products]);

  const getCustomerCreditStatus = useCallback((customerId: string): CustomerCreditStatus => {
    const customer = customers.find(x => x.id === customerId);
    const currentBalance = customer?.transactions.reduce((sum, tx) => sum + tx.balance, 0) ?? 0;
    const rawLimit = customer?.creditLimit;
    const normalizedLimit =
      rawLimit === null || rawLimit === undefined || Number.isNaN(Number(rawLimit))
        ? null
        : Math.max(0, Number(rawLimit));
    return {
      currentBalance,
      creditLimit: normalizedLimit,
      availableCredit: normalizedLimit === null ? null : Math.max(0, normalizedLimit - currentBalance),
    };
  }, [customers]);

  // Sales
  const completeSale = useCallback((amountPaid: number, method = "cash") => {
    if (cart.length === 0) return;
    const now = new Date();
    const saleId = newId();
    const saleItems = cart.map(i => {
      const product = products.find(p => p.id === i.productId);
      return {
        productId: i.productId,
        name: i.productName,
        qty: i.quantity,
        unit: i.unit,
        price: i.price,
        cost: product?.cost ?? i.price * 0.65,
        subtotal: i.subtotal,
      };
    });
    setSales(prev => [{
      id: saleId,
      timestamp: now.toISOString(),
      date: now.toISOString(),
      items: saleItems,
      total: cartTotal,
      paymentType: method as Sale["paymentType"],
      isUtang: false,
      helperName: operatingUser,
    }, ...prev]);
    setProducts(prev => prev.map(p => {
      const ci = cart.find(i => i.productId === p.id);
      return ci ? { ...p, stock: Math.max(0, p.stock - toBaseUnits(p, ci.quantity)) } : p;
    }));
    setCart([]);
    void persistSale({
      id: saleId,
      items: saleItems,
      total: cartTotal,
      paymentType: method as Sale["paymentType"],
      isUtang: false,
      amountPaid,
      changeDue: amountPaid - cartTotal,
      timestamp: now.getTime(),
    });
    void syncAll().catch(() => {});
  }, [cart, cartTotal, operatingUser, products]);

  const addUtangSale = useCallback((
    customerId: string,
    amountPaid = 0,
    forceOverride = false,
    applyAdvanceFirst = false
  ): AddUtangSaleResult => {
    if (!settings.enableUtang) return { ok: false, code: "utang_disabled" };
    if (cart.length === 0) return { ok: false, code: "cart_empty" };
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return { ok: false, code: "customer_not_found" };
    const now = new Date();
    const nowStr = now.toISOString();
    const saleId = newId();
    const utangId = newId();
    const safeAmountPaid = Math.max(0, Math.min(amountPaid, cartTotal));
    const baseUtangAmount = Math.max(0, cartTotal - safeAmountPaid);
    const customerAdvance = Math.max(0, Number(customer.advanceBalance || 0));
    const advanceUsed = applyAdvanceFirst ? Math.min(customerAdvance, baseUtangAmount) : 0;
    const remainingBalance = Math.max(0, baseUtangAmount - advanceUsed);
    const shouldCreateUtang = remainingBalance > 0;
    const persistedAmountPaid = Math.min(cartTotal, safeAmountPaid + advanceUsed);
    const credit = getCustomerCreditStatus(customerId);
    const newBalance = credit.currentBalance + remainingBalance;
    if (
      credit.creditLimit !== null &&
      remainingBalance > 0 &&
      newBalance > credit.creditLimit &&
      !forceOverride
    ) {
      return {
        ok: false,
        code: "credit_limit_exceeded",
        credit: { ...credit, newBalance },
      };
    }
    const saleItems = cart.map(i => ({
      productId: i.productId,
      name: i.productName,
      qty: i.quantity,
      unit: i.unit,
      price: i.price,
      cost: products.find(p => p.id === i.productId)?.cost ?? i.price * 0.65,
      subtotal: i.subtotal,
    }));
    const utangItems = cart.map(i => ({
      productId: i.productId,
      name: i.productName,
      qty: i.quantity,
      unit: i.unit,
      price: i.price,
      subtotal: i.subtotal,
    }));
    const newTx: UtangRecord | null = shouldCreateUtang
      ? {
          id: utangId,
          date: nowStr.split("T")[0],
          items: utangItems,
          amount: cartTotal,
          balance: remainingBalance,
          status: getUtangStatus(cartTotal, remainingBalance),
          payments: [],
        }
      : null;
    setSales(prev => [{
      id: saleId,
      timestamp: nowStr,
      date: nowStr,
      items: saleItems,
      total: cartTotal,
      paymentType: shouldCreateUtang ? "utang" : "cash",
      isUtang: shouldCreateUtang,
      customerId,
      customerName: customer.name,
      helperName: operatingUser,
    }, ...prev]);
    setCustomers(prev => prev.map(c => {
      if (c.id !== customerId) return c;
      const nextAdvance = Math.max(0, Number(c.advanceBalance || 0) - advanceUsed);
      const nextHistory = advanceUsed > 0
        ? [{
            id: `adv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            date: nowStr,
            amount: advanceUsed,
            appliedAmount: 0,
            advanceAmount: -advanceUsed,
            entryType: "advance_deduction" as const,
            referenceSaleId: saleId,
            note: shouldCreateUtang
              ? "Advance applied before creating utang."
              : "Advance fully covered checkout.",
          }, ...(c.paymentHistory || [])]
        : (c.paymentHistory || []);
      if (!newTx) {
        return {
          ...c,
          advanceBalance: nextAdvance,
          paymentHistory: nextHistory,
        };
      }
      return {
        ...c,
        advanceBalance: nextAdvance,
        paymentHistory: nextHistory,
        transactions: [newTx, ...c.transactions],
      };
    }));
    setProducts(prev => prev.map(p => {
      const ci = cart.find(i => i.productId === p.id);
      return ci ? { ...p, stock: Math.max(0, p.stock - toBaseUnits(p, ci.quantity)) } : p;
    }));
    setCart([]);
    void (async () => {
      try {
        await persistSale({
          id: saleId,
          items: saleItems,
          total: cartTotal,
          paymentType: shouldCreateUtang ? "utang" : "cash",
          isUtang: shouldCreateUtang,
          customerId,
          amountPaid: persistedAmountPaid,
          changeDue: 0,
          timestamp: now.getTime(),
          forceCreditLimitOverride: forceOverride,
        });
        if (advanceUsed > 0) {
          await persistCustomerAdvanceUse(customerId, advanceUsed, nowStr, saleId, shouldCreateUtang);
        }
        if (shouldCreateUtang) {
          await persistUtangRecord({
            id: utangId,
            customerId,
            items: utangItems,
            amount: cartTotal,
            balance: remainingBalance,
            date: nowStr.split("T")[0],
            forceCreditLimitOverride: forceOverride,
          });
        }
        await syncAll().catch(() => {});
      } catch {
        // Keep UI responsive if persistence fails; sync retry will handle eventual consistency.
      }
    })();
    return { ok: true };
  }, [cart, cartTotal, customers, getCustomerCreditStatus, operatingUser, products, settings.enableUtang]);

  // Customers
  const addCustomer = useCallback((name: string, phone?: string, note?: string, creditLimit: number | null = null) => {
    const id = newId();
    const normalizedLimit = creditLimit === null || creditLimit === undefined
      ? null
      : Math.max(0, Number(creditLimit));
    setCustomers(prev => [...prev, {
      id,
      name,
      phone,
      note,
      creditLimit: normalizedLimit,
      advanceBalance: 0,
      paymentHistory: [],
      transactions: [],
    }]);
    void persistCustomer(name, phone, id, note, normalizedLimit);
    void syncAll().catch(() => {});
    return id;
  }, []);
  const updateCustomerProfile = useCallback((customerId: string, changes: { name: string; phone?: string; creditLimit?: number | null }) => {
    const normalizedLimit = changes.creditLimit === null || changes.creditLimit === undefined
      ? null
      : Math.max(0, Number(changes.creditLimit));
    setCustomers(prev => prev.map(customer => {
      if (customer.id !== customerId) return customer;
      return {
        ...customer,
        name: changes.name,
        phone: changes.phone,
        creditLimit: normalizedLimit,
      };
    }));
    void persistCustomerUpdate(customerId, {
      name: changes.name,
      phone: changes.phone,
      creditLimit: normalizedLimit,
    });
    void syncAll().catch(() => {});
  }, []);
  const recordPayment = useCallback((customerId: string, amount: number) => {
    const normalizedAmount = Math.max(0, Number(amount || 0));
    if (normalizedAmount <= 0) return;

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const oldestUnpaid = [...customer.transactions]
      .filter(tx => tx.balance > 0)
      .sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });

    let remaining = normalizedAmount;
    const allocations: Record<string, number> = {};
    oldestUnpaid.forEach(tx => {
      if (remaining <= 0) return;
      const applied = Math.min(tx.balance, remaining);
      if (applied <= 0) return;
      allocations[tx.id] = applied;
      remaining -= applied;
    });

    const appliedAmount = normalizedAmount - remaining;
    const advanceAmount = Math.max(0, remaining);
    const paymentDate = new Date().toISOString();
    const paymentHistoryId = `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    setCustomers(prev => prev.map(c => {
      if (c.id !== customerId) return c;
      return {
        ...c,
        advanceBalance: (c.advanceBalance || 0) + advanceAmount,
        paymentHistory: [{
          id: paymentHistoryId,
          date: paymentDate,
          amount: normalizedAmount,
          appliedAmount,
          advanceAmount,
          entryType: "payment",
          note: "Customer payment recorded.",
        }, ...(c.paymentHistory || [])],
        transactions: c.transactions.map(tx => {
          const applied = allocations[tx.id] || 0;
          if (applied <= 0) {
            return {
              ...tx,
              status: getUtangStatus(tx.amount, tx.balance),
            };
          }
          const newBalance = Math.max(0, tx.balance - applied);
          return {
            ...tx,
            balance: newBalance,
            status: getUtangStatus(tx.amount, newBalance),
            payments: [...tx.payments, {
              id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              amount: applied,
              date: paymentDate,
            }],
          };
        }),
      };
    }));

    void persistPayment(customerId, normalizedAmount, paymentDate);
    void syncAll().catch(() => {});
  }, [customers]);
  const getCustomerBalance = useCallback((customerId: string) => {
    return getCustomerCreditStatus(customerId).currentBalance;
  }, [getCustomerCreditStatus]);

  // Pabili
  const addPabiliOrder = useCallback((order: Omit<PabiliOrder, "id">) => {
    const id = newId();
    const timestamp = order.timestamp || order.date || new Date().toISOString();
    const newOrder = { ...order, id, timestamp };
    setPabiliOrders(prev => [newOrder, ...prev]);
    void persistPabiliOrder({
      id,
      items: order.items,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      status: order.status,
      timestamp: new Date(timestamp).getTime(),
      note: order.note,
      total: order.total,
    });
    void syncAll().catch(() => {});
  }, []);
  const updatePabiliStatus = useCallback((id: string, status: PabiliOrder["status"]) => {
    setPabiliOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    void persistPabiliStatus(id, status);
    void syncAll().catch(() => {});
  }, []);

  // Restock
  const updateRestockList = useCallback((items: RestockItem[]) => {
    setRestockList(items);
  }, []);
  const checkRestockItem = useCallback((productId: string, checked: boolean, purchasedQty: number) => {
    setRestockList(prev => prev.map(i => i.productId === productId ? { ...i, checked } : i));
    if (checked && purchasedQty > 0) {
      setProducts(prev => prev.map(p => {
        if (p.id !== productId) return p;
        return { ...p, stock: p.stock + toBaseUnits(p, purchasedQty) };
      }));
      const product = products.find(p => p.id === productId);
      if (product) {
        const updatedStock = product.stock + toBaseUnits(product, purchasedQty);
        void updateProductRecord(productId, { stock: updatedStock });
        void syncAll().catch(() => {});
      }
    }
  }, [products]);

  // Marketplace & Chat
  const getSupplierCatalog = useCallback(() => suppliers.flatMap(s => s.products), [suppliers]);

  const placeRestockOrder = useCallback((supplierId: string, items: RestockOrderItem[]) => {
    const order = createRestockOrder({ supplierId, items, suppliers });
    if (!order) return null;
    setRestockOrders(prev => [order, ...prev]);
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
      const msgText = formatRestockMessage(order, supplier);
      const chat = sendChatMessage({
        senderId: "store-owner",
        receiverId: supplierId,
        message: msgText,
        context: "restock",
        threadId: order.id,
      });
      setChatMessages(prev => [chat, ...prev]);
    }
    return order;
  }, [suppliers]);

  const updateRestockOrderStatus = useCallback((orderId: string, status: RestockOrderStatus) => {
    setRestockOrders(prev => prev.map(o => o.id === orderId ? applyRestockOrderStatus(o, status) : o));
  }, []);

  const sendChat = useCallback((input: Omit<ChatMessage, "id" | "timestamp"> & { id?: string; timestamp?: string }) => {
    const msg = sendChatMessage(input);
    setChatMessages(prev => [msg, ...prev]);
    return msg;
  }, []);

  const getConversationMessages = useCallback((a: string, b: string) => {
    return getConversation(a, b);
  }, []);

  // Expenses
  const addExpense = useCallback((e: Omit<Expense, "id">) => {
    const id = newId();
    const expense = { ...e, id };
    setExpenses(prev => [...prev, expense]);
    void persistExpense(expense);
    void syncAll().catch(() => {});
  }, []);

  // Analytics
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const getWeeklyRevenue = useCallback(() => {
    return sales.filter(s => new Date(s.date) >= sevenDaysAgo).reduce((sum, s) => sum + s.total, 0);
  }, [sales]);

  const getWeeklyProfit = useCallback(() => {
    const weeklySales = sales.filter(s => new Date(s.date) >= sevenDaysAgo);
    const revenue = weeklySales.reduce((sum, s) => sum + s.total, 0);
    const cogs = weeklySales.reduce((sum, s) => {
      return sum + s.items.reduce((cs, item) => {
        const product = products.find(p => p.name === item.name);
        return cs + (product?.cost || item.price * 0.65) * item.qty;
      }, 0);
    }, 0);
    const weeklyExpenses = expenses.filter(e => new Date(e.date) >= sevenDaysAgo).reduce((sum, e) => sum + e.amount, 0);
    return revenue - cogs - weeklyExpenses;
  }, [sales, products, expenses]);

  const getSmartRestockSuggestions = useCallback(() => {
    return generateRestockSuggestions(products, sales, { lookbackDays: 7, bufferDays: 14, thresholdDays: 3 });
  }, [products, sales]);

  const getProductAnalytics = useCallback((period: "today" | "week" | "all") => {
    const cutoff = period === "today"
      ? new Date(fmt(today))
      : period === "week"
      ? sevenDaysAgo
      : new Date(0);
    const filteredSales = sales.filter(s => new Date(s.date) >= cutoff);
    const map: Record<string, { qty: number; revenue: number; cost: number }> = {};
    filteredSales.forEach(s => s.items.forEach(item => {
      if (!map[item.name]) map[item.name] = { qty: 0, revenue: 0, cost: 0 };
      map[item.name].qty += item.qty;
      map[item.name].revenue += item.price * item.qty;
      const product = products.find(p => p.name === item.name);
      const costPerUnit = product?.cost ?? item.cost ?? item.price * 0.65;
      map[item.name].cost += costPerUnit * item.qty;
    }));
    const days = period === "today" ? 1 : period === "week" ? 7 : 30;
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        emoji: products.find(p => p.name === name)?.emoji || "📦",
        ...data,
        avgDaily: data.qty / days,
        profit: data.revenue - data.cost,
        margin: data.revenue > 0 ? (data.revenue - data.cost) / data.revenue : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [sales, products]);

  const getHourlySales = useCallback((date: Date = new Date()) => {
    return groupSalesByHour(sales, date);
  }, [sales]);

  const getDailySales = useCallback((days: number = 7) => {
    return aggregateDailySales(sales, days);
  }, [sales]);

  const getWeeklyTrends = useCallback((weeks: number = 4) => {
    return aggregateWeeklyTrends(sales, weeks);
  }, [sales]);

  const getTopSellingProducts = useCallback((limit: number = 5) => {
    return getProductAnalytics("all")
      .sort((a, b) => b.qty - a.qty)
      .slice(0, limit)
      .map(({ name, qty, revenue, profit, emoji }) => ({ name, qty, revenue, profit, emoji }));
  }, [getProductAnalytics]);

  const getProductProfitability = useCallback((limit: number = 5) => {
    return topProfitable(products, sales, limit);
  }, [products, sales]);

  const getLeastProfitable = useCallback((limit: number = 5) => {
    return leastProfitable(products, sales, limit);
  }, [products, sales]);

  const getCommunityInsights = useCallback(() => communityStats, [communityStats]);

  const getBenchmarkSnapshot = useCallback(() => buildBenchmark(sales, products, { communityStats }), [sales, products, communityStats]);
  const isManagementMode = managementUnlocked;

  return (
    <StoreContext.Provider value={{
      products, cart, customers, sales, pabiliOrders, expenses, restockList, suppliers, restockOrders, chatMessages, settings, t,
      currentAccount, currentStore, session, managementUnlocked, isHydrated,
      createAccount, login, logout, verifyManagementPin, verifyManagementPinForAction, createManagementPin,
      isManagementMode, operatingUser,
      enterManagementMode, exitManagementMode, completeOnboarding, setOperatingUser,
      addProduct, importStarterProducts, updateProduct, deleteProduct, addStock, searchProducts,
      addToCart, removeFromCart, updateCartQty, clearCart, addPabiliToCart,
      completeSale, addUtangSale,
      addCustomer, updateCustomerProfile, recordPayment, getCustomerBalance, getCustomerCreditStatus,
      addPabiliOrder, updatePabiliStatus,
      updateRestockList, checkRestockItem, placeRestockOrder, updateRestockOrderStatus, getSupplierCatalog,
      sendChat, getConversation: getConversationMessages,
      addExpense,
      getWeeklyRevenue, getWeeklyProfit,
      getSmartRestockSuggestions, getProductAnalytics,
      getHourlySales, getDailySales, getWeeklyTrends,
      getTopSellingProducts, getProductProfitability, getLeastProfitable,
      getCommunityInsights, getBenchmarkSnapshot,
      updateSettings, cartTotal,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
