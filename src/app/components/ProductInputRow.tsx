import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { Unit } from "../context/StoreContext";
import { startScanner, stopScanner } from "../hardware/barcodeScanner";

export const SUPPORTED_UNITS: Unit[] = [
  "piece",
  "pack",
  "box",
  "cavan",
  "kg",
  "grams",
  "ml",
  "liters",
];

export interface ProductInputValue {
  emoji: string;
  name: string;
  category: string;
  cost: string;
  price: string;
  stock: string;
  unit: Unit;
  conversion: string;
  barcodes: string[];
}

export interface ProductInputErrors {
  name?: string;
  cost?: string;
  price?: string;
  stock?: string;
  unit?: string;
  conversion?: string;
}

interface ProductInputRowProps {
  value: ProductInputValue;
  selected: boolean;
  isDark: boolean;
  nameEditable?: boolean;
  showCategory?: boolean;
  errors?: ProductInputErrors;
  onSelectedChange: (checked: boolean) => void;
  onChange: (next: ProductInputValue) => void;
}

const ensureBarcodeFields = (barcodes: string[]) => (barcodes.length ? barcodes : [""]);

export function ProductInputRow({
  value,
  selected,
  isDark,
  nameEditable = false,
  showCategory = true,
  errors,
  onSelectedChange,
  onChange,
}: ProductInputRowProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTargetIndex, setScannerTargetIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const cardBorder = isDark ? "#374151" : "#e5e7eb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";
  const subCard = isDark ? "#111827" : "#f8fafc";
  const inputBg = isDark ? "#0f172a" : "#ffffff";
  const rowBg = isDark ? "#1f2937" : "#ffffff";
  const barcodeFields = ensureBarcodeFields(value.barcodes || []);

  const patchValue = useCallback(
    (partial: Partial<ProductInputValue>) => {
      onChange({ ...value, ...partial });
    },
    [onChange, value]
  );

  const updateBarcode = useCallback(
    (index: number, barcode: string) => {
      const next = [...barcodeFields];
      next[index] = barcode;
      patchValue({ barcodes: next });
    },
    [barcodeFields, patchValue]
  );

  const addBarcodeField = () => {
    patchValue({ barcodes: [...barcodeFields, ""] });
  };

  const removeBarcodeField = (index: number) => {
    const next = barcodeFields.filter((_, i) => i !== index);
    patchValue({ barcodes: next.length ? next : [""] });
  };

  useEffect(() => {
    if (!scannerOpen || !videoRef.current) return;
    let active = true;

    void startScanner(
      videoRef.current,
      code => {
        if (!active) return;
        updateBarcode(scannerTargetIndex, code);
        setScannerOpen(false);
      },
      () => {}
    );

    return () => {
      active = false;
      stopScanner();
    };
  }, [scannerOpen, scannerTargetIndex, updateBarcode]);

  return (
    <div
      className="rounded-xl border mb-2 p-3"
      style={{ borderColor: cardBorder, background: rowBg }}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={event => onSelectedChange(event.target.checked)}
          className="mt-0.5"
        />
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: isDark ? "#111827" : "#f3f4f6" }}
        >
          {value.emoji || "📦"}
        </div>
        <div className="flex-1 min-w-0">
          {nameEditable ? (
            <div>
              <input
                type="text"
                value={value.name}
                onChange={event => patchValue({ name: event.target.value })}
                placeholder="Product name"
                className="w-full rounded-lg px-2 py-1.5 border text-sm font-semibold outline-none"
                style={{
                  borderColor: errors?.name ? "#ef4444" : cardBorder,
                  background: inputBg,
                  color: text,
                }}
              />
              {errors?.name && (
                <p className="text-[10px] mt-1" style={{ color: "#ef4444" }}>
                  {errors.name}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-semibold leading-tight" style={{ color: text }}>
              {value.name}
            </p>
          )}
          {showCategory && (
            <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>
              {value.category}
            </p>
          )}
        </div>
      </div>

      {selected && (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px]" style={{ color: textMuted }}>
                Cost Price
              </label>
              <input
                type="number"
                value={value.cost}
                onChange={event => patchValue({ cost: event.target.value })}
                className="w-full mt-1 px-2 py-1.5 rounded-lg border text-sm outline-none"
                style={{
                  borderColor: errors?.cost ? "#ef4444" : cardBorder,
                  background: inputBg,
                  color: text,
                }}
                placeholder="0.00"
              />
              {errors?.cost && (
                <p className="text-[10px] mt-1" style={{ color: "#ef4444" }}>
                  {errors.cost}
                </p>
              )}
            </div>

            <div>
              <label className="text-[11px]" style={{ color: textMuted }}>
                Selling Price
              </label>
              <input
                type="number"
                value={value.price}
                onChange={event => patchValue({ price: event.target.value })}
                className="w-full mt-1 px-2 py-1.5 rounded-lg border text-sm outline-none"
                style={{
                  borderColor: errors?.price ? "#ef4444" : cardBorder,
                  background: inputBg,
                  color: text,
                }}
                placeholder="0.00"
              />
              {errors?.price && (
                <p className="text-[10px] mt-1" style={{ color: "#ef4444" }}>
                  {errors.price}
                </p>
              )}
            </div>

            <div>
              <label className="text-[11px]" style={{ color: textMuted }}>
                Stock Quantity
              </label>
              <input
                type="number"
                value={value.stock}
                onChange={event => patchValue({ stock: event.target.value })}
                className="w-full mt-1 px-2 py-1.5 rounded-lg border text-sm outline-none"
                style={{
                  borderColor: errors?.stock ? "#ef4444" : cardBorder,
                  background: inputBg,
                  color: text,
                }}
                placeholder="0"
              />
              {errors?.stock && (
                <p className="text-[10px] mt-1" style={{ color: "#ef4444" }}>
                  {errors.stock}
                </p>
              )}
            </div>

            <div>
              <label className="text-[11px]" style={{ color: textMuted }}>
                Unit
              </label>
              <select
                value={value.unit}
                onChange={event => patchValue({ unit: event.target.value as Unit })}
                className="w-full mt-1 px-2 py-1.5 rounded-lg border text-sm outline-none"
                style={{
                  borderColor: errors?.unit ? "#ef4444" : cardBorder,
                  background: inputBg,
                  color: text,
                }}
              >
                {SUPPORTED_UNITS.map(unit => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
              {errors?.unit && (
                <p className="text-[10px] mt-1" style={{ color: "#ef4444" }}>
                  {errors.unit}
                </p>
              )}
            </div>
          </div>

          {(value.unit === "pack" || value.unit === "box") && (
            <div className="mt-2">
              <label className="text-[11px]" style={{ color: textMuted }}>
                Pieces per {value.unit}
              </label>
              <input
                type="number"
                value={value.conversion}
                onChange={event => patchValue({ conversion: event.target.value })}
                className="w-full mt-1 px-2 py-1.5 rounded-lg border text-sm outline-none"
                style={{
                  borderColor: errors?.conversion ? "#ef4444" : cardBorder,
                  background: inputBg,
                  color: text,
                }}
                placeholder={value.unit === "pack" ? "e.g. 6" : "e.g. 24"}
              />
              {errors?.conversion && (
                <p className="text-[10px] mt-1" style={{ color: "#ef4444" }}>
                  {errors.conversion}
                </p>
              )}
            </div>
          )}

          <div
            className="mt-3 rounded-lg border p-2"
            style={{ borderColor: cardBorder, background: subCard }}
          >
            <p className="text-[11px] font-semibold mb-2" style={{ color: textMuted }}>
              Barcode
            </p>
            <div className="space-y-2">
              {barcodeFields.map((barcode, index) => (
                <div key={`${value.name}-${index}`} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={barcode}
                    onChange={event => updateBarcode(index, event.target.value)}
                    placeholder="Enter barcode (optional)"
                    className="flex-1 px-2 py-1.5 rounded-lg border text-sm outline-none"
                    style={{ borderColor: cardBorder, background: inputBg, color: text }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setScannerTargetIndex(index);
                      setScannerOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1"
                    style={{
                      borderColor: cardBorder,
                      background: isDark ? "#1e3a8a" : "#eff6ff",
                      color: "#2563eb",
                    }}
                  >
                    <Camera size={13} />
                    Scan
                  </button>
                  {barcodeFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBarcodeField(index)}
                      className="px-2 py-1.5 rounded-lg border"
                      style={{ borderColor: cardBorder, background: inputBg, color: textMuted }}
                      aria-label="Remove barcode"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addBarcodeField}
              className="mt-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1"
              style={{
                borderColor: cardBorder,
                background: inputBg,
                color: textMuted,
              }}
            >
              <Plus size={13} />
              Add Another Barcode
            </button>

            {scannerOpen && (
              <div className="mt-3 rounded-lg border p-2" style={{ borderColor: cardBorder, background: rowBg }}>
                <p className="text-[11px] mb-2" style={{ color: textMuted }}>
                  Scan Barcode
                </p>
                <video ref={videoRef} className="w-full rounded-lg" autoPlay muted playsInline />
                <button
                  type="button"
                  onClick={() => setScannerOpen(false)}
                  className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: cardBorder, background: inputBg, color: textMuted }}
                >
                  Stop Scanner
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
