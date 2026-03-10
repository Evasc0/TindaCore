import React, { useState } from "react";
import { useNavigate } from "react-router";
import { LogIn, Store, AlertCircle } from "lucide-react";
import { useStore } from "../context/StoreContext";

export function LoginScreen() {
  const navigate = useNavigate();
  const { login, isHydrated } = useStore();
  const [emailOrMobile, setEmailOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!emailOrMobile.trim() || !password) {
      setError("Email/mobile and password are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(emailOrMobile.trim(), password);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)" }}>
      <div className="flex-1 px-6 py-8 flex flex-col justify-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 mx-auto" style={{ background: "rgba(255,255,255,0.14)" }}>
          <Store size={36} className="text-white" />
        </div>
        <h1 className="text-white font-black text-2xl text-center">Welcome Back</h1>
        <p className="text-blue-200 text-sm text-center mt-1 mb-8">Login to your store account</p>

        <div className="space-y-3">
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
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(239,68,68,0.18)" }}>
            <AlertCircle size={14} className="text-red-300" />
            <p className="text-xs text-red-100">{error}</p>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={!isHydrated || loading}
          className="w-full mt-6 py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
        >
          <LogIn size={16} />
          {loading ? "Logging in..." : "Login"}
        </button>

        <button
          onClick={() => navigate("/create-account")}
          className="w-full mt-3 py-3 rounded-2xl text-sm font-semibold text-blue-100"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          Create Account
        </button>
      </div>
    </div>
  );
}
