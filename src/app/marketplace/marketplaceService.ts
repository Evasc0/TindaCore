import { Product, Unit } from "../context/StoreContext";

export interface SupplierProduct {
  productId: string;
  name: string;
  price: number;
  stock: number;
  unit: Unit;
  minOrder?: number;
  leadTimeDays?: number;
}

export interface Supplier {
  id: string;
  storeName: string;
  location: string;
  usesApp: boolean;
  products: SupplierProduct[];
}

export interface RestockOrderItem {
  productId: string;
  name: string;
  quantity: number;
  unit: Unit;
  price: number;
}

export type RestockOrderStatus = "pending" | "accepted" | "completed";

export interface RestockOrder {
  id: string;
  supplierId: string;
  items: RestockOrderItem[];
  status: RestockOrderStatus;
  timestamp: string;
  channel: "in-app" | "manual";
  total: number;
}

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `ord-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function buildSuggestedSuppliers(products: Product[]): Supplier[] {
  const popular = products.slice(0, 6);
  const makeSupplier = (id: string, name: string, usesApp: boolean, offset = 0): Supplier => ({
    id,
    storeName: name,
    location: "Nearby",
    usesApp,
    products: popular.map((p, idx) => ({
      productId: p.id,
      name: p.name,
      price: Math.max(p.cost * 1.05, p.price * 0.7) + offset,
      stock: 100 - idx * 5,
      unit: p.unit,
      minOrder: 5,
      leadTimeDays: usesApp ? 1 : 2,
    })),
  });
  return [
    makeSupplier("sup-1", "Barangay Wholesale", true),
    makeSupplier("sup-2", "Kanto Distributor", false, 1.5),
    makeSupplier("sup-3", "Grocery Partner", true, 0.5),
  ];
}

export function searchSupplierProducts(suppliers: Supplier[], term: string): SupplierProduct[] {
  const q = term.toLowerCase();
  return suppliers.flatMap(s => s.products.filter(p => p.name.toLowerCase().includes(q)));
}

export function createRestockOrder(params: {
  supplierId: string;
  items: RestockOrderItem[];
  suppliers: Supplier[];
}): RestockOrder | null {
  const supplier = params.suppliers.find(s => s.id === params.supplierId);
  if (!supplier) return null;
  const total = params.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return {
    id: uuid(),
    supplierId: supplier.id,
    items: params.items,
    status: "pending",
    timestamp: new Date().toISOString(),
    channel: supplier.usesApp ? "in-app" : "manual",
    total,
  };
}

export function updateRestockOrderStatus(order: RestockOrder, status: RestockOrderStatus): RestockOrder {
  return { ...order, status };
}

export function formatRestockMessage(order: RestockOrder, supplier: Supplier): string {
  const lines = order.items.map(i => `- ${i.name} x${i.quantity} @ ₱${i.price}`);
  const channelNote = supplier.usesApp
    ? "Order will sync automatically to your partner's POS."
    : "Supplier is offline; please confirm via call/SMS.";
  return [
    `Restock request for ${supplier.storeName}`,
    ...lines,
    `Total: ₱${order.total.toFixed(2)}`,
    channelNote,
  ].join("\n");
}

