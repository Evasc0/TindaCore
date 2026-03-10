import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Store, Moon, Sun, Globe, Check, ChevronDown, Smartphone, CreditCard, Headphones, Key, Download, Crown, Zap, LogOut } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useStore, StoreSettings } from "../context/StoreContext";
import { TierBadge } from "./TierComponents";

export function SettingsScreen() {
  const { settings, updateSettings, logout, t } = useStore();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";

  const [form, setForm] = useState<StoreSettings>({ ...settings });
  const [saved, setSaved] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>("store");
  const [showPayQR, setShowPayQR] = useState<null | "gcash" | "paymaya">(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const card = isDark ? "#1f2937" : "#ffffff";
  const cardBorder = isDark ? "#374151" : "#f3f4f6";
  const bg = isDark ? "#111827" : "#f9fafb";
  const text = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";

  const handleSave = () => {
    updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const Section = ({ id, icon: Icon, title, color, children }: { id: string; icon: any; title: string; color: string; children: React.ReactNode }) => {
    const isOpen = activeSection === id;
    return (
      <div className="rounded-2xl overflow-hidden border mb-3" style={{ background: card, borderColor: cardBorder }}>
        <button
          className="w-full flex items-center gap-3 px-4 py-3.5"
          onClick={() => setActiveSection(isOpen ? null : id)}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
            <Icon size={15} style={{ color }} />
          </div>
          <p className="flex-1 text-sm font-semibold text-left" style={{ color: text }}>{title}</p>
          <ChevronDown size={16} style={{ color: textMuted, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>
        {isOpen && (
          <div style={{ borderTop: `1px solid ${cardBorder}` }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  const Field = ({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) => (
    <div className="px-4 py-3 border-b last:border-0" style={{ borderColor: cardBorder }}>
      <label className="text-xs font-semibold block mb-1.5" style={{ color: textMuted }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full outline-none text-sm font-medium"
        style={{ background: "transparent", color: text }}
      />
    </div>
  );

  const gcashQRValue = form.gcashNumber ? `gcash://send?to=${form.gcashNumber}&storeName=${encodeURIComponent(form.storeName)}` : "";
  const paymayaQRValue = form.paymayaNumber ? `paymaya://pay?number=${form.paymayaNumber}` : "";

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)" }} className="px-4 pt-4 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1 as any)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="flex-1">
            <h2 className="text-white font-bold" style={{ fontSize: "20px" }}>{t.profileSettings}</h2>
            <p className="text-blue-300 text-xs mt-0.5">{t.editProfile}</p>
          </div>
        </div>

        {/* Store preview */}
        <div className="mt-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
            <Store size={28} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold truncate" style={{ fontSize: "18px" }}>{form.storeName}</p>
            <p className="text-blue-300 text-sm">{form.ownerName}</p>
            <div className="flex items-center gap-2 mt-1">
              <TierBadge tier={settings.subscription} size="xs" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>

        {/* Store Info */}
        <Section id="store" icon={Store} title={settings.language === "fil" ? "Impormasyon ng Tindahan" : "Store Information"} color="#2563eb">
          <Field label={t.storeName} value={form.storeName} onChange={v => setForm(f => ({ ...f, storeName: v }))} placeholder="Tindahan ni Ate" />
          <Field label={t.ownerName} value={form.ownerName} onChange={v => setForm(f => ({ ...f, ownerName: v }))} placeholder="Maria Santos" />
          <Field label={t.address} value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Brgy. 123, Maynila" />
        </Section>

        {/* Management PIN */}
        <Section id="security" icon={Key} title={settings.language === "fil" ? "Seguridad at PIN" : "Security & PIN"} color="#ef4444">
          <button
            onClick={() => navigate("/enter-pin?mode=change")}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b"
            style={{ borderColor: cardBorder }}
          >
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: text }}>
                {settings.hasManagementPin
                  ? (settings.language === "fil" ? "Palitan ang Management PIN" : "Change Management PIN")
                  : (settings.language === "fil" ? "Gumawa ng Management PIN" : "Create Management PIN")}
              </p>
              <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                {settings.language === "fil"
                  ? "4-digit PIN para sa Management Mode"
                  : "4-digit PIN for Management Mode access"}
              </p>
            </div>
            <ChevronDown size={16} style={{ color: textMuted, transform: "rotate(-90deg)" }} />
          </button>
        </Section>

        {/* Feature Toggles */}
        <Section id="features" icon={Zap} title={settings.language === "fil" ? "Mga Feature" : "Feature Toggles"} color="#7c3aed">
          {[
            { key: "enableUtang" as const, label: "Utang / Credit Tracking", desc: "Allow recording customer credit" },
            { key: "enablePabili" as const, label: "Pabili Orders", desc: "Enable QR-based order requests" },
            { key: "enableBarcodeScanner" as const, label: "Barcode Scanner", desc: "Enable barcode scanning in POS" },
            { key: "enableReceiptPrinter" as const, label: "Receipt Printer", desc: "Bluetooth thermal printer support" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between px-4 py-3.5 border-b last:border-0" style={{ borderColor: cardBorder }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: text }}>{label}</p>
                <p className="text-xs" style={{ color: textMuted }}>{desc}</p>
              </div>
              <button
                onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                className="relative flex-shrink-0 ml-3"
                style={{ width: "44px", height: "24px", borderRadius: "12px", background: (form as any)[key] ? "#2563eb" : isDark ? "#374151" : "#d1d5db", transition: "background 0.25s" }}
              >
                <div
                  className="absolute top-1 rounded-full"
                  style={{
                    width: "16px", height: "16px",
                    left: (form as any)[key] ? "24px" : "4px",
                    background: "#ffffff",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                    transition: "left 0.25s",
                  }}
                />
              </button>
            </div>
          ))}
        </Section>

        {/* Payment Info */}
        <Section id="payment" icon={CreditCard} title={t.paymentInfo} color="#7c3aed">
          <Field label={t.gcashNumber} value={form.gcashNumber} onChange={v => setForm(f => ({ ...f, gcashNumber: v }))} placeholder="09xxxxxxxxx" type="tel" />
          <Field label={t.paymayaNumber} value={form.paymayaNumber} onChange={v => setForm(f => ({ ...f, paymayaNumber: v }))} placeholder="09xxxxxxxxx" type="tel" />

          {/* Payment QR Buttons */}
          <div className="px-4 py-3 flex gap-2">
            {[
              { key: "gcash" as const, label: "💙 GCash QR", value: form.gcashNumber, color: "#2563eb" },
              { key: "paymaya" as const, label: "💚 PayMaya QR", value: form.paymayaNumber, color: "#16a34a" },
            ].map(({ key, label, value: val, color }) => (
              <button
                key={key}
                onClick={() => { if (val) setShowPayQR(showPayQR === key ? null : key); }}
                disabled={!val}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-40"
                style={{
                  background: showPayQR === key ? color : "transparent",
                  color: showPayQR === key ? "#fff" : color,
                  borderColor: color + "40",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* QR Display */}
          {showPayQR && (
            <div className="px-4 pb-4 flex flex-col items-center">
              <div className="p-4 rounded-2xl mb-3" style={{ background: "#ffffff" }}>
                <QRCodeSVG
                  value={showPayQR === "gcash" ? gcashQRValue : paymayaQRValue}
                  size={150}
                  level="H"
                  fgColor="#1e1e2e"
                  bgColor="#ffffff"
                  includeMargin={false}
                />
              </div>
              <p className="text-xs font-semibold mb-1" style={{ color: text }}>
                {showPayQR === "gcash" ? "GCash" : "PayMaya"}: {showPayQR === "gcash" ? form.gcashNumber : form.paymayaNumber}
              </p>
              <p className="text-xs mb-3" style={{ color: textMuted }}>{t.paymentQRDesc}</p>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: showPayQR === "gcash" ? "#2563eb" : "#16a34a" }}>
                <Download size={13} />
                {t.downloadPaymentQR}
              </button>
            </div>
          )}
        </Section>

        {/* Appearance */}
        <Section id="appearance" icon={Moon} title={settings.language === "fil" ? "Hitsura" : "Appearance"} color="#7c3aed">
          {/* Theme toggle */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: cardBorder }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: isDark ? "#1c1917" : "#fef9c3" }}>
                {form.theme === "dark" ? <Moon size={15} className="text-yellow-400" /> : <Sun size={15} className="text-yellow-500" />}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: text }}>{t.theme}</p>
                <p className="text-xs" style={{ color: textMuted }}>{form.theme === "dark" ? t.dark : t.light}</p>
              </div>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, theme: f.theme === "dark" ? "light" : "dark" }))}
              className="relative flex-shrink-0"
              style={{ width: "52px", height: "28px", borderRadius: "14px", background: form.theme === "dark" ? "#2563eb" : "#d1d5db", transition: "background 0.25s" }}
            >
              <div
                className="absolute top-1 rounded-full flex items-center justify-center"
                style={{
                  width: "20px", height: "20px",
                  left: form.theme === "dark" ? "28px" : "4px",
                  background: "#ffffff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  transition: "left 0.25s",
                }}
              >
                {form.theme === "dark" ? <Moon size={10} style={{ color: "#2563eb" }} /> : <Sun size={10} style={{ color: "#f59e0b" }} />}
              </div>
            </button>
          </div>

          {/* Theme previews */}
          <div className="flex gap-3 px-4 py-3 border-b" style={{ borderColor: cardBorder }}>
            {(["light", "dark"] as const).map(th => (
              <button
                key={th}
                onClick={() => setForm(f => ({ ...f, theme: th }))}
                className="flex-1 rounded-xl overflow-hidden border-2 transition-all"
                style={{ borderColor: form.theme === th ? "#2563eb" : cardBorder }}
              >
                <div className="h-12 flex flex-col gap-1 p-2" style={{ background: th === "dark" ? "#111827" : "#f9fafb" }}>
                  <div className="rounded flex gap-1">
                    <div className="flex-1 h-2 rounded" style={{ background: th === "dark" ? "#1f2937" : "#ffffff" }} />
                    <div className="h-2 w-6 rounded" style={{ background: "#2563eb" }} />
                  </div>
                  <div className="rounded h-2" style={{ background: th === "dark" ? "#1f2937" : "#ffffff", width: "75%" }} />
                </div>
                <div className="py-1.5 flex items-center justify-center gap-1.5" style={{ background: th === "dark" ? "#1f2937" : "#ffffff" }}>
                  {form.theme === th && <Check size={10} className="text-blue-600" />}
                  <span className="text-xs font-semibold" style={{ color: form.theme === th ? "#2563eb" : textMuted }}>
                    {th === "dark" ? t.dark : t.light}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Language */}
          <div>
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="w-full flex items-center gap-3 px-4 py-3.5"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isDark ? "#134e4a" : "#ecfdf5" }}>
                <Globe size={15} className="text-emerald-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold" style={{ color: text }}>{t.language}</p>
                <p className="text-xs" style={{ color: textMuted }}>{form.language === "en" ? "English" : "Filipino"}</p>
              </div>
              <ChevronDown size={16} style={{ color: textMuted, transform: showLangMenu ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            {showLangMenu && (
              <div style={{ borderTop: `1px solid ${cardBorder}` }}>
                {(["en", "fil"] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => { setForm(f => ({ ...f, language: lang })); setShowLangMenu(false); }}
                    className="w-full flex items-center justify-between px-4 py-3 border-b last:border-0"
                    style={{ borderColor: cardBorder }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{lang === "en" ? "🇺🇸" : "🇵🇭"}</span>
                      <span className="text-sm font-medium" style={{ color: text }}>{lang === "en" ? "English" : "Filipino"}</span>
                    </div>
                    {form.language === lang && <Check size={16} className="text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* Subscription */}
        <div className="rounded-2xl overflow-hidden border mb-3" style={{ background: card, borderColor: cardBorder }}>
          <button
            className="w-full flex items-center gap-3 px-4 py-3.5"
            onClick={() => navigate("/management/subscription")}
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: settings.subscription === "premium" ? "#451a03" : isDark ? "#1e3a8a" : "#eff6ff" }}>
              {settings.subscription === "premium" ? <Crown size={15} style={{ color: "#d97706" }} /> : <Zap size={15} style={{ color: "#2563eb" }} />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold" style={{ color: text }}>{t.subscriptionInfo}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <TierBadge tier={settings.subscription} size="xs" />
                <span className="text-xs" style={{ color: textMuted }}>
                  {settings.subscription === "free" ? "Upgrade for more features" : "Active subscription"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center w-6 h-6 rounded-full" style={{ background: isDark ? "#374151" : "#f3f4f6" }}>
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                <path d="M1.5 1L6.5 6L1.5 11" stroke={textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>
        </div>

        {/* Quick Actions */}
        <Section id="quick" icon={Smartphone} title={settings.language === "fil" ? "Tungkol sa App" : "About & Support"} color="#6b7280">
          {[
            { icon: Key, label: t.changePassword, color: "#6b7280" },
            { icon: Headphones, label: t.support, color: "#2563eb" },
          ].map(({ icon: Icon, label, color }) => (
            <button key={label} className="w-full flex items-center gap-3 px-4 py-3.5 border-b last:border-0" style={{ borderColor: cardBorder }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                <Icon size={14} style={{ color }} />
              </div>
              <p className="text-sm font-medium" style={{ color: text }}>{label}</p>
              <div className="ml-auto"><svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M1 1L5 5L1 9" stroke={textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            </button>
          ))}
          <div className="px-4 py-3">
            <p className="text-xs" style={{ color: textMuted }}>Sari-Sari POS v1.0.0 · Offline-First</p>
          </div>
        </Section>

        <div className="rounded-2xl overflow-hidden border mb-3" style={{ background: card, borderColor: cardBorder }}>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold disabled:opacity-60"
            style={{ color: "#ef4444" }}
          >
            <LogOut size={15} />
            {loggingOut ? "Logging out..." : "Log Out"}
          </button>
        </div>

        <div style={{ height: "8px" }} />
      </div>

      {/* Save Button */}
      <div className="flex-shrink-0 p-4 border-t" style={{ background: card, borderColor: cardBorder }}>
        <button
          onClick={handleSave}
          className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-all"
          style={{
            background: saved ? "#16a34a" : "linear-gradient(135deg, #2563eb, #1d4ed8)",
            fontSize: "16px",
            boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
            transition: "background 0.3s",
          }}
        >
          {saved ? <><Check size={18} />{t.settingsSaved}</> : t.saveSettings}
        </button>
      </div>
    </div>
  );
}
