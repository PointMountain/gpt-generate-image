import { expect, test } from '@playwright/test';

test('renders the workbench shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '造境' })).toBeVisible();
  await expect(page).toHaveTitle('造境｜AI 图片创作台');
  await expect(page.getByRole('heading', { name: '把想法压进画布' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '三步开始创作' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '连接图像模型' })).toHaveCount(0);

  await page.getByRole('button', { name: '连接设置', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '连接图像模型' });
  await expect(dialog.getByLabel('OpenAI API key')).toBeVisible();
  await expect(dialog.getByText('高级连接设置')).toBeVisible();
  await expect(page.getByRole('button', { name: '生成图片' })).toBeVisible();
});

test('fetches image models and uses custom dropdown controls', async ({ page }) => {
  let modelRequestHeaders: Record<string, string> | undefined;

  await page.route('**/api/openai/models', async (route) => {
    modelRequestHeaders = route.request().headers();
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

  await page.getByRole('button', { name: '连接设置', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '连接图像模型' });
  await dialog.getByLabel('OpenAI API key').fill('sk-test');
  await dialog.getByRole('button', { name: '拉取模型' }).click();
  await expect(page.getByText('已发现 1 个图片模型，已选择 gpt-image-2。')).toBeVisible();
  expect(modelRequestHeaders?.authorization).toBe('Bearer sk-test');
  expect(modelRequestHeaders?.['x-openai-base-url']).toBe('https://codex.pingchela.xyz/v1');
  expect(modelRequestHeaders?.['x-openai-use-proxy']).toBe('true');

  await expect(dialog.getByLabel('手动模型 ID')).toHaveValue('gpt-image-2');

  await dialog.getByRole('button', { name: '关闭连接设置' }).click();

  await page.getByLabel('创作配方编辑器').getByRole('button', { name: /^尺寸 / }).click();
  await page.getByRole('option', { name: /1536 x 1024/ }).click();
  await expect(page.locator('select')).toHaveCount(0);
});
