import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

interface AddressSuggestion {
  placeId: string;
  description: string;
}

export interface AddressSelectResult {
  address: string;
  city: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value: string;
  onValueChange: (val: string) => void;
  onAddressSelect: (result: AddressSelectResult) => void;
  error?: string;
  placeholder?: string;
}

export function AddressAutocomplete({
  value,
  onValueChange,
  onAddressSelect,
  error,
  placeholder = 'F.eks. Storgata 1',
}: AddressAutocompleteProps) {
  const places = useMapsLibrary('places');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number>();

  const searchPlaces = useCallback(
    (query: string) => {
      if (!places || query.trim().length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      const service = new places.AutocompleteService();
      service.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'NO' },
          language: 'no',
        },
        (predictions, status) => {
          setIsSearching(false);
          if (status === 'OK' && predictions) {
            setSuggestions(
              predictions.map((p) => ({ placeId: p.place_id, description: p.description }))
            );
            setIsOpen(true);
          } else {
            setSuggestions([]);
            setIsOpen(false);
          }
        }
      );
    },
    [places]
  );

  const handleInputChange = (val: string) => {
    onValueChange(val);
    window.clearTimeout(debounceRef.current);
    if (val.trim().length >= 3) {
      debounceRef.current = window.setTimeout(() => searchPlaces(val), 350);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    setIsOpen(false);
    setSuggestions([]);
    onValueChange(suggestion.description);

    if (!places) return;
    const service = new places.PlacesService(document.createElement('div'));
    service.getDetails({ placeId: suggestion.placeId }, (place, status) => {
      if (status !== 'OK' || !place?.geometry?.location) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const components = place.address_components || [];
      const pick = (types: string[]) =>
        components.find((c) => types.some((t) => c.types.includes(t)))?.long_name || '';
      const city =
        pick(['locality']) ||
        pick(['postal_town']) ||
        pick(['administrative_area_level_2']) ||
        pick(['administrative_area_level_1']);
      onAddressSelect({ address: suggestion.description, city, lat, lng });
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(debounceRef.current);
  }, []);

  const inputClass = `w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border bg-white text-sm md:text-base outline-none transition-all pr-10
    ${error ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/5' : 'border-gray-200 focus:border-[#2D7A4D] focus:ring-4 focus:ring-[#2D7A4D]/5'}`;

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        required
        placeholder={placeholder}
        className={inputClass}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        required
        placeholder={placeholder}
        className={inputClass}
      />
      {isSearching && (
        <Loader2
          size={16}
          className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-gray-400 pointer-events-none"
        />
      )}

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-30 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId}>
              <button
                type="button"
                onClick={() => handleSelect(suggestion)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-[#2D7A4D]/5 flex items-start gap-2 cursor-pointer"
              >
                <MapPin size={14} className="text-[#2D7A4D] shrink-0 mt-0.5" />
                <span>{suggestion.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-1 text-red-500 text-[10px] md:text-xs font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

export default AddressAutocomplete;
