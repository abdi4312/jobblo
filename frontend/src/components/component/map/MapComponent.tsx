import styles from "./MapComponent.module.css";
import { Circle, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { LatLngLiteral } from "leaflet";

export function MapComponent({
  coordinates,
  circleRadius,
}: {
  coordinates: [number, number];
  circleRadius: number;
}) {
  const coord: LatLngLiteral = { lng: coordinates[0], lat: coordinates[1] };

  return (
    <>
      <div className={styles.container}>
        <MapContainer
          center={coord}
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
