import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const auditDirectory = process.env.VISUAL_AUDIT_DIR;
const mascotPath = resolve(process.cwd(), 'public/tokencanvas-hero.png');

async function capture(page: Page, testInfo: TestInfo, name: string, fullPage = true) {
  await page.evaluate(() => document.fonts.ready);
  const body = await page.screenshot({ fullPage, animations: 'disabled' });

  if (auditDirectory) {
    await mkdir(auditDirectory, { recursive: true });
    await writeFile(resolve(auditDirectory, `${name}.png`), body);
  }

  await testInfo.attach(name, { body, contentType: 'image/png' });
}

async function mockModelDiscovery(page: Page) {
  await page.route('**/api/openai/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'gpt-image-2', object: 'model', owned_by: 'openai' },
          { id: 'gpt-image-1.5', object: 'model', owned_by: 'openai' },
          { id: 'gpt-image-1', object: 'model', owned_by: 'openai' },
        ],
      }),
    });
  });
}

async function openConnectionSettings(page: Page) {
  await page.getByRole('button', { name: '连接设置', exact: true }).click();
  return page.getByRole('dialog', { name: '连接图像模型' });
}

async function configureMockModel(page: Page) {
  const dialog = await openConnectionSettings(page);
  await dialog.getByLabel('OpenAI API key').fill('sk-visual-audit');
  await dialog.getByLabel('手动模型 ID').fill('gpt-image-2');
  await dialog.getByRole('button', { name: '保存 OpenAI 设置' }).click();
  await dialog.getByRole('button', { name: '关闭连接设置' }).click();
}

test.describe('visual interaction audit', () => {
  test.describe.configure({ mode: 'serial' });

  test('captures desktop creation and configuration states', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await mockModelDiscovery(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    page.setDefaultTimeout(10_000);
    await page.goto('/');

    await capture(page, testInfo, '01-desktop-empty');

    await page.getByRole('button', { name: '图生图' }).hover();
    await capture(page, testInfo, '02-desktop-mode-hover', false);

    await page.getByRole('button', { name: '图生图' }).click();
    await capture(page, testInfo, '03-desktop-image-mode-empty');

    await page.locator('input[type="file"][multiple]').setInputFiles(mascotPath);
    await capture(page, testInfo, '04-desktop-image-mode-with-material');

    await page.getByRole('button', { name: '遮罩编辑' }).click();
    await page.locator('input[type="file"]:not([multiple])').setInputFiles(mascotPath);
    await capture(page, testInfo, '05-desktop-mask-mode');

    await page.reload();
    const composer = page.getByLabel('创作配方编辑器');
    await composer.getByRole('button', { name: /^尺寸 / }).click();
    await capture(page, testInfo, '06-desktop-size-dropdown', false);
    await page.getByRole('option', { name: /1536 x 1024/ }).click();

    await composer.getByRole('button', { name: /^质量 / }).click();
    await capture(page, testInfo, '07-desktop-quality-dropdown', false);
    await page.getByRole('option', { name: /快速/ }).click();

    await composer.locator('.generation-controls__advanced > summary').click();
    await capture(page, testInfo, '08-desktop-more-settings');

    const dialog = await openConnectionSettings(page);
    await capture(page, testInfo, '09-desktop-connection-drawer', false);
    await dialog.getByLabel('OpenAI API key').fill('sk-visual-audit');
    await dialog.getByRole('button', { name: '拉取模型' }).click();
    await dialog.getByRole('button', { name: /图片模型/ }).click();
    await capture(page, testInfo, '10-desktop-model-dropdown', false);
    await page.getByRole('option', { name: /GPT Image 2/ }).click();
    await dialog.locator('details.settings-disclosure > summary').click();
    await capture(page, testInfo, '11-desktop-advanced-connection', false);
    await dialog.getByRole('button', { name: '关闭连接设置' }).click();

    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '配方' }).click();
    await capture(page, testInfo, '12-desktop-library-empty');
    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '创作' }).click();
    await page.getByRole('button', { name: '暂时隐藏引导' }).click();
    await capture(page, testInfo, '13-desktop-guide-hidden');
  });

  test('captures generation, result, preview, history and error states', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const mascotBase64 = (await readFile(mascotPath)).toString('base64');
    await mockModelDiscovery(page);
    page.setDefaultTimeout(10_000);
    await page.route('**/api/openai/images/generations', async (route) => {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 900));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ created: 1, data: [{ b64_json: mascotBase64 }] }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await configureMockModel(page);
    await page.getByLabel('画面描述').fill('纸船载着一颗发光的种子，童话绘本，暖色纸张纹理');
    await page.getByRole('button', { name: '生成图片' }).click();
    await expect(page.getByText('正在生成图片')).toBeVisible();
    await capture(page, testInfo, '14-desktop-generating', false);

    await expect(page.getByText('生成完成，共得到 1 张图片。')).toBeVisible();
    await capture(page, testInfo, '15-desktop-result-success');

    await page.getByRole('button', { name: '预览', exact: true }).click();
    await capture(page, testInfo, '16-desktop-result-preview', false);
    await page.getByRole('dialog', { name: '结果预览' }).getByRole('button', { name: '关闭', exact: true }).click();

    await page.getByRole('button', { name: '继续创作' }).click();
    await capture(page, testInfo, '17-desktop-continue-with-material');

    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '配方' }).click();
    await page.getByLabel('新配方名称').fill('发光种子');
    await page.getByRole('button', { name: '保存当前创作配方' }).click();
    await capture(page, testInfo, '18-desktop-recipe-and-history');

    await page.unroute('**/api/openai/images/generations');
    await page.route('**/api/openai/images/generations', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Unsupported visual audit parameter' } }),
      });
    });
    await page.reload();
    await page.getByLabel('画面描述').fill('错误恢复状态');
    await page.getByRole('button', { name: '生成图片' }).click();
    await expect(page.getByRole('heading', { name: '这次创作没有成功' })).toBeVisible();
    await capture(page, testInfo, '19-desktop-generation-error');
  });

  test('captures mobile and tablet states', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    page.setDefaultTimeout(10_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await capture(page, testInfo, '20-mobile-empty');

    await page.getByRole('button', { name: '图生图' }).click();
    await capture(page, testInfo, '21-mobile-image-mode');

    await page.reload();
    await page.getByLabel('创作配方编辑器').locator('.generation-controls__advanced > summary').click();
    await capture(page, testInfo, '22-mobile-more-settings');

    await page.getByRole('button', { name: '打开模型连接设置' }).click();
    await capture(page, testInfo, '23-mobile-connection-drawer', false);
    await page.getByRole('button', { name: '关闭连接设置', exact: true }).click();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await capture(page, testInfo, '24-mobile-guide-bottom', false);

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await capture(page, testInfo, '25-tablet-empty');

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
