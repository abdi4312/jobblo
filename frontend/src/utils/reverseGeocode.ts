const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

export interface ReverseGeocodeResult {
  address: string;
  city: string;
  postNumber?: string;
  /** Fylke — administrative_area_level_1. */
  county?: string;
  /** Kommune — administrative_area_level_2. */
  municipality?: string;
}

export const reverseGeocode = async (
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> => {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=no`
    );
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.[0]) return null;

    const result = data.results[0];
    const components = result.address_components || [];
    const pick = (types: string[]) =>
      components.find((c: any) => types.some((t) => c.types.includes(t)))?.long_name || '';

    const street = pick(['route']) || pick(['street_address']);
    const number = pick(['street_number']);
    const city =
      pick(['locality']) ||
      pick(['postal_town']) ||
      pick(['sublocality_level_1']) ||
      pick(['administrative_area_level_3']) ||
      pick(['administrative_area_level_2']);
    const postNumber = pick(['postal_code']);

    return {
      address: [street, number].filter(Boolean).join(' ') || result.formatted_address || '',
      city,
      postNumber,
      // Returned so that moving the pin can put fylke and kommune back in step with it.
      // Without these the dropdowns kept whatever was chosen before the pin moved, and the
      // job was filed under one kommune while its coordinates sat in another.
      county: pick(['administrative_area_level_1']),
      municipality: pick(['administrative_area_level_2']) || pick(['locality']),
    };
  } catch {
    return null;
  }
};
