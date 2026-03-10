import QRCode from "qrcode";

export interface QrPayload {
  storeId: string;
  orderingUrl: string;
}

export const buildOrderingLink = (storeSlug: string, base?: string) => {
  if (base) return `${base.replace(/\/$/, "")}/${storeSlug}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/pabili/${storeSlug}`;
  }
  return `https://tindacore.app/pabili/${storeSlug}`;
};

export async function generateStoreQr(payload: QrPayload, width = 480) {
  const data = JSON.stringify(payload);
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: "M",
    width,
    margin: 1,
    color: { dark: "#111827", light: "#ffffff" },
  });
}
