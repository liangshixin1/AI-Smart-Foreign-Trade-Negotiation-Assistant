export function confirmAction(message: string): boolean {
  return globalThis.confirm(message)
}
