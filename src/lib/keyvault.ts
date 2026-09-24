import crypto from "crypto";

/**
 * Server-side vault for candidate BYOK keys. AES-256-GCM with a KMS-style
 * master secret from `KEYVAULT_SECRET` (32-byte hex); the ciphertext is
 * bound to `userId:provider` as AAD so rows can't be swapped between users.
 * Plaintext exists only in process memory inside the grading hot path —
 * never logged, never returned to clients.
 */

function masterKey(): Buffer | null {
  const raw = (process.env.KEYVAULT_SECRET ?? "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) return null;
  return Buffer.from(raw, "hex");
}

export function vaultEnabled(): boolean {
  return masterKey() !== null;
}

/** Encrypts to `v1.<iv b64>.<cipher b64>.<tag b64>`. Throws when disabled. */
export function encryptKey(plain: string, userId: string, provider: string): string {
  const key = masterKey();
  if (!key) throw new Error("Key vault is not configured");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${userId}:${provider}`, "utf8"));
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${enc.toString("base64")}.${tag.toString("base64")}`;
}

/** Reverses `encryptKey`. Throws on tamper, wrong user/provider, or disabled. */
export function decryptKey(cipher: string, userId: string, provider: string): string {
  const key = masterKey();
  if (!key) throw new Error("Key vault is not configured");
  const parts = cipher.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Bad vault row");
  const [, ivB64, encB64, tagB64] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAAD(Buffer.from(`${userId}:${provider}`, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return (
    decipher.update(Buffer.from(encB64, "base64"), undefined, "utf8") +
    decipher.final("utf8")
  );
}

/** Write-only UX helper: `gsk-test-1234` → `…1234`. */
export function last4(plain: string): string {
  return `…${plain.trim().slice(-4)}`;
}
