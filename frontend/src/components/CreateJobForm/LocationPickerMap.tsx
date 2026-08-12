import React, { useState, useEffect, useCallback } from 'react';
import { Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { Locate, Loader2, MapPin, Crosshair } from 'lucide-react';
import { reverseGeocode, type ReverseGeocodeResult } from '../../utils/reverseGeocode';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const MAP_ID = 'jobblo-map-picker';

const DEFAULT_LOCATION = { lat: 59.9127, lng: 10.7461 }; // Oslo

interface LocationPickerMapProps {
  coordinates?: [number, number] | null;
  onCoordinatesChange?: (coords: [number, number]) => void;
  onReverseGeocode?: (result: ReverseGeocodeResult & { manual?: boolean }) => void;
}

export function LocationPickerMap({
  coordinates,
  onCoordinatesChange,
  onReverseGeocode,
}: LocationPickerMapProps) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(() =>
    coordinates ? { lat: coordinates[0], lng: coordinates[1] } : null
  );
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [panTarget, setPanTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [panVersion, setPanVersion] = useState(0);

  const setLocation = useCallback(
    (lat: number, lng: number, { geocode = true, pan = false, manual = false } = {}) => {
      setPosition({ lat, lng });
      onCoordinatesChange?.([lat, lng]);
      if (pan) {
        setPanTarget({ lat, lng });
        setPanVersion((v) => v + 1);
      }
      if (geocode) {
        reverseGeocode(lat, lng).then((result) => {
          if (result && onReverseGeocode) onReverseGeocode({ ...result, manual });
        });
      }
    },
    [onCoordinatesChange, onReverseGeocode]
  );

  const getCurrentLocation = useCallback(
    (opts?: { pan?: boolean; manual?: boolean }) => {
      if (!navigator.geolocation) {
        setLocationError('Geolokasjon støttes ikke i denne nettleseren.');
        return;
      }
      setIsLocating(true);
      setLocationError('');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation(pos.coords.latitude, pos.coords.longitude, {
            pan: true,
            manual: opts?.manual ?? false,
          });
          setIsLocating(false);
        },
        () => {
          setIsLocating(false);
          setLocationError(
            'Kunne ikke hente posisjonen din. Klikk på kartet for å sette lokasjonen manuelt.'
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    },
    [setLocation]
  );

  useEffect(() => {
    getCurrentLocation({ pan: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker + center when coordinates change from outside (e.g. address autocomplete)
  useEffect(() => {
    if (coordinates) {
      const lat = coordinates[0];
      const lng = coordinates[1];
      setPosition({ lat, lng });
      setPanTarget({ lat, lng });
      setPanVersion((v) => v + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates?.[0], coordinates?.[1]]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-64 rounded-xl border border-gray-200 flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
        Google Maps API key mangler
      </div>
    );
  }

  const hasPosition = !!position;

  return (
    <div className="space-y-3">
      <div className="relative w-full h-64 md:h-72 rounded-xl overflow-hidden border border-gray-200">
        <Map
          id={MAP_ID}
          style={{ width: '100%', height: '100%' }}
          defaultCenter={position ?? DEFAULT_LOCATION}
          defaultZoom={13}
          gestureHandling="greedy"
          mapId="jobblo-map"
          onClick={(e) => {
            const latLng = e.detail.latLng;
            if (latLng) setLocation(latLng.lat, latLng.lng, { manual: true });
          }}
        >
          {position && (
            <Marker
              position={position}
              draggable
              onDragEnd={(e) => {
                const latLng = e.latLng;
                if (latLng) setLocation(latLng.lat(), latLng.lng(), { manual: true });
              }}
            />
          )}
        </Map>
        <PanToMap mapId={MAP_ID} target={panTarget} version={panVersion} />

        {/* Center pin hint when no position is set yet */}
        {!hasPosition && !isLocating && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-white/95 backdrop-blur-sm shadow-lg rounded-full px-4 py-2 text-xs font-semibold text-gray-700 flex items-center gap-2 border border-gray-200">
              <Crosshair size={14} className="text-[#2D7A4D]" />
              Klikk på kartet for å sette lokasjon
            </div>
          </div>
        )}

        {isLocating && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm shadow-md rounded-full px-4 py-1.5 text-xs font-semibold text-gray-700 flex items-center gap-2 z-10">
            <Loader2 size={14} className="animate-spin text-[#2D7A4D]" />
            Henter posisjonen din...
          </div>
        )}

        {/* Coordinates badge in the corner */}
        {hasPosition && position && (
          <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm shadow-md rounded-md px-2 py-1 text-[10px] font-mono text-gray-600 z-10">
            {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
          </div>
        )}
      </div>

      {locationError && (
        <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
          <MapPin size={13} /> {locationError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => getCurrentLocation({ manual: true })}
          disabled={isLocating}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2D7A4D] text-white text-sm font-semibold rounded-xl hover:bg-[#25663f] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLocating ? <Loader2 size={15} className="animate-spin" /> : <Locate size={15} />}
          {isLocating ? 'Henter...' : 'Bruk min nåværende posisjon'}
        </button>
        <span className="text-xs text-gray-500">
          eller klikk på kartet / dra i markøren
        </span>
      </div>
    </div>
  );
};

function PanToMap({
  mapId,
  target,
  version,
}: {
  mapId: string;
  target: { lat: number; lng: number } | null;
  version: number;
}) {
  const map = useMap(mapId);
  useEffect(() => {
    if (map && target && version > 0) {
      map.panTo({ lat: target.lat, lng: target.lng });
    }
  }, [map, target, version]);
  return null;
}

export default LocationPickerMap;
