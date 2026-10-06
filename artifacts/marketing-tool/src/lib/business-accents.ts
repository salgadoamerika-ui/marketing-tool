export const businessAccentOptions = [
  { value: 'rose', label: 'Rose', color: '#a84a6e', tone: 'rose' },
  { value: 'sage', label: 'Sage', color: '#7c9a86', tone: 'sage' },
  { value: 'amber', label: 'Amber', color: '#c59c61', tone: 'sand' },
  { value: 'lavender', label: 'Lavender', color: '#9b86a8', tone: 'lavender' },
  { value: 'blue', label: 'Blue', color: '#7892b0', tone: 'blue' },
  { value: 'clay', label: 'Clay', color: '#c47f6c', tone: 'blush' },
] as const;

export type BusinessAccent = (typeof businessAccentOptions)[number]['value'];

export function isBusinessAccent(value: unknown): value is BusinessAccent {
  return businessAccentOptions.some((option) => option.value === value);
}

export function getBusinessAccent(value: BusinessAccent) {
  return businessAccentOptions.find((option) => option.value === value)!;
}
