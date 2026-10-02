export const serviceSeasonsStorageKey = 'marketing-tool.service-seasons';
export type ServiceSeasonSelections = Record<string, number[]>;

export function serviceSeasonKey(businessId: string, service: string): string {
  return JSON.stringify([businessId, service]);
}

export function normalizeSeasonMonths(months: number[]): number[] {
  if (!Array.isArray(months) || months.some((month) => !Number.isSafeInteger(month) || month < 1 || month > 12)) {
    throw new Error('Choose valid months for this service.');
  }
  return [...new Set(months)].sort((a, b) => a - b);
}

export function loadServiceSeasonSelections(raw: string | null): ServiceSeasonSelections {
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Saved service season settings could not be read.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Saved service season settings are invalid.');
  }
  const selections: ServiceSeasonSelections = {};
  for (const [key, value] of Object.entries(parsed)) {
    let identity: unknown;
    try {
      identity = JSON.parse(key);
    } catch {
      throw new Error('Saved service season settings are invalid.');
    }
    if (!Array.isArray(identity) || identity.length !== 2
      || identity.some((part) => typeof part !== 'string' || !part.trim())) {
      throw new Error('Saved service season settings are invalid.');
    }
    if (!Array.isArray(value)) throw new Error('Saved service season settings are invalid.');
    const normalized = normalizeSeasonMonths(value as number[]);
    if (normalized.length !== value.length) throw new Error('Saved service season settings contain duplicate months.');
    selections[key] = normalized;
  }
  return selections;
}