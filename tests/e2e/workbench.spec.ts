import { expect, test } from '@playwright/test';

test('renders the workbench shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'TokenCanvas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '创作下一轮' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '当前结果' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OpenAI 设置', exact: true })).toBeVisible();
  await expect(page.getByLabel('OpenAI API key')).toBeVisible();
  await expect(page.getByText('高级连接设置')).toBeVisible();
  await expect(page.getByRole('button', { name: '生成图片' })).toBeVisible();
});

test('fetches image models and uses custom dropdown controls', async ({ page }) => {
  await page.route('https://api.openai.com/v1/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'gpt-5.5', object: 'model', owned_by: 'openai' },
          { id: 'gpt-image-2', object: 'model', owned_by: 'openai' },
        ],
      }),
    });
  });

  await page.goto('/');

  await page.getByLabel('OpenAI API key').fill('sk-test');
  await page.getByLabel('OpenAI 创作控制条').getByRole('button', { name: '拉取模型' }).click();
  await expect(page.getByText('已发现 2 个图片模型。')).toBeVisible();

  await page.getByRole('button', { name: /图片模型/ }).click();
  await page.getByRole('option', { name: /GPT Image 2/ }).click();
  await expect(page.getByLabel('手动模型 ID')).toHaveValue('gpt-image-2');

  await page.getByRole('button', { name: /^尺寸 / }).click();
  await page.getByRole('option', { name: /1536 x 1024/ }).click();
  await expect(page.locator('select')).toHaveCount(0);
});
