import { test, expect } from '@playwright/test';
for (const format of ['object', 'string']) test(`retained ${format} display is inactive without CSS and restores on activation`, async ({ page }) => {
  await page.goto('/tests/fixtures/retained-panels.html'); const panel = page.locator(`#${format}`);
  await expect(panel).toBeHidden(); await expect(panel).toHaveAttribute('inert', ''); await expect(panel).toHaveCSS('display', 'none');
  await page.getByRole('button', { name: 'Toggle activity' }).click(); await expect(panel).toBeVisible(); await expect(panel).toHaveCSS('display', format === 'object' ? 'grid' : 'flex');
  await panel.getByRole('textbox').fill('retained draft'); await page.getByRole('button', { name: 'Toggle activity' }).click(); await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Toggle activity' }).click(); await expect(panel.getByRole('textbox')).toHaveValue('retained draft');
});
