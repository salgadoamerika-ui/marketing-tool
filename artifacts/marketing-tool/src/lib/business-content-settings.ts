export const defaultContentTypes = [
  'Announcement',
  'Insight',
  'Inside look',
  'Proof',
  'Testimonial',
  'Pricing',
  'Book now',
  'Last chance',
  'Recap',
  'Promo',
  'Fresh angle',
];

export const defaultPlatformOptions = ['Facebook', 'Instagram', 'TikTok'];

export type BusinessContentSettings = {
  contentTypes: string[];
  platformOptions: string[];
  selectedPlatforms: string[];
  contentTypeAliases: Record<string, string | null>;
};

export type ContentCatalogBusiness = {
  id: string;
  platforms: string[];
};

function cleanNames(value: unknown, label: string, allowEmpty = true): string[] {
  if (!Array.isArray(value)
    || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${label} must be a list of named items.`);
  }
  const names = value.map((item) => (item as string).trim());
  const folded = names.map((name) => name.toLocaleLowerCase());
  if (new Set(folded).size !== names.length) throw new Error(`${label} contains duplicate names.`);
  if (!allowEmpty && names.length === 0) throw new Error(`${label} cannot be empty.`);
  return names;
}

function defaultSettings(
  business: ContentCatalogBusiness,
  platformOptions: string[],
): BusinessContentSettings {
  const available = [...platformOptions];
  return {
    contentTypes: [...defaultContentTypes],
    platformOptions: available,
    selectedPlatforms: business.platforms.filter((platform) => available.includes(platform)),
    contentTypeAliases: {},
  };
}

export function createBusinessContentSettings(
  selectedPlatforms: string[] = defaultPlatformOptions,
  platformOptions: string[] = defaultPlatformOptions,
): BusinessContentSettings {
  const options = cleanNames(platformOptions, 'Platforms');
  const selected = cleanNames(selectedPlatforms, 'Selected platforms')
    .filter((platform) => options.includes(platform));
  return {
    contentTypes: [...defaultContentTypes],
    platformOptions: options,
    selectedPlatforms: selected,
    contentTypeAliases: {},
  };
}

export function loadBusinessContentSettings(
  serialized: string | null,
  businesses: ContentCatalogBusiness[],
  legacyPlatformOptions: string[] = defaultPlatformOptions,
): Record<string, BusinessContentSettings> {
  let stored: Record<string, unknown> = {};
  if (serialized) {
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Saved business content settings are invalid.');
    }
    stored = parsed as Record<string, unknown>;
  }

  const legacy = cleanNames(legacyPlatformOptions, 'Saved platforms');
  const result: Record<string, BusinessContentSettings> = {};
  for (const business of businesses) {
    const saved = stored[business.id];
    if (saved === undefined) {
      result[business.id] = defaultSettings(business, legacy);
      continue;
    }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
      throw new Error(`Saved content settings for ${business.id} are invalid.`);
    }
    const record = saved as Record<string, unknown>;
    const contentTypes = cleanNames(record.contentTypes, 'Content types');
    const platformOptions = cleanNames(record.platformOptions, 'Platforms');
    const selectedPlatforms = cleanNames(record.selectedPlatforms ?? [], 'Selected platforms')
      .filter((platform) => platformOptions.includes(platform));
    const rawAliases = record.contentTypeAliases ?? {};
    if (!rawAliases || typeof rawAliases !== 'object' || Array.isArray(rawAliases)) {
      throw new Error('Saved content type names are invalid.');
    }
    const contentTypeAliases: Record<string, string | null> = {};
    for (const [original, current] of Object.entries(rawAliases)) {
      if (typeof current !== 'string' && current !== null) {
        throw new Error('Saved content type names are invalid.');
      }
      contentTypeAliases[original] = current;
    }
    result[business.id] = { contentTypes, platformOptions, selectedPlatforms, contentTypeAliases };
  }
  return result;
}

export function resolveSeededContentType(
  sourceName: string,
  settings: BusinessContentSettings,
): string | null {
  if (!defaultContentTypes.includes(sourceName)) return null;
  const currentName = Object.hasOwn(settings.contentTypeAliases, sourceName)
    ? settings.contentTypeAliases[sourceName]
    : sourceName;
  return currentName && settings.contentTypes.includes(currentName) ? currentName : '';
}

export function renameContentTypeAliases(
  aliases: Record<string, string | null>,
  oldName: string,
  newName: string,
): Record<string, string | null> {
  return {
    ...Object.fromEntries(
    Object.entries(aliases).map(([original, current]) => [
      original,
      current === oldName ? newName : current,
    ]),
    ),
    [oldName]: newName,
  };
}

export function deleteContentTypeAliases(
  aliases: Record<string, string | null>,
  removedName: string,
): Record<string, string | null> {
  return {
    ...Object.fromEntries(
    Object.entries(aliases).map(([original, current]) => [
      original,
      current === removedName ? null : current,
    ]),
    ),
    [removedName]: null,
  };
}
