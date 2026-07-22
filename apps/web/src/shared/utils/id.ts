export function createClientId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
