import { expect, test } from '@playwright/test';

test('shows empty history and preset sections on first visit', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '最近历史' })).toBeVisible();
  await expect(page.getByText('暂时还没有历史记录。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '预设模板' })).toBeVisible();
  await expect(page.getByText('还没有保存模板。')).toBeVisible();
});
