const GOOGLE_MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/';

export function googleMapsSearchUrl(lat: number, lng: number): string {
  return `${GOOGLE_MAPS_SEARCH_BASE}?api=1&query=${lat},${lng}`;
}
