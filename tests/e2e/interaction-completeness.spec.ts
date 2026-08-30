import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const outputDirectory = process.env.INTERACTION_AUDIT_DIR;
const mascotPath = resolve(process.cwd(), 'public/tokencanvas-hero.png');

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const body = await page.screenshot({ fullPage: true, animations: 'disabled' });

  if (outputDirectory) {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(resolve(outputDirectory, `${name}.png`), body);
  }

  await testInfo.attach(name, { body, contentType: 'image/png' });
}

async function configureGeneration(page: Page) {
  await page.getByRole('button', { name: '连接设置', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '连接图像模型' });
  await dialog.getByLabel('OpenAI API key').fill('sk-interaction-audit');
  await dialog.getByLabel('手动模型 ID').fill('gpt-image-2');
  await dialog.getByRole('button', { name: '保存 OpenAI 设置' }).click();
  await dialog.getByRole('button', { name: '关闭连接设置' }).click();
}

async function generateOneResult(page: Page) {
  const mascotBase64 = (await readFile(mascotPath)).toString('base64');
  await page.route('**/api/openai/images/generations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ created: 1, data: [{ b64_json: mascotBase64 }] }),
    });
  });

  await page.getByLabel('画面描述').fill('纸艺小猫坐在蓝色纸船里');
  await page.getByRole('button', { name: '生成图片' }).click();
  await expect(page.getByText('生成完成，共得到 1 张图片。')).toBeVisible();
}

test('use guide plays the real video, exposes registration, and restores focus', async ({ page }, testInfo) => {
  await page.goto('/');
  const guideTrigger = page.getByRole('button', { name: '观看 1 分 17 秒使用指南' });

  await capture(page, testInfo, '00-guide-entry-desktop');
  await guideTrigger.click();
  const dialog = page.getByRole('dialog', { name: '使用指南' });
  const video = dialog.getByLabel('中转站与绘图平台使用指南');
  const registrationLink = dialog.getByRole('link', { name: '打开链接，获取 API Key' });
  const copyLinkButton = dialog.getByRole('button', { name: '复制注册链接' });

  await expect(dialog.getByRole('button', { name: '关闭使用指南', exact: true })).toBeFocused();
  await expect(dialog.getByRole('heading', { name: '1 分 17 秒完成首次连接' })).toBeVisible();
  await expect(video).toHaveAttribute('preload', 'metadata');
  await expect(video).not.toHaveAttribute('autoplay', '');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(1);
  expect(await video.evaluate((element: HTMLVideoElement) => element.duration)).toBeGreaterThan(77);
  await expect(registrationLink).toHaveAttribute(
    'href',
    'https://codex.pingchela.xyz/register?aff=4L2D7UE2FAM3',
  );
  await expect(registrationLink).toHaveAttribute('target', '_blank');
  await expect(registrationLink).toBeInViewport();
  await expect(copyLinkButton).toBeInViewport();
  await copyLinkButton.click();
  await expect(copyLinkButton).toContainText('已复制');
  await capture(page, testInfo, '00-guide-video-desktop');

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(guideTrigger).toBeFocused();

  await page.setViewportSize({ width: 375, height: 812 });
  await capture(page, testInfo, '00-guide-entry-mobile');
  await guideTrigger.click();
  await expect(dialog).toBeVisible();
  const mobileSheetPosition = await dialog.locator('.guide-video-modal__sheet').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      topGap: bounds.top,
      bottomGap: window.innerHeight - bounds.bottom,
    };
  });
  expect(Math.abs(mobileSheetPosition.topGap - mobileSheetPosition.bottomGap)).toBeLessThanOrEqual(16);
  await capture(page, testInfo, '00-guide-video-mobile');
  await dialog.getByRole('button', { name: '关闭使用指南', exact: true }).click();
  await expect(guideTrigger).toBeFocused();
});

test('result preview owns focus, closes with Escape, and restores the trigger', async ({ page }, testInfo) => {
  await page.goto('/');
  await configureGeneration(page);
  await generateOneResult(page);

  const previewTrigger = page.getByRole('button', { name: '预览', exact: true });
  await previewTrigger.click();
  const dialog = page.getByRole('dialog', { name: '结果预览' });
  await expect(dialog.getByRole('button', { name: '关闭', exact: true })).toBeFocused();
  await capture(page, testInfo, '01-result-preview-open-and-focused');

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(previewTrigger).toBeFocused();
  await capture(page, testInfo, '02-result-preview-closed-by-escape');

  await previewTrigger.click();
  await page.getByRole('button', { name: '关闭结果预览遮罩' }).click({ position: { x: 8, y: 8 } });
  await expect(dialog).toHaveCount(0);
  await expect(previewTrigger).toBeFocused();
  await capture(page, testInfo, '02b-result-preview-closed-by-backdrop');
});

test('deleting a saved recipe requires an inline confirmation', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByLabel('画面描述').fill('低饱和纸艺电影海报');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '配方' }).click();
  await page.getByLabel('新配方名称').fill('纸艺电影感');
  await page.getByRole('button', { name: '保存当前创作配方' }).click();

  const recipe = page.locator('.stack-card').filter({ hasText: '纸艺电影感' });
  await expect(recipe).toBeVisible();
  await capture(page, testInfo, '03-recipe-saved');

  await recipe.getByRole('button', { name: '删除', exact: true }).click();
  await expect(recipe.getByText('确认删除这份配方？')).toBeVisible();
  await capture(page, testInfo, '04-recipe-delete-confirmation');

  await recipe.getByRole('button', { name: '取消删除' }).click();
  await expect(recipe.getByRole('button', { name: '删除', exact: true })).toBeVisible();
  await capture(page, testInfo, '05-recipe-delete-cancelled');

  await recipe.getByRole('button', { name: '删除', exact: true }).click();
  await recipe.getByRole('button', { name: '确认删除' }).click();
  await expect(recipe).toHaveCount(0);
  await capture(page, testInfo, '06-recipe-delete-confirmed');
});

test('deleting a creation round requires an inline confirmation', async ({ page }, testInfo) => {
  await page.goto('/');
  await configureGeneration(page);
  await generateOneResult(page);
  await page.getByRole('button', { name: /历史 1/ }).click();

  const historyCard = page.locator('.stack-card').filter({ hasText: '纸艺小猫坐在蓝色纸船里' });
  await expect(historyCard).toBeVisible();
  await capture(page, testInfo, '07-history-entry-open');

  await historyCard.getByRole('button', { name: '删除', exact: true }).click();
  await expect(historyCard.getByText('确认删除这次创作？')).toBeVisible();
  await capture(page, testInfo, '08-history-delete-confirmation');

  await historyCard.getByRole('button', { name: '取消删除' }).click();
  await expect(historyCard.getByRole('button', { name: '删除', exact: true })).toBeVisible();

  await historyCard.getByRole('button', { name: '删除', exact: true }).click();
  await historyCard.getByRole('button', { name: '确认删除' }).click();
  await expect(historyCard).toHaveCount(0);
  await capture(page, testInfo, '09-history-delete-confirmed');
});

test('connection validation focuses the first field that needs attention', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: '连接设置', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '连接图像模型' });

  await dialog.getByRole('button', { name: '保存 OpenAI 设置' }).click();
  await expect(dialog.getByText('OpenAI API key 不能为空。')).toBeVisible();
  await expect(dialog.getByLabel('OpenAI API key')).toBeFocused();
  await capture(page, testInfo, '10-connection-validation-focus');
});

test('API key stays masked until the user explicitly reveals it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '连接设置', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '连接图像模型' });
  const apiKeyInput = dialog.getByLabel('OpenAI API key');

  await apiKeyInput.fill('sk-visibility-audit');
  await expect(apiKeyInput).toHaveAttribute('type', 'password');

  await dialog.getByRole('button', { name: '显示 API key' }).click();
  await expect(apiKeyInput).toHaveAttribute('type', 'text');
  await expect(apiKeyInput).toHaveValue('sk-visibility-audit');

  await dialog.getByRole('button', { name: '隐藏 API key' }).click();
  await expect(apiKeyInput).toHaveAttribute('type', 'password');
});

test('continue creation carries the result into the next round as input material', async ({ page }, testInfo) => {
  await page.goto('/');
  await configureGeneration(page);
  await generateOneResult(page);

  await page.getByRole('button', { name: '继续创作', exact: true }).click();
  await expect(page.getByText('1 张输入素材', { exact: true })).toBeVisible();
  await expect(page.getByText('结果已加入输入素材。')).toBeVisible();
  await capture(page, testInfo, '11-continue-creation-with-result');
});

test('connection drawer traps keyboard focus on visible controls and closes with Escape', async ({ page }, testInfo) => {
  await page.goto('/');
  const openButton = page.getByRole('button', { name: '连接设置', exact: true });
  await openButton.click();
  const dialog = page.getByRole('dialog', { name: '连接图像模型' });
  const closeButton = dialog.getByRole('button', { name: '关闭连接设置' });
  const advancedSummary = dialog.locator('details.settings-disclosure > summary');

  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(advancedSummary).toBeFocused();
  await capture(page, testInfo, '12-connection-drawer-keyboard-loop');

  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(openButton).toBeFocused();
  await capture(page, testInfo, '13-connection-drawer-closed-by-escape');

  await openButton.click();
  await page.getByRole('button', { name: '关闭连接设置遮罩' }).click({ position: { x: 8, y: 8 } });
  await expect(dialog).toHaveCount(0);
  await expect(openButton).toBeFocused();
  await capture(page, testInfo, '13b-connection-drawer-closed-by-scrim');
});

test('generation mode buttons expose their selected state', async ({ page }, testInfo) => {
  await page.goto('/');
  const textMode = page.getByRole('button', { name: '纯文生图' });
  const imageMode = page.getByRole('button', { name: '图生图' });
  const maskMode = page.getByRole('button', { name: '遮罩编辑' });

  await expect(textMode).toHaveAttribute('aria-pressed', 'true');
  await imageMode.click();
  await expect(textMode).toHaveAttribute('aria-pressed', 'false');
  await expect(imageMode).toHaveAttribute('aria-pressed', 'true');
  await capture(page, testInfo, '14-image-mode-selected');

  await maskMode.click();
  await expect(imageMode).toHaveAttribute('aria-pressed', 'false');
  await expect(maskMode).toHaveAttribute('aria-pressed', 'true');
  await capture(page, testInfo, '15-mask-mode-selected');
});

test('downloading a result provides visible success feedback', async ({ page }, testInfo) => {
  await page.goto('/');
  await configureGeneration(page);
  await generateOneResult(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('generated-image-1.png');
  await expect(page.getByText('图片下载已开始。')).toBeVisible();
  await capture(page, testInfo, '16-result-download-feedback');
});

test('gpt-image-2 output controls prevent incompatible format combinations', async ({ page }, testInfo) => {
  await page.goto('/');
  const composer = page.getByLabel('创作配方编辑器');
  await composer.locator('.generation-controls__advanced > summary').click();
  const compression = composer.getByLabel('压缩');

  await expect(compression).toBeDisabled();
  await composer.getByRole('button', { name: /^输出格式 / }).click();
  await page.getByRole('option', { name: 'WEBP', exact: true }).click();
  await expect(compression).toBeEnabled();
  await compression.fill('82');

  await composer.getByRole('button', { name: /^背景 / }).click();
  await page.getByRole('option', { name: '透明', exact: true }).click();
  await expect(composer.getByRole('button', { name: /^背景 透明/ })).toBeVisible();
  await capture(page, testInfo, '17-gpt-image-2-transparent-webp');

  await composer.getByRole('button', { name: /^输出格式 / }).click();
  await page.getByRole('option', { name: 'JPEG', exact: true }).click();
  await expect(composer.getByRole('button', { name: /^背景 自动/ })).toBeVisible();
  await capture(page, testInfo, '18-gpt-image-2-jpeg-normalized');
});

test('saved gpt-image-2 defaults use the same compatible output rules', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: '连接设置', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '连接图像模型' });
  const compression = dialog.getByLabel('默认压缩');

  await expect(dialog.getByRole('button', { name: /^默认质量 高质量/ })).toBeVisible();
  await expect(compression).toBeDisabled();
  await dialog.getByRole('button', { name: /^默认格式 / }).click();
  await page.getByRole('option', { name: 'WEBP', exact: true }).click();
  await expect(compression).toBeEnabled();
  await compression.fill('76');

  await dialog.getByRole('button', { name: /^默认背景 / }).click();
  await page.getByRole('option', { name: '透明', exact: true }).click();
  await dialog.getByRole('button', { name: /^默认格式 / }).click();
  await page.getByRole('option', { name: 'JPEG', exact: true }).click();
  await expect(dialog.getByRole('button', { name: /^默认背景 自动/ })).toBeVisible();
  await capture(page, testInfo, '19-gpt-image-2-compatible-defaults');
});

test('model discovery shows loading, recovery guidance, and a retryable success state', async ({ page }, testInfo) => {
  let releaseFailure: (() => void) | undefined;
  const failureGate = new Promise<void>((resolveFailure) => {
    releaseFailure = resolveFailure;
  });

  await page.route('**/api/openai/models', async (route) => {
    await failureGate;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Provider is warming up' } }),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '连接设置', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '连接图像模型' });
  await dialog.getByLabel('OpenAI API key').fill('sk-model-audit');
  await dialog.getByRole('button', { name: '拉取模型' }).click();
  await expect(dialog.getByRole('button', { name: '拉取中' })).toBeDisabled();
  await capture(page, testInfo, '20-model-discovery-loading');

  releaseFailure?.();
  await expect(dialog.getByRole('alert')).toContainText('OpenAI 模型列表拉取失败');
  await expect(dialog.getByRole('alert')).toContainText('检查 baseURL、API key');
  await capture(page, testInfo, '21-model-discovery-error');

  await page.unroute('**/api/openai/models');
  await page.route('**/api/openai/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'gpt-image-2', object: 'model', owned_by: 'openai' },
          { id: 'gpt-image-1.5', object: 'model', owned_by: 'openai' },
        ],
      }),
    });
  });
  await dialog.getByRole('button', { name: '拉取模型' }).click();
  await expect(page.getByText('已发现 2 个图片模型，已选择 gpt-image-2。')).toBeVisible();
  await dialog.getByRole('button', { name: /^图片模型 / }).click();
  await capture(page, testInfo, '22-model-discovery-retry-success');
});

test('the three-step guide moves focus and can launch a creation round', async ({ page }, testInfo) => {
  const mascotBase64 = (await readFile(mascotPath)).toString('base64');
  await page.route('**/api/openai/images/generations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ b64_json: mascotBase64 }] }),
    });
  });
  await page.goto('/');

  await page.getByRole('button', { name: /连接模型/ }).click();
  const dialog = page.getByRole('dialog', { name: '连接图像模型' });
  await expect(dialog).toBeVisible();
  await capture(page, testInfo, '23-guide-opens-connection');
  await dialog.getByLabel('OpenAI API key').fill('sk-guide-audit');
  await dialog.getByLabel('手动模型 ID').fill('gpt-image-2');
  await dialog.getByRole('button', { name: '保存 OpenAI 设置' }).click();
  await dialog.getByRole('button', { name: '关闭连接设置' }).click();

  await page.getByRole('button', { name: /写好配方/ }).click();
  const prompt = page.getByLabel('画面描述');
  await expect(prompt).toBeFocused();
  await prompt.fill('会发光的纸艺种子漂在夜空里');
  await capture(page, testInfo, '24-guide-focuses-prompt');

  await page.getByRole('button', { name: '暂时隐藏引导' }).click();
  await expect(page.getByRole('button', { name: '打开创作引导' })).toBeVisible();
  await capture(page, testInfo, '25-guide-hidden');
  await page.getByRole('button', { name: '打开创作引导' }).click();

  await page.getByRole('button', { name: /开始生成/ }).click();
  await expect(page.locator('.result-card')).toHaveCount(1);
  await capture(page, testInfo, '26-guide-launches-generation');
});

test('input material and mask actions expose every editable state', async ({ page }, testInfo) => {
  const mascotBuffer = await readFile(mascotPath);
  await page.goto('/');
  await page.getByRole('button', { name: '图生图' }).click();
  await page.locator('input[type="file"][multiple]').setInputFiles(mascotPath);
  await expect(page.getByText('1 张输入素材', { exact: true })).toBeVisible();
  await capture(page, testInfo, '27-input-material-added');

  await page.getByRole('button', { name: '移除', exact: true }).click();
  await expect(page.getByText('选择输入素材')).toBeVisible();
  await capture(page, testInfo, '28-input-material-removed');

  await page.locator('input[type="file"][multiple]').setInputFiles(mascotPath);
  await page.getByRole('button', { name: '遮罩编辑' }).click();
  await page.locator('.composer-panel__controls input[type="file"]').setInputFiles(mascotPath);
  await expect(page.getByText('mask 文件已附加')).toBeVisible();
  await capture(page, testInfo, '29-mask-added');

  await page.getByText('替换 mask', { exact: true }).locator('input[type="file"]').setInputFiles({
    name: 'replacement-mask.png',
    mimeType: 'image/png',
    buffer: mascotBuffer,
  });
  await expect(page.getByText('replacement-mask.png')).toBeVisible();
  await capture(page, testInfo, '30-mask-replaced');

  await page.getByRole('button', { name: '清除', exact: true }).click();
  await expect(page.getByText('选择 mask')).toBeVisible();
  await capture(page, testInfo, '31-mask-cleared');

  await page.getByLabel('画面描述').fill('稍后清空的创作配方');
  await page.getByRole('button', { name: '清空输入' }).click();
  await expect(page.getByLabel('画面描述')).toHaveValue('');
  await expect(page.getByRole('button', { name: '纯文生图' })).toHaveAttribute('aria-pressed', 'true');
  await capture(page, testInfo, '32-composer-cleared');
});

test('cancelling a creation round returns the workbench to an editable state', async ({ page }, testInfo) => {
  let releaseRequest: (() => void) | undefined;
  const requestGate = new Promise<void>((resolveRequest) => {
    releaseRequest = resolveRequest;
  });
  await page.route('**/api/openai/images/generations', async (route) => {
    await requestGate;
    await route.abort('aborted');
  });
  await page.goto('/');
  await configureGeneration(page);
  await page.getByLabel('画面描述').fill('等待取消的纸艺画面');
  await page.getByRole('button', { name: '生成图片' }).click();
  await expect(page.getByText('正在生成图片')).toBeVisible();
  await capture(page, testInfo, '33-generation-in-progress');

  await page.getByRole('button', { name: '取消生成' }).click();
  releaseRequest?.();
  await expect(page.getByText('正在生成图片')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '生成图片' })).toBeEnabled();
  await expect(page.getByText('已取消本次创作轮次。')).toBeVisible();
  await capture(page, testInfo, '34-generation-cancelled');
});

test('custom dropdowns support a complete keyboard selection loop', async ({ page }, testInfo) => {
  await page.goto('/');
  const sizeTrigger = page.getByLabel('创作配方编辑器').getByRole('button', { name: /^尺寸 / });
  await sizeTrigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox', { name: '尺寸' })).toBeFocused();
  await page.keyboard.press('End');
  await capture(page, testInfo, '35-size-dropdown-keyboard-active');
  await page.keyboard.press('Enter');
  await expect(sizeTrigger).toHaveAccessibleName(/2048 x 2048/);
  await expect(sizeTrigger).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox', { name: '尺寸' })).toHaveCount(0);
  await expect(sizeTrigger).toBeFocused();
  await capture(page, testInfo, '36-size-dropdown-keyboard-selected');
});

test('mobile navigation reaches every workbench destination without overlaying content', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: '移动端主导航' });

  await navigation.getByRole('button', { name: '当前' }).click();
  await expect(navigation.getByRole('button', { name: '当前' })).toHaveAttribute('aria-current', 'page');
  await capture(page, testInfo, '37-mobile-current-destination');

  await navigation.getByRole('button', { name: '配方' }).click();
  await expect(page.getByRole('heading', { name: '创作配方' })).toBeVisible();
  await capture(page, testInfo, '38-mobile-recipes-destination');

  await navigation.getByRole('button', { name: '历史' }).click();
  await expect(page.getByRole('heading', { name: '创作历史' })).toBeVisible();
  await capture(page, testInfo, '39-mobile-history-destination');

  await navigation.getByRole('button', { name: '创作' }).click();
  await expect(page.getByRole('heading', { name: '把想法压进画布' })).toBeVisible();
  await capture(page, testInfo, '40-mobile-create-destination');
});

test('history and recipes restore a previous creation through visible actions', async ({ page }, testInfo) => {
  await page.goto('/');
  await configureGeneration(page);
  await generateOneResult(page);
  const prompt = page.getByLabel('画面描述');
  await prompt.fill('一段尚未保存的临时描述');

  await page.getByRole('button', { name: /历史 1/ }).click();
  const historyCard = page.locator('.stack-card').filter({ hasText: '纸艺小猫坐在蓝色纸船里' });
  await historyCard.getByRole('button', { name: '应用创作配方' }).click();
  await expect(prompt).toHaveValue('纸艺小猫坐在蓝色纸船里');
  await capture(page, testInfo, '41-history-restores-creation-recipe');

  await page.getByRole('button', { name: /历史 1/ }).click();
  await historyCard.getByRole('button', { name: '将历史结果 1 加入输入素材' }).click();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '创作' }).click();
  await expect(page.getByText('1 张输入素材', { exact: true })).toBeVisible();
  await capture(page, testInfo, '42-history-result-continues-creation');

  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '配方' }).click();
  await page.getByLabel('新配方名称').fill('纸船小猫');
  await page.getByRole('button', { name: '保存当前创作配方' }).click();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '创作' }).click();
  await prompt.fill('另一份临时描述');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '配方' }).click();
  const recipe = page.locator('.stack-card').filter({ hasText: '纸船小猫' });
  await recipe.getByRole('button', { name: '应用到创作条' }).click();
  await expect(prompt).toHaveValue('纸艺小猫坐在蓝色纸船里');
  await capture(page, testInfo, '43-saved-recipe-restored');
});

test('image history restores its original input after reload and keeps results downloadable', async ({ page }, testInfo) => {
  const mascotBase64 = (await readFile(mascotPath)).toString('base64');
  await page.route('**/api/openai/images/edits', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ b64_json: mascotBase64 }] }),
    });
  });

  await page.goto('/');
  await configureGeneration(page);
  await page.getByRole('button', { name: '图生图' }).click();
  await page.locator('input[type="file"][multiple]').setInputFiles(mascotPath);
  await page.getByLabel('画面描述').fill('保留原图继续创作');
  await page.getByRole('button', { name: '生成图片' }).click();
  await expect(page.getByText('生成完成，共得到 1 张图片。')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /历史 1/ }).click();
  const historyCard = page.locator('.stack-card').filter({ hasText: '保留原图继续创作' });
  await expect(historyCard).toBeVisible();
  await capture(page, testInfo, '50-image-history-with-download');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, testInfo, '51-mobile-image-history-with-download');
  await page.setViewportSize({ width: 1280, height: 720 });

  const downloadPromise = page.waitForEvent('download');
  await historyCard.getByRole('button', { name: '下载历史结果 1' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('generated-image-1.png');

  await historyCard.getByRole('button', { name: '应用创作配方' }).click();
  await expect(page.getByRole('button', { name: '图生图' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('1 张输入素材', { exact: true })).toBeVisible();
  await expect(page.getByAltText('输入素材预览')).toBeVisible();
  await expect(page.getByText('已恢复创作配方和 1 张输入素材。')).toBeVisible();
});

test('generation errors progressively disclose provider details', async ({ page }, testInfo) => {
  await page.route('**/api/openai/images/generations', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Unsupported combination: jpeg + transparent' } }),
    });
  });
  await page.goto('/');
  await configureGeneration(page);
  await page.getByLabel('画面描述').fill('触发可恢复错误的画面');
  await page.getByRole('button', { name: '生成图片' }).click();
  await expect(page.getByRole('heading', { name: '这次创作没有成功' })).toBeVisible();
  await capture(page, testInfo, '44-generation-error-collapsed');

  await page.getByText('展开模型返回详情', { exact: true }).click();
  await expect(page.getByText(/Unsupported combination/)).toBeVisible();
  await capture(page, testInfo, '45-generation-error-expanded');
});

test('compatible endpoint capacity failures explain that the prompt is not at fault', async ({ page }) => {
  await page.route('**/api/openai/images/generations', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'No available compatible accounts' } }),
    });
  });
  await page.goto('/');
  await configureGeneration(page);
  await page.getByLabel('画面描述').fill('不会影响账号池容量的测试画面');
  await page.getByRole('button', { name: '生成图片' }).click();

  const errorCard = page.locator('.generation-error');
  await expect(errorCard).toContainText('兼容端点当前没有可用的图片生成账号。');
  await expect(errorCard).toContainText('这不是画面描述或尺寸造成的');
});

test('advanced connection settings save and reopen with the chosen values', async ({ page }, testInfo) => {
  await page.goto('/');
  const openButton = page.getByRole('button', { name: '连接设置', exact: true });
  await openButton.click();
  let dialog = page.getByRole('dialog', { name: '连接图像模型' });
  await dialog.getByLabel('OpenAI API key').fill('sk-advanced-audit');
  await dialog.getByLabel('手动模型 ID').fill('gpt-image-2');
  await dialog.locator('details.settings-disclosure > summary').click();
  await dialog.getByLabel('baseURL').fill('https://example.com/v1');
  await dialog.getByLabel('请求超时（秒）').fill('45');
  await dialog.getByLabel('使用同源请求代理').uncheck();
  await dialog.getByRole('button', { name: '保存 OpenAI 设置' }).click();
  await expect(page.getByText('连接设置已保存在当前浏览器。')).toBeVisible();
  await capture(page, testInfo, '46-advanced-connection-saved');
  await dialog.getByRole('button', { name: '关闭连接设置' }).click();

  await openButton.click();
  dialog = page.getByRole('dialog', { name: '连接图像模型' });
  await dialog.locator('details.settings-disclosure > summary').click();
  await expect(dialog.getByLabel('baseURL')).toHaveValue('https://example.com/v1');
  await expect(dialog.getByLabel('请求超时（秒）')).toHaveValue('45');
  await expect(dialog.getByLabel('使用同源请求代理')).not.toBeChecked();
  await capture(page, testInfo, '47-advanced-connection-reopened');
});

test('responsive and reduced-motion variants preserve the same visual language', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(844);
  const motionDuration = await page.getByRole('button', { name: '图生图' }).evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).transitionDuration) * 1000
  ));
  expect(motionDuration).toBeLessThanOrEqual(0.01);
  await capture(page, testInfo, '48-mobile-landscape-reduced-motion');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '20px';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await capture(page, testInfo, '49-small-phone-125-percent-text');
});
