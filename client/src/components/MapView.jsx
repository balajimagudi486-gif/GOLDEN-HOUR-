import React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// ─── Custom Marker Icons ────────────────────────────────────────────
// Using data-URI SVG icons to avoid external asset dependencies.

const createIcon = (color, label, ping) =>
  L.divIcon({
    className: "custom-marker",
    html: `
      <div class="mk-wrap">
        <div class="mk-ping" style="border-color: ${ping};"></div>
        <div style="
          position: relative;
          width: 32px; height: 32px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          font-size: 14px;
        ">${label}</div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });

const icons = {
  patient: createIcon("#DC2626", "\u{1F3E5}", "rgba(220,38,38,0.55)"),
  ambulance: createIcon("#2563EB", "\u{1F691}", "rgba(37,99,235,0.55)"),
  hospital: createIcon("#7C3AED", "\u{2695}", "rgba(124,58,237,0.55)"),
};

// ─── Re-center map when position changes ────────────────────────────
function RecenterMap({ center }) {
  const map = useMap();
  React.useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// ─── Fix Leaflet rendering when a hidden tab becomes visible ────────
// A map inside `display: none` has zero size; when the tab is shown
// Leaflet must recalculate its dimensions or tiles render grey.
function FixSizeOnShow({ active }) {
  const map = useMap();
  React.useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [active, map]);
  return null;
}

/**
 * MapView renders a Leaflet map with markers for patient, ambulance(s), and hospitals.
 *
 * Props:
 *   patientLocation  - { lat, lng } of the SOS caller
 *   ambulanceMarkers - [{ id, lat, lng, status }]
 *   hospitals        - [{ id, name, lat, lng }]
 *   center           - [lat, lng] initial view center
 */
export default function MapView({
  patientLocation,
  ambulanceMarkers = [],
  hospitals = [],
  center,
  active = true,
}) {
  const mapCenter = center || [10.3630, 77.9750];

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-app-line shadow-card">
      <MapContainer
        center={mapCenter}
        zoom={14}
        style={{ width: "100%", height: "100%", minHeight: "350px" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <RecenterMap center={mapCenter} />
        <FixSizeOnShow active={active} />

        {/* Patient marker */}
        {patientLocation && (
          <Marker
            position={[patientLocation.lat, patientLocation.lng]}
            icon={icons.patient}
          >
            <Popup>
              <strong>Patient Location</strong>
              <br />
              {patientLocation.lat.toFixed(5)}, {patientLocation.lng.toFixed(5)}
              {patientLocation.accuracy && (
                <>
                  <br />
                  Accuracy: {Math.round(patientLocation.accuracy)}m
                </>
              )}
            </Popup>
          </Marker>
        )}

        {/* Ambulance markers */}
        {ambulanceMarkers.map((amb) => (
          <Marker
            key={amb.id}
            position={[amb.lat, amb.lng]}
            icon={icons.ambulance}
          >
            <Popup>
              <strong>{amb.id}</strong>
              <br />
              Status: {amb.status}
              {amb.driverName && (
                <>
                  <br />
                  Driver: {amb.driverName}
                </>
              )}
            </Popup>
          </Marker>
        ))}

        {/* Hospital markers */}
        {hospitals.map((hosp) => (
          <Marker
            key={hosp.id}
            position={[hosp.lat, hosp.lng]}
            icon={icons.hospital}
          >
            <Popup>
              <strong>{hosp.name}</strong>
              <br />
              Beds Available: {hosp.bedsAvailable}
              <br />
              Trauma Team: {hosp.traumaTeamReady ? "Ready" : "Not Ready"}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
