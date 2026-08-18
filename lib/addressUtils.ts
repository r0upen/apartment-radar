/** Placeholder strings that indicate a listing has no real address. */
const UNDISCLOSED_PATTERNS = [
  "address not disclosed",
  "undisclosed",
  "address unavailable",
  "address withheld",
];

/** Returns false for null/empty addresses and known placeholder strings. */
export function isValidAddress(address: string | null | undefined): boolean {
  if (!address || !address.trim()) return false;
  const lower = address.trim().toLowerCase();
  return !UNDISCLOSED_PATTERNS.some((p) => lower.includes(p));
}
