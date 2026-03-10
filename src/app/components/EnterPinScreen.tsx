import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router";
import { ArrowLeft, ShieldCheck, AlertCircle, KeyRound } from "lucide-react";
import { useStore } from "../context/StoreContext";

type FlowStep = "verify" | "create" | "verify-old";

export function EnterPinScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get("mode");
  const {
    session,
    settings,
    verifyManagementPin,
    createManagementPin,
  } = useStore();

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifiedOldPin, setVerifiedOldPin] = useState(false);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const initialStep: FlowStep = useMemo(() => {
    if (mode === "change" && settings.hasManagementPin) return "verify-old";
    if (!settings.hasManagementPin || mode === "create") return "create";
    return "verify";
  }, [mode, settings.hasManagementPin]);

  const step: FlowStep = verifiedOldPin ? "create" : initialStep;

  const submitVerify = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be 4 digits.");
      return;
    }
    setLoading(true);
    setError("");
    const ok = await verifyManagementPin(pin);
    setLoading(false);
    if (!ok) {
      setError("Invalid PIN.");
      return;
    }
    if (step === "verify-old") {
      setVerifiedOldPin(true);
      setPin("");
      setConfirmPin("");
      return;
    }
    navigate("/management/dashboard", { replace: true });
  };

  const submitCreate = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createManagementPin(pin);
      navigate("/management/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Unable to save PIN.");
    } finally {
      setLoading(false);
    }
  };

  const title = step === "create"
    ? (mode === "change" ? "Change Management PIN" : "Create Management PIN")
    : step === "verify-old"
    ? "Verify Current PIN"
    : "Enter Management PIN";

  const subtitle = step === "create"
    ? "Set a 4-digit PIN to protect management data."
    : "Enter PIN to access Management Mode.";

  return (
    <div className="flex flex-col h-full" style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)" }}>
      <div className="px-5 pt-5 pb-3">
        <button
          onClick={() => navigate(mode === "change" ? "/management/settings" : "/")}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.14)" }}
        >
          <ArrowLeft size={17} className="text-white" />
        </button>
      </div>

      <div className="flex-1 px-6 py-4 flex flex-col justify-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 mx-auto" style={{ background: "rgba(255,255,255,0.14)" }}>
          {step === "create" ? <KeyRound size={34} className="text-white" /> : <ShieldCheck size={34} className="text-white" />}
        </div>
        <h1 className="text-white font-black text-2xl text-center">{title}</h1>
        <p className="text-blue-200 text-sm text-center mt-1 mb-7">{subtitle}</p>

        <div className="space-y-3">
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="4-digit PIN"
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none text-center tracking-[0.35em]"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
          />
          {step === "create" && (
            <input
              type="password"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Confirm PIN"
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none text-center tracking-[0.35em]"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
            />
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(239,68,68,0.18)" }}>
            <AlertCircle size={14} className="text-red-300" />
            <p className="text-xs text-red-100">{error}</p>
          </div>
        )}

        <button
          onClick={step === "create" ? submitCreate : submitVerify}
          disabled={loading}
          className="w-full mt-6 py-3.5 rounded-2xl font-bold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
        >
          {loading ? "Please wait..." : step === "create" ? "Save PIN" : "Verify PIN"}
        </button>
      </div>
    </div>
  );
}
