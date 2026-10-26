import { defaultContentTypes, defaultPlatformOptions } from './business-content-settings.ts';
import { loadServices, type ServiceDefinition } from './services.ts';
import { serviceSeasonKey, type ServiceSeasonSelections } from './service-seasons.ts';

// Identity only, for recognizing old auto-saved services and recovering real work.
// These are never offered as businesses unless saved user data needs them.
export const legacyBusinessIdentities = [
  { id: 'mosaic', name: 'Mosaic Legal', accent: 'rose' as const },
  { id: 'northline', name: 'Northline Financial', accent: 'sage' as const },
  { id: 'harbor', name: 'Harbor Coverage', accent: 'amber' as const },
];
const legacyProjects = ['Fall programs', 'Tax planning', 'Divorce', 'Immigration', 'Insurance'];
export const legacySampleServiceIds = legacyBusinessIdentities.flatMap(({ id }) =>
  legacyProjects.map((name) => `${id}:${name}`));

type SavedPost = { businessId: string; project: string };
type SavedBusiness = { id: string };
type Catalog = {
  contentTypes?: string[];
  platformOptions?: string[];
  selectedPlatforms?: string[];
  contentTypeAliases?: Record<string, string | null>;
};

function hasCustomCatalog(catalog: Catalog | undefined, inheritedPlatforms: string[]): boolean {
  if (!catalog) return false;
  return (catalog.contentTypes !== undefined
    && JSON.stringify(catalog.contentTypes) !== JSON.stringify(defaultContentTypes))
    || (catalog.platformOptions !== undefined
      && JSON.stringify(catalog.platformOptions) !== JSON.stringify(defaultPlatformOptions)
      && JSON.stringify(catalog.platformOptions) !== JSON.stringify(inheritedPlatforms))
    || (catalog.selectedPlatforms !== undefined
      && JSON.stringify(catalog.selectedPlatforms) !== JSON.stringify(defaultPlatformOptions))
    || Object.keys(catalog.contentTypeAliases ?? {}).length > 0;
}

/** Remove only identifiable, untouched auto-saved defaults; recover from real posts. */
export function initializeLegacyWorkspace(
  rawServices: string | null,
  posts: SavedPost[],
  businesses: SavedBusiness[],
  catalogs: Record<string, Catalog> = {},
  seasons: ServiceSeasonSelections = {},
  inheritedPlatforms: string[] = defaultPlatformOptions,
) {
  // Inspect raw entries too: normalization must not erase evidence of a user edit.
  const raw: unknown = JSON.parse(rawServices ?? '[]');
  if (!Array.isArray(raw)) throw new Error('Saved services could not be read.');
  const retained = raw.filter((service) => {
    if (!service || typeof service !== 'object') return true; // let validation report it
    const isUntouchedDefault = legacySampleServiceIds.includes(service.id)
      && service.id === `${service.businessId}:${service.name}`
      && service.mode === 'evergreen'
      && Object.keys(service).every((key) => ['id', 'businessId', 'name', 'mode'].includes(key));
    return !isUntouchedDefault
      || businesses.some((business) => business.id === service.businessId)
      || posts.some((post) => post.businessId === service.businessId && post.project === service.name)
      || hasCustomCatalog(catalogs[service.businessId], inheritedPlatforms)
      || Object.hasOwn(seasons, serviceSeasonKey(service.businessId, service.name));
  });
  const recovered: ServiceDefinition[] = posts.filter((post) => post.project.trim()).map((post) => ({
    id: `${post.businessId}:${post.project}`,
    businessId: post.businessId,
    name: post.project,
    mode: 'evergreen',
  }));
  const services = loadServices(JSON.stringify(retained), recovered);
  const recoveredBusinesses = legacyBusinessIdentities.filter(({ id }) =>
    !businesses.some((business) => business.id === id)
    && (posts.some((post) => post.businessId === id)
      || services.some((service) => service.businessId === id)
      || hasCustomCatalog(catalogs[id], inheritedPlatforms)
      || Object.keys(seasons).some((key) => {
        try { return JSON.parse(key)[0] === id; } catch { return false; }
      })));
  return { services, recoveredBusinesses };
}
