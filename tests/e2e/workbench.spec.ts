import { expect, test } from '@playwright/test';

test('renders the workbench shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'AI 产图工作台' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '创作主台' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '连接与模型' })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始生成' })).toBeVisible();
});
