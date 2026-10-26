export const welcomeNameStorageKey = 'marketing-tool.display-name';
// Editable fallback until an authenticated profile supplies a name.
export const defaultWelcomeName = 'Amerika';

export function resolveWelcomeName(userName?: unknown, storedName?: unknown): string {
  for (const value of [userName, storedName]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return defaultWelcomeName;
}
