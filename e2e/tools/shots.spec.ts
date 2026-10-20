// Ad-hoc screenshot helper (not an acceptance test): SHOTS="route|step|step,..." npx playwright test e2e/tools
// steps: click:<testid> | text:<exact text> | as:<owner|pd|ra|mk> | seed
import { test } from '@playwright/test';
import { seedDemoHistory, USERS } from '../support/demo-data';
const COASTAL = '449b5ed1-d098-5f91-9839-006e26c6dd99';
const paths = (process.env.SHOTS ?? '').split(',').filter(Boolean);
for (const p of paths) {
  test(`shot ${p}`, async ({ page, request }) => {
    const [route, ...steps] = p.split('|');
    if (steps.includes('seed')) await seedDemoHistory(request, COASTAL);
    const as = steps.find((s) => s.startsWith('as:'))?.slice(3) as keyof typeof USERS | undefined;
    if (as) await page.addInitScript((id) => localStorage.setItem('aurora.user.v1', id), USERS[as]);
    await page.goto(`/projects/${COASTAL}/${route}`);
    await page.waitForTimeout(1800);
    for (const s of steps) {
      if (s.startsWith('click:')) await page.getByTestId(s.slice(6)).first().click();
      if (s.startsWith('text:')) await page.getByText(s.slice(5), { exact: true }).first().click();
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `e2e/shots/${p.replace(/[|:/]/g, '_')}.png` });
  });
}
