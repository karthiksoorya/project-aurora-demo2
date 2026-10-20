import { E2E_API } from './support/api-process';
import { expect, openApp, test } from './support/fixtures';

const WS = [
  ['concept', 'Concept Studio'],
  ['ingredients', 'Ingredient Explorer'],
  ['formula', 'Formula Studio'],
  ['validation', 'Validation Studio'],
  ['experiments', 'Experiment Explorer'],
  ['review', 'Share & Review'],
] as const;

test.describe('M0 · foundation', () => {
  test('API /health is healthy and reports AI disabled', async ({ request }) => {
    const r = await request.get(`${E2E_API}/health`);
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.status).toBe('ok');
    expect(body.ai.enabled).toBe(false);
    expect(body.outboundNetwork).toBe('none');
  });

  test('exactly six workspace routes render inside one shared shell', async ({ page, net }) => {
    await openApp(page, '/'); // landing redirect
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/concept$/);
    const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
    await expect(nav.getByRole('link')).toHaveCount(6);
    for (const [key, label] of WS) {
      await page.getByTestId(`nav-${key}`).click();
      await expect(page).toHaveURL(new RegExp(`/${key}$`));
      await expect(page.getByTestId('workspace-title')).toContainText(label);
      // shared shell landmarks on every route
      await expect(page.getByTestId('project-selector')).toContainText('Coastal Air');
      await expect(page.getByTestId('mode-switch')).toBeVisible();
      await expect(page.getByTestId('current-project-card')).toBeVisible();
      await expect(page.getByTestId(`nav-${key}`)).toHaveAttribute('aria-current', 'page');
    }
    expect(net.ai, 'Manual mode makes zero AI calls').toEqual([]);
  });

  test('Manual/AI toggle shows an honest disabled AI panel and no remote calls', async ({ page, net }) => {
    await openApp(page);
    await expect(page.getByTestId('ai-panel')).toHaveCount(0);
    await page.getByTestId('mode-ai').click();
    await expect(page.getByTestId('ai-panel')).toBeVisible();
    await expect(page.getByTestId('ai-unavailable')).toContainText('AI Assist is unavailable');
    await page.getByTestId('ai-panel-close').click();
    await expect(page.getByTestId('ai-panel')).toHaveCount(0);
    await page.getByTestId('mode-manual').click();
    // only the local status probe may have been called, and only in AI mode
    expect(net.ai.every((c) => c === 'GET /api/v1/ai/status')).toBe(true);
  });
});
