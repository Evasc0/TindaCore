interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  subtotal: number;
}

interface ReceiptPayload {
  storeName: string;
  items: ReceiptItem[];
  total: number;
  amountPaid?: number;
  changeDue?: number;
  date?: string;
  isUtang?: boolean;
}

let printerCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

export async function connectPrinter() {
  if (typeof navigator === "undefined" || !navigator.bluetooth) {
    throw new Error("Web Bluetooth not available. Use Android build with Bluetooth enabled.");
  }
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [0xffe0, 0x18f0, 0x180f],
  });
  const server = await device.gatt?.connect();
  const service = await server?.getPrimaryService(0xffe0);
  printerCharacteristic = await service?.getCharacteristic(0xffe1) ?? null;
  return device.name || "Bluetooth Printer";
}

export async function printReceipt(payload: ReceiptPayload) {
  if (!printerCharacteristic) {
    throw new Error("Printer not connected. Call connectPrinter() first.");
  }
  const encoder = new TextEncoder();
  const lines: string[] = [];
  const date = payload.date || new Date().toLocaleString();
  lines.push(center(payload.storeName.toUpperCase()));
  lines.push(center(date));
  lines.push("--------------------------------");
  payload.items.forEach(item => {
    lines.push(`${item.qty} x ${truncate(item.name, 18)}  ₱${item.price.toFixed(2)}`);
    lines.push(right(`₱${item.subtotal.toFixed(2)}`));
  });
  lines.push("--------------------------------");
  lines.push(right(`TOTAL: ₱${payload.total.toFixed(2)}`));
  if (payload.amountPaid !== undefined) {
    lines.push(right(`PAID:  ₱${payload.amountPaid.toFixed(2)}`));
    lines.push(right(`CHANGE: ₱${(payload.changeDue ?? 0).toFixed(2)}`));
  }
  if (payload.isUtang) {
    lines.push(center("*** UTANG / ON ACCOUNT ***"));
  }
  lines.push("\n\n");
  const content = lines.join("\n");
  await printerCharacteristic.writeValue(encoder.encode(content));
}

const center = (text: string, width = 32) => {
  if (text.length >= width) return text.slice(0, width);
  const padding = Math.floor((width - text.length) / 2);
  return `${" ".repeat(padding)}${text}`;
};

const right = (text: string, width = 32) => {
  if (text.length >= width) return text.slice(0, width);
  return `${" ".repeat(width - text.length)}${text}`;
};

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
