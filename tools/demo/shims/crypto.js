const { sha256 } = require('@noble/hashes/sha256');
const { sha1 } = require('@noble/hashes/sha1');
const { Buffer } = require('buffer');
const algos = { sha256, sha1 };
exports.createHash = (name) => {
  const parts = [];
  const h = {
    update(d) { parts.push(typeof d === 'string' ? new TextEncoder().encode(d) : d); return h; },
    digest(enc) {
      const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let o = 0;
      for (const p of parts) { all.set(p, o); o += p.length; }
      const out = Buffer.from(algos[name](all));
      return enc ? out.toString(enc) : out;
    },
  };
  return h;
};
exports.randomUUID = () => {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
