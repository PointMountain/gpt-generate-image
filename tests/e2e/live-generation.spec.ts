import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page, type Request } from '@playwright/test';

const apiKey = process.env.TOKENCANVAS_LIVE_KEY ?? '';
const baseURL = process.env.LIVE_OPENAI_BASE_URL ?? '';
const model = process.env.LIVE_IMAGE_MODEL ?? 'gpt-image-2';
const quality = process.env.LIVE_IMAGE_QUALITY ?? 'high';
const maskPath = process.env.LIVE_MASK_PATH ?? '';
const largeReferencePath = process.env.LIVE_LARGE_REFERENCE_PATH ?? '';
const transparentReferencePath = process.env.LIVE_TRANSPARENT_REFERENCE_PATH ?? '';
const outputDir = process.env.LIVE_TEST_OUTPUT_DIR ?? '/tmp/zaojing-live-e2e';
const transparentFormat = process.env.LIVE_TRANSPARENT_FORMAT === 'png' ? 'png' : 'webp';
const mascotPath = resolve(process.cwd(), 'public/tokencanvas-hero.png');
const maskSourcePath = process.env.LIVE_MASK_SOURCE_PATH ?? mascotPath;

test.skip(
  !apiKey || !baseURL,
  'Set TOKENCANVAS_LIVE_KEY and LIVE_OPENAI_BASE_URL to run paid live generation checks.',
);
test.describe.configure({ timeout: 300_000 });

async function capture(page: Page, name: string) {
  await mkdir(outputDir, { recursive: true });
  await page.screenshot({ path: resolve(outputDir, `${name}.png`), fullPage: true });
}

interface ExpectedImageOutput {
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
  width?: number;
  height?: number;
  hasTransparency?: boolean;
}

async function waitForGeneratedImages(
  page: Page,
  expectedCount: number,
  screenshotName: string,
  expectedOutput: ExpectedImageOutput = {},
) {
  try {
    const resultCard = page.locator('.result-card').first();
    const errorHeading = page.getByRole('heading', { name: '这次创作没有成功' });
    const outcome = await Promise.race([
      resultCard.waitFor({ state: 'visible', timeout: 270_000 }).then(() => 'success' as const),
      errorHeading.waitFor({ state: 'visible', timeout: 270_000 }).then(() => 'error' as const),
    ]);

    if (outcome === 'error') {
      await page.getByText('展开模型返回详情', { exact: true }).click();
      const detail = await page.locator('.error-detail-drawer pre, .error-detail-drawer p').textContent();
      throw new Error(`Live generation failed: ${detail?.trim() || 'no detail returned'}`);
    }

    await expect(page.locator('.result-card')).toHaveCount(expectedCount);
    await expect(page.locator('.result-card img')).toHaveCount(expectedCount);
    const outputImages = await page.locator('.result-card img').evaluateAll((images) => images.map((image) => {
      const element = image as HTMLImageElement;
      const canvas = document.createElement('canvas');
      canvas.width = element.naturalWidth;
      canvas.height = element.naturalHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(element, 0, 0);
      const pixels = context?.getImageData(0, 0, canvas.width, canvas.height).data;
      const sampleStep = pixels ? Math.max(4, Math.ceil(pixels.length / 800_000 / 4) * 4) : 4;
      let transparentSamples = 0;
      let samples = 0;
      if (pixels) {
        for (let offset = 3; offset < pixels.length; offset += sampleStep) {
          samples += 1;
          if ((pixels[offset] ?? 255) < 16) {
            transparentSamples += 1;
          }
        }
      }

      return {
        src: element.src,
        width: element.naturalWidth,
        height: element.naturalHeight,
        transparentRatio: samples ? transparentSamples / samples : 0,
      };
    }));
    await mkdir(outputDir, { recursive: true });
    for (const [index, image] of outputImages.entries()) {
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);

      const match = image.src.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);
      expect(match, 'generated image should be a base64 image data URL').not.toBeNull();
      const mimeType = match?.[1] as ExpectedImageOutput['mimeType'];
      if (expectedOutput.mimeType) {
        expect(mimeType).toBe(expectedOutput.mimeType);
      }
      if (expectedOutput.hasTransparency) {
        expect(image.transparentRatio).toBeGreaterThan(0.01);
      }
      const bytes = Buffer.from(match?.[2] ?? '', 'base64');
      expect(bytes.byteLength).toBeGreaterThan(1024);
      const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType?.split('/')[1] ?? 'bin';
      await writeFile(resolve(outputDir, `${screenshotName}-${index + 1}.${extension}`), bytes);

      if (expectedOutput.width) {
        expect(image.width).toBe(expectedOutput.width);
      }
      if (expectedOutput.height) {
        expect(image.height).toBe(expectedOutput.height);
      }
    }
    await capture(page, screenshotName);
  } catch (error) {
    await capture(page, `${screenshotName}-failure`);
    throw error;
  }
}

async function selectOption(page: Page, fieldName: RegExp, optionName: RegExp) {
  const composer = page.getByLabel('创作配方编辑器');
  await composer.getByRole('button', { name: fieldName }).click();
  await page.getByRole('option', { name: optionName }).click();
}

async function submitAndCaptureRequest(page: Page, endpoint: '/images/generations' | '/images/edits') {
  const requestPromise = page.waitForRequest((request) => (
    request.method() === 'POST' && request.url().includes(`/api/openai${endpoint}`)
  ));
  await page.getByRole('button', { name: '生成图片' }).click();
  return requestPromise;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ nextApiKey, nextBaseURL, nextModel, nextQuality }) => {
    window.localStorage.setItem('gpt-image-workbench/openai-settings', JSON.stringify({
      apiKey: nextApiKey,
      baseURL: nextBaseURL,
      useProxy: true,
      model: nextModel,
      timeoutSeconds: 240,
      defaultSize: '1024x1024',
      defaultQuality: nextQuality,
      defaultOutputFormat: 'auto',
      defaultBackground: 'auto',
      defaultOutputCompression: 0,
    }));
  }, { nextApiKey: apiKey, nextBaseURL: baseURL, nextModel: model, nextQuality: quality });

  await page.goto('/');
  await expect(page.getByRole('button', { name: '打开模型连接设置' }).first()).toContainText(model);
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem('gpt-image-workbench/openai-settings');
    return raw ? (JSON.parse(raw) as { baseURL?: string }).baseURL : undefined;
  })).toBe(baseURL);
});

test('generates a square image at the configured quality through the real UI', async ({ page }) => {
  await page.getByLabel('画面描述').fill('一只橙色小猫坐在蓝色纸船里，温暖童书插画，干净背景，细节丰富');

  const request = await submitAndCaptureRequest(page, '/images/generations');
  const body = request.postDataJSON() as Record<string, unknown>;
  expect(await request.headerValue('x-openai-base-url')).toBe(baseURL);
  expect(body).toMatchObject({ model, size: '1024x1024' });
  if (quality === 'auto') {
    expect(body).not.toHaveProperty('quality');
  } else {
    expect(body).toMatchObject({ quality });
  }
  expect(body).not.toHaveProperty('n');

  await waitForGeneratedImages(page, 1, `01-${model}-text-${quality}-square`, {
    mimeType: 'image/png',
    width: 1024,
    height: 1024,
  });
});

test('sends landscape, count, JPEG and compression parameters together', async ({ page }) => {
  await page.getByLabel('画面描述').fill('傍晚海边的纸艺灯塔，横向电影构图，层叠纸张纹理，暖色灯光，高细节');
  await selectOption(page, /^尺寸 /, /1536 x 1024/);
  await selectOption(page, /^张数 /, /^2 张$/);
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, /^JPEG$/);
  await page.getByLabel('压缩').fill('82');

  const request = await submitAndCaptureRequest(page, '/images/generations');
  const body = request.postDataJSON() as Record<string, unknown>;
  expect(body).toMatchObject({
    model,
    size: '1536x1024',
    n: 2,
    output_format: 'jpeg',
    output_compression: 82,
  });
  if (quality === 'auto') {
    expect(body).not.toHaveProperty('quality');
  } else {
    expect(body).toMatchObject({ quality });
  }

  await waitForGeneratedImages(page, 2, `02-${model}-text-landscape-jpeg-count-2`, {
    mimeType: 'image/jpeg',
    width: 1536,
    height: 1024,
  });
});

test('generates a transparent image at the configured quality and format', async ({ page }) => {
  await page.getByLabel('画面描述').fill('透明背景的蓝黄色纸艺小精灵贴纸，完整轮廓，活泼表情，高细节');
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, transparentFormat === 'png' ? /^PNG$/ : /^WEBP$/);
  await selectOption(page, /^背景 /, /^透明$/);
  if (transparentFormat === 'webp') {
    await page.getByLabel('压缩').fill('80');
  }

  const request = await submitAndCaptureRequest(page, '/images/generations');
  const body = request.postDataJSON() as Record<string, unknown>;
  const expectedBody = {
    model,
    quality,
    output_format: transparentFormat,
    background: 'transparent',
    ...(transparentFormat === 'webp' ? { output_compression: 80 } : {}),
  };
  expect(body).toMatchObject(expectedBody);
  if (transparentFormat === 'png') {
    expect(body).not.toHaveProperty('output_compression');
  }

  await waitForGeneratedImages(page, 1, `03-${model}-transparent-${transparentFormat}-${quality}`, {
    mimeType: `image/${transparentFormat}` as ExpectedImageOutput['mimeType'],
    width: 1024,
    height: 1024,
    hasTransparency: true,
  });
});

test('generates from a real reference image', async ({ page }) => {
  await page.getByRole('button', { name: '图生图' }).click();
  await page.locator('.reference-dropzone-card input[type="file"]').first().setInputFiles(mascotPath);
  await page.getByLabel('画面描述').fill('保留角色的可爱表情，改成手工剪纸海报，蓝黄配色，留出呼吸感');
  await selectOption(page, /^尺寸 /, /1024 x 1536/);

  const request = await submitAndCaptureRequest(page, '/images/edits');
  expect(await request.headerValue('content-type')).toContain('multipart/form-data');
  expect(await request.headerValue('x-openai-base-url')).toBe(baseURL);

  await waitForGeneratedImages(page, 1, `04-${model}-reference-${quality}-portrait`, {
    mimeType: 'image/png',
    width: 1024,
    height: 1536,
  });
});

test('generates a truly transparent PNG from an opaque reference image', async ({ page }) => {
  await page.getByRole('button', { name: '图生图' }).click();
  await page.locator('.reference-dropzone-card input[type="file"]').first().setInputFiles(mascotPath);
  await page.getByLabel('画面描述').fill('保留角色主体与表情，移除所有背景，输出边缘干净的透明贴纸');
  await selectOption(page, /^质量 /, /^快速/);
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, /^PNG$/);
  await selectOption(page, /^背景 /, /^透明$/);

  const request = await submitAndCaptureRequest(page, '/images/edits');
  expect(await request.headerValue('content-type')).toContain('multipart/form-data');
  await waitForGeneratedImages(page, 1, `04b-${model}-reference-transparent-png`, {
    mimeType: 'image/png',
    width: 1024,
    height: 1024,
    hasTransparency: true,
  });
});

test('generates from a reference image larger than the legacy 10MB limit', async ({ page }) => {
  test.skip(!largeReferencePath, 'Set LIVE_LARGE_REFERENCE_PATH to a valid image larger than 10MB.');
  expect((await stat(largeReferencePath)).size).toBeGreaterThan(10 * 1024 * 1024);

  await page.getByRole('button', { name: '图生图' }).click();
  await page.locator('.reference-dropzone-card input[type="file"]').first().setInputFiles(largeReferencePath);
  await page.getByLabel('画面描述').fill('保留丰富色彩与整体构图，重绘为层叠剪纸风格，轮廓清晰');
  await selectOption(page, /^质量 /, /^快速/);
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, /^JPEG$/);
  await page.getByLabel('压缩').fill('60');

  const request = await submitAndCaptureRequest(page, '/images/edits');
  expect(await request.headerValue('content-type')).toContain('multipart/form-data');
  expect(await request.headerValue('x-openai-base-url')).toBe(baseURL);
  await waitForGeneratedImages(page, 1, `05-${model}-reference-over-10mb-low-jpeg`, {
    mimeType: 'image/jpeg',
    width: 1024,
    height: 1024,
  });
});

test('sends source image and alpha mask through the real mask workflow', async ({ page }) => {
  test.skip(!maskPath, 'Set LIVE_MASK_PATH to a same-size PNG with an alpha channel.');
  await page.getByRole('button', { name: '遮罩编辑' }).click();
  await page.locator('.reference-dropzone-card input[type="file"]').first().setInputFiles(mascotPath);
  await page.locator('.composer-panel__controls input[type="file"]').setInputFiles(maskPath);
  await page.getByLabel('画面描述').fill('把背景替换为柔和的蓝黄色纸艺星空，角色主体保持清晰可爱');

  const request: Request = await submitAndCaptureRequest(page, '/images/edits');
  expect(await request.headerValue('content-type')).toContain('multipart/form-data');
  expect(await request.headerValue('x-openai-base-url')).toBe(baseURL);

  await waitForGeneratedImages(page, 1, `06-${model}-mask-${quality}-square`, {
    mimeType: 'image/png',
    width: 1024,
    height: 1024,
  });
});

test('preserves real transparency through the mask editing workflow', async ({ page }) => {
  test.skip(!maskPath || !transparentReferencePath, 'Set mask and transparent reference paths for alpha mask verification.');
  await page.getByRole('button', { name: '遮罩编辑' }).click();
  await page.locator('.reference-dropzone-card input[type="file"]').first().setInputFiles(transparentReferencePath);
  await page.locator('.composer-panel__controls input[type="file"]').setInputFiles(maskPath);
  await page.getByLabel('画面描述').fill('在遮罩区域增加一颗蓝黄色纸艺星星，保留源图透明背景');
  await selectOption(page, /^质量 /, /^快速/);
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, /^PNG$/);
  await selectOption(page, /^背景 /, /^透明$/);

  const request = await submitAndCaptureRequest(page, '/images/edits');
  expect(await request.headerValue('content-type')).toContain('multipart/form-data');
  await waitForGeneratedImages(page, 1, `06b-${model}-mask-transparent-png`, {
    mimeType: 'image/png',
    width: 1024,
    height: 1024,
    hasTransparency: true,
  });
});

test('covers auto size and quality with three opaque PNG outputs', async ({ page }) => {
  await page.getByLabel('画面描述').fill('三张活泼的几何纸艺图标，奶油纸背景，简洁构图');
  await selectOption(page, /^尺寸 /, /^自动（推荐）$/);
  await selectOption(page, /^张数 /, /^3 张$/);
  await selectOption(page, /^质量 /, /^自动$/);
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, /^PNG$/);
  await selectOption(page, /^背景 /, /^不透明$/);

  const request = await submitAndCaptureRequest(page, '/images/generations');
  const body = request.postDataJSON() as Record<string, unknown>;
  expect(body).toMatchObject({ model, n: 3, output_format: 'png', background: 'opaque' });
  expect(body).not.toHaveProperty('size');
  expect(body).not.toHaveProperty('quality');

  await waitForGeneratedImages(page, 3, `07-${model}-auto-png-opaque-count-3`, {
    mimeType: 'image/png',
  });
});

test('covers 2048 square low-quality WebP with compression 100', async ({ page }) => {
  await page.getByLabel('画面描述').fill('蓝黄色纸艺风筝在晴朗天空中飞翔，方形构图，边缘清晰');
  await selectOption(page, /^尺寸 /, /^2048 x 2048$/);
  await selectOption(page, /^质量 /, /^快速/);
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, /^WEBP$/);
  await selectOption(page, /^背景 /, /^不透明$/);
  await page.getByLabel('压缩').fill('100');

  const request = await submitAndCaptureRequest(page, '/images/generations');
  expect(request.postDataJSON()).toMatchObject({
    model,
    size: '2048x2048',
    quality: 'low',
    output_format: 'webp',
    background: 'opaque',
    output_compression: 100,
  });
  await waitForGeneratedImages(page, 1, `08-${model}-2048-low-webp-opaque-compression-100`, {
    mimeType: 'image/webp',
    width: 2048,
    height: 2048,
  });
});

test('covers portrait medium-quality JPEG with zero compression omitted', async ({ page }) => {
  await page.getByLabel('画面描述').fill('竖版纸艺花园海报，柔和晨光，层叠植物与清晰留白');
  await selectOption(page, /^尺寸 /, /^1024 x 1536$/);
  await selectOption(page, /^质量 /, /^均衡$/);
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, /^JPEG$/);
  await page.getByLabel('压缩').fill('0');

  const request = await submitAndCaptureRequest(page, '/images/generations');
  const body = request.postDataJSON() as Record<string, unknown>;
  expect(body).toMatchObject({
    model,
    size: '1024x1536',
    quality: 'medium',
    output_format: 'jpeg',
  });
  expect(body).not.toHaveProperty('output_compression');
  await waitForGeneratedImages(page, 1, `09-${model}-portrait-medium-jpeg-compression-0`, {
    mimeType: 'image/jpeg',
    width: 1024,
    height: 1536,
  });
});

test('covers four low-quality outputs through the compatible count fallback', async ({ page }) => {
  await page.getByLabel('画面描述').fill('四款不同表情的蓝色纸艺小鸟头像，统一白色背景');
  await selectOption(page, /^张数 /, /^4 张$/);
  await selectOption(page, /^质量 /, /^快速/);

  const request = await submitAndCaptureRequest(page, '/images/generations');
  expect(request.postDataJSON()).toMatchObject({ model, n: 4, quality: 'low' });
  await waitForGeneratedImages(page, 4, `10-${model}-low-count-4-fallback`, {
    mimeType: 'image/png',
    width: 1024,
    height: 1024,
  });
});

test('covers image-to-image medium landscape WebP parameters', async ({ page }) => {
  await page.getByRole('button', { name: '图生图' }).click();
  await page.locator('.reference-dropzone-card input[type="file"]').first().setInputFiles(mascotPath);
  await page.getByLabel('画面描述').fill('保留角色主体，扩展为横向蓝黄色剪纸场景，背景不透明');
  await selectOption(page, /^尺寸 /, /^1536 x 1024$/);
  await selectOption(page, /^质量 /, /^均衡$/);
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, /^WEBP$/);
  await selectOption(page, /^背景 /, /^不透明$/);
  await page.getByLabel('压缩').fill('100');

  await submitAndCaptureRequest(page, '/images/edits');
  await waitForGeneratedImages(page, 1, `11-${model}-reference-medium-landscape-webp`, {
    mimeType: 'image/webp',
    width: 1536,
    height: 1024,
  });
});

test('covers mask editing medium landscape WebP parameters', async ({ page }) => {
  test.skip(!maskPath, 'Set LIVE_MASK_PATH to a same-size PNG with an alpha channel.');
  await page.getByRole('button', { name: '遮罩编辑' }).click();
  await page.locator('.reference-dropzone-card input[type="file"]').first().setInputFiles(maskSourcePath);
  await page.locator('.composer-panel__controls input[type="file"]').setInputFiles(maskPath);
  await page.getByLabel('画面描述').fill('把透明遮罩区域改成横向蓝黄色纸艺星空，主体保持不变');
  await selectOption(page, /^尺寸 /, /^1536 x 1024$/);
  await selectOption(page, /^质量 /, /^均衡$/);
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, /^WEBP$/);
  await selectOption(page, /^背景 /, /^不透明$/);
  await page.getByLabel('压缩').fill('100');

  await submitAndCaptureRequest(page, '/images/edits');
  await waitForGeneratedImages(page, 1, `12-${model}-mask-medium-landscape-webp`, {
    mimeType: 'image/webp',
    width: 1536,
    height: 1024,
  });
});
