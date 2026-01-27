import styles from "./MapComponent.module.css";
import { Circle, MapContainer, TileLayer } from "react-leaflet";
import type { LatLngLiteral } from "leaflet";

const EARTH_RADIUS_METERS = 6371000;

function randomPointInCircle(
  center: LatLngLiteral,
  radiusMeters: number,
): LatLngLiteral {
  const u = Math.max(Math.random(), 1e-6);
  const v = Math.random();
  const distance = Math.sqrt(u) * radiusMeters;
  const angle = 2 * Math.PI * v;
  const deltaLat = (distance * Math.cos(angle)) / EARTH_RADIUS_METERS;
  const deltaLng =
    (distance * Math.sin(angle)) /
    (EARTH_RADIUS_METERS * Math.cos((center.lat * Math.PI) / 180));

  return {
    lat: center.lat + (deltaLat * 180) / Math.PI,
    lng: center.lng + (deltaLng * 180) / Math.PI,
  };
}

export function MapComponent({
  coordinates,
  circleRadius,
}: {
  coordinates: [number, number];
  circleRadius: number;
}) {
  const coord: LatLngLiteral = { lng: coordinates[0], lat: coordinates[1] };
  const randomCenter = randomPointInCircle(coord, circleRadius);

  return (
    <>
      <div className={styles.container}>
        <MapContainer
          center={randomCenter}
          zoom={15}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle center={coord} radius={circleRadius} />
        </MapContainer>
      </div>
    </>
  );
}
