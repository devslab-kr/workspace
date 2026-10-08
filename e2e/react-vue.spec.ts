import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const framework of ['react', 'vue']) {
  test(`${framework}: retains instances, suspends active effects, unmounts closed pages`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`/tests/fixtures/react-vue.html?framework=${framework}`);
    await expect(page.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('textbox').fill('retained work');
    await page.getByRole('button', { name: 'Beta', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    const inactive = page.locator('[data-workspace-part="panel"][hidden]'); await expect(inactive).toHaveAttribute('inert', '');
    await page.getByRole('tab', { name: 'Alpha' }).click();
    await expect(page.getByRole('textbox')).toHaveValue('retained work');
    await expect.poll(() => page.evaluate(() => (window as any).adapterEvents.mounted)).toBe(2);
    await expect.poll(() => page.evaluate(() => (window as any).adapterEvents.inactive)).toBe(2);
    await page.getByRole('button', { name: 'Close Beta', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).adapterEvents.cleaned)).toBe(1);
    expect(errors).toEqual([]);
  });
  test(`${framework}: manual activation and modal keyboard trap/restore`, async ({ page }) => {
    await page.goto(`/tests/fixtures/react-vue.html?framework=${framework}`);
    await page.getByRole('button', { name: 'Beta', exact: true }).click();
    const beta = page.getByRole('tab', { name: 'Beta' }); await beta.focus(); await beta.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Alpha' })).toBeFocused(); await expect(beta).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter'); await expect(page.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    const trigger = page.getByRole('button', { name: 'Switch screens', exact: true }); await trigger.click();
    const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await expect(dialog.getByRole('button', { name: 'Alpha', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', { name: 'Close switcher' })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
  test(`${framework}: reset reopens a fresh page and ambient RTL updates keyboard direction`, async ({ page }) => {
    await page.goto(`/tests/fixtures/react-vue.html?framework=${framework}`);
    await expect(page.getByRole('textbox')).toBeVisible(); await page.getByRole('textbox').fill('old identity');
    await page.evaluate(async () => { const api = (window as any).adapterController; api.reset(); await api.open('a'); });
    await expect(page.getByRole('textbox')).toHaveValue('');
    await expect.poll(() => page.evaluate(() => (window as any).adapterEvents.cleaned)).toBe(1);
    await page.getByRole('button', { name: 'Beta', exact: true }).click();
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    await expect(page.locator('[data-workspace-part="root"]')).toHaveAttribute('dir', 'rtl');
    const beta = page.getByRole('tab', { name: 'Beta' }); await beta.focus(); await beta.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Alpha' })).toBeFocused(); await expect(beta).toHaveAttribute('aria-selected', 'true');
  });  test(`${framework}: pending and denied activation never change the selected tab`, async ({ page }) => {
    await page.goto(`/tests/fixtures/react-vue.html?framework=${framework}`);
    await page.getByRole('button', { name: 'Beta', exact: true }).click();
    await page.evaluate(() => { (window as any).adapterGuard = () => new Promise(resolve => { (window as any).resolveAdapterGuard = resolve; }); });
    await page.getByRole('tab', { name: 'Alpha' }).click();
    await expect(page.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false');
    await page.evaluate(() => (window as any).resolveAdapterGuard(false));
    await expect(page.getByRole('status')).toHaveText('Screen transition cancelled');
    await expect(page.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
  });  test(`${framework}: denied and failed switcher choices report inside the modal`, async ({ page }) => {
    await page.goto(`/tests/fixtures/react-vue.html?framework=${framework}`);
    await page.getByRole('button', { name: 'Beta', exact: true }).click();
    await page.getByRole('button', { name: 'Switch screens', exact: true }).click();
    const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
    await page.evaluate(() => { (window as any).adapterGuard = () => false; });
    await dialog.getByRole('button', { name: 'Alpha', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('Screen transition cancelled'); await expect(dialog).toBeVisible();
    await expect(page.locator('[data-workspace-part="status"]')).toBeHidden();
    await page.evaluate(() => { (window as any).adapterGuard = () => Promise.reject(new Error('App-owned failure')); });
    await dialog.getByRole('button', { name: 'Alpha', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('Screen transition failed'); await expect(dialog).toBeVisible();
  });  test(`${framework}: inactive panels stay hidden under custom display styles`, async ({ page }) => {
    await page.goto(`/tests/fixtures/react-vue.html?framework=${framework}`);
    await page.addStyleTag({ content: '[data-workspace-part="panel"] { display: flex; }' });
    await page.getByRole('textbox').fill('custom retained');
    await page.getByRole('button', { name: 'Beta', exact: true }).click();
    const inactive = page.locator('[data-workspace-part="panel"][hidden]');
    await expect(inactive).toBeHidden(); await expect(inactive).toHaveCSS('display', 'none');
    await expect(page.locator('[data-workspace-part="panel"]:not([hidden])')).toBeVisible();
    await page.getByRole('tab', { name: 'Alpha' }).click(); await expect(page.getByRole('textbox')).toHaveValue('custom retained');
  });}
