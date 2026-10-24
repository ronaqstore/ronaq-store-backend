import {
  MARKETPLACE_HUBS,
  type MarketplaceHubDefinition,
} from '../constants/marketplace-hubs.constant.js';

function normalizeCityToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function listMarketplaceHubs(): MarketplaceHubDefinition[] {
  return MARKETPLACE_HUBS;
}

export function searchMarketplaceHubs(
  q?: string | null,
): MarketplaceHubDefinition[] {
  const sorted = [...MARKETPLACE_HUBS].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const token = q ? normalizeCityToken(q) : '';
  if (!token) return sorted;
  const compact = token.replace(/\s+/g, '');
  return sorted.filter(
    (hub) =>
      hub.id.includes(compact) ||
      hub.id.includes(token) ||
      normalizeCityToken(hub.name).includes(token) ||
      hub.aliases.some(
        (alias) => alias.includes(token) || alias.includes(compact),
      ),
  );
}

export function paginateMarketplaceHubs(
  q: string | null | undefined,
  page: number,
  pageSize: number,
): {
  items: MarketplaceHubDefinition[];
  total: number;
  page: number;
  pageSize: number;
} {
  const filtered = searchMarketplaceHubs(q);
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const start = (safePage - 1) * safeSize;
  return {
    items: filtered.slice(start, start + safeSize),
    total: filtered.length,
    page: safePage,
    pageSize: safeSize,
  };
}

export function findMarketplaceHub(
  cityOrId: string | null | undefined,
): MarketplaceHubDefinition | null {
  if (!cityOrId?.trim()) return null;
  const token = normalizeCityToken(cityOrId);
  if (token === 'all' || token.startsWith('area:')) return null;
  return (
    MARKETPLACE_HUBS.find(
      (hub) =>
        hub.id === token ||
        normalizeCityToken(hub.name) === token ||
        hub.aliases.some((alias) => alias === token),
    ) ?? null
  );
}

export function resolveHubCityFilter(
  cityOrId: string | null | undefined,
): string | null {
  if (!cityOrId?.trim()) return null;
  const token = normalizeCityToken(cityOrId);
  if (token === 'all' || token.startsWith('area:')) return null;
  const hub = findMarketplaceHub(cityOrId);
  return hub?.name ?? cityOrId.trim();
}

export function resolveHubCityTokens(
  cityOrId: string | null | undefined,
): string[] | null {
  if (!cityOrId?.trim()) return null;
  const token = normalizeCityToken(cityOrId);
  if (token === 'all' || token.startsWith('area:')) return null;
  const hub = findMarketplaceHub(cityOrId);
  if (!hub) return [cityOrId.trim()];
  return Array.from(new Set([hub.name, hub.id, ...hub.aliases]));
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestMarketplaceHub(
  latitude: number,
  longitude: number,
): MarketplaceHubDefinition {
  let best = MARKETPLACE_HUBS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const hub of MARKETPLACE_HUBS) {
    const distance = haversineKm(
      latitude,
      longitude,
      hub.latitude,
      hub.longitude,
    );
    if (distance < bestDistance) {
      best = hub;
      bestDistance = distance;
    }
  }
  return best;
}

export function resolveMarketplaceCityName(
  city: string | null | undefined,
): string | null {
  const hub = findMarketplaceHub(city);
  return hub?.name ?? null;
}
