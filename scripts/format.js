// Consistent score formatting, e.g. 12345 -> "12,345".
export function formatScore(n) {
  return Math.max(0, Math.floor(n)).toLocaleString('en-US');
}
