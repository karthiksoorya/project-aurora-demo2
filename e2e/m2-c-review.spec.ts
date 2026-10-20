import { apiAs, USERS } from './support/demo-data';
import { COASTAL_AIR_ID, expect, openApp, test } from './support/fixtures';
import type { Page } from '@playwright/test';

async function actAs(page: Page, initials: 'SP' | 'PD' | 'RA' | 'MK') {
  await page.getByTestId('user-switcher').click();
  await page.getByTestId(`act-as-${initials}`).click();
  await expect(page.getByTestId('user-switcher')).toContainText(
    { SP: 'Senior Perfumer', PD: 'Product Development', RA: 'Regulatory Affairs', MK: 'Marketing' }[initials],
  );
}

/** Journeys 4 + 5: review workflow, permission checks, audit trail (A10, A11). */
test.describe('M2 · Share & Review', () => {
  test('J4 owner requests review; commenter comments; approver approves; audit records it', async ({
    page,
    request,
  }) => {
    test.setTimeout(150_000);
    const o = apiAs(request, USERS.owner);
    const sfx = Date.now() % 100000;
    const d = await o.get(`/projects/${COASTAL_AIR_ID}/formula-draft`);
    const v = await o.post(`/projects/${COASTAL_AIR_ID}/formula-versions`, {
      expectedDraftRevision: d.revision,
      versionLabel: `REV-${sfx}`,
    });

    await openApp(page);
    await page.getByTestId('nav-review').click();
    await page.getByTestId('request-review').click();
    await page.getByTestId('rq-version').selectOption(v.id);
    await page.getByTestId('rq-title').fill(`Sign-off ${sfx}`);
    await page.getByTestId('rq-perm-PD').selectOption('approve');
    await page.getByTestId('rq-perm-RA').selectOption('comment');
    await page.getByTestId('rq-submit').click();
    await expect(page.getByTestId('sr-feedback')).toContainText(`Sign-off ${sfx}`);
    await expect(page.getByTestId('sr-feedback')).toContainText(`REV-${sfx}`);
    await expect(page.getByTestId('decision-locked')).toContainText('cannot approve their own');

    // commenter
    await actAs(page, 'RA');
    await expect(page.getByTestId('readonly-banner')).toBeVisible();
    await page.getByTestId('sr-tab-feedback').click();
    await page.getByTestId('comment-text').fill('Please attach supplier CoA for bergamot.');
    await page.getByTestId('comment-post').click();
    await expect(page.getByTestId('sr-comments')).toContainText('supplier CoA');
    await expect(page.getByTestId('decision-locked')).toContainText('do not have approval permission');

    // approver
    await actAs(page, 'PD');
    await page.getByTestId('sr-tab-feedback').click();
    await page.getByTestId('decision-reason').fill('Brighter top works');
    await page.getByTestId('decide-approve').click();
    await expect(page.getByTestId('sr-feedback')).toContainText('Approved');

    // audit trail, filtered, shows who did what on this version
    await page.getByTestId('sr-tab-audit').click();
    await page.getByTestId('audit-filter').selectOption('review.');
    const audit = page.getByTestId('sr-audit');
    await expect(audit).toContainText('review.requested');
    await expect(audit).toContainText('review.commented');
    await expect(audit).toContainText('review.decision');
    await expect(audit).toContainText('Regulatory Affairs');
    await expect(audit).toContainText(`REV-${sfx}`);
    await actAs(page, 'SP');
  });

  test('J5 viewer is read-only everywhere; API refuses viewer writes', async ({ page, request }) => {
    const reviews = await apiAs(request, USERS.owner).get(`/projects/${COASTAL_AIR_ID}/reviews`);
    expect(reviews.length).toBeGreaterThan(0);
    await openApp(page);
    await actAs(page, 'MK');
    await expect(page.getByTestId('my-role')).toContainText('Viewer');
    await expect(page.getByTestId('readonly-banner')).toContainText('read-only');
    await page.getByTestId('nav-review').click();
    await expect(page.getByTestId('request-review')).toBeDisabled();
    await page.getByTestId('sr-tab-feedback').click();
    await expect(page.getByTestId('comment-readonly')).toContainText('Viewers can read reviews');
    await expect(page.getByTestId('comment-form')).toHaveCount(0);
    await page.getByTestId('nav-formula').click();
    await expect(page.getByTestId('qty-bergamot-eo')).toHaveAttribute('readonly', '');
    await expect(page.getByTestId('save-version')).toBeDisabled();
    await page.getByTestId('nav-validation').click();
    await expect(page.getByTestId('run-validation')).toBeDisabled();

    const mk = apiAs(request, USERS.mk);
    expect((await mk.raw.post(`/reviews/${reviews[0].id}/comments`, { comment: 'hi' })).status()).toBe(403);
    expect((await mk.raw.post(`/reviews/${reviews[0].id}/decisions`, { decision: 'approved' })).status()).toBe(403);
    const exps = await mk.get(`/projects/${COASTAL_AIR_ID}/experiments`);
    if (exps.length)
      expect(
        (await mk.raw.post(`/experiments/${exps[0].id}/observations`, { kind: 'observation', text: 'x' })).status(),
      ).toBe(403);
    await actAs(page, 'SP');
    await expect(page.getByTestId('readonly-banner')).toHaveCount(0);
  });
});
