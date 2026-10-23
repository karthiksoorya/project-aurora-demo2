// npm run demo:build → tools/demo/out/site: static demo of the full app (no server) for a private preview link.
import { execSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const site = path.join(here, 'out', 'site');
const sh = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });

rmSync(path.join(here, 'out'), { recursive: true, force: true });
sh('npm run build -w apps/api');
sh(`node ${JSON.stringify(path.join(here, 'build.mjs'))} ${JSON.stringify(site)}`);
const webOut = path.join(here, 'out', 'web');
sh(`npx ng build --base-href ./ --output-path ${JSON.stringify(webOut)}`, path.join(root, 'apps/web'));
cpSync(path.join(webOut, 'browser'), site, { recursive: true });

const ribbon = `
<style>
  #aurora-demo-ribbon{position:fixed;right:14px;bottom:12px;z-index:9999;display:flex;gap:8px;align-items:center;
    font:600 12px/1.2 'Inter Variable',system-ui,sans-serif;color:#3b2a00;background:#fff4cc;border:1px solid #f2c94c;
    border-radius:999px;padding:6px 8px 6px 12px;box-shadow:0 4px 16px rgba(30,40,80,.15)}
  #aurora-demo-ribbon button{font:inherit;border:1px solid #e0b43a;background:#fff;border-radius:999px;padding:4px 10px;cursor:pointer}
  #aurora-demo-ribbon button:hover{background:#fffaf0}
  #aurora-demo-ribbon .x{border:0;background:transparent;padding:2px 6px}
</style>
<div id="aurora-demo-ribbon" role="note" aria-label="Demo build notice">
  <span>Demo build · runs entirely in your browser · changes are saved only on this device</span>
  <button type="button" onclick="if(this.dataset.armed){auroraDemo.reset()}else{this.dataset.armed='1';this.textContent='Click again to erase demo data'}">Reset demo data</button>
  <button type="button" class="x" aria-label="Hide notice" onclick="this.parentElement.remove()">✕</button>
</div>`;
const idx = path.join(site, 'index.html');
let html = readFileSync(idx, 'utf8');
html = html
  .replace('<title>Aurora — Fragrance Creation Studio</title>', '<title>Aurora Fragrance Studio</title>')
  .replace('</head>', '  <script src="demo-backend.js"></script>\n</head>')
  .replace('</body>', `${ribbon}\n</body>`);
writeFileSync(idx, html);
// Artifact page form: the host supplies <!doctype>/<html>/<head>/<body>, so publish head + body contents only.
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<base [^>]*>\s*/, '').replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
writeFileSync(path.join(here, 'out', 'page.html'), `${head.trim()}\n${body.trim()}\n`);
const files = [];
const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.relative(site, path.join(d, e.name)))));
walk(site);
writeFileSync(path.join(here, 'out', 'files.json'), JSON.stringify(files, null, 1));
console.log(`Demo site: ${site} (${files.length} files)`);
