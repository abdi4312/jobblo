import { useState, useRef, useEffect, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Loader2, AlertCircle, Globe2 } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

/**
 * Address search, scoped to the kommune the person picked.
 *
 * It used to search all of Norway with nothing but `country: 'NO'`, so choosing
 * Innlandet → Etnedal and then typing a street name offered addresses in Vestfold — and
 * taking one left the form saying the job was in Etnedal while the map pin sat two hundred
 * kilometres away. Nothing reconciled the two, and the job published with whichever the
 * backend read first.
 *
 * So the search is now bounded by the chosen kommune. The bounds come from geocoding the
 * kommune once and reusing its viewport, and `strictBounds` makes Google drop anything
 * outside it rather than merely ranking it lower.
 *
 * If that returns nothing the search widens to the whole country rather than dead-ending —
 * kommune borders and postal areas disagree often enough that a strict box can exclude an
 * address people would reasonably enter — but the widened results say so, and picking one
 * moves the kommune to match the address rather than leaving the two contradicting.
 */

interface AddressSuggestion {
  placeId: string;
  /** Street line — what the person is actually looking for. */
  primary: string;
  /** Kommune, fylke, country. Context, not the answer. */
  secondary: string;
}

export interface AddressSelectResult {
  address: string;
  city: string;
  /** administrative_area_level_1 — fylke. */
  county: string;
  /** administrative_area_level_2 — kommune. */
  municipality: string;
  postalCode: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value: string;
  onValueChange: (val: string) => void;
  onAddressSelect: (result: AddressSelectResult) => void;
  error?: string;
  placeholder?: string;
  /** Names, not codes — Google is asked about places, not about our location tree. */
  countyName?: string;
  municipalityName?: string;
}

/**
 * Geocoded kommune viewports, kept for the life of the tab.
 *
 * A kommune's bounds do not change while someone fills in a form, and geocoding is billed
 * per call. Module scope rather than a ref so switching steps — which unmounts this — does
 * not throw the lookup away.
 */
const boundsCache = new Map<string, google.maps.LatLngBounds | null>();

export function AddressAutocomplete({
  value,
  onValueChange,
  onAddressSelect,
  error,
  placeholder = 'F.eks. Storgata 1',
  countyName,
  municipalityName,
}: AddressAutocompleteProps) {
  const places = useMapsLibrary('places');
  const geocoding = useMapsLibrary('geocoding');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  /** True when the results had to be found outside the chosen kommune. */
  const [widened, setWidened] = useState(false);
  const [noMatches, setNoMatches] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<number>(undefined);
  /**
   * Every search carries a number and only the newest may write to state. Typing fires
   * overlapping requests, and Google does not answer them in order — without this, a slow
   * reply to "Stor" can land after the fast reply to "Storgata 1" and put the shorter
   * query's suggestions under the longer query's text.
   */
  const requestSeq = useRef(0);

  const scopeLabel = municipalityName || countyName || '';

  /** The kommune's viewport, geocoded once and cached. `null` means "we tried and failed". */
  const boundsForScope = useCallback(async (): Promise<google.maps.LatLngBounds | null> => {
    if (!geocoding || !municipalityName) return null;

    const key = `${municipalityName}|${countyName || ''}`;
    if (boundsCache.has(key)) return boundsCache.get(key) ?? null;

    const query = [municipalityName, countyName, 'Norge'].filter(Boolean).join(', ');
    try {
      const geocoder = new geocoding.Geocoder();
      const { results } = await geocoder.geocode({
        address: query,
        componentRestrictions: { country: 'NO' },
      });
      const viewport = results?.[0]?.geometry?.viewport ?? null;
      boundsCache.set(key, viewport);
      return viewport;
    } catch {
      // A kommune we cannot geocode is not an error worth showing anyone — the search just
      // falls back to the whole country, which is where it was before any of this.
      boundsCache.set(key, null);
      return null;
    }
  }, [geocoding, municipalityName, countyName]);

  const searchPlaces = useCallback(
    async (query: string) => {
      if (!places || query.trim().length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        setIsSearching(false);
        return;
      }

      const seq = ++requestSeq.current;
      setIsSearching(true);

      const bounds = await boundsForScope();
      if (seq !== requestSeq.current) return;

      const service = new places.AutocompleteService();

      const run = (strict: boolean) =>
        new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => {
          service.getPlacePredictions(
            {
              input: query,
              componentRestrictions: { country: 'NO' },
              language: 'no',
              // `address` keeps the list to street addresses. This field asks for a
              // gateadresse; offering shops and lakes here is what fills the dropdown with
              // things that cannot be a job location.
              types: ['address'],
              ...(bounds && strict ? { bounds, strictBounds: true } : {}),
              ...(bounds && !strict ? { bounds } : {}),
            },
            (predictions, status) => resolve(status === 'OK' && predictions ? predictions : [])
          );
        });

      let predictions = await run(true);
      let hadToWiden = false;

      // Nothing inside the kommune: widen rather than dead-end, and say that is what
      // happened. `bounds` without `strictBounds` still biases towards the area, so the
      // nearest sensible matches come first.
      if (predictions.length === 0 && bounds) {
        predictions = await run(false);
        hadToWiden = predictions.length > 0;
      }

      if (seq !== requestSeq.current) return;

      setIsSearching(false);
      setActiveIndex(-1);
      setWidened(hadToWiden);
      setNoMatches(predictions.length === 0);
      setSuggestions(
        predictions.map((p) => ({
          placeId: p.place_id,
          primary: p.structured_formatting?.main_text || p.description,
          secondary: p.structured_formatting?.secondary_text || '',
        }))
      );
      setIsOpen(true);
    },
    [places, boundsForScope]
  );

  const handleInputChange = (val: string) => {
    onValueChange(val);
    window.clearTimeout(debounceRef.current);
    if (val.trim().length >= 3) {
      debounceRef.current = window.setTimeout(() => searchPlaces(val), 350);
    } else {
      requestSeq.current++;
      setSuggestions([]);
      setIsOpen(false);
      setNoMatches(false);
      setWidened(false);
    }
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    setIsOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    setNoMatches(false);

    const fallback = [suggestion.primary, suggestion.secondary].filter(Boolean).join(', ');
    onValueChange(fallback);

    if (!places) return;
    const service = new places.PlacesService(document.createElement('div'));
    service.getDetails(
      {
        placeId: suggestion.placeId,
        // Asking for the fields we use rather than everything: Places bills by field group,
        // and the default is the expensive one.
        fields: ['geometry', 'address_components', 'formatted_address'],
      },
      (place, status) => {
        if (status !== 'OK' || !place?.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const components = place.address_components || [];
        const pick = (types: string[]) =>
          components.find((c) => types.some((t) => c.types.includes(t)))?.long_name || '';

        const city = pick(['postal_town']) || pick(['locality']) || pick(['administrative_area_level_2']);
        const municipality = pick(['administrative_area_level_2']) || pick(['locality']);
        const county = pick(['administrative_area_level_1']);

        // `formatted_address` is the postal form — "Storgata 1, 2890 Etnedal" — where the
        // prediction description is "Storgata 1, Etnedal, Norge". The postal form is the one
        // a provider can put into a satnav.
        const address = place.formatted_address || fallback;
        onValueChange(address);

        onAddressSelect({
          address,
          city,
          county,
          municipality,
          postalCode: pick(['postal_code']),
          lat,
          lng,
        });
      }
    );
  };

  /**
   * Arrow keys, Enter and Escape.
   *
   * A dropdown you can only reach with a mouse is not finished. This also stops Enter from
   * submitting the step while the list is open, which used to skip past the address the
   * person was in the middle of choosing.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0) {
        event.preventDefault();
        handleSelect(suggestions[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  // Keep the keyboard-highlighted row inside the scrollable list.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    listRef.current.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
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
        aria-invalid={error ? true : undefined}
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
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        required
        placeholder={scopeLabel ? `Søk adresse i ${scopeLabel}` : placeholder}
        aria-invalid={error ? true : undefined}
        aria-expanded={isOpen}
        aria-autocomplete="list"
        role="combobox"
        className={inputClass}
      />
      {isSearching && (
        <Loader2
          size={16}
          className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-gray-400 pointer-events-none"
        />
      )}

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
          {widened && scopeLabel && (
            <p className="flex items-start gap-2 border-b border-gray-100 bg-amber-50 px-4 py-2.5 text-[11px] leading-relaxed text-amber-800">
              <Globe2 size={13} className="mt-0.5 shrink-0" />
              <span>
                Ingen treff i <span className="font-bold">{scopeLabel}</span>. Viser hele Norge —
                velger du en av disse, oppdateres fylke og kommune.
              </span>
            </p>
          )}
          <ul ref={listRef} className="max-h-60 overflow-y-auto" role="listbox">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.placeId} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onClick={() => handleSelect(suggestion)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full cursor-pointer items-start gap-2.5 px-4 py-2.5 text-left transition-colors ${
                    index === activeIndex ? 'bg-[#2D7A4D]/8' : 'hover:bg-[#2D7A4D]/5'
                  }`}
                >
                  <MapPin size={14} className="mt-0.5 shrink-0 text-[#2D7A4D]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-800">
                      {suggestion.primary}
                    </span>
                    {suggestion.secondary && (
                      <span className="block truncate text-[11px] text-gray-500">
                        {suggestion.secondary}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpen && noMatches && !isSearching && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-100 bg-white p-4 text-[12px] text-gray-500 shadow-lg">
          Fant ingen adresse som passer. Sjekk stavemåten, eller sett markøren i kartet under.
        </div>
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
