import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

function createPickerIcon() {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 26px;
        height: 26px;
        background: #1f7a4d;
        border: 4px solid #ffffff;
        border-radius: 999px;
        box-shadow: 0 12px 26px rgba(15, 23, 42, 0.28);
      "></div>
    `,
    iconAnchor: [13, 13],
    iconSize: [26, 26]
  });
}

function MapReady({ center }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    map.setView(center, Math.max(map.getZoom(), 15), { animate: false });
  }, [center, map]);

  return null;
}

function LocationClickHandler({ onSelect }) {
  useMapEvents({
    click: (event) => {
      onSelect({
        lat: event.latlng.lat,
        lng: event.latlng.lng
      });
    }
  });

  return null;
}

function formatCoordinate(value) {
  return Number(value).toFixed(6);
}

export function LocationPickerMap({ initialLatitude, initialLongitude, onApply, onClose }) {
  const center = useMemo(
    () => [Number(initialLatitude), Number(initialLongitude)],
    [initialLatitude, initialLongitude]
  );
  const [selectedPoint, setSelectedPoint] = useState(null);
  const pickerIcon = useMemo(() => createPickerIcon(), []);

  const applySelection = () => {
    if (!selectedPoint) {
      return;
    }

    onApply({
      latitude: formatCoordinate(selectedPoint.lat),
      longitude: formatCoordinate(selectedPoint.lng)
    });
  };

  return (
    <div aria-modal="true" className="location-picker-overlay" role="dialog">
      <div className="location-picker-dialog">
        <header className="location-picker-header">
          <div>
            <p className="eyebrow">Map location</p>
            <h2 className="panel-title">Pick parking spot point</h2>
          </div>
          <button
            aria-label="Close location picker"
            className="panel-close"
            type="button"
            onClick={onClose}
          >
            X
          </button>
        </header>

        <div className="location-picker-map">
          <MapContainer
            center={center}
            style={{ height: "100%", width: "100%" }}
            zoom={15}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapReady center={center} />
            <LocationClickHandler onSelect={setSelectedPoint} />

            {selectedPoint ? (
              <Marker
                icon={pickerIcon}
                position={[selectedPoint.lat, selectedPoint.lng]}
              />
            ) : null}
          </MapContainer>
        </div>

        <footer className="location-picker-actions">
          <p className="notice compact">
            {selectedPoint
              ? `Selected location: ${formatCoordinate(selectedPoint.lat)}, ${formatCoordinate(selectedPoint.lng)}`
              : "Click the map to select a parking spot point."}
          </p>
          <div className="inline-actions">
            <button className="button-ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="button"
              disabled={!selectedPoint}
              type="button"
              onClick={applySelection}
            >
              Apply location
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
