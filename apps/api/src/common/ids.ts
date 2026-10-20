import { createHash, randomUUID } from 'node:crypto';

/** Random v4 UUID for new runtime entities. */
export const newId = (): string => randomUUID();

/**
 * Deterministic UUID (RFC 4122 v5 layout, SHA-1 of a fixed namespace + name).
 * Used for fixture entities so that IDs are stable across reseeds and machines.
 */
export function stableUuid(name: string): string {
  const h = createHash('sha1').update(`aurora-fixture-ns:${name}`).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
