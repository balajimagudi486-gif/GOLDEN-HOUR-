import math
import time
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ─── Socket.IO Server ───────────────────────────────────────────────
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

# ─── FastAPI App (REST endpoints) ───────────────────────────────────
fastapi_app = FastAPI(title="GoldenHour backend", version="1.0.0")
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-Memory Data Store ───────────────────────────────────────────
# Swappable with MongoDB/PostgreSQL later via repository pattern.
# Default origin: Dindigul, Tamil Nadu (matching the demo prototype)
DEFAULT_LAT = 10.3630
DEFAULT_LNG = 77.9750

HOSPITALS = [
    {
        "id": "hosp-1",
        "name": "Dindigul Govt Medical College Hospital",
        "phone": "+914512420100",
        "address": "Trichy Rd, Dindigul",
        "lat": 10.3667,
        "lng": 77.9800,
        "bedsAvailable": 12,
        "traumaTeamReady": True,
    },
    {
        "id": "hosp-2",
        "name": "Priya Hospital",
        "phone": "+914512431200",
        "address": "Salai Rd, Dindigul",
        "lat": 10.3621,
        "lng": 77.9734,
        "bedsAvailable": 8,
        "traumaTeamReady": False,
    },
    {
        "id": "hosp-3",
        "name": "City Hospital",
        "phone": "+914512425500",
        "address": "Mengles Rd, Dindigul",
        "lat": 10.3582,
        "lng": 77.9721,
        "bedsAvailable": 6,
        "traumaTeamReady": True,
    },
]

# Ambulances seeded ~1-3 km from Dindigul city center
AMBULANCES = [
    {
        "id": "AMB-101",
        "driverName": "Murugan K.",
        "phone": "+91-98765-43210",
        "vehicleNo": "TN-57-A-1008",
        "lat": 10.3580,
        "lng": 77.9700,
        "status": "IDLE",  # IDLE | DISPATCHED | EN_ROUTE | ARRIVED_SCENE | PICKED_UP | COMPLETED
        "currentEmergencyId": None,
        "isOnDuty": True,
        "socketId": None,
    },
    {
        "id": "AMB-202",
        "driverName": "Suresh Patel",
        "phone": "+91-98765-43211",
        "vehicleNo": "TN-57-A-1009",
        "lat": 10.3700,
        "lng": 77.9830,
        "status": "IDLE",
        "currentEmergencyId": None,
        "isOnDuty": True,
        "socketId": None,
    },
    {
        "id": "AMB-303",
        "driverName": "Mohammed Ali",
        "phone": "+91-98765-43212",
        "vehicleNo": "TN-57-A-1010",
        "lat": 10.3550,
        "lng": 77.9670,
        "status": "IDLE",
        "currentEmergencyId": None,
        "isOnDuty": True,
        "socketId": None,
    },
]

# Active emergencies keyed by emergency ID
EMERGENCIES = {}

_emergency_counter = {"value": 0}


# ─── Haversine Distance (km) ────────────────────────────────────────
def haversine_distance(lat1, lng1, lat2, lng2):
    R = 6371.0
    to_rad = lambda deg: deg * math.pi / 180.0
    d_lat = to_rad(lat2 - lat1)
    d_lng = to_rad(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── Find Nearest Idle Ambulance ────────────────────────────────────
def find_nearest_ambulance(patient_lat, patient_lng):
    nearest = None
    min_dist = float("inf")
    for amb in AMBULANCES:
        if amb["status"] != "IDLE" or not amb["isOnDuty"]:
            continue
        dist = haversine_distance(patient_lat, patient_lng, amb["lat"], amb["lng"])
        if dist < min_dist:
            min_dist = dist
            nearest = {"ambulance": amb, "distance": dist}
    return nearest


# ─── Find Nearest Hospital ──────────────────────────────────────────
def find_nearest_hospital(lat, lng):
    nearest = None
    min_dist = float("inf")
    for hosp in HOSPITALS:
        dist = haversine_distance(lat, lng, hosp["lat"], hosp["lng"])
        if dist < min_dist:
            min_dist = dist
            nearest = {"hospital": hosp, "distance": dist}
    return nearest


def find_hospital_by_id(hospital_id):
    for hosp in HOSPITALS:
        if hosp["id"] == hospital_id:
            return hosp
    return None


def public_ambulance(amb):
    return {
        "id": amb["id"],
        "driverName": amb["driverName"],
        "phone": amb["phone"],
        "vehicleNo": amb["vehicleNo"],
        "lat": amb["lat"],
        "lng": amb["lng"],
        "status": amb["status"],
        "isOnDuty": amb["isOnDuty"],
    }


def seed_payload():
    return {
        "ambulances": [public_ambulance(a) for a in AMBULANCES],
        "hospitals": HOSPITALS,
    }


# ─── Per-emergency rooms ────────────────────────────────────────────
# Each SOS gets its own room ("emg:EMG-0001") containing the citizen and
# the assigned driver. Citizen/driver events are emitted to the room so
# concurrent emergencies never leak into each other. The hospital
# dashboard intentionally keeps global broadcasts (it watches everything).
def room_for(emergency_id):
    return f"emg:{emergency_id}"


# ─── Socket.IO Event Handlers ───────────────────────────────────────
@sio.event
async def connect(sid, environ, auth):
    print(f"[CONNECT] Socket connected: {sid}")
    await sio.emit("seed:data", seed_payload(), to=sid)


@sio.event
async def disconnect(sid):
    print(f"[DISCONNECT] Socket disconnected: {sid}")
    # Clear socket reference for any ambulance that used this connection
    for amb in AMBULANCES:
        if amb.get("socketId") == sid:
            amb["socketId"] = None


# ── CITIZEN: Trigger SOS ────────────────────────────────────────────
# Receives patient location + emergency type, finds nearest ambulance,
# creates emergency record, dispatches to the driver.
# If a hospitalId is supplied (citizen-selected target), it overrides
# the nearest-hospital heuristic.
@sio.on("client:trigger-sos")
async def on_trigger_sos(sid, data):
    global EMERGENCIES

    lat = data.get("lat")
    lng = data.get("lng")
    accuracy = data.get("accuracy")
    category = data.get("category")
    hospital_id = data.get("hospitalId")

    if lat is None or lng is None:
        await sio.emit("citizen:no-ambulance", {"message": "Location unavailable."}, to=sid)
        return

    _emergency_counter["value"] += 1
    emergency_id = f"EMG-{_emergency_counter['value']:04d}"

    nearest = find_nearest_ambulance(lat, lng)
    if not nearest:
        await sio.emit(
            "citizen:no-ambulance",
            {"message": "No ambulances currently available. Please try again."},
            to=sid,
        )
        return

    ambulance, distance = nearest["ambulance"], nearest["distance"]

    # Prefer the citizen-selected hospital, otherwise nearest one
    assigned_hospital = find_hospital_by_id(hospital_id) if hospital_id else None
    if not assigned_hospital:
        assigned_hospital = find_nearest_hospital(lat, lng)["hospital"]

    emergency = {
        "id": emergency_id,
        "patientLocation": {"lat": lat, "lng": lng, "accuracy": accuracy},
        "category": category,
        "status": "DISPATCHED",
        "ambulanceId": ambulance["id"],
        "driverName": ambulance["driverName"],
        "driverPhone": ambulance["phone"],
        "driverVehicleNo": ambulance.get("vehicleNo", ""),
        "hospitalId": assigned_hospital["id"],
        "hospitalName": assigned_hospital["name"],
        "hospitalPhone": assigned_hospital["phone"],
        "hospitalAddress": assigned_hospital["address"],
        "hospitalLat": assigned_hospital["lat"],
        "hospitalLng": assigned_hospital["lng"],
        "distanceToPatient": round(distance, 1),
        "etaSeconds": round(distance * 120),  # rough ETA: ~50 km/h avg
        "createdAt": int(time.time() * 1000),
    }
    EMERGENCIES[emergency_id] = emergency

    # Citizen joins the emergency room for scoped updates
    await sio.enter_room(sid, room_for(emergency_id))

    # Mark ambulance as busy
    ambulance["status"] = "DISPATCHED"
    ambulance["currentEmergencyId"] = emergency_id

    # Notify the assigned driver's socket (if connected)
    if ambulance.get("socketId"):
        await sio.emit(
            "driver:incoming-request",
            {
                "emergencyId": emergency_id,
                "patientLat": lat,
                "patientLng": lng,
                "category": category,
                "distance": round(distance, 1),
                "hospitalName": assigned_hospital["name"],
                "hospitalLat": assigned_hospital["lat"],
                "hospitalLng": assigned_hospital["lng"],
                "patientName": data.get("patientName"),
                "patientPhone": data.get("patientPhone"),
            },
            to=ambulance["socketId"],
        )

    # Notify citizen that dispatch has started
    await sio.emit(
        "citizen:ambulance-dispatched",
        {
            "emergencyId": emergency_id,
            "ambulanceId": ambulance["id"],
            "driverName": ambulance["driverName"],
            "driverPhone": ambulance["phone"],
            "vehicleNo": ambulance.get("vehicleNo", ""),
            "distance": round(distance, 1),
            "etaSeconds": emergency["etaSeconds"],
            "hospitalId": assigned_hospital["id"],
            "hospitalName": assigned_hospital["name"],
            "hospitalPhone": assigned_hospital["phone"],
            "hospitalAddress": assigned_hospital["address"],
            "ambulanceLat": ambulance["lat"],
            "ambulanceLng": ambulance["lng"],
        },
        to=sid,
    )

    # Broadcast to hospital dashboard
    await sio.emit("hospital:inbound-alert", {**emergency})

    print(f"[DISPATCH] {emergency_id} -> {ambulance['id']} ({round(distance, 1)} km)")


# ── DRIVER: Accept Request ────────────────────────────────────────
@sio.on("driver:accept-request")
async def on_accept_request(sid, data):
    emergency_id = data.get("emergencyId")
    emergency = EMERGENCIES.get(emergency_id)
    if not emergency:
        return

    ambulance = next((a for a in AMBULANCES if a["id"] == emergency["ambulanceId"]), None)
    if not ambulance:
        return

    # Register driver's socket for location updates. NOTE: always use the
    # handler's `sid` (the actual sender) — never trust a client-reported
    # socket id, which may be stale (e.g. after a transport reconnect).
    ambulance["socketId"] = sid
    ambulance["status"] = "EN_ROUTE"
    emergency["status"] = "EN_ROUTE"

    # Driver joins the emergency room for scoped updates
    await sio.enter_room(ambulance["socketId"], room_for(emergency_id))
    room = room_for(emergency_id)

    # Notify citizen that the ambulance is now en route (room-scoped)
    await sio.emit("citizen:status-update", {"emergencyId": emergency_id, "status": "EN_ROUTE"}, room=room)
    await sio.emit(
        "citizen:ambulance-dispatched",
        {
            "emergencyId": emergency_id,
            "ambulanceId": ambulance["id"],
            "driverName": ambulance["driverName"],
            "driverPhone": ambulance["phone"],
            "vehicleNo": ambulance.get("vehicleNo", ""),
            "distance": emergency["distanceToPatient"],
            "etaSeconds": emergency["etaSeconds"],
            "hospitalId": emergency["hospitalId"],
            "hospitalName": emergency["hospitalName"],
            "hospitalPhone": emergency["hospitalPhone"],
            "hospitalAddress": emergency["hospitalAddress"],
            "ambulanceLat": ambulance["lat"],
            "ambulanceLng": ambulance["lng"],
        },
        room=room,
    )

    # Notify hospital dashboard of status change
    await sio.emit(
        "hospital:status-update",
        {"emergencyId": emergency_id, "status": "EN_ROUTE", "ambulanceId": ambulance["id"]},
    )

    print(f"[ACCEPT] {emergency_id} accepted by {ambulance['id']}")


# ── DRIVER: Reject Request ────────────────────────────────────────
@sio.on("driver:reject-request")
async def on_reject_request(sid, data):
    emergency_id = data.get("emergencyId")
    emergency = EMERGENCIES.get(emergency_id)
    if not emergency:
        return

    ambulance = next((a for a in AMBULANCES if a["id"] == emergency["ambulanceId"]), None)
    if ambulance:
        ambulance["status"] = "IDLE"
        ambulance["currentEmergencyId"] = None

    # Try to find another ambulance
    patient_location = emergency["patientLocation"]
    nearest = find_nearest_ambulance(patient_location["lat"], patient_location["lng"])

    if nearest:
        new_ambulance = nearest["ambulance"]
        emergency["ambulanceId"] = new_ambulance["id"]
        emergency["driverName"] = new_ambulance["driverName"]
        emergency["driverPhone"] = new_ambulance["phone"]
        emergency["driverVehicleNo"] = new_ambulance.get("vehicleNo", "")
        emergency["distanceToPatient"] = round(nearest["distance"], 1)
        emergency["etaSeconds"] = round(nearest["distance"] * 120)

        new_ambulance["status"] = "DISPATCHED"
        new_ambulance["currentEmergencyId"] = emergency_id

        if new_ambulance.get("socketId"):
            await sio.emit(
                "driver:incoming-request",
                {
                    "emergencyId": emergency_id,
                    "patientLat": patient_location["lat"],
                    "patientLng": patient_location["lng"],
                    "category": emergency["category"],
                    "distance": round(nearest["distance"], 1),
                    "hospitalName": emergency["hospitalName"],
                    "hospitalLat": emergency["hospitalLat"],
                    "hospitalLng": emergency["hospitalLng"],
                },
                to=new_ambulance["socketId"],
            )

        # Notify citizen of new ambulance (room-scoped)
        await sio.emit(
            "citizen:ambulance-dispatched",
            {
                "emergencyId": emergency_id,
                "ambulanceId": new_ambulance["id"],
                "driverName": new_ambulance["driverName"],
                "driverPhone": new_ambulance["phone"],
                "vehicleNo": new_ambulance.get("vehicleNo", ""),
                "distance": round(nearest["distance"], 1),
                "etaSeconds": emergency["etaSeconds"],
                "hospitalId": emergency["hospitalId"],
                "hospitalName": emergency["hospitalName"],
                "hospitalPhone": emergency["hospitalPhone"],
                "hospitalAddress": emergency["hospitalAddress"],
                "ambulanceLat": new_ambulance["lat"],
                "ambulanceLng": new_ambulance["lng"],
            },
            room=room_for(emergency_id),
        )
    else:
        await sio.emit(
            "citizen:no-ambulance",
            {"message": "No other ambulances available. Please try again."},
        )


# ── DRIVER: Update Location ───────────────────────────────────────
@sio.on("driver:update-location")
async def on_update_location(sid, data):
    emergency_id = data.get("emergencyId")
    lat = data.get("lat")
    lng = data.get("lng")
    emergency = EMERGENCIES.get(emergency_id)
    if not emergency or lat is None or lng is None:
        return

    ambulance = next((a for a in AMBULANCES if a["id"] == emergency["ambulanceId"]), None)
    if ambulance:
        ambulance["lat"] = lat
        ambulance["lng"] = lng

    # Recalculate ETA based on current ambulance position
    dist_to_patient = haversine_distance(lat, lng, emergency["patientLocation"]["lat"], emergency["patientLocation"]["lng"])
    new_eta = round(dist_to_patient * 120)
    emergency["etaSeconds"] = new_eta

    # Broadcast to the emergency room (citizen + assigned driver)
    await sio.emit(
        "driver:location-update",
        {
            "emergencyId": emergency_id,
            "ambulanceId": emergency["ambulanceId"],
            "lat": lat,
            "lng": lng,
            "etaSeconds": new_eta,
            "distanceToPatient": round(dist_to_patient, 1),
        },
        room=room_for(emergency_id),
    )

    # Dashboard copy for the hospital map (global, keyed by emergency)
    await sio.emit(
        "hospital:location-update",
        {
            "emergencyId": emergency_id,
            "ambulanceId": emergency["ambulanceId"],
            "lat": lat,
            "lng": lng,
            "etaSeconds": new_eta,
            "distanceToPatient": round(dist_to_patient, 1),
        },
    )


# ── DRIVER: Update Status ─────────────────────────────────────────
# Lifecycle: EN_ROUTE -> ARRIVED_SCENE -> PICKED_UP -> COMPLETED
@sio.on("driver:update-status")
async def on_update_status(sid, data):
    emergency_id = data.get("emergencyId")
    status = data.get("status")
    emergency = EMERGENCIES.get(emergency_id)
    if not emergency:
        return

    ambulance = next((a for a in AMBULANCES if a["id"] == emergency["ambulanceId"]), None)
    if not ambulance:
        return

    emergency["status"] = status
    ambulance["status"] = status

    # When completed, free up the ambulance
    if status == "COMPLETED":
        ambulance["status"] = "IDLE"
        ambulance["currentEmergencyId"] = None
        emergency["status"] = "COMPLETED"

    # Notify citizen (room-scoped) + hospital (global dashboard)
    await sio.emit(
        "citizen:status-update",
        {"emergencyId": emergency_id, "status": status},
        room=room_for(emergency_id),
    )
    await sio.emit(
        "hospital:status-update",
        {"emergencyId": emergency_id, "status": status, "ambulanceId": ambulance["id"]},
    )

    print(f"[STATUS] {emergency_id} -> {status}")


# ── CITIZEN: Cancel SOS ─────────────────────────────────────────────
# Frees the ambulance, notifies the driver + hospital with CANCELLED,
# and removes the emergency record.
@sio.on("client:cancel-sos")
async def on_cancel_sos(sid, data):
    emergency_id = (data or {}).get("emergencyId")
    emergency = EMERGENCIES.pop(emergency_id, None)
    if not emergency:
        return

    ambulance = next((a for a in AMBULANCES if a["id"] == emergency["ambulanceId"]), None)
    if ambulance:
        ambulance["status"] = "IDLE"
        ambulance["currentEmergencyId"] = None

    room = room_for(emergency_id)
    payload = {"emergencyId": emergency_id, "status": "CANCELLED"}
    # Room covers the citizen (and the driver, if they already accepted).
    await sio.emit("citizen:status-update", payload, room=room)

    # The assigned driver may never have accepted (never joined the room)
    # — reach them directly on a best-effort basis.
    if emergency.get("status") == "DISPATCHED" and ambulance and ambulance.get("socketId"):
        try:
            await sio.emit("citizen:status-update", payload, to=ambulance["socketId"])
        except Exception:
            pass

    await sio.emit(
        "hospital:status-update",
        {
            "emergencyId": emergency_id,
            "status": "CANCELLED",
            "ambulanceId": emergency["ambulanceId"],
        },
    )

    print(f"[CANCEL] {emergency_id} cancelled, {emergency['ambulanceId']} freed")


# ── DEMO: Reset everything ──────────────────────────────────────────
# Clears all emergencies, frees ambulances, restores on-duty seed state.
@sio.on("demo:reset")
async def on_demo_reset(sid, data=None):
    EMERGENCIES.clear()
    for amb in AMBULANCES:
        amb["status"] = "IDLE"
        amb["currentEmergencyId"] = None
        amb["isOnDuty"] = True
    await sio.emit("demo:reset", {})
    print("[RESET] demo state cleared")


# ── Resend a pending dispatch to a (re)connecting driver ─────────────
# If an ambulance still has a DISPATCHED (unaccepted) emergency when its
# driver registers or toggles back on duty, re-send the incoming request
# so no SOS is ever silently missed.
async def resend_pending_dispatch(ambulance):
    emg_id = ambulance.get("currentEmergencyId")
    if not emg_id or not ambulance.get("socketId"):
        return
    emergency = EMERGENCIES.get(emg_id)
    if not emergency or emergency.get("status") != "DISPATCHED":
        return
    await sio.emit(
        "driver:incoming-request",
        {
            "emergencyId": emg_id,
            "patientLat": emergency["patientLocation"]["lat"],
            "patientLng": emergency["patientLocation"]["lng"],
            "category": emergency["category"],
            "distance": emergency["distanceToPatient"],
            "hospitalName": emergency["hospitalName"],
            "hospitalLat": emergency["hospitalLat"],
            "hospitalLng": emergency["hospitalLng"],
        },
        to=ambulance["socketId"],
    )
    print(f"[RESEND] pending {emg_id} -> {ambulance['id']}")


# ── DRIVER: Toggle Duty ───────────────────────────────────────────
@sio.on("driver:toggle-duty")
async def on_toggle_duty(sid, data):
    ambulance_id = data.get("ambulanceId")
    is_on_duty = data.get("isOnDuty")
    ambulance = next((a for a in AMBULANCES if a["id"] == ambulance_id), None)
    if ambulance:
        ambulance["isOnDuty"] = is_on_duty
        ambulance["socketId"] = sid
        if is_on_duty:
            await resend_pending_dispatch(ambulance)


# ── DRIVER: Register ──────────────────────────────────────────────
@sio.on("driver:register")
async def on_register(sid, data):
    ambulance_id = data.get("ambulanceId")
    ambulance = next((a for a in AMBULANCES if a["id"] == ambulance_id), None)
    if ambulance:
        ambulance["socketId"] = sid
        print(f"[REGISTER] Driver {ambulance_id} -> socket {sid}")
        await resend_pending_dispatch(ambulance)


# ── HOSPITAL: Assign Bed / Trauma Team ────────────────────────────
@sio.on("hospital:assign-resource")
async def on_assign_resource(sid, data):
    hospital_id = data.get("hospitalId")
    beds_available = data.get("bedsAvailable")
    trauma_ready = data.get("traumaTeamReady")
    hospital = next((h for h in HOSPITALS if h["id"] == hospital_id), None)
    if hospital:
        hospital["bedsAvailable"] = beds_available
        hospital["traumaTeamReady"] = trauma_ready
        await sio.emit(
            "hospital:resource-update",
            {
                "hospitalId": hospital_id,
                "bedsAvailable": beds_available,
                "traumaTeamReady": trauma_ready,
            },
        )


# ─── REST endpoint for health check ────────────────────────────────
@fastapi_app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "ambulances": len(AMBULANCES),
        "activeEmergencies": len(EMERGENCIES),
    }


# ─── ASGI app entrypoint (uvicorn main:app) ────────────────────────
socket_app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
app = socket_app