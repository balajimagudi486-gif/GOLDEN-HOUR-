import React, { useState, useRef } from "react";
import {
  Cross,
  Heart,
  Truck,
  Building2,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  UserPlus,
} from "lucide-react";

// ─── Demo accounts for quick testing ────────────────────────────────
const DEMO_ACCOUNTS = [
  {
    role: "citizen",
    label: "Citizen",
    email: "citizen@medx.io",
    icon: Heart,
    color: "text-rose-600",
    ring: "hover:border-rose-300 hover:bg-rose-50",
  },
  {
    role: "driver",
    label: "Driver AMB-101",
    email: "driver@medx.io",
    icon: Truck,
    color: "text-sky-600",
    ring: "hover:border-sky-300 hover:bg-sky-50",
  },
  {
    role: "hospital",
    label: "Hospital Admin",
    email: "hospital@medx.io",
    icon: Building2,
    color: "text-violet-600",
    ring: "hover:border-violet-300 hover:bg-violet-50",
  },
];

const ROLES_FOR_SIGNUP = [
  { id: "citizen", label: "Citizen", icon: Heart, color: "text-rose-600" },
  { id: "driver", label: "Driver", icon: Truck, color: "text-sky-600" },
  { id: "hospital", label: "Hospital Staff", icon: Building2, color: "text-violet-600" },
];

const FEATURES = [
  { icon: MapPin, title: "GPS-Locked Dispatch", desc: "One-tap SOS broadcasts your exact location to the nearest unit." },
  { icon: Truck, title: "Nearest-Unit Routing", desc: "Haversine matching assigns the closest available ambulance every time." },
  { icon: ShieldCheck, title: "Trauma-Ready Hospitals", desc: "Pre-arrival alerts prep beds and trauma teams before you arrive." },
];

/**
 * AuthPage
 * Split-screen sign-in / sign-up screen with a clinical medical theme.
 * Authentication is mocked client-side and persists the session in localStorage.
 */
export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "citizen" });
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // ── 3D tilt on mouse move over the auth card ──────────────────────
  const handleMouseMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -8, y: px * 10 });
  };

  const resetTilt = () => setTilt({ x: 0, y: 0 });

  // Infer portal role from email prefix (only for the mock sign-in)
  const inferRole = (email) => {
    const e = email.toLowerCase();
    if (e.includes("driver")) return "driver";
    if (e.includes("hospital")) return "hospital";
    return "citizen";
  };

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (mode === "signup" && !form.name) {
      setError("Full name is required to register.");
      return;
    }
    setError("");
    const role = mode === "signup" ? form.role : inferRole(form.email);
    const name =
      mode === "signup"
        ? form.name
        : form.email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    onAuthenticated({ name, email: form.email, role });
  };

  const handleDemo = (account) => {
    onAuthenticated({ name: account.label, email: account.email, role: account.role });
  };

  return (
    <div className="min-h-screen bg-app-bg flex">
      {/* ── Left Branding Panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-med-deep via-med-dark to-med">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-32 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 right-10 w-72 h-72 rounded-full bg-white/5" />

        <div className="relative flex flex-col justify-between p-12 w-full">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg">
              <Cross size={26} className="text-med" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">GoldenHour</h1>
              <p className="text-med-light/90 text-xs -mt-0.5">Pre-Arrival Emergency Response</p>
            </div>
          </div>

          {/* Hero + Headline */}
          <div className="mt-12 flex items-center lg:gap-10 xl:gap-14">
            {/* 3D rotating medical cross with sonar rings */}
            <div className="hero-stage relative w-40 h-40 shrink-0 hidden xl:flex items-center justify-center">
              <div className="hero-ring" />
              <div className="hero-ring hero-ring--delay" />
              <div className="relative w-24 h-24 float-soft">
                <div className="hero-glow" />
                <div className="hero-cross">
                  <div className="hero-bar hero-bar-v" />
                  <div className="hero-bar hero-bar-h" />
                  <div
                    className="hero-bar hero-bar-v"
                    style={{ transform: "translate(-50%,-50%) translateZ(-0.75rem)" }}
                  />
                  <div
                    className="hero-bar hero-bar-h"
                    style={{ transform: "translate(-50%,-50%) translateZ(-0.75rem)" }}
                  />
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <h2 className="text-4xl font-extrabold leading-tight text-white max-w-md">
                Every second counts.
                <span className="block text-med-soft mt-1">We put one back in your hands.</span>
              </h2>
            <p className="text-med-light/80 mt-4 max-w-md text-sm leading-relaxed">
              One-tap emergency dispatch connecting citizens, ambulances, and hospitals on a
              single real-time network.
            </p>

            {/* Feature list */}
            <div className="mt-10 space-y-5">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{f.title}</p>
                      <p className="text-med-light/70 text-xs mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>

          {/* Live stat strip */}
          <div className="mt-12 flex items-center gap-6 bg-white/10 backdrop-blur rounded-2xl px-6 py-4 w-fit">
            <div>
              <p className="text-2xl font-extrabold text-white">3</p>
              <p className="text-[10px] text-med-light/70 uppercase tracking-wide">Active Units</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-2xl font-extrabold text-white">&lt;5</p>
              <p className="text-[10px] text-med-light/70 uppercase tracking-wide">Km Coverage</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-2xl font-extrabold text-white">24/7</p>
              <p className="text-[10px] text-med-light/70 uppercase tracking-wide">On Call</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Auth Form Panel (top-aligned) ─────────────────────── */}
      <div className="flex-1 flex justify-center p-6 pb-16">
        <div className="w-full max-w-md pt-4">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2 mb-6 justify-center">
            <div className="w-10 h-10 rounded-xl bg-med flex items-center justify-center shadow-lg">
              <Cross size={22} className="text-white" />
            </div>
            <span className="text-xl font-extrabold text-slate-800">GoldenHour</span>
          </div>

          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={resetTilt}
            style={{ transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
            className="tilt-card bg-white rounded-2xl shadow-card border border-app-line p-8"
          >
            {/* Mode tabs */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-6">
              <button
                onClick={() => { setMode("signin"); setError(""); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === "signin"
                    ? "bg-white shadow-sm text-med"
                    : "text-slate-600 hover:text-slate-700"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode("signup"); setError(""); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === "signup"
                    ? "bg-white shadow-sm text-med"
                    : "text-slate-600 hover:text-slate-700"
                }`}
              >
                Sign Up
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-lg bg-med-light flex items-center justify-center">
                <Stethoscope size={16} className="text-med" />
              </span>
              <h2 className="text-xl font-bold text-slate-800">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              {mode === "signin"
                ? "Sign in to access your emergency portal."
                : "Register as a citizen, driver, or hospital staff."}
            </p>

            {/* Error */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 mb-1.5 block">Full Name</span>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                      type="text"
                      value={form.name}
                      onChange={update("name")}
                      placeholder="e.g. Ananya Sharma"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-med/40 focus:border-med transition-shadow"
                    />
                  </div>
                </label>
              )}

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</span>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={update("email")}
                    placeholder="you@medx.io"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-med/40 focus:border-med transition-shadow"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 mb-1.5 block">Password</span>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={update("password")}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-med/40 focus:border-med transition-shadow"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              {mode === "signup" && (
                <div>
                  <span className="text-xs font-semibold text-slate-600 mb-1.5 block">I am a...</span>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES_FOR_SIGNUP.map((r) => {
                      const Icon = r.icon;
                      const isSelected = form.role === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, role: r.id }))}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-all ${
                            isSelected
                              ? "border-med bg-med-light text-med"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <Icon size={18} className={r.color} />
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 bg-med hover:bg-med-dark text-white font-semibold rounded-lg transition-colors shadow-sm shadow-med/20"
              >
                {mode === "signin" ? "Sign In" : "Create Account"}
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Demo quick login */}
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-app-line" />
                <span className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">
                  Quick demo access
                </span>
                <div className="h-px flex-1 bg-app-line" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const Icon = acc.icon;
                  return (
                    <button
                      key={acc.role}
                      onClick={() => handleDemo(acc)}
                      className={`flex flex-col items-center gap-1 py-3 rounded-xl border border-slate-200 bg-white transition-all ${acc.ring}`}
                    >
                      <Icon size={18} className={acc.color} />
                      <span className="text-[11px] font-semibold text-slate-600">{acc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 mt-5 flex items-center justify-center gap-1.5">
            <UserPlus size={12} />
            Mock authentication &middot; no personal data is stored
          </p>
        </div>
      </div>
    </div>
  );
}