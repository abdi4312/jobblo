import styles from "./MapComponent.module.css";
import { MapContainer } from "react-leaflet";
import type { LatLngLiteral } from "leaflet";

export function MapComponent({
  coordinates,
}: {
  coordinates: [number, number];
}) {
  const coord: LatLngLiteral = { lng: coordinates[0], lat: coordinates[1] };

  return (
    <>
      <div className={styles.container}>
        <MapContainer center={coord}></MapContainer>
      </div>
    </>
  );
}
