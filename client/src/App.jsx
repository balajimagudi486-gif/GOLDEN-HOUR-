import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { Heart, Truck, Building2, Cross, LogOut, RotateCcw } from "lucide-react";
import AuthPage from "./components/AuthPage";
import CitizenView from "./components/CitizenView";
import DriverView from "./components/DriverView";
import HospitalView from "./components/HospitalView";

// ─── Socket Connection ──────────────────────────────────────────────
// Connects to the Express + Socket.io backend on port 4000.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
const SESSION_KEY = "goldenhour-session";

const ROLES = [
  {
    id: "citizen",
    label: "Citizen",
    icon: Heart,
    active: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    idle: "text-slate-600 hover:text-slate-700 hover:bg-slate-100",
  },
  {
    id: "driver",
    label: "Driver",
    icon: Truck,
    active: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    idle: "text-slate-600 hover:text-slate-700 hover:bg-slate-100",
  },
  {
    id: "hospital",
    label: "Hospital",
    icon: Building2,
    active: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    idle: "text-slate-600 hover:text-slate-700 hover:bg-slate-100",
  },
];

const ROLE_BADGES = {
  citizen: "bg-rose-100 text-rose-700",
  driver: "bg-sky-100 text-sky-700",
  hospital: "bg-violet-100 text-violet-700",
};

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [activeRole, setActiveRole] = useState(user?.role || "citizen");
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  // Initialize socket connection on mount
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      setConnected(true);
      console.log("Connected to GoldenHour server:", newSocket.id);
    });

    newSocket.on("disconnect", () => {
      setConnected(false);
      console.log("Disconnected from server");
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // When a user authenticates, default the portal to their role
  useEffect(() => {
    if (user) setActiveRole(user.role);
  }, [user]);

  const handleAuthenticated = (u) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(u));
    setUser(u);
    setActiveRole(u.role);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setActiveRole("citizen");
  };

  // Reset the whole demo: frees ambulances, clears emergencies everywhere
  const handleDemoReset = () => {
    if (!socket) return;
    if (window.confirm("Reset the demo? This clears all emergencies and frees all ambulances.")) {
      socket.emit("demo:reset");
    }
  };

  // ── Not authenticated → show Auth screen ─────────────────────────
  if (!user) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen bg-app-bg">
      {/* ── Top Navigation Bar ──────────────────────────────────────── */}
      <header className="bg-white/90 backdrop-blur-md border-b border-app-line sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-med-dark to-med flex items-center justify-center shadow-md shadow-med/30 transition-transform duration-300 [transform-style:preserve-3d] [perspective:600px] hover:[transform:rotateY(180deg)]">
              <Cross size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-800">GoldenHour</h1>
              <p className="text-[10px] text-slate-600 -mt-0.5">Pre-Arrival Emergency Response</p>
            </div>
          </div>

          {/* Role Switcher */}
          <nav className="hidden md:flex gap-1 bg-slate-100 rounded-xl p-1">
            {ROLES.map((role) => {
              const Icon = role.icon;
              const isActive = activeRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setActiveRole(role.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive ? role.active : role.idle
                  }`}
                >
                  <Icon size={15} />
                  <span>{role.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: connection + user */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? "bg-emerald-500 animate-pulse" : "bg-rose-400"
                }`}
              />
              <span className="text-xs text-slate-600 font-medium">
                {connected ? "Live" : "Reconnecting"}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-app-line rounded-xl pl-1.5 pr-1 py-1">
              <div className="w-7 h-7 rounded-lg bg-med text-white flex items-center justify-center text-xs font-bold uppercase">
                {user.name?.charAt(0) || "U"}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-xs font-semibold text-slate-700">{user.name}</p>
                <span
                  className={`text-[9px] uppercase tracking-wide font-semibold px-1.5 py-[1px] rounded ${
                    ROLE_BADGES[user.role] || "bg-slate-100 text-slate-600"
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <button
                onClick={handleDemoReset}
                title="Reset demo (free ambulances, clear emergencies)"
                className="ml-1 p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="ml-1 p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile role switcher below header */}
        <nav className="md:hidden border-t border-app-line bg-white flex gap-1 px-4 py-2">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isActive = activeRole === role.id;
            return (
              <button
                key={role.id}
                onClick={() => setActiveRole(role.id)}
                className={`flex flex-1 items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive ? role.active : role.idle
                }`}
              >
                <Icon size={14} />
                {role.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Active Portal View ──────────────────────────────────────── */}
      {/* All three portals stay mounted so duty state, SOS progress and
          live socket listeners survive tab switches. Inactive ones are
          hidden with CSS instead of unmounted. */}
      <main className="py-6">
        <div className={activeRole === "citizen" ? "" : "hidden"}>
          <CitizenView socket={socket} active={activeRole === "citizen"} />
        </div>
        <div className={activeRole === "driver" ? "" : "hidden"}>
          <DriverView socket={socket} active={activeRole === "driver"} />
        </div>
        <div className={activeRole === "hospital" ? "" : "hidden"}>
          <HospitalView socket={socket} active={activeRole === "hospital"} />
        </div>
      </main>
    </div>
  );
}