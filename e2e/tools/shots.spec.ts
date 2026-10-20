// Ad-hoc screenshot helper (not part of the acceptance suite): SHOTS="path1,path2" npx playwright test e2e/tools
import { test } from '@playwright/test';
const paths = (process.env.SHOTS ?? '').split(',').filter(Boolean);
for (const p of paths) {
  test(`shot ${p}`, async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/projects/);
    const id = /projects\/([^/]+)/.exec(page.url())![1];
    const [route, ...setup] = p.split('|');
    await page.goto(`/projects/${id}/${route}`);
    await page.waitForTimeout(1500);
    for (const s of setup) {
      if (s.startsWith('click:')) await page.getByTestId(s.slice(6)).first().click();
      if (s.startsWith('text:')) await page.getByText(s.slice(5), { exact: true }).first().click();
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `e2e/shots/${p.replace(/[|:/]/g, '_')}.png` });
  });
}
