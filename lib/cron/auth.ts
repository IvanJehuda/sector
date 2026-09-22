import { timingSafeEqual } from 'node:crypto';

/** Constant-time check of an `Authorization: Bearer <secret>` header. */
export function isCronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
