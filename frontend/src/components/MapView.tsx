import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  CircleMarker,
  Circle,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Signal } from "../lib/types";

// Ambulance live vehicle icon
const ambulanceIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(2,132,199,0.25);animation:pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
    <div style="position:relative;width:28px;height:28px;border-radius:50%;background:#ffffff;border:2.5px solid #0284c7;box-shadow:0 3px 8px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10H8c0 0-2.7.6-4.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
    </div>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Pickup / User Location Pin Icon (Distinct, high-visibility pin)
const pickupPinIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;width:42px;height:42px;border-radius:50%;background:rgba(14,165,233,0.3);animation:pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
    <div style="position:relative;width:30px;height:30px;border-radius:50%;background:#0284c7;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(2,132,199,0.45);display:flex;align-items:center;justify-content:center;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/></svg>
    </div>
  </div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

// Red Hospital Cross Icon
const hospitalIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:8px;background:#ffffff;border:2px solid #ef4444;box-shadow:0 3px 8px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444"><path d="M19 10.5h-5.5V5c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5v5.5H5c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5h5.5V19c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5v-5.5H19c.8 0 1.5-.7 1.5-1.5s-.7-1.5-1.5-1.5z"/></svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/**
 * Ensures map centers smoothly whenever `center` coordinates change.
 * React-Leaflet MapContainer.center does NOT update dynamically; this component fixes that.
 */
function MapRecenter({ center, zoom = 14 }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center?.[0], center?.[1], zoom, map]);
  return null;
}

/**
 * Fits bounds automatically for multi-point routes.
 */
function FitBoundsHandler({ points, enabled }: { points: [number, number][]; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || points.length < 2) return;
    try {
      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    } catch {
      // ignore
    }
  }, [map, JSON.stringify(points), enabled]);
  return null;
}

/**
 * Listens for user clicks on the map to set location pin.
 */
function MapClickHandler({ onPick }: { onPick?: (coords: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      if (onPick) {
        onPick([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

export function MapView({
  center = [12.9716, 77.5946], // Bangalore Center default
  zoom = 13,
  ambulance,
  pickupLocation,
  hospitals = [],
  signals = [],
  route = [],
  destination,
  className = "h-[420px]",
  theme = "light",
  onLocationPick,
  showLocateButton = false,
  onLocateMe,
  isLocating = false,
  interactive = true,
}: {
  center?: [number, number];
  zoom?: number;
  ambulance?: { lat: number; lng: number; label?: string } | null;
  pickupLocation?: { lat: number; lng: number; label?: string } | null;
  hospitals?: { id: string; name: string; lat: number; lng: number }[];
  signals?: Signal[];
  route?: [number, number][];
  destination?: { lat: number; lng: number; name: string } | null;
  className?: string;
  theme?: "light" | "dark";
  onLocationPick?: (coords: [number, number]) => void;
  showLocateButton?: boolean;
  onLocateMe?: () => void;
  isLocating?: boolean;
  interactive?: boolean;
}) {
  const isLight = theme === "light";

  // Active anchor reference for filtering signals
  const activeLat = ambulance?.lat ?? pickupLocation?.lat ?? center[0];
  const activeLng = ambulance?.lng ?? pickupLocation?.lng ?? center[1];

  // When viewing an active route, display all route corridor signals
  // Otherwise show signals in the active city vicinity (~30 km bounding)
  const displayedMapSignals =
    route.length > 1
      ? signals
      : signals.filter(
          (s) => Math.abs(s.latitude - activeLat) < 0.3 && Math.abs(s.longitude - activeLng) < 0.3
        );

  // Points for route bounding
  const routePoints: [number, number][] = [
    ...(route.length > 1 ? route : []),
    ...(destination ? [[destination.lat, destination.lng] as [number, number]] : []),
  ];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${
        isLight ? "border border-slate-200 bg-slate-50 shadow-sm" : "border border-white/10"
      } ${className}`}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom={interactive}
        dragging={interactive}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className={isLight ? "light-map-tiles" : "dark-tactical-tiles"}
        />

        {/* Dynamic recentering whenever user location or center prop changes */}
        <MapRecenter center={center} zoom={zoom} />

        {/* Auto fit bounds when an active route exists */}
        <FitBoundsHandler points={routePoints} enabled={route.length > 1} />

        {/* Click to pick location */}
        {onLocationPick && <MapClickHandler onPick={onLocationPick} />}

        {/* Route Polylines */}
        {route.length > 1 && (
          <>
            <Polyline
              positions={route}
              pathOptions={{
                color: isLight ? "#38bdf8" : "#2ee6c6",
                weight: isLight ? 8 : 9,
                opacity: isLight ? 0.45 : 0.25,
                lineCap: "round",
              }}
            />
            <Polyline
              positions={route}
              pathOptions={{
                color: isLight ? "#0284c7" : "#3ba4ff",
                weight: 5,
                opacity: 0.95,
                lineCap: "round",
              }}
            />
          </>
        )}

        {/* Pickup Location Marker (Step 2 & general location viewing) */}
        {pickupLocation && (
          <>
            <Circle
              center={[pickupLocation.lat, pickupLocation.lng]}
              radius={220}
              pathOptions={{
                color: "#0284c7",
                fillColor: "#38bdf8",
                fillOpacity: 0.15,
                weight: 1.5,
              }}
            />
            <Marker position={[pickupLocation.lat, pickupLocation.lng]} icon={pickupPinIcon}>
              <Popup>
                <div className="p-1 font-semibold text-slate-900 text-xs">
                  <p className="font-bold text-sky-700">Pickup Location</p>
                  <p className="text-slate-700 mt-0.5">{pickupLocation.label || "Selected Coordinates"}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {pickupLocation.lat.toFixed(4)}, {pickupLocation.lng.toFixed(4)}
                  </p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Active Ambulance Marker */}
        {ambulance && (
          <Marker position={[ambulance.lat, ambulance.lng]} icon={ambulanceIcon}>
            <Popup>
              <div className="p-1 font-semibold text-slate-900 text-xs">
                {ambulance.label || "Ambulance Vehicle"}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Hospital Markers */}
        {hospitals.map((h) => (
          <Marker key={h.id} position={[h.lat, h.lng]} icon={hospitalIcon}>
            <Popup>
              <div className="p-1 font-semibold text-slate-900 text-xs">
                <p className="font-bold text-rose-700">{h.name}</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {h.lat.toFixed(4)}, {h.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Destination Hospital Marker */}
        {destination && (
          <CircleMarker
            center={[destination.lat, destination.lng]}
            radius={12}
            pathOptions={{
              color: "#16a34a",
              fillColor: "#22c55e",
              fillOpacity: 0.9,
              weight: 3,
            }}
          >
            <Popup>
              <div className="p-1 font-bold text-slate-900 text-xs">
                Destination Hospital: {destination.name}
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Corridor Signals (Relevant Area / Route) */}
        {displayedMapSignals.map((s) => {
          const isEmergency = s.mode === "EMERGENCY_PRIORITY";
          // When approaching, signal is strictly GREEN (Green Corridor), never blue!
          const color = isEmergency
            ? "#22c55e"
            : s.status === "GREEN"
            ? "#16a34a"
            : s.status === "YELLOW"
            ? "#f59e0b"
            : "#dc2626";

          return (
            <div key={s.id}>
              {/* Outer pulsing Green Corridor priority halo */}
              {isEmergency && (
                <CircleMarker
                  center={[s.latitude, s.longitude]}
                  radius={22}
                  pathOptions={{
                    color: "#22c55e",
                    fillColor: "#22c55e",
                    fillOpacity: 0.3,
                    weight: 2,
                  }}
                />
              )}

              <CircleMarker
                center={[s.latitude, s.longitude]}
                radius={isEmergency ? 14 : 9}
                pathOptions={{
                  color: isEmergency ? "#15803d" : "#ffffff",
                  fillColor: color,
                  fillOpacity: 0.95,
                  weight: isEmergency ? 3.5 : 2,
                }}
              >
                <Tooltip
                  direction="top"
                  offset={[0, -10]}
                  opacity={0.95}
                  permanent={route.length > 1}
                  className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border ${
                    isEmergency
                      ? "bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-300"
                      : "bg-white text-slate-800 border-slate-200"
                  }`}
                >
                  <span>{isEmergency ? `⚡ ${s.code} (PRIORITY GREEN)` : s.code}</span>
                </Tooltip>

                <Popup>
                  <div className="p-1 text-xs">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className={`font-mono font-bold ${isEmergency ? "text-emerald-700" : "text-slate-800"}`}>
                        {s.code}
                      </span>
                      <span>{s.name}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      <span
                        className={`font-bold ${
                          isEmergency || s.status === "GREEN"
                            ? "text-emerald-600"
                            : s.status === "YELLOW"
                            ? "text-amber-600"
                            : "text-rose-600"
                        }`}
                      >
                        ● {isEmergency ? "GREEN (PRIORITY)" : s.status}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600 font-semibold">
                        {isEmergency ? "GREEN CORRIDOR PRIORITY" : "NORMAL CYCLE"}
                      </span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </div>
          );
        })}
      </MapContainer>

      {/* Floating Click-to-Pin Indicator */}
      {onLocationPick && (
        <div className="absolute top-3 left-3 z-[1000] pointer-events-none bg-white/95 backdrop-blur-sm border border-slate-200/90 shadow-md px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-ping" />
          <span>Click anywhere on map to pin your location</span>
        </div>
      )}

      {/* Floating "Locate Me" Button */}
      {showLocateButton && onLocateMe && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLocateMe();
          }}
          disabled={isLocating}
          className="absolute top-3 right-3 z-[1000] bg-white hover:bg-slate-50 active:bg-slate-100 text-sky-700 border border-slate-200 shadow-md px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          title="Detect and center on your live GPS location"
        >
          <svg
            className={`w-3.5 h-3.5 text-sky-600 ${isLocating ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3" />
            <path d="M12 19v3" />
            <path d="M2 12h3" />
            <path d="M20 12h3" />
          </svg>
          <span>{isLocating ? "Detecting GPS..." : "Locate Me"}</span>
        </button>
      )}
    </div>
  );
}
