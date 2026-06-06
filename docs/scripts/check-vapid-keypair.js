const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "..", "..", ".env.local");
const env = parseEnvFile(envPath);

const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const privateKey = env.VAPID_PRIVATE_KEY || "";
const subject = env.VAPID_SUBJECT || "";
const validation = validateVapidKeyPair(publicKey, privateKey);

console.log(JSON.stringify({
  envFile: fs.existsSync(envPath) ? ".env.local" : "not found",
  publicKeyPresent: Boolean(publicKey),
  privateKeyPresent: Boolean(privateKey),
  subjectPresent: Boolean(subject),
  publicKeyLength: publicKey.length,
  privateKeyLength: privateKey.length,
  publicKeyPreview: previewPublicKey(publicKey),
  publicKeyFingerprint: getVapidFingerprint(publicKey),
  keyPairAppearsValid: validation.valid,
  error: validation.error,
}, null, 2));

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function validateVapidKeyPair(publicValue, privateValue) {
  if (!publicValue || !privateValue) {
    return { valid: false, error: "missing_vapid_key" };
  }

  try {
    const decodedPublic = base64UrlToBuffer(publicValue);
    const decodedPrivate = base64UrlToBuffer(privateValue);
    if (decodedPublic.length !== 65 || decodedPublic[0] !== 4) {
      return { valid: false, error: "invalid_public_key_format" };
    }
    if (decodedPrivate.length !== 32) {
      return { valid: false, error: "invalid_private_key_format" };
    }

    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(decodedPrivate);
    const derivedPublic = ecdh.getPublicKey();
    const valid = timingSafeEqual(decodedPublic, derivedPublic);
    return { valid, error: valid ? null : "public_private_key_mismatch" };
  } catch {
    return { valid: false, error: "vapid_key_validation_failed" };
  }
}

function base64UrlToBuffer(value) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function timingSafeEqual(left, right) {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function getVapidFingerprint(value) {
  if (!value) return "";
  return value.slice(-16);
}

function previewPublicKey(value) {
  if (!value) return "";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}
