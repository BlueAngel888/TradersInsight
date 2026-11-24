// Small signed tokens (HMAC-SHA256) so the server needs no database:
// OAuth codes, access/refresh tokens and trade confirmations are all
// self-contained and expire on their own.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function sign(payload: Record<string, unknown>, key: Buffer): string {
  const body = b64(JSON.stringify(payload));
  const sig = b64(createHmac("sha256", key).update(body).digest());
  return `${body}.${sig}`;
}

export function verify<T extends Record<string, unknown>>(token: string, key: Buffer, typ: string, now = Date.now()): T | null {
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = createHmac("sha256", key).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { typ?: string; exp?: number };
    if (p.typ !== typ) return null;
    if (typeof p.exp !== "number" || p.exp < now) return null;
    return p;
  } catch {
    return null;
  }
}

export const nonce = (bytes = 9) => randomBytes(bytes).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

/** PKCE S256 check. */
export function pkceOk(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  return safeEqual(b64(createHash("sha256").update(verifier).digest()), challenge);
}
