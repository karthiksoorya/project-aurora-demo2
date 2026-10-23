// Tiny virtual file system for the JSON adapter running in a browser:
// the data file is persisted in localStorage (per viewer); other files (uploads) live in memory.
const { Buffer } = require('buffer');
const KEY = 'aurora.demo.fs.v1:';
const mem = new Map();
function read(p) {
  if (mem.has(p)) return mem.get(p);
  try {
    const v = localStorage.getItem(KEY + p);
    if (v != null) {
      const out = v.startsWith('b64:') ? Buffer.from(v.slice(4), 'base64') : v;
      mem.set(p, out);
      return out;
    }
  } catch { /* storage unavailable */ }
  return undefined;
}
function write(p, data) {
  mem.set(p, data);
  // best effort: text as-is, binary (uploads) as base64; over quota the file simply stays in memory
  try {
    localStorage.setItem(KEY + p, typeof data === 'string' ? data : 'b64:' + Buffer.from(data).toString('base64'));
  } catch { /* memory only */ }
}
const enoent = (p) => Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
exports.existsSync = (p) => read(p) !== undefined;
exports.mkdirSync = () => undefined;
exports.accessSync = () => undefined;
exports.rmSync = (p) => { mem.delete(p); try { localStorage.removeItem(KEY + p); } catch { /* */ } };
exports.constants = { W_OK: 2 };
exports.readFileSync = (p) => { const v = read(p); if (v === undefined) throw enoent(p); return v; };
exports.writeFileSync = write;
exports.promises = {
  readFile: async (p, enc) => { const v = read(p); if (v === undefined) throw enoent(p); return enc ? String(v) : v; },
  writeFile: async (p, d) => write(p, d),
  copyFile: async (a, b) => write(b, read(a)),
  rename: async (a, b) => { write(b, read(a)); mem.delete(a); },
  open: async (p) => ({
    writeFile: async (d) => write(p, d),
    sync: async () => undefined,
    close: async () => undefined,
  }),
};
exports.__read = read;
exports.__resetAll = () => {
  mem.clear();
  try { Object.keys(localStorage).filter((k) => k.startsWith(KEY)).forEach((k) => localStorage.removeItem(k)); } catch { /* */ }
};
