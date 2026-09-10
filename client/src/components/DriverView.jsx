import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  Check,
  X,
  Navigation,
  MapPin,
  Building2,
  UserCheck,
  Truck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useGeolocation } from "../hooks/useGeolocation";
import MapView from "./MapView";
import TiltCard from "./TiltCard";

const AMBULANCES = [
  { id: "AMB-101", name: "Murugan K.", vehicleNo: "TN-57-A-1008" },
  { id: "AMB-202", name: "Suresh Patel", vehicleNo: "TN-57-A-1009" },
  { id: "AMB-303", name: "Mohammed Ali", vehicleNo: "TN-57-A-1010" },
];

// Status lifecycle with action buttons
const STATUS_FLOW = [
  { key: "DISPATCHED", label: "Incoming Request", next: "EN_ROUTE", btnLabel: "Accept & Go" },
  { key: "EN_ROUTE", label: "En Route to Patient", next: "ARRIVED_SCENE", btnLabel: "Arrived at Scene" },
  { key: "ARRIVED_SCENE", label: "At Patient Location", next: "PICKED_UP", btnLabel: "Patient Picked Up" },
  { key: "PICKED_UP", label: "Transporting to Hospital", next: "COMPLETED", btnLabel: "Arrived at Hospital" },
  { key: "COMPLETED", label: "Completed", next: null, btnLabel: "Done" },
];

export default function DriverView({ socket, active = true }) {
  const [selectedAmbulance, setSelectedAmbulance] = useState(AMBULANCES[0].id);
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [currentEmergency, setCurrentEmergency] = useState(null);
  const [patientLocation, setPatientLocation] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [simPosition, setSimPosition] = useState(null);
  const [cancelledMsg, setCancelledMsg] = useState(null);
  const { position } = useGeolocation();
  const audioRef = useRef(null);

  // Register driver socket on mount / ambulance change
  useEffect(() => {
    if (!socket || !isOnDuty) return;
    socket.emit("driver:register", { ambulanceId: selectedAmbulance });
    socket.emit("driver:toggle-duty", { ambulanceId: selectedAmbulance, isOnDuty: true });
  }, [socket, selectedAmbulance, isOnDuty]);

  // Listen for incoming requests
  useEffect(() => {
    if (!socket) return;

    const onIncoming = (data) => {
      setIncomingRequest(data);
      setPatientLocation({ lat: data.patientLat, lng: data.patientLng });
      // Play alert sound
      try {
        audioRef.current?.play().catch(() => {});
      } catch (_) {}
    };

    const onStatusUpdate = (data) => {
      if (data.status === "CANCELLED") {
        setCancelledMsg("Emergency cancelled by citizen. Unit stood down.");
        setCurrentEmergency(null);
        setIncomingRequest(null);
        setCurrentStatus(null);
        setPatientLocation(null);
        setSimPosition(null);
        setTimeout(() => setCancelledMsg(null), 5000);
        return;
      }
      setCurrentStatus(data.status);
      if (data.status === "COMPLETED") {
        setTimeout(() => {
          setCurrentEmergency(null);
          setIncomingRequest(null);
          setCurrentStatus(null);
          setPatientLocation(null);
        }, 3000);
      }
    };

    const onDemoReset = () => {
      setIncomingRequest(null);
      setCurrentEmergency(null);
      setPatientLocation(null);
      setCurrentStatus(null);
      setSimPosition(null);
      setCancelledMsg(null);
      setIsOnDuty(true); // restore canonical demo state (re-registers via effect)
    };

    socket.on("driver:incoming-request", onIncoming);
    socket.on("citizen:status-update", onStatusUpdate);
    socket.on("demo:reset", onDemoReset);

    return () => {
      socket.off("driver:incoming-request", onIncoming);
      socket.off("citizen:status-update", onStatusUpdate);
      socket.off("demo:reset", onDemoReset);
    };
  }, [socket]);

  // ── Accept incoming request ───────────────────────────────────────
  const acceptRequest = () => {
    if (!incomingRequest) return;
    socket.emit("driver:accept-request", {
      emergencyId: incomingRequest.emergencyId,
      driverSocketId: socket.id,
    });
    setCurrentEmergency(incomingRequest);
    setCurrentStatus("EN_ROUTE");
    setIncomingRequest(null);
    // Start the simulated journey from the driver's base position
    setSimPosition(position || { lat: 10.3630, lng: 77.9750 });
  };

  // ── Reject incoming request ───────────────────────────────────────
  const rejectRequest = () => {
    if (!incomingRequest) return;
    socket.emit("driver:reject-request", {
      emergencyId: incomingRequest.emergencyId,
    });
    setIncomingRequest(null);
    setPatientLocation(null);
  };

  // ── Advance status ────────────────────────────────────────────────
  const advanceStatus = () => {
    if (!currentEmergency || !currentStatus) return;
    const step = STATUS_FLOW.find((s) => s.key === currentStatus);
    if (!step?.next) return;

    socket.emit("driver:update-status", {
      emergencyId: currentEmergency.emergencyId,
      status: step.next,
    });
    setCurrentStatus(step.next);
  };

  // ── Broadcast location periodically while en route ────────────────
  // Simulates the ambulance moving toward the patient (EN_ROUTE /
  // ARRIVED_SCENE) or toward the hospital (PICKED_UP) and broadcasts
  // the live position every 2s.
  useEffect(() => {
    if (!socket || !currentEmergency || !isOnDuty) return;

    // Pick the target based on the current status
    const isReturnTrip = currentStatus === "PICKED_UP";
    const target = isReturnTrip
      ? {
          lat: currentEmergency.hospitalLat ?? currentEmergency.patientLat,
          lng: currentEmergency.hospitalLng ?? currentEmergency.patientLng,
        }
      : { lat: currentEmergency.patientLat, lng: currentEmergency.patientLng };

    const interval = setInterval(() => {
      setSimPosition((prev) => {
        const base = prev || position || { lat: 10.3630, lng: 77.9750 };
        const dLat = (target.lat - base.lat) * 0.25;
        const dLng = (target.lng - base.lng) * 0.25;
        const next = {
          lat: Math.abs(dLat) < 0.00005 ? target.lat : base.lat + dLat,
          lng: Math.abs(dLng) < 0.00005 ? target.lng : base.lng + dLng,
        };
        socket.emit("driver:update-location", {
          emergencyId: currentEmergency.emergencyId,
          lat: next.lat,
          lng: next.lng,
        });
        return next;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [socket, currentEmergency, isOnDuty, position, currentStatus]);

  // ── Toggle duty ───────────────────────────────────────────────────
  const toggleDuty = () => {
    const newDuty = !isOnDuty;
    setIsOnDuty(newDuty);
    socket.emit("driver:toggle-duty", {
      ambulanceId: selectedAmbulance,
      isOnDuty: newDuty,
    });
    if (newDuty) {
      socket.emit("driver:register", { ambulanceId: selectedAmbulance });
    }
  };

  const currentStep = STATUS_FLOW.find((s) => s.key === currentStatus);

  return (
    <div className={`flex flex-col lg:flex-row gap-6 p-4 max-w-7xl mx-auto ${active ? "animate-view-in" : ""}`}>
      {/* Hidden audio for alert */}
      <audio ref={audioRef} preload="auto">
        <source
          src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f3+AgICAgICAgH9/f39/gICAgICAgIB/f39/f4CAgICAgICAf39/f3+AgICAgICA"
          type="audio/wav"
        />
      </audio>

      {/* Left: Controls */}
      <div className="flex-1 space-y-4">
        {/* Cancelled notice */}
        {cancelledMsg && (
          <div className="bg-slate-100 border border-app-line rounded-xl p-4 text-center text-sm font-semibold text-slate-600 animate-pop-in">
            {cancelledMsg}
          </div>
        )}

        {/* Driver Selection & Duty Toggle */}
        <div className="bg-white rounded-xl p-5 border border-app-line shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
              Driver Panel
            </h3>
            <button
              onClick={toggleDuty}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                isOnDuty
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-50 text-slate-600 border border-app-line hover:bg-slate-100"
              }`}
            >
              {isOnDuty ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {isOnDuty ? "On Duty" : "Off Duty"}
            </button>
          </div>

          <select
            value={selectedAmbulance}
            onChange={(e) => setSelectedAmbulance(e.target.value)}
            disabled={!isOnDuty}
            className="w-full bg-slate-50 border border-app-line rounded-lg p-3 text-sm text-slate-700 font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-med/30 focus:border-med transition-shadow"
          >
            {AMBULANCES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} - {a.name} ({a.vehicleNo})
              </option>
            ))}
          </select>

          {!isOnDuty && (
            <p className="text-xs text-slate-600 mt-2">
              Toggle duty status to receive emergency requests
            </p>
          )}
        </div>

        {/* ── INCOMING REQUEST MODAL ────────────────────────────────── */}
        {incomingRequest && (
          <TiltCard
            key={incomingRequest.emergencyId}
            max={4}
            className="bg-rose-50 border-2 border-rose-300 rounded-xl p-5 flash-overlay animate-flash animate-pop-in shadow-card"
          >  <div className="flex items-center gap-3 mb-4">
              <Bell className="text-rose-500 animate-bounce" size={28} />
              <h3 className="text-lg font-bold text-rose-700">INCOMING EMERGENCY</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div className="bg-white border border-rose-100 rounded-lg p-3">
                <p className="text-slate-600 text-xs">Emergency ID</p>
                <p className="font-bold text-slate-800">{incomingRequest.emergencyId}</p>
              </div>
              <div className="bg-white border border-rose-100 rounded-lg p-3">
                <p className="text-slate-600 text-xs">Type</p>
                <p className="font-bold text-orange-600">{incomingRequest.category}</p>
              </div>
              <div className="bg-white border border-rose-100 rounded-lg p-3">
                <p className="text-slate-600 text-xs">Distance</p>
                <p className="font-bold text-slate-800">{incomingRequest.distance} km</p>
              </div>
              <div className="bg-white border border-rose-100 rounded-lg p-3">
                <p className="text-slate-600 text-xs">Hospital</p>
                <p className="font-bold text-violet-600 text-xs">{incomingRequest.hospitalName}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={acceptRequest}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors btn-3d shadow-sm shadow-emerald-600/20"
              >
                <Check size={20} /> Accept
              </button>
              <button
                onClick={rejectRequest}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-bold transition-colors btn-3d"
              >
                <X size={20} /> Reject
              </button>
            </div>
          </TiltCard>
        )}

        {/* ── ACTIVE EMERGENCY STATUS ───────────────────────────────── */}
        {currentEmergency && currentStatus && currentStatus !== "COMPLETED" && (
          <TiltCard
            key={currentEmergency.emergencyId}
            max={4}
            className="bg-white rounded-xl p-5 border border-app-line shadow-card animate-pop-in"
          >
            <div className="flex items-center gap-2 mb-4">
              <Truck size={20} className="text-sky-600" />
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                Active Emergency
              </h3>
            </div>

            <div className="bg-slate-50 border border-app-line rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-bold text-emerald-700">
                  {currentStep?.label}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                ID: {currentEmergency.emergencyId} | Type: {currentEmergency.category}
              </p>
            </div>

            <button
              onClick={advanceStatus}
              className="w-full flex items-center justify-center gap-2 py-4 bg-med hover:bg-med-dark text-white rounded-lg font-bold text-lg transition-colors btn-3d shadow-md shadow-med/20"
            >
              {currentStep?.key === "EN_ROUTE" && <Navigation size={22} />}
              {currentStep?.key === "ARRIVED_SCENE" && <MapPin size={22} />}
              {currentStep?.key === "PICKED_UP" && <UserCheck size={22} />}
              {currentStep?.key === "DISPATCHED" && <Check size={22} />}
              {currentStep?.btnLabel}
            </button>
          </TiltCard>
        )}

        {/* ── COMPLETED STATE ───────────────────────────────────────── */}
        {currentStatus === "COMPLETED" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center shadow-card">
            <Building2 className="mx-auto mb-3 text-emerald-500" size={48} />
            <h2 className="text-xl font-bold text-emerald-700 mb-2">Trip Completed</h2>
            <p className="text-slate-600">Patient delivered safely. Ready for next dispatch.</p>
          </div>
        )}

        {/* ── NO ACTIVE REQUEST ─────────────────────────────────────── */}
        {!currentEmergency && !incomingRequest && isOnDuty && (
          <div className="bg-white rounded-xl p-8 text-center border border-app-line shadow-card">
            <Bell className="mx-auto mb-3 text-slate-600" size={48} />
            <h2 className="text-lg font-semibold text-slate-600">Waiting for Dispatch</h2>
            <p className="text-slate-600 text-sm mt-1">
              You will be notified when a new emergency is assigned.
            </p>
          </div>
        )}
      </div>

      {/* Right: Map */}
      <div className="flex-1 min-h-[400px] lg:min-h-0">
        <MapView
          patientLocation={patientLocation}
          ambulanceMarkers={
            simPosition || position
              ? [
                  {
                    id: selectedAmbulance,
                    lat: (simPosition || position).lat,
                    lng: (simPosition || position).lng,
                    status: currentStatus || "IDLE",
                  },
                ]
              : []
          }
          hospitals={[]}
          active={active}
          center={patientLocation ? [patientLocation.lat, patientLocation.lng] : [10.3630, 77.9750]}
        />
      </div>
    </div>
  );
}