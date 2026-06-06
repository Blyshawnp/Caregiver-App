import crypto from "crypto";
import { getVapidFingerprint } from "@/lib/vapid-helper";

export type ServerVapidStatus = {
  publicKeyPresent: boolean;
  privateKeyPresent: boolean;
  subjectPresent: boolean;
  serverPublicKeyFingerprint: string;
  keyPairValid: boolean;
  error: string | null;
};

export type ServerVapidDetails = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function getServerVapidStatus(): ServerVapidStatus {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "";

  if (!publicKey || !privateKey || !subject) {
    return {
      publicKeyPresent: Boolean(publicKey),
      privateKeyPresent: Boolean(privateKey),
      subjectPresent: Boolean(subject),
      serverPublicKeyFingerprint: getVapidFingerprint(publicKey),
      keyPairValid: false,
      error: "missing_vapid_configuration",
    };
  }

  const validation = validateVapidKeyPair(publicKey, privateKey);
  return {
    publicKeyPresent: true,
    privateKeyPresent: true,
    subjectPresent: true,
    serverPublicKeyFingerprint: getVapidFingerprint(publicKey),
    keyPairValid: validation.valid,
    error: validation.error,
  };
}

export function getServerVapidDetails() {
  const status = getServerVapidStatus();
  if (!status.keyPairValid) {
    return { details: null, status };
  }

  return {
    details: {
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      privateKey: process.env.VAPID_PRIVATE_KEY!,
      subject: process.env.VAPID_SUBJECT!,
    },
    status,
  };
}

function validateVapidKeyPair(publicKey: string, privateKey: string) {
  try {
    const decodedPublic = base64UrlToBuffer(publicKey);
    const decodedPrivate = base64UrlToBuffer(privateKey);
    if (decodedPublic.length !== 65 || decodedPublic[0] !== 4) {
      return { valid: false, error: "invalid_public_key_format" };
    }
    if (decodedPrivate.length !== 32) {
      return { valid: false, error: "invalid_private_key_format" };
    }

    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(decodedPrivate);
    const derivedPublic = ecdh.getPublicKey();
    return {
      valid: timingSafeEqual(decodedPublic, derivedPublic),
      error: timingSafeEqual(decodedPublic, derivedPublic) ? null : "public_private_key_mismatch",
    };
  } catch {
    return { valid: false, error: "vapid_key_validation_failed" };
  }
}

function timingSafeEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function base64UrlToBuffer(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
