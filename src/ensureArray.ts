export function ensureArray<T extends any>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}
