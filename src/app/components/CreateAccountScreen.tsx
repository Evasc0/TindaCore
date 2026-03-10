import React, { useState } from "react";
import { useNavigate } from "react-router";
import { UserPlus, ArrowLeft, AlertCircle } from "lucide-react";
import { useStore } from "../context/StoreContext";

export function CreateAccountScreen() {
  const navigate = useNavigate();
  const { createAccount } = useStore();
  const [ownerName, setOwnerName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [emailOrMobile, setEmailOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!ownerName.trim() || !storeName.trim() || !emailOrMobile.trim() || !password) {
      setError("All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createAccount(ownerName.trim(), storeName.trim(), emailOrMobile.trim(), password);
      navigate("/onboarding", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Unable to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)" }}>
      <div className="px-5 pt-5">
        <button
          onClick={() => navigate("/login")}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.14)" }}
        >
          <ArrowLeft size={17} className="text-white" />
        </button>
      </div>

      <div className="flex-1 px-6 py-3 flex flex-col justify-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 mx-auto" style={{ background: "rgba(255,255,255,0.14)" }}>
          <UserPlus size={34} className="text-white" />
        </div>
        <h1 className="text-white font-black text-2xl text-center">Create Account</h1>
        <p className="text-blue-200 text-sm text-center mt-1 mb-7">One account is one store</p>

        <div className="space-y-3">
          <input
            value={ownerName}
            onChange={e => setOwnerName(e.target.value)}
            placeholder="Owner Name"
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
          />
          <input
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            placeholder="Store Name"
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
          />
          <input
            value={emailOrMobile}
            onChange={e => setEmailOrMobile(e.target.value)}
            placeholder="Email or Mobile"
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm Password"
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
          />
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(239,68,68,0.18)" }}>
            <AlertCircle size={14} className="text-red-300" />
            <p className="text-xs text-red-100">{error}</p>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full mt-6 py-3.5 rounded-2xl font-bold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </div>
    </div>
  );
}
