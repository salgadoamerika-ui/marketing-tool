export type ServiceMode = 'evergreen' | 'campaign';
export const serviceCalendarTones = ['rose', 'lavender', 'sage', 'sand', 'blue', 'blush', 'muted'] as const;
export type ServiceTone = (typeof serviceCalendarTones)[number];
type ServiceIdentity = {
  id: string;
  businessId: string;
  name: string;
  platforms?: string[];
  tone?: ServiceTone;
};
export type ServiceDefinition = ServiceIdentity & (
  { mode: 'evergreen' } | { mode: 'campaign'; startDate: string; endDate: string }
);

export const servicesStorageKey = 'marketing-tool.services';
export function modeLabel(mode: ServiceMode): string {
  return mode === 'campaign' ? 'Campaign' : 'Service';
}

export function isServiceTone(value: unknown): value is ServiceTone {
  return serviceCalendarTones.some((tone) => tone === value);
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateService(service: ServiceDefinition): string | undefined {
  if (!service.id?.trim() || !service.businessId?.trim() || !service.name?.trim()) {
    return 'Add a name for this service or campaign.';
  }
  if (service.mode !== 'evergreen' && service.mode !== 'campaign') return 'Choose Service or Campaign.';
  if (service.platforms !== undefined
    && (!Array.isArray(service.platforms) || service.platforms.length === 0
      || service.platforms.some((platform) => typeof platform !== 'string' || !platform.trim()))) {
    return 'Choose at least one platform for this service or campaign.';
  }
  if (service.tone !== undefined && !isServiceTone(service.tone)) return 'Choose a valid calendar color.';
  if (service.mode === 'campaign') {
    if (!validDate(service.startDate) || !validDate(service.endDate)) return 'Add a valid start date and deadline.';
    if (service.startDate > service.endDate) return 'The deadline must be on or after the start date.';
  }
  return undefined;
}

/** Remove obsolete dates when an offering becomes an ongoing Service. */
export function normalizeService(value: unknown): ServiceDefinition {
  if (!value || typeof value !== 'object') throw new Error('Saved service information is invalid.');
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.businessId !== 'string' || typeof record.name !== 'string') {
    throw new Error('Saved service information is invalid.');
  }
  const identity = { id: record.id, businessId: record.businessId, name: record.name.trim() };
  let platforms: string[] | undefined;
  if (record.platforms !== undefined) {
    if (!Array.isArray(record.platforms) || record.platforms.some((platform) => typeof platform !== 'string' || !platform.trim())) {
      throw new Error('Saved service platforms are invalid.');
    }
    platforms = [...new Set((record.platforms as string[]).map((platform) => platform.trim()))];
    if (platforms.length === 0) throw new Error('Choose at least one platform for this service or campaign.');
  }
  if (record.tone !== undefined && !isServiceTone(record.tone)) {
    throw new Error('Saved service color is invalid.');
  }
  const settings = {
    ...(platforms ? { platforms } : {}),
    ...(record.tone !== undefined ? { tone: record.tone as ServiceTone } : {}),
  };
  // Existing entries without a mode remain ongoing; never invent a deadline.
  const mode = record.mode ?? 'evergreen';
  const service = {
    ...identity, ...settings, mode,
    ...(mode === 'campaign' ? { startDate: record.startDate, endDate: record.endDate } : {}),
  } as ServiceDefinition;
  const error = validateService(service);
  if (error) throw new Error(error);
  return service;
}

/** Merge defaults and recovered post projects without overwriting saved modes. */
export function loadServices(raw: string | null, defaults: ServiceDefinition[]): ServiceDefinition[] {
  const saved: unknown = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(saved)) throw new Error('Saved services could not be read.');
  const services = saved.map(normalizeService);
  const key = (service: ServiceDefinition) => `${service.businessId}:${service.name.toLowerCase()}`;
  if (new Set(services.map(key)).size !== services.length || new Set(services.map((s) => s.id)).size !== services.length) {
    throw new Error('Saved services contain duplicate entries.');
  }
  for (const service of defaults) {
    if (!services.some((existing) => key(existing) === key(service))) services.push(normalizeService(service));
  }
  return services;
}