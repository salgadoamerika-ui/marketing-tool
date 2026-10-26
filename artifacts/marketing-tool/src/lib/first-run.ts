import { defaultContentTypes, defaultPlatformOptions } from './business-content-settings.ts';

export const firstRunStorageKey = 'marketing-tool.first-run-setup';

export type FirstRunSetupInput = {
  serviceName: string;
  mode: 'evergreen' | 'campaign';
  deadline: string;
  platforms: string[];
  contentType: string;
  date: string;
  isCompleted: boolean;
};

type ReadableStorage = { getItem(key: string): string | null };

/** Sample services auto-persist on load; they are not evidence of user setup. */
export function shouldOfferFirstRun(storage: ReadableStorage, sampleServiceIds: string[]): boolean {
  try {
    if (storage.getItem(firstRunStorageKey)) return false;
    const businesses: unknown = JSON.parse(storage.getItem('marketing-tool.businesses') ?? '[]');
    const posts: unknown = JSON.parse(storage.getItem('marketing-tool.user-posts') ?? '[]');
    const services: unknown = JSON.parse(storage.getItem('marketing-tool.services') ?? '[]');
    // Be conservative with unrecognized saved data: never replace an existing workspace.
    if (!Array.isArray(businesses) || !Array.isArray(posts) || !Array.isArray(services)) return false;
    if (businesses.length || posts.length) return false;
    const platformOptions = JSON.parse(storage.getItem('marketing-tool.platform-options')
      ?? JSON.stringify(defaultPlatformOptions));
    if (JSON.stringify(platformOptions) !== JSON.stringify(defaultPlatformOptions)) return false;
    const catalogs: unknown = JSON.parse(storage.getItem('marketing-tool.business-content-settings') ?? '{}');
    if (!catalogs || typeof catalogs !== 'object' || Array.isArray(catalogs)) return false;
    if (Object.values(catalogs).some((catalog) => !catalog || typeof catalog !== 'object'
      || (catalog.contentTypes !== undefined
        && JSON.stringify(catalog.contentTypes) !== JSON.stringify(defaultContentTypes))
      || (catalog.platformOptions !== undefined
        && JSON.stringify(catalog.platformOptions) !== JSON.stringify(defaultPlatformOptions))
      || Object.keys(catalog.contentTypeAliases ?? {}).length > 0)) return false;
    const sampleIds = new Set(sampleServiceIds);
    return !services.some((service) => !service || typeof service !== 'object'
      || !sampleIds.has(service.id) || service.mode !== 'evergreen'
      || service.platforms !== undefined || service.campaignHistory !== undefined);
  } catch {
    return false;
  }
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateFirstRun(
  input: FirstRunSetupInput,
  platformOptions: string[],
  contentTypes: string[],
  today: string,
): string | undefined {
  if (!input.serviceName.trim()) return 'Name the service or project you want to promote.';
  if (input.mode !== 'evergreen' && input.mode !== 'campaign') return 'Choose Service or Campaign.';
  if (input.mode === 'campaign' && (!validDate(input.deadline) || input.deadline < today)) {
    return 'Choose a Campaign deadline that is today or later.';
  }
  if (!input.platforms.length || input.platforms.some((platform) => !platformOptions.includes(platform))) {
    return 'Choose at least one available platform.';
  }
  if (!contentTypes.includes(input.contentType)) return 'Choose an available content type.';
  if (!validDate(input.date)) return 'Choose a valid day for your first post.';
  if (input.mode === 'campaign' && input.date > input.deadline) return 'Place your first post on or before the Campaign deadline.';
  return undefined;
}
