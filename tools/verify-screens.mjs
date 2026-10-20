// Verifies a folder of reference screenshots against docs/handoff/ASSET_MANIFEST.json (sha256, bytes).
// Usage: node tools/verify-screens.mjs <path-to-screens-folder>
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node tools/verify-screens.mjs <screens-folder>');
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(new URL('../docs/handoff/ASSET_MANIFEST.json', import.meta.url), 'utf8'));
let bad = 0;
for (const a of manifest) {
  const f = join(dir, a.filename);
  if (!existsSync(f)) {
    console.log(`MISSING  ${a.id.padEnd(6)} ${a.filename}`);
    bad++;
    continue;
  }
  const buf = readFileSync(f);
  const sha = createHash('sha256').update(buf).digest('hex');
  const ok = sha === a.sha256 && buf.length === a.bytes;
  if (!ok) bad++;
  console.log(`${ok ? 'OK      ' : 'CHANGED '} ${a.id.padEnd(6)} ${a.filename}`);
}
console.log(`\n${manifest.length - bad}/${manifest.length} reference screenshots verified unchanged.`);
process.exit(bad ? 1 : 0);
