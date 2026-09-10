import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Phone,
  MapPin,
  Clock,
  Cross,
  Heart,
  Baby,
  Stethoscope,
  Shield,
} from "lucide-react";
import { useGeolocation } from "../hooks/useGeolocation";
import MapView from "./MapView";
import TiltCard from "./TiltCard";

// Emergency categories with icons and colors
const CATEGORIES = [
  { id: "cardiac", label: "Cardiac", icon: Heart, color: "text-rose-600" },
  { id: "trauma", label: "Trauma / Accident", icon: Shield, color: "text-orange-600" },
  { id: "pregnancy", label: "Pregnancy", icon: Baby, color: "text-pink-600" },
  { id: "general", label: "General", icon: Stethoscope, color: "text-sky-600" },
];

// Status step indicators for the lifecycle display
const STATUS_STEPS = ["DISPATCHED", "EN_ROUTE", "ARRIVED_SCENE", "PICKED_UP", "COMPLETED"];
const STATUS_LABELS = {
  DISPATCHED: "Dispatching",
  EN_ROUTE: "Ambulance En Route",
  ARRIVED_SCENE: "Arrived at Scene",
  PICKED_UP: "Patient Picked Up",
  COMPLETED: "To Hospital",
};

export default function CitizenView({ socket, active = true }) {
  const { position, loading: geoLoading } = useGeolocation();
  const [phase, setPhase] = useState("idle"); // idle | selecting | dispatched | no-ambulance
  const [category, setCategory] = useState(null);
  const [dispatchInfo, setDispatchInfo] = useState(null);
  const [ambulanceLocation, setAmbulanceLocation] = useState(null);
  const [status, setStatus] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [notice, setNotice] = useState(null);

  // Listen for server responses + seed data
  useEffect(() => {
    if (!socket) return;

    const onSeed = (data) => {
      if (Array.isArray(data.hospitals)) {
        setHospitals(data.hospitals);
        if (data.hospitals.length > 0) setSelectedHospitalId(data.hospitals[0].id);
      }
    };

    const onDispatched = (data) => {
      setPhase("dispatched");
      setDispatchInfo(data);
      setAmbulanceLocation({ lat: data.ambulanceLat, lng: data.ambulanceLng });
    };

    const onStatusUpdate = (data) => {
      setStatus(data.status);
      if (data.status === "COMPLETED") {
        // Reset after 5 seconds
        setTimeout(() => {
          setPhase("idle");
          setDispatchInfo(null);
          setStatus(null);
          setCategory(null);
          setAmbulanceLocation(null);
        }, 5000);
      }
    };

    const onLocationUpdate = (data) => {
      setAmbulanceLocation({ lat: data.lat, lng: data.lng });
      // Tick the live ETA / distance as the ambulance moves
      if (data.etaSeconds !== undefined) {
        setDispatchInfo((prev) =>
          prev
            ? {
                ...prev,
                etaSeconds: data.etaSeconds,
                distance: data.distanceToPatient ?? prev.distance,
              }
            : prev
        );
      }
    };

    const onNoAmbulance = () => {
      setPhase("no-ambulance");
      setTimeout(() => setPhase("idle"), 4000);
    };

    const onDemoReset = () => {
      resetSOS();
      setNotice(null);
    };

    socket.on("seed:data", onSeed);
    socket.on("citizen:ambulance-dispatched", onDispatched);
    socket.on("citizen:status-update", onStatusUpdate);
    socket.on("driver:location-update", onLocationUpdate);
    socket.on("citizen:no-ambulance", onNoAmbulance);
    socket.on("demo:reset", onDemoReset);

    return () => {
      socket.off("seed:data", onSeed);
      socket.off("citizen:ambulance-dispatched", onDispatched);
      socket.off("citizen:status-update", onStatusUpdate);
      socket.off("driver:location-update", onLocationUpdate);
      socket.off("citizen:no-ambulance", onNoAmbulance);
      socket.off("demo:reset", onDemoReset);
    };
  }, [socket]);

  // ── Trigger SOS ───────────────────────────────────────────────────
  const triggerSOS = () => {
    if (!position || !category) return;
    socket.emit("client:trigger-sos", {
      lat: position.lat,
      lng: position.lng,
      accuracy: position.accuracy,
      category: category.id,
      hospitalId: selectedHospitalId || undefined,
    });
    setPhase("selecting"); // brief "sending" state
  };

  const resetSOS = () => {
    setPhase("idle");
    setCategory(null);
    setDispatchInfo(null);
    setStatus(null);
    setAmbulanceLocation(null);
  };

  // ── Cancel SOS: free the ambulance and stand down ─────────────────
  const cancelSOS = () => {
    if (dispatchInfo?.emergencyId) {
      socket.emit("client:cancel-sos", { emergencyId: dispatchInfo.emergencyId });
    }
    resetSOS();
    setNotice("SOS cancelled. The ambulance has been stood down.");
    setTimeout(() => setNotice(null), 4000);
  };

  // ── ETA display helper ────────────────────────────────────────────
  const formatETA = (seconds) => {
    if (!seconds) return "--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // ── Active step index for visual progress ─────────────────────────
  const currentStepIndex = STATUS_STEPS.indexOf(status || "DISPATCHED");

  return (
    <div className={`flex flex-col lg:flex-row gap-6 p-4 max-w-7xl mx-auto ${active ? "animate-view-in" : ""}`}>
      {/* Left: Controls & Status */}
      <div className="flex-1 space-y-5">
        {/* Cancel confirmation notice */}
        {notice && phase === "idle" && (
          <div className="bg-slate-100 border border-app-line rounded-xl p-4 text-center text-sm font-semibold text-slate-600 animate-pop-in">
            {notice}
          </div>
        )}

        {/* ── IDLE PHASE: Show SOS button + category selector ──────── */}
        {phase === "idle" && (
          <>
            {/* GPS Status */}
            <div className="bg-white rounded-xl p-4 border border-app-line shadow-card">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin size={16} className="text-med shrink-0" />
                {geoLoading ? (
                  <span>Acquiring GPS signal...</span>
                ) : position ? (
                  <span>
                    Location locked: {position.lat.toFixed(5)},{" "}
                    {position.lng.toFixed(5)} (&plusmn;{Math.round(position.accuracy)}m)
                  </span>
                ) : (
                  <span className="text-rose-600 font-medium">GPS unavailable</span>
                )}
              </div>
            </div>

            {/* Emergency Category Selector */}
            <div className="bg-white rounded-xl p-5 border border-app-line shadow-card">
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Emergency Type
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category?.id === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        isSelected
                          ? "border-rose-300 bg-rose-50 ring-1 ring-rose-200"
                          : "border-app-line bg-slate-50 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <Icon size={20} className={cat.color} />
                      <span className="text-sm font-semibold text-slate-700">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Hospital Selector */}
            {hospitals.length > 0 && (
              <div className="bg-white rounded-xl p-5 border border-app-line shadow-card">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">
                  Target Hospital
                </h3>
                <select
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                  className="w-full bg-slate-50 border border-app-line rounded-lg p-3 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-med/30 focus:border-med transition-shadow"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  The ambulance will transport the patient to this facility.
                </p>
              </div>
            )}

            {/* BIG SOS BUTTON */}
            <button
              onClick={triggerSOS}
              disabled={!position || !category}
              className={`w-full py-6 rounded-2xl font-bold text-2xl tracking-wider uppercase transition-all btn-3d ${
                position && category
                  ? "bg-sos hover:bg-sos-dark text-white animate-pulse-sos cursor-pointer shadow-lg shadow-rose-600/30"
                  : "bg-slate-200 text-slate-600 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                <AlertTriangle size={32} />
                <span>SOS - Emergency</span>
              </div>
              {(!position || !category) && (
                <p className="text-xs mt-2 font-normal opacity-80">
                  {!position
                    ? "Waiting for GPS..."
                    : "Select emergency type above"}
                </p>
              )}
            </button>
          </>
        )}

        {/* ── NO AMBULANCE message ─────────────────────────────────── */}
        {phase === "no-ambulance" && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center shadow-card">
            <AlertTriangle className="mx-auto mb-3 text-rose-500" size={48} />
            <h2 className="text-xl font-bold text-rose-700 mb-2">
              No Ambulances Available
            </h2>
            <p className="text-slate-600">
              All units are currently busy. Please try again in a moment.
            </p>
          </div>
        )}

        {/* ── DISPATCHED PHASE: Status card + driver info ──────────── */}
        {(phase === "dispatched" || phase === "selecting") && (
          <div className="space-y-4">
            {/* Status Lifecycle Bar */}
            <TiltCard className="bg-white rounded-xl p-5 border border-app-line shadow-card animate-pop-in" max={5}>
              <div className="flex items-center gap-2 mb-4">
                <Clock size={15} className="text-med" />
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Emergency Status
                </h3>
              </div>
              <div className="flex items-center justify-between mb-3">
                {STATUS_STEPS.map((step, idx) => (
                  <div key={step} className="flex flex-col items-center flex-1">
                    <div
                      key={`${step}-${status || "DISPATCHED"}`}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                        idx <= currentStepIndex
                          ? "bg-emerald-500 border-emerald-400 text-white"
                          : "bg-slate-100 border-slate-200 text-slate-600"
                      } ${idx === currentStepIndex ? "animate-flip-in" : ""}`}
                    >
                      {idx + 1}
                    </div>
                    <span className="text-[10px] text-slate-600 mt-1 text-center leading-tight font-medium">
                      {STATUS_LABELS[step]}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
                <span className="text-lg font-bold text-emerald-700">
                  {STATUS_LABELS[status || "DISPATCHED"] || "Processing..."}
                </span>
              </div>
            </TiltCard>

            {/* Driver Contact Card */}
            {dispatchInfo && (
              <TiltCard className="bg-white rounded-xl p-5 border border-app-line shadow-card animate-pop-in" max={5}>
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">
                  Assigned Ambulance
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center">
                      <Cross size={24} className="text-sky-500" />
                    </div>
                    <div>
                      <p className="font-bold text-lg text-slate-800">{dispatchInfo.ambulanceId}</p>
                      <p className="text-slate-600 text-sm">{dispatchInfo.driverName}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-50 border border-app-line rounded-lg p-3">
                      <p className="text-slate-600 text-xs mb-1">Distance</p>
                      <p className="font-semibold text-slate-800">{dispatchInfo.distance} km</p>
                    </div>
                    <div className="bg-slate-50 border border-app-line rounded-lg p-3">
                      <p className="text-slate-600 text-xs mb-1">ETA</p>
                      <p className="font-semibold text-emerald-600">
                        {formatETA(dispatchInfo.etaSeconds)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-app-line rounded-lg p-3">
                    <p className="text-slate-600 text-xs mb-1">Assigned Hospital</p>
                    <p className="font-semibold text-violet-600">
                      {dispatchInfo.hospitalName}
                    </p>
                    {dispatchInfo.hospitalAddress && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {dispatchInfo.hospitalAddress}
                      </p>
                    )}
                  </div>

                  <a
                    href={`tel:${dispatchInfo.driverPhone}`}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors shadow-sm shadow-emerald-600/20"
                  >
                    <Phone size={18} />
                    Call Driver: {dispatchInfo.driverPhone}
                  </a>

                  {dispatchInfo.hospitalPhone && (
                    <a
                      href={`tel:${dispatchInfo.hospitalPhone}`}
                      className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors shadow-sm shadow-blue-600/20"
                    >
                      <Phone size={18} />
                      Call ER Desk: {dispatchInfo.hospitalPhone}
                    </a>
                  )}
                </div>
              </TiltCard>
            )}

            {/* Reset button */}
            {status === "COMPLETED" && (
              <button
                onClick={resetSOS}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 border border-app-line rounded-lg font-semibold text-slate-600 transition-colors"
              >
                New Emergency
              </button>
            )}

            {/* Cancel SOS (frees the ambulance) */}
            {status !== "COMPLETED" && (
              <button
                onClick={cancelSOS}
                className="w-full py-3 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg font-semibold text-rose-600 transition-colors"
              >
                Cancel SOS
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: Map */}
      <div className="flex-1 min-h-[400px] lg:min-h-0">
        <MapView
          patientLocation={position}
          ambulanceMarkers={
            ambulanceLocation
              ? [
                  {
                    id: "AMB",
                    lat: ambulanceLocation.lat,
                    lng: ambulanceLocation.lng,
                    status: status || "EN_ROUTE",
                  },
                ]
              : []
          }
          hospitals={hospitals}
          active={active}
          center={
            position
              ? [position.lat, position.lng]
              : [10.3630, 77.9750]
          }
        />
      </div>
    </div>
  );
}