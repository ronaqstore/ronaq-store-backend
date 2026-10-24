import {
  findMarketplaceHub,
  listMarketplaceHubs,
  nearestMarketplaceHub,
  paginateMarketplaceHubs,
  resolveHubCityFilter,
  resolveHubCityTokens,
  resolveMarketplaceCityName,
  searchMarketplaceHubs,
} from './marketplace-hub.helper.js';

describe('marketplace-hub.helper', () => {
  it('lists a flat KPK city set including Dir and Swat towns', () => {
    const hubs = listMarketplaceHubs();
    expect(hubs.length).toBeGreaterThan(150);
    expect(hubs.some((hub) => hub.id === 'peshawar')).toBe(true);
    expect(hubs.some((hub) => hub.id === 'timergara')).toBe(true);
    expect(hubs.some((hub) => hub.id === 'kumbar')).toBe(true);
    expect(hubs.some((hub) => hub.id === 'talash')).toBe(true);
    expect(hubs.some((hub) => hub.id === 'manglawar')).toBe(true);
    expect(hubs.some((hub) => hub.id === 'lahore')).toBe(false);
    expect(hubs.some((hub) => /bazaar$/i.test(hub.name))).toBe(false);
  });

  it('resolves hub by id, name, or alias', () => {
    expect(findMarketplaceHub('timergara')?.name).toBe('Timergara');
    expect(findMarketplaceHub('Kumbar Maidan')?.id).toBe('kumbar');
    expect(findMarketplaceHub('Ziarat Talash')?.id).toBe('talash');
    expect(findMarketplaceHub('Minglawar')?.id).toBe('manglawar');
    expect(findMarketplaceHub('Takht Bhai')?.id).toBe('takht-bhai');
  });

  it('maps city filter tokens', () => {
    expect(resolveHubCityFilter('talash')).toBe('Talash');
    expect(resolveHubCityFilter('all')).toBeNull();
    expect(resolveHubCityFilter('area:lower-dir')).toBeNull();
  });

  it('expands city aliases for product filters', () => {
    const tokens = resolveHubCityTokens('kumbar');
    expect(tokens).toEqual(
      expect.arrayContaining(['Kumbar', 'kumbar maidan', 'kambar']),
    );
    expect(resolveHubCityTokens('all')).toBeNull();
  });

  it('picks nearest hub from GPS', () => {
    const hub = nearestMarketplaceHub(34.83, 71.85);
    expect(hub.id).toBe('timergara');
  });

  it('resolves canonical marketplace city names for registration', () => {
    expect(resolveMarketplaceCityName('kumbar maidan')).toBe('Kumbar');
    expect(resolveMarketplaceCityName('Lahore')).toBeNull();
  });

  it('searches and paginates hubs for dropdown infinite scroll', () => {
    const matches = searchMarketplaceHubs('timer');
    expect(matches.some((hub) => hub.id === 'timergara')).toBe(true);

    const page1 = paginateMarketplaceHubs(undefined, 1, 20);
    expect(page1.items).toHaveLength(20);
    expect(page1.total).toBe(listMarketplaceHubs().length);
    expect(page1.page).toBe(1);

    const page2 = paginateMarketplaceHubs(undefined, 2, 20);
    expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
  });
});
