import { expect, test } from '@playwright/test';

test('shows empty history and preset sections on first visit', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '配方' }).click();

  await expect(page.getByRole('heading', { name: '创作历史' })).toBeVisible();
  await expect(page.getByText('暂时还没有创作历史，生成后的作品会出现在这里。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '创作配方' })).toBeVisible();
  await expect(page.getByText('还没有保存创作配方，命名后即可把当前设置保存下来。')).toBeVisible();
});

test('applies a legacy history recipe without crashing the creation workbench', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('gpt-image-workbench-history', 1);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('history')) {
          request.result.createObjectStore('history', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('history', 'readwrite');
        transaction.objectStore('history').put({
          id: 'legacy-history',
          modelId: 'gpt-image-1',
          prompt: '从旧历史恢复的纸艺小猫',
          size: '1024x1024',
          count: 1,
          quality: 'high',
          mode: 'reference',
          images: [],
          createdAt: '2026-04-27T12:00:00.000Z',
        });
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
      };
    });
  });
  await page.reload();

  await page.getByRole('button', { name: /历史 1/ }).click();
  await page.getByRole('button', { name: '应用创作配方' }).click();

  await expect(page.getByRole('heading', { name: '把想法压进画布' })).toBeVisible();
  await expect(page.getByLabel('画面描述')).toHaveValue('从旧历史恢复的纸艺小猫');
  expect(pageErrors).toEqual([]);
});
