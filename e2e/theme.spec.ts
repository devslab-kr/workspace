import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

test('DDS token mapping themes retained pages and the body-portalled switcher', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
  await page.addStyleTag({ content: `:root {
    --dds-color-bg-subtle:#18181b; --dds-color-bg-elevated:#18181b;
    --dds-color-text-primary:#fafafa; --dds-color-border-default:#3f3f46;
    --dds-color-bg-brand:#06b6d4; --dds-color-text-on-brand:#09090b;
    --dds-color-border-focus:#22d3ee; --dds-color-overlay-dim:#00000040;
    --dds-radius-xl:16px; --dds-elevation-3:0 12px 32px #0003;
    --dds-font-family-sans:system-ui,sans-serif;
  }\n${readFileSync(new URL('../src/dds.css', import.meta.url), 'utf8').replace(':root{', '.demo-shell[data-theme],html[data-demo-theme] .workspace-switcher{')}` });
  await expect(page.getByRole('tab', { name: 'Orders' })).toHaveCSS('background-color', 'rgb(6, 182, 212)');
  await expect(page.getByRole('tab', { name: 'Orders' })).toHaveCSS('color', 'rgb(9, 9, 11)');
  await page.getByRole('button', { name: 'Open screens', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(24, 24, 27)');
  await expect(page.getByRole('dialog')).toHaveCSS('color', 'rgb(250, 250, 250)');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
