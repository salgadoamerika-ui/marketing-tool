export type ServiceMode = 'evergreen' | 'campaign';
type ServiceIdentity = { id: string; businessId: string; name: string };
export type ServiceDefinition = ServiceIdentity & (
  { mode: 'evergreen' } | { mode: 'campaign'; startDate: string; endDate: string }
);

export const servicesStorageKey = 'marketing-tool.services';
export function modeLabel(mode: ServiceMode): string {
  return mode === 'campaign' ? 'Campaign' : 'Service';
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
  // Existing entries without a mode remain ongoing; never invent a deadline.
  const mode = record.mode ?? 'evergreen';
  const service = {
    ...identity, mode,
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