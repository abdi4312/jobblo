/**
 * Kartverket's free address register (ws.geonorge.no/adresser/v1). Covers every Norwegian
 * address; no key. `kommunenummer` is the same code as our location tree's municipality code
 * (both come from Kartverket), so a hit maps straight onto countyCode/municipalityCode.
 */
const BASE = 'https://ws.geonorge.no/adresser/v1';

export interface AddressHit {
  /** e.g. "Borggata 8" */
  address: string;
  postalCode: string;
  /** Poststed, title-cased, e.g. "Oslo" */
  city: string;
  municipalityCode: string;
  municipalityName: string;
  lat: number;
  lng: number;
}

interface RawAddress {
  adressetekst?: string;
  postnummer?: string;
  poststed?: string;
  kommunenummer?: string;
  kommunenavn?: string;
  representasjonspunkt?: { lat?: number; lon?: number };
}

/** "NORDRE LAND" → "Nordre Land", "AURSKOG-HØLAND" → "Aurskog-Høland". */
const titleCase = (value = '') =>
  value.toLowerCase().replace(/(^|[\s-])([a-zæøåäöü])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());

function toHit(raw: RawAddress): AddressHit | null {
  const lat = raw.representasjonspunkt?.lat;
  const lng = raw.representasjonspunkt?.lon;
  if (!raw.adressetekst || typeof lat !== 'number' || typeof lng !== 'number') return null;
  return {
    address: raw.adressetekst,
    postalCode: raw.postnummer ?? '',
    city: titleCase(raw.poststed),
    municipalityCode: raw.kommunenummer ?? '',
    municipalityName: titleCase(raw.kommunenavn),
    lat,
    lng,
  };
}

async function fetchHits(url: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const response = await fetch(url, { signal });
  // 400 = a point outside Norway / a query it cannot use: that is "no address", not an outage.
  if (response.status === 400) return [];
  if (!response.ok) throw new Error(`Adressesøk feilet (${response.status})`);
  const data = (await response.json()) as { adresser?: RawAddress[] };
  return (data.adresser ?? []).map(toHit).filter((hit): hit is AddressHit => hit !== null);
}

/** Suggestions while typing. */
export function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const params = `sok=${encodeURIComponent(query.trim())}&fuzzy=true&treffPerSide=8&utkoordsys=4258`;
  return fetchHits(`${BASE}/sok?${params}`, signal);
}

/** Nearest address to a map tap / GPS position, or null when there is none within 250 m. */
export async function addressAt(lat: number, lng: number): Promise<AddressHit | null> {
  const hits = await fetchHits(`${BASE}/punktsok?lat=${lat}&lon=${lng}&radius=250&treffPerSide=1&utkoordsys=4258`);
  return hits[0] ?? null;
}
