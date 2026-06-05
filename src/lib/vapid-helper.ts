export function getVapidFingerprint(publicKey?: string | null): string {
  if (!publicKey) return "";
  // Use the last 16 characters of the VAPID public key as a stable fingerprint/version
  return publicKey.slice(-16);
}
