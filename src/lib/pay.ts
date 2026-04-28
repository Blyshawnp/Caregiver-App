export function roundUpToQuarter(value: number) {
  return Math.ceil((value - 1e-9) * 4) / 4;
}

export function normalizePositiveQuarter(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return roundUpToQuarter(value);
}
