import { expect, test } from '@playwright/test';

test('renders the workbench shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'AI 出图工作台' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '当前结果' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '创作下一轮' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OpenAI 设置', exact: true })).toBeVisible();
  await expect(page.getByLabel('OpenAI API key')).toBeVisible();
  await expect(page.getByRole('button', { name: '生成图片' })).toBeVisible();
});
