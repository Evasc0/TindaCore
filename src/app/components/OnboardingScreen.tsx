import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Store, User, Lock, Check, ChevronRight, QrCode, Printer, Barcode, Users, Star, Zap, Eye, EyeOff } from "lucide-react";
import { useStore } from "../context/StoreContext";

type Step = "welcome" | "store" | "pin" | "features" | "done";

export function OnboardingScreen() {
  const { completeOnboarding, settings } = useStore();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";

  const [step, setStep] = useState<Step>("welcome");
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState("");
  const [features, setFeatures] = useState({
    enableUtang: true,
    enablePabili: true,
    enableBarcodeScanner: true,
    enableReceiptPrinter: false,
  });

  const bg = "#0f172a";
  const card = isDark ? "#1e293b" : "#1e293b";
  const inputBg = "rgba(255,255,255,0.08)";
  const inputBorder = "rgba(255,255,255,0.15)";

  const toggleFeature = (key: keyof typeof features) => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePinNext = () => {
    if (pin.length !== 4) { setPinError("PIN must be 4 digits"); return; }
    if (pin !== confirmPin) { setPinError("PINs do not match"); return; }
    setPinError("");
    setStep("features");
  };

  const handleFinish = () => {
    completeOnboarding({
      storeName: storeName || "My Sari-Sari Store",
      ownerName: ownerName || "Store Owner",
      address,
      pin: pin || "1234",
      ...features,
    });
    navigate("/management/dashboard");
  };

  const steps: Step[] = ["welcome", "store", "pin", "features", "done"];
  const stepIdx = steps.indexOf(step);

  const inputStyle: React.CSSProperties = {
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    color: "#f8fafc",
    borderRadius: "14px",
    padding: "14px 16px",
    fontSize: "14px",
    outline: "none",
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: 600,
    marginBottom: "6px",
    display: "block",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: bg, scrollbarWidth: "none" }}>
      {/* Progress bar */}
      <div className="px-6 pt-5 pb-2 flex gap-1.5">
        {steps.slice(0, -1).map((s, i) => (
          <div
            key={s}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= stepIdx - (step === "done" ? 0 : 0) ? "#3b82f6" : "rgba(255,255,255,0.15)" }}
          />
        ))}
      </div>

      <div className="flex-1 px-6 py-4">
        {/* ── Welcome ── */}
        {step === "welcome" && (
          <div className="flex flex-col items-center text-center pt-6">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
              style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)", boxShadow: "0 8px 32px rgba(37,99,235,0.4)" }}
            >
              <Store size={44} className="text-white" />
            </div>
            <h1 className="text-white font-black mb-2" style={{ fontSize: "26px" }}>
              Welcome to
            </h1>
            <h2 className="font-black mb-1" style={{ fontSize: "28px", background: "linear-gradient(135deg, #3b82f6, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              TindahanPOS
            </h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed px-2">
              The complete digital platform for sari-sari stores — POS, inventory, utang tracking, and more. Simple enough for everyone.
            </p>

            <div className="mt-8 space-y-3 w-full text-left">
              {[
                { icon: "🛒", text: "Fast POS selling in 2–4 taps" },
                { icon: "📦", text: "Smart inventory management" },
                { icon: "📋", text: "Utang / credit tracking" },
                { icon: "🔔", text: "Smart Pabili order system" },
                { icon: "📊", text: "Sales analytics & reports" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <span className="text-xl">{icon}</span>
                  <span className="text-slate-300 text-sm">{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep("store")}
              className="w-full mt-8 py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)", boxShadow: "0 4px 20px rgba(37,99,235,0.4)" }}
            >
              Get Started <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ── Store Info ── */}
        {step === "store" && (
          <div className="pt-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(37,99,235,0.2)" }}>
                <Store size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-black text-lg">Store Setup</h2>
                <p className="text-slate-400 text-xs">Tell us about your store</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label style={labelStyle}>Store Name *</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Tindahan ni Ate Rosa"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Owner Name *</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Maria Santos"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Address (optional)</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Brgy. 123, Maynila"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={() => setStep("pin")}
              disabled={!storeName || !ownerName}
              className="w-full mt-8 py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}
            >
              Next <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ── PIN Setup ── */}
        {step === "pin" && (
          <div className="pt-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(37,99,235,0.2)" }}>
                <Lock size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-black text-lg">Set Management PIN</h2>
                <p className="text-slate-400 text-xs">Protect your business data</p>
              </div>
            </div>

            <div
              className="px-4 py-3 rounded-2xl mb-6"
              style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)" }}
            >
              <p className="text-blue-300 text-xs leading-relaxed">
                Your PIN protects sensitive data like sales reports, inventory costs, and financial records from helpers.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label style={labelStyle}>4-Digit PIN *</label>
                <div className="relative">
                  <input
                    style={inputStyle}
                    type={showPin ? "text" : "password"}
                    placeholder="e.g. 1234"
                    maxLength={4}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                  <button
                    onClick={() => setShowPin(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    style={{ color: "#64748b" }}
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Confirm PIN *</label>
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="Re-enter your PIN"
                  maxLength={4}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>
              {pinError && (
                <p className="text-red-400 text-sm font-semibold">{pinError}</p>
              )}
            </div>

            <button
              onClick={handlePinNext}
              disabled={pin.length !== 4}
              className="w-full mt-8 py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}
            >
              Next <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ── Features ── */}
        {step === "features" && (
          <div className="pt-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.2)" }}>
                <Zap size={20} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-white font-black text-lg">Enable Features</h2>
                <p className="text-slate-400 text-xs">Can be changed later in Settings</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                {
                  key: "enableUtang" as const,
                  icon: Users,
                  color: "#d97706",
                  bg: "rgba(217,119,6,0.15)",
                  title: "Utang / Credit",
                  desc: "Record customer credit purchases",
                },
                {
                  key: "enablePabili" as const,
                  icon: QrCode,
                  color: "#7c3aed",
                  bg: "rgba(124,58,237,0.15)",
                  title: "Pabili Orders",
                  desc: "Accept orders via QR code",
                },
                {
                  key: "enableBarcodeScanner" as const,
                  icon: Barcode,
                  color: "#2563eb",
                  bg: "rgba(37,99,235,0.15)",
                  title: "Barcode Scanner",
                  desc: "Scan barcodes for fast selling",
                },
                {
                  key: "enableReceiptPrinter" as const,
                  icon: Printer,
                  color: "#16a34a",
                  bg: "rgba(22,163,74,0.15)",
                  title: "Receipt Printer",
                  desc: "Bluetooth thermal printer support",
                },
              ].map(({ key, icon: Icon, color, bg: iconBg, title, desc }) => (
                <button
                  key={key}
                  onClick={() => toggleFeature(key)}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-all"
                  style={{
                    background: features[key] ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${features[key] ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">{title}</p>
                    <p className="text-slate-400 text-xs">{desc}</p>
                  </div>
                  <div
                    className="w-10 h-6 rounded-full flex items-center transition-all"
                    style={{
                      background: features[key] ? "#2563eb" : "rgba(255,255,255,0.1)",
                      padding: "2px",
                      justifyContent: features[key] ? "flex-end" : "flex-start",
                    }}
                  >
                    <div className="w-5 h-5 rounded-full bg-white" />
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep("done")}
              className="w-full mt-8 py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)", boxShadow: "0 4px 20px rgba(37,99,235,0.4)" }}
            >
              Next <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ── Done ── */}
        {step === "done" && (
          <div className="flex flex-col items-center text-center pt-6">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 8px 32px rgba(22,163,74,0.4)" }}
            >
              <Check size={44} className="text-white" />
            </div>
            <h2 className="text-white font-black text-2xl mb-2">All Set!</h2>
            <p className="text-slate-400 text-sm px-4 leading-relaxed mb-2">
              <span className="text-white font-bold">{storeName}</span> is ready to start selling.
            </p>
            <p className="text-slate-500 text-xs px-4">
              Your management PIN is <span className="text-blue-400 font-bold">{pin}</span> — keep it private.
            </p>

            <div className="mt-8 space-y-2 w-full">
              <div className="px-4 py-3 rounded-2xl text-left" style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.2)" }}>
                <p className="text-green-400 text-sm font-semibold">✓ Store: {storeName}</p>
              </div>
              <div className="px-4 py-3 rounded-2xl text-left" style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.2)" }}>
                <p className="text-green-400 text-sm font-semibold">✓ Owner: {ownerName}</p>
              </div>
              <div className="px-4 py-3 rounded-2xl text-left" style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.2)" }}>
                <p className="text-green-400 text-sm font-semibold">✓ PIN protected</p>
              </div>
              <div className="px-4 py-3 rounded-2xl text-left" style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.2)" }}>
                <p className="text-green-400 text-sm font-semibold">
                  ✓ {Object.values(features).filter(Boolean).length} features enabled
                </p>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full mt-8 py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 20px rgba(22,163,74,0.4)" }}
            >
              Open Management Dashboard <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
