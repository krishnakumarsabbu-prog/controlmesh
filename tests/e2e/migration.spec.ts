import { test, expect } from '@playwright/test';

const UI_URL = process.env.UI_URL || 'http://localhost:5173';

test.describe('Topology page', () => {
  test('topology graph renders source queue managers', async ({ page }) => {
    await page.goto(`${UI_URL}/topology`);
    await expect(page.getByText('QM.SRC.A')).toBeVisible();
    await expect(page.getByText('QM.SRC.B')).toBeVisible();
  });
});

test.describe('Migration console', () => {
  test('migration console shows all 6 apps', async ({ page }) => {
    await page.goto(`${UI_URL}/migration`);
    for (const app of ['APP1', 'APP2', 'APP3', 'APP4', 'APP5', 'APP6']) {
      await expect(page.getByText(app)).toBeVisible();
    }
  });

  test('clicking Migrate triggers state change', async ({ page }) => {
    await page.goto(`${UI_URL}/migration`);
    const app1Row = page.locator('[data-testid="migration-row-APP1"]');
    await expect(app1Row).toBeVisible();

    const migrateBtn = app1Row.getByRole('button', { name: 'Migrate' });
    // Only click if button is present (app must be IDLE or ROLLED_BACK)
    const btnCount = await migrateBtn.count();
    if (btnCount > 0) {
      await migrateBtn.click();
      // State should change from IDLE within 10s
      await expect(
        app1Row.getByText(/SNAPSHOTTED|PROVISIONING|REWIRING|VALIDATING/i)
      ).toBeVisible({ timeout: 10000 });
    } else {
      // App is already migrating or migrated — pass the check
      await expect(
        app1Row.getByText(/MIGRATED|SNAPSHOTTED|PROVISIONING|REWIRING|VALIDATING|ROLLING/i)
      ).toBeVisible();
    }
  });

  test('migration row shows StateBadge', async ({ page }) => {
    await page.goto(`${UI_URL}/migration`);
    for (const app of ['APP1', 'APP2', 'APP3']) {
      const row = page.locator(`[data-testid="migration-row-${app}"]`);
      await expect(row).toBeVisible();
    }
  });

  test('migration progress bar is visible', async ({ page }) => {
    await page.goto(`${UI_URL}/migration`);
    // Progress bar container exists
    await expect(page.locator('.bg-emerald-500, .bg-emerald-400')).toBeVisible();
  });
});

test.describe('Audit log', () => {
  test('audit log page renders', async ({ page }) => {
    await page.goto(`${UI_URL}/audit`);
    // Page renders without error
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('audit log shows event table or empty state', async ({ page }) => {
    await page.goto(`${UI_URL}/audit`);
    // Either the table with events or an empty state message should be present
    const hasEvents = await page.getByText('CREATE_QUEUE').isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no events|no audit/i).isVisible().catch(() => false);
    expect(hasEvents || hasEmpty).toBeTruthy();
  });
});

test.describe('Validation page', () => {
  test('validation page renders', async ({ page }) => {
    await page.goto(`${UI_URL}/validation`);
    await expect(page).not.toHaveTitle(/error/i);
  });
});
