import styles from './MapComponent.module.css';
import { APIProvider, Map, Circle } from '@vis.gl/react-google-maps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const circleRadius = 1000; // 1 KM

export function MapComponent({
  coordinates,
}: {
  coordinates: [number, number];
  circleRadius?: number; // accepted but ignored — always 1 km
}) {
  const [lng, lat] = coordinates;
  const center = { lat, lng };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div
        className={styles.container}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f4f6',
          color: '#9ca3af',
          fontSize: 12,
        }}
      >
        Google Maps API key mangler
      </div>
    );
  }

  return (
    <div className={styles.container} key={`${lng},${lat}`}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={center}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId="jobblo-map"
        >
          <Circle
            center={center}
            radius={circleRadius}
            strokeColor="#ff8a7a"
            strokeOpacity={0.9}
            strokeWeight={2}
            fillColor="#ff8a7a"
            fillOpacity={0.18}
          />
        </Map>
      </APIProvider>
    </div>
  );
}
