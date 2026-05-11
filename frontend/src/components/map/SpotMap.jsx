import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

const DEFAULT_CENTER = [48.1486, 17.1077];
const DEFAULT_ZOOM = 13;

const statusColors = {
  available: "#22c55e",
  inactive: "#ef4444",
  reserved: "#f59e0b"
};

function createMarkerIcon(status, isSelected) {
  const color = statusColors[status] || statusColors.inactive;
  const ring = isSelected ? "#0f172a" : "#ffffff";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 22px;
        height: 22px;
        background: ${color};
        border: 3px solid ${ring};
        border-radius: 999px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.22);
      "></div>
    `,
    iconAnchor: [11, 11],
    iconSize: [22, 22]
  });
}

function MapStartup() {
  const map = useMap();
  const didRequestLocation = useRef(false);

  useEffect(() => {
    map.invalidateSize();

    if (didRequestLocation.current || !navigator.geolocation) {
      return;
    }

    didRequestLocation.current = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.setView(
          [position.coords.latitude, position.coords.longitude],
          Math.max(map.getZoom(), 14),
          { animate: true }
        );
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 5000
      }
    );
  }, [map]);

  return null;
}

function SelectedSpotViewport({ selectedSpot }) {
  const map = useMap();
  const previousSelectedSpotId = useRef(null);

  useEffect(() => {
    map.invalidateSize();

    if (!selectedSpot) {
      previousSelectedSpotId.current = null;
      return;
    }

    if (previousSelectedSpotId.current !== selectedSpot.id?.toString()) {
      previousSelectedSpotId.current = selectedSpot.id?.toString();
      map.setView(
        [selectedSpot.latitude, selectedSpot.longitude],
        Math.max(map.getZoom(), 15),
        { animate: true }
      );
    }
  }, [map, selectedSpot]);

  return null;
}

function EmptyMapClick({ onEmptyClick }) {
  useMapEvents({
    click: () => {
      onEmptyClick?.();
    }
  });

  return null;
}

export function SpotMap({ selectedSpot, spots, onSelectSpot, onEmptyClick }) {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      style={{ height: "100%", width: "100%" }}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
    >   
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        noWrap
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapStartup />
      <SelectedSpotViewport selectedSpot={selectedSpot} />
      <EmptyMapClick onEmptyClick={onEmptyClick} />

      {spots.map((spot) => (
        <Marker
          key={spot.id.toString()}
          eventHandlers={{
            click: (event) => {
              event.originalEvent.stopPropagation();
              onSelectSpot(spot.id);
            }
          }}
          icon={createMarkerIcon(spot.status, selectedSpot?.id === spot.id)}
          position={[spot.latitude, spot.longitude]}
        >
          <Popup>
            <strong>{spot.locationName}</strong>
            <br />
            {spot.displayPrice}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
