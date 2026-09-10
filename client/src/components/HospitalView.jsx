import React, { useState, useEffect } from "react";
import {
  Activity,
  Clock,
  BedDouble,
  ShieldCheck,
  Cross,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import MapView from "./MapView";
import TiltCard from "./TiltCard";

const STATUS_BADGES = {
  DISPATCHED: { bg: "bg-amber-50", text: "text-amber-700", label: "Dispatched" },
  EN_ROUTE: { bg: "bg-sky-50", text: "text-sky-700", label: "En Route" },
  ARRIVED_SCENE: { bg: "bg-orange-50", text: "text-orange-700", label: "At Scene" },
  PICKED_UP: { bg: "bg-violet-50", text: "text-violet-700", label: "Transporting" },
  COMPLETED: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Completed" },
  CANCELLED: { bg: "bg-slate-100", text: "text-slate-500", label: "Cancelled" },
};

const CATEGORY_COLORS = {
  cardiac: "text-rose-600",
  trauma: "text-orange-600",
  pregnancy: "text-pink-600",
  general: "text-sky-600",
};

export default function HospitalView({ socket, active = true }) {
  const [hospitals, setHospitals] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [resources, setResources] = useState({});
  const [ambulanceLocations, setAmbulanceLocations] = useState({});
  const [bedAssignments, setBedAssignments] = useState({});

  // Receive seed data
  useEffect(() => {
    if (!socket) return;

    const onSeed = (data) => {
      setHospitals(data.hospitals);
      const res = {};
      data.hospitals.forEach((h) => {
        res[h.id] = { beds: h.bedsAvailable, trauma: h.traumaTeamReady };
      });
      setResources(res);

      // Seed real ambulance base positions
      const locs = {};
      (data.ambulances || []).forEach((a) => {
        locs[a.id] = { lat: a.lat, lng: a.lng };
      });
      setAmbulanceLocations(locs);
    };

    const onInbound = (emergency) => {
      setEmergencies((prev) => {
        const exists = prev.find((e) => e.id === emergency.id);
        if (exists) return prev.map((e) => (e.id === emergency.id ? emergency : e));
        return [emergency, ...prev];
      });
    };

    const onStatusUpdate = (data) => {
      setEmergencies((prev) =>
        prev.map((e) =>
          e.id === data.emergencyId ? { ...e, status: data.status } : e
        )
      );
    };

    const onResourceUpdate = (data) => {
      setResources((prev) => ({
        ...prev,
        [data.hospitalId]: { beds: data.bedsAvailable, trauma: data.traumaTeamReady },
      }));
    };

    // Track live ambulance GPS positions (dashboard channel)
    const onLocationUpdate = (data) => {
      setAmbulanceLocations((prev) => ({
        ...prev,
        [data.ambulanceId]: { lat: data.lat, lng: data.lng },
      }));
    };

    const onDemoReset = () => {
      setEmergencies([]);
    };

    socket.on("seed:data", onSeed);
    socket.on("hospital:inbound-alert", onInbound);
    socket.on("hospital:status-update", onStatusUpdate);
    socket.on("hospital:resource-update", onResourceUpdate);
    socket.on("hospital:location-update", onLocationUpdate);
    socket.on("demo:reset", onDemoReset);

    return () => {
      socket.off("seed:data", onSeed);
      socket.off("hospital:inbound-alert", onInbound);
      socket.off("hospital:status-update", onStatusUpdate);
      socket.off("hospital:resource-update", onResourceUpdate);
      socket.off("hospital:location-update", onLocationUpdate);
      socket.off("demo:reset", onDemoReset);
    };
  }, [socket]);

  // ── Toggle resource allocation ────────────────────────────────────
  const toggleResource = (hospitalId, field, delta = 1) => {
    const current = resources[hospitalId];
    if (!current) return;
    const updated =
      field === "trauma"
        ? { ...current, trauma: !current.trauma }
        : { ...current, beds: Math.max(0, current.beds + delta) };

    setResources((prev) => ({ ...prev, [hospitalId]: updated }));
    socket.emit("hospital:assign-resource", {
      hospitalId,
      bedsAvailable: updated.beds,
      traumaTeamReady: updated.trauma,
    });
  };

  // ── Update per-emergency bed/unit assignment ─────────────────────
  const assignBed = (emergencyId, value) => {
    setBedAssignments((prev) => ({ ...prev, [emergencyId]: value }));
  };

  // ── Format time elapsed since emergency creation ───────────────────
  const formatElapsed = (createdAt) => {
    const elapsed = Math.floor((Date.now() - createdAt) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}m ${s}s`;
  };

  // ── Compute ETA ───────────────────────────────────────────────────
  const getETA = (emergency) => {
    if (emergency.etaSeconds !== undefined) {
      const m = Math.floor(emergency.etaSeconds / 60);
      const s = emergency.etaSeconds % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }
    return "--";
  };

  // Collect real ambulance locations for map display
  const allAmbulanceLocations = emergencies
    .filter((e) => e.status !== "COMPLETED" && e.status !== "CANCELLED")
    .map((e) => {
      const loc = ambulanceLocations[e.ambulanceId];
      return {
        id: e.ambulanceId,
        lat: loc ? loc.lat : e.patientLocation.lat,
        lng: loc ? loc.lng : e.patientLocation.lng,
        status: e.status,
      };
    });

  return (
    <div className={`flex flex-col lg:flex-row gap-6 p-4 max-w-7xl mx-auto ${active ? "animate-view-in" : ""}`}>
      {/* Left: Dashboard */}
      <div className="flex-1 space-y-5">
        {/* ── Hospital Resource Cards ────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hospitals.map((hosp) => {
            const res = resources[hosp.id] || { beds: hosp.bedsAvailable, trauma: hosp.traumaTeamReady };
            return (
              <TiltCard
                key={hosp.id}
                max={6}
                className="bg-white rounded-xl p-5 border border-app-line shadow-card hover:shadow-cardHover transition-shadow"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={18} className="text-violet-500" />
                  <h3 className="font-bold text-sm text-slate-800">{hosp.name}</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 border border-app-line rounded-lg p-3 text-center">
                    <BedDouble size={20} className="mx-auto mb-1 text-sky-500" />
                    <p className="text-2xl font-extrabold text-slate-800">{res.beds}</p>
                    <p className="text-[10px] text-slate-600">Beds Available</p>
                  </div>
                  <div className="bg-slate-50 border border-app-line rounded-lg p-3 text-center">
                    <ShieldCheck size={20} className="mx-auto mb-1 text-emerald-500" />
                    <p className={`text-2xl font-extrabold ${res.trauma ? "text-emerald-600" : "text-rose-600"}`}>
                      {res.trauma ? "ON" : "OFF"}
                    </p>
                    <p className="text-[10px] text-slate-600">Trauma Team</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-1">
                    <button
                      onClick={() => toggleResource(hosp.id, "beds", -1)}
                      disabled={res.beds <= 0}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-white border border-app-line hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                    >
                      <XCircle size={12} /> -1
                    </button>
                    <button
                      onClick={() => toggleResource(hosp.id, "beds", 1)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <RefreshCw size={12} /> +1
                    </button>
                  </div>
                  <button
                    onClick={() => toggleResource(hosp.id, "trauma")}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      res.trauma
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    {res.trauma ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {res.trauma ? "Trauma ON" : "Trauma OFF"}
                  </button>
                </div>
              </TiltCard>
            );
          })}
        </div>

        {/* ── Inbound Emergency Queue ────────────────────────────────── */}
        <TiltCard max={3} className="bg-white rounded-xl p-5 border border-app-line shadow-card animate-pop-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-orange-500" />
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                Inbound Emergency Queue
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
              {emergencies.filter((e) => e.status !== "COMPLETED" && e.status !== "CANCELLED").length} active
            </span>
          </div>

          {emergencies.length === 0 ? (
            <div className="text-center py-8 text-slate-600">
              <Clock className="mx-auto mb-2" size={32} />
              <p>No emergencies in queue</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 text-xs uppercase tracking-wide border-b border-app-line">
                    <th className="pb-2 pr-3">ID</th>
                    <th className="pb-2 pr-3">Category</th>
                    <th className="pb-2 pr-3">Ambulance</th>
                    <th className="pb-2 pr-3">Driver</th>
                    <th className="pb-2 pr-3">ETA</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Bed / Unit</th>
                    <th className="pb-2">Elapsed</th>
                  </tr>
                </thead>
                <tbody>
                  {emergencies.map((emg) => {
                    const badge = STATUS_BADGES[emg.status] || STATUS_BADGES.DISPATCHED;
                    const severityColor = CATEGORY_COLORS[emg.category] || "text-sky-600";
                    return (
                      <tr
                        key={emg.id}
                        className="border-b border-app-line/70 hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 pr-3 font-mono text-xs text-slate-600">{emg.id}</td>
                        <td className={`py-3 pr-3 font-semibold capitalize ${severityColor}`}>
                          {emg.category}
                        </td>
                        <td className="py-3 pr-3">
                          <Cross size={14} className="inline mr-1 text-sky-500" />
                          <span className="text-slate-700 font-medium">{emg.ambulanceId}</span>
                        </td>
                        <td className="py-3 pr-3 text-slate-600">{emg.driverName}</td>
                        <td className="py-3 pr-3">
                          <span className="font-mono text-emerald-600 font-semibold">{getETA(emg)}</span>
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <input
                            type="text"
                            value={bedAssignments[emg.id] || ""}
                            onChange={(e) => assignBed(emg.id, e.target.value)}
                            placeholder="ICU / OT / Ward"
                            className="w-24 bg-slate-50 border border-app-line rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-med/30 focus:border-med transition-shadow"
                          />
                        </td>
                        <td className="py-3 text-slate-600 text-xs">
                          {formatElapsed(emg.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TiltCard>
      </div>

      {/* Right: Map */}
      <div className="flex-1 min-h-[400px] lg:min-h-0">
        <MapView
          patientLocation={
            emergencies.length > 0
              ? emergencies[0].patientLocation
              : null
          }
          ambulanceMarkers={allAmbulanceLocations}
          hospitals={hospitals}
          active={active}
          center={[10.3630, 77.9750]}
        />
      </div>
    </div>
  );
}