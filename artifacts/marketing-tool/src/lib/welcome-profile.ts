export const welcomeNameStorageKey = 'marketing-tool.display-name';
// No demo identity: an unnamed visitor sees the greeting without a name line.
export const defaultWelcomeName = '';

export function resolveWelcomeName(userName?: unknown, storedName?: unknown): string {
  for (const value of [userName, storedName]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return defaultWelcomeName;
}
