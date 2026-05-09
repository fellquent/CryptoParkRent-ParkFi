import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

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

function MapViewport({ spots, selectedSpot }) {
  const map = useMap();

  useMemo(() => {
    if (!spots.length) {
      map.setView([48.1486, 17.1077], 13);
      return;
    }

    if (selectedSpot) {
      map.setView(
        [selectedSpot.latitude, selectedSpot.longitude],
        Math.max(map.getZoom(), 15),
        { animate: true }
      );
      return;
    }

    const bounds = L.latLngBounds(
      spots.map((spot) => [spot.latitude, spot.longitude])
    );

    map.fitBounds(bounds.pad(0.2), { animate: true });
  }, [map, selectedSpot, spots]);

  return null;
}

export function SpotMap({ selectedSpot, spots, onSelectSpot }) {
  return (
    <MapContainer
      center={[48.1486, 17.1077]}
      style={{ height: "100%", width: "100%" }}
      zoom={13}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapViewport selectedSpot={selectedSpot} spots={spots} />

      {spots.map((spot) => (
        <Marker
          key={spot.id.toString()}
          eventHandlers={{
            click: () => onSelectSpot(spot.id)
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
