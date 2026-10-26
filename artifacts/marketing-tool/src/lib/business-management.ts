export const businessOverridesStorageKey = 'marketing-tool.business-overrides';
export type BusinessOverrides = Record<string, { name?: string; deleted?: boolean }>;

export function loadBusinessOverrides(raw: string | null): BusinessOverrides {
  if (raw === null) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Saved business settings are invalid.');
  }
  for (const entry of Object.values(parsed)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || (entry.name !== undefined && (typeof entry.name !== 'string' || !entry.name.trim()))
      || (entry.deleted !== undefined && typeof entry.deleted !== 'boolean')) {
      throw new Error('Saved business settings are invalid.');
    }
  }
  return parsed as BusinessOverrides;
}

export function validateBusinessName(
  name: string, businessId: string, businesses: Array<{ id: string; name: string }>,
): string | undefined {
  if (!name.trim()) return 'Enter a business name.';
  if (businesses.some((business) => business.id !== businessId
    && business.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    return 'A business with that name already exists.';
  }
  return undefined;
}

/** Business names are labels, never keys for services, posts, or learning. */
export function renameBusiness<T extends { id: string; name: string }>(
  businesses: T[], businessId: string, name: string,
): T[] {
  return businesses.map((business) =>
    business.id === businessId ? { ...business, name: name.trim() } : business);
}

export function withoutBusiness<T extends { businessId: string }>(items: T[], businessId: string): T[] {
  return items.filter((item) => item.businessId !== businessId);
}

export function withoutBusinessSettings<T>(settings: Record<string, T>, businessId: string): Record<string, T> {
  return Object.fromEntries(Object.entries(settings).filter(([key]) => key !== businessId));
}

export function withoutBusinessSeasons(
  seasons: Record<string, number[]>, businessId: string,
): Record<string, number[]> {
  return Object.fromEntries(Object.entries(seasons).filter(([key]) => {
    try { return JSON.parse(key)[0] !== businessId; }
    catch { return true; }
  }));
}
