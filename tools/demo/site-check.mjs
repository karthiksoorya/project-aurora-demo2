import { chromium } from '@playwright/test';
const base = process.argv[2];
const outDir = process.argv[3];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1672, height: 941 } });
const bad = [];
p.on('console', (m) => m.type() === 'error' && bad.push('console: ' + m.text()));
p.on('pageerror', (e) => bad.push('pageerror: ' + e.message));
p.on('request', (r) => { if (/\/api\/v1|\/health/.test(r.url())) bad.push('network API call: ' + r.url()); if (!r.url().startsWith(new URL(base).origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) bad.push('external: ' + r.url()); });
await p.goto(base);
await p.waitForSelector('[data-testid=workspace-title]', { timeout: 30000 });
const shots = [['concept', 'concept'], ['ingredients', 'ingredients'], ['formula', 'formula'], ['validation', 'validation'], ['experiments', 'experiments'], ['review', 'review']];
for (const [key, name] of shots) {
  await p.getByTestId(`nav-${key}`).click();
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${outDir}/${name}.png` });
}
// a real write: save a version, run validation
await p.getByTestId('nav-formula').click();
await p.getByTestId('save-version').click();
await p.getByTestId('version-label').fill('Demo check');
await p.getByTestId('confirm-save-version').click();
await p.waitForTimeout(800);
await p.getByTestId('nav-validation').click();
await p.getByTestId('run-validation').click();
await p.waitForTimeout(1200);
await p.screenshot({ path: `${outDir}/validation-run.png` });
const status = await p.getByTestId('vs-run-status').innerText();
await p.reload();
await p.waitForSelector('[data-testid=workspace-title]');
const url = p.url();
const versions = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.includes('aurora-db.json')))).versions.map((v) => v.versionLabel));
console.log(JSON.stringify({ status, url, versions, problems: bad }, null, 1));
await b.close();
