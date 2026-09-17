import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** A high-entropy secret suitable for an admin token. Never logged or returned after creation. */
export function generateSecret(): string {
  return randomBytes(24).toString('base64url');
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Constant-time comparison so admin-secret checks aren't vulnerable to timing attacks. */
export function secretMatchesHash(secret: string, hash: string): boolean {
  const candidate = Buffer.from(hashSecret(secret), 'hex');
  const actual = Buffer.from(hash, 'hex');
  if (candidate.length !== actual.length) return false;
  return timingSafeEqual(candidate, actual);
}
