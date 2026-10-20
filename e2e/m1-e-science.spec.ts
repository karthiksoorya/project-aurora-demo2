import { expect, openApp, test } from './support/fixtures';

const FORBIDDEN = [/\bIFRA\s*(compliant|pass)/i, /\bCompliant\b/, /\b\d+\s*\/\s*10\b/, /\b7[–-]9\s*hrs\b/];

test.describe('M1 · scientific honesty (A7, A8)', () => {
  test('natural oil shows constituents (no single structure); compound shows sourced structure', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('nav-ingredients').click();
    await page.getByTestId('tab-list').click();
    await page.getByTestId('row-bergamot-eo').click();
    await expect(page.getByTestId('detail-kind')).toHaveText('Natural mixture');
    await page.getByTestId('detail-tab-composition').click();
    await expect(page.getByTestId('mixture-policy')).toContainText('no single molecular structure');
    await expect(page.getByTestId('constituents')).toContainText('Limonene');
    await expect(page.getByTestId('ingredient-detail').getByTestId('molecule-canvas')).toHaveCount(0);

    // jump from constituent to the Formula Studio inspector (FS-MI2 breadcrumb)
    await page.getByTestId('inspect-Limonene').click();
    await expect(page.getByTestId('mi-breadcrumb')).toContainText('Bergamot EO');
    await expect(page.getByTestId('mi-breadcrumb')).toContainText('Limonene');
    await expect(page.getByTestId('molecule-canvas')).toBeVisible();
    await expect(page.getByTestId('mi-provenance')).toContainText('cmp-limonene');
    await expect(page.getByTestId('mi-provenance')).toContainText('Formula from SMILES matches fixture');
    await page.getByTestId('molecule-2d').click();
    await expect(page.getByTestId('molecule-svg')).toBeVisible();

    // a single compound without a curated fixture shows no structure
    await page.getByTestId('nav-ingredients').click();
    await page.getByTestId('tab-list').click();
    await page.getByTestId('row-iso-e-super').click();
    await page.getByTestId('detail-tab-composition').click();
    await expect(page.getByTestId('no-structure')).toContainText('no curated structure');
  });

  test('regulatory / safety fields are “Not assessed” and no success claims appear anywhere', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('nav-ingredients').click();
    await page.getByTestId('tab-list').click();
    await page.getByTestId('row-limonene').click();
    await page.getByTestId('detail-tab-safety').click();
    await expect(page.getByTestId('detail-safety')).toContainText('Not assessed');
    await expect(page.getByTestId('detail-safety')).toContainText('does not infer compliance');
    for (const ws of ['concept', 'ingredients', 'formula', 'validation', 'experiments', 'review']) {
      await page.getByTestId(`nav-${ws}`).click();
      await page.waitForTimeout(300);
      const text = await page.locator('main').innerText();
      for (const re of FORBIDDEN) expect(text, `${ws} must not show ${re}`).not.toMatch(re);
    }
    await page.getByTestId('nav-formula').click();
    await expect(page.getByTestId('key-properties')).toContainText('Not assessed');
  });
});
