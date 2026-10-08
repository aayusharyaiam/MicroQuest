import { expect, test } from '@playwright/test';

test('beginner lesson → quiz → code puzzle saves grouped progress across reloads', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true });
  await page.getByRole('button', { name: 'Start my journey' }).click();
  await expect(page.getByRole('heading', { name: 'Your first conversation with a CPU' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark read & take quiz' }).click();
  await page.getByRole('button', { name: /Translates assembly into machine code/ }).click();
  await page.getByRole('button', { name: /A small, fast storage location/ }).click();
  await page.getByRole('button', { name: /To stop execution/ }).click();
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.getByRole('status')).toContainText('3/3 correct');
  await page.getByRole('button', { name: 'Next: code puzzle' }).click();
  await page.getByLabel('Code blank 1').fill('mvi'); await page.getByLabel('Code blank 2').fill('hlt');
  await page.getByRole('button', { name: 'Check puzzle' }).click(); await expect(page.getByRole('status')).toContainText('Exactly right');
  await page.goto('/#progress'); await expect(page.locator('.group-card').filter({ hasText: 'Foundations' })).toContainText('1/3 completed');
  await page.reload(); await expect(page.locator('.group-card').filter({ hasText: 'Quiz mastery' })).toContainText('1/11 completed');
  await expect(page.locator('.progress-overview')).toContainText('105 XP');
});
test('lab program runs, validates output, and persists its editor draft', async ({ page }) => {
  await page.goto('/#lab/lab-02');
  await page.getByRole('button', { name: 'View worked solution' }).click();
  await page.getByRole('button', { name: 'Load solution into editor' }).click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByRole('button', { name: 'Check outputs' }).click();
  await expect(page.getByRole('status')).toContainText('All expected outputs match');
  await page.reload(); await expect(page.getByLabel('8085 assembly code')).toHaveValue(/LXI D, 2408H/);
  await expect(page.locator('.page-heading')).toContainText('Completed');
});
test('8086 simulator runs a word program and instruction search exposes hardware limits', async ({ page }) => {
  await page.goto('/#playground'); await page.getByRole('button', { name: '8086 16-bit' }).click();
  await page.getByLabel('8086 assembly code').fill('MOV AX, 7FFFH\nADD AX, 1\nMOV [3000H], AX\nHLT');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.locator('.register').filter({ hasText: 'AX' })).toContainText('8000');
  await page.getByLabel('Memory start address').fill('3000H'); await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page.getByLabel('Memory 3001H')).toHaveValue('80');
  await page.goto('/#reference'); await page.getByLabel('Search instructions').fill('IRET');
  await expect(page.locator('.instruction-row')).toHaveCount(1); await page.locator('.instruction-main').click();
  await expect(page.locator('.instruction-detail')).toContainText('IRET restores flags');
});
test('backup export/import transfers progress between separate browser contexts', async ({ browser }) => {
  const first = await browser.newContext(); const second = await browser.newContext();
  const a = await first.newPage(); const b = await second.newPage();
  await a.goto('/#lesson/8085-hello'); await a.getByRole('button', { name: 'Mark read & take quiz' }).click();
  await a.goto('/#progress');
  const downloadPromise = a.waitForEvent('download'); await a.getByRole('button', { name: 'Export', exact: true }).click();
  const backup = await downloadPromise; const path = await backup.path();
  await b.goto('/#progress'); await b.locator('input[type=file]').setInputFiles(path!);
  await expect(b.getByRole('status')).toContainText('Backup imported');
  await expect(b.locator('.group-card').filter({ hasText: 'Foundations' })).toContainText('1/3 completed');
  await first.close(); await second.close();
});
test('mobile navigation, account setup explanation, and layout work without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('mobile-overview.png'), fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click(); await page.getByRole('button', { name: 'Learning roadmap', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Zero confusion. A real roadmap.' })).toBeVisible();
  await page.getByRole('button', { name: 'Sync progress', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Cross-device sync is ready to connect once Firebase is configured');
  await page.getByRole('button', { name: 'Close account dialog' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
