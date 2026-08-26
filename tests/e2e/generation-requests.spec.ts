import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';

const mascotPath = resolve(process.cwd(), 'public/tokencanvas-hero.png');
const mockImageBase64 = (await readFile(mascotPath)).toString('base64');

async function configureWorkbench(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('gpt-image-workbench/openai-settings', JSON.stringify({
      apiKey: 'sk-e2e-request-contract',
      baseURL: 'https://example.com/v1',
      useProxy: true,
      model: 'gpt-image-2',
      timeoutSeconds: 30,
      defaultSize: '1024x1024',
      defaultQuality: 'high',
      defaultOutputFormat: 'auto',
      defaultBackground: 'auto',
      defaultOutputCompression: 0,
    }));
  });
  await page.goto('/');
}

async function fulfillImage(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ b64_json: mockImageBase64 }] }),
  });
}

async function selectOption(page: Page, field: RegExp, option: RegExp) {
  const composer = page.getByLabel('创作配方编辑器');
  await composer.getByRole('button', { name: field }).click();
  await page.getByRole('option', { name: option }).click();
}

function readPngDimensions(buffer: Buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const dimensions: Array<{ width: number; height: number }> = [];
  let offset = 0;

  while ((offset = buffer.indexOf(signature, offset)) >= 0) {
    dimensions.push({
      width: buffer.readUInt32BE(offset + 16),
      height: buffer.readUInt32BE(offset + 20),
    });
    offset += signature.byteLength;
  }

  return dimensions;
}

function extractPngFiles(buffer: Buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const files: Buffer[] = [];
  let offset = 0;

  while ((offset = buffer.indexOf(signature, offset)) >= 0) {
    let cursor = offset + signature.byteLength;
    while (cursor + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(cursor);
      const type = buffer.toString('ascii', cursor + 4, cursor + 8);
      cursor += length + 12;
      if (type === 'IEND') {
        files.push(buffer.subarray(offset, cursor));
        break;
      }
    }
    offset = cursor;
  }

  return files;
}

test('sends gpt-image-2 high-quality text parameters without n=1', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route('**/api/openai/images/generations', async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillImage(route);
  });
  await configureWorkbench(page);

  await page.getByLabel('画面描述').fill('纸艺海边灯塔，温暖电影灯光');
  await page.getByRole('button', { name: '生成图片' }).click();

  await expect(page.locator('.result-card')).toHaveCount(1);
  expect(requestBody).toMatchObject({
    model: 'gpt-image-2',
    prompt: '纸艺海边灯塔，温暖电影灯光',
    quality: 'high',
    size: '1024x1024',
  });
  expect(requestBody).not.toHaveProperty('n');
});

test('sends landscape, multi-image, JPEG and compression parameters from the UI', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route('**/api/openai/images/generations', async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [
        { b64_json: mockImageBase64 },
        { b64_json: mockImageBase64 },
      ] }),
    });
  });
  await configureWorkbench(page);

  await page.getByLabel('画面描述').fill('横向纸艺港口海报');
  await selectOption(page, /^尺寸 /, /1536 x 1024/);
  await selectOption(page, /^张数 /, /^2 张$/);
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, /^JPEG$/);
  await page.getByLabel('压缩').fill('82');
  await page.getByRole('button', { name: '生成图片' }).click();

  await expect(page.locator('.result-card')).toHaveCount(2);
  expect(requestBody).toMatchObject({
    model: 'gpt-image-2',
    quality: 'high',
    size: '1536x1024',
    n: 2,
    output_format: 'jpeg',
    output_compression: 82,
  });
});

test('sends WebP, transparent background and compression together for gpt-image-2', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route('**/api/openai/images/generations', async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillImage(route);
  });
  await configureWorkbench(page);

  await page.getByLabel('画面描述').fill('透明背景的活泼蓝黄色纸艺角色贴纸');
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, /^WEBP$/);
  await selectOption(page, /^背景 /, /^透明$/);
  await page.getByLabel('压缩').fill('76');
  await page.getByRole('button', { name: '生成图片' }).click();

  await expect(page.locator('.result-card')).toHaveCount(1);
  expect(requestBody).toMatchObject({
    model: 'gpt-image-2',
    quality: 'high',
    output_format: 'webp',
    background: 'transparent',
    output_compression: 76,
  });
});

test('every gpt-image-2 option offered by the composer reaches the request contract', async ({ page }) => {
  const requestBodies: Record<string, unknown>[] = [];
  await page.route('**/api/openai/images/generations', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    requestBodies.push(body);
    const count = typeof body.n === 'number' ? body.n : 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: Array.from({ length: count }, () => ({ b64_json: mockImageBase64 })),
      }),
    });
  });
  await configureWorkbench(page);
  await page.getByLabel('画面描述').fill('逐项检查 gpt-image-2 的公开创作参数');

  async function generate() {
    const expectedRequestCount = requestBodies.length + 1;
    const button = page.getByRole('button', { name: '生成图片' });
    await button.click();
    await expect.poll(() => requestBodies.length).toBe(expectedRequestCount);
    await expect(button).toBeEnabled();
    return requestBodies.at(-1) ?? {};
  }

  for (const qualityCase of [
    { option: /^自动$/, expected: undefined },
    { option: /^快速（更稳）$/, expected: 'low' },
    { option: /^均衡$/, expected: 'medium' },
    { option: /^高质量$/, expected: 'high' },
  ]) {
    await selectOption(page, /^质量 /, qualityCase.option);
    const body = await generate();
    expect(body.quality).toBe(qualityCase.expected);
  }

  for (const sizeCase of [
    { option: /^自动（推荐）$/, expected: undefined },
    { option: /^1024 x 1024$/, expected: '1024x1024' },
    { option: /^1536 x 1024$/, expected: '1536x1024' },
    { option: /^1024 x 1536$/, expected: '1024x1536' },
    { option: /^2048 x 2048$/, expected: '2048x2048' },
  ]) {
    await selectOption(page, /^尺寸 /, sizeCase.option);
    const body = await generate();
    expect(body.size).toBe(sizeCase.expected);
  }

  for (const count of [1, 2, 3, 4]) {
    await selectOption(page, /^张数 /, new RegExp(`^${count} 张$`));
    const body = await generate();
    if (count === 1) {
      expect(body).not.toHaveProperty('n');
    } else {
      expect(body.n).toBe(count);
    }
  }

  await page.getByText('更多设置', { exact: true }).click();
  for (const formatCase of [
    { option: /^自动$/, expected: undefined },
    { option: /^PNG$/, expected: 'png' },
    { option: /^JPEG$/, expected: 'jpeg' },
    { option: /^WEBP$/, expected: 'webp' },
  ]) {
    await selectOption(page, /^输出格式 /, formatCase.option);
    const body = await generate();
    expect(body.output_format).toBe(formatCase.expected);
  }

  for (const backgroundCase of [
    { option: /^自动$/, expected: undefined },
    { option: /^不透明$/, expected: 'opaque' },
    { option: /^透明$/, expected: 'transparent' },
  ]) {
    await selectOption(page, /^背景 /, backgroundCase.option);
    const body = await generate();
    expect(body.background).toBe(backgroundCase.expected);
  }
});

test('sends reference image and mask as distinct multipart edit requests', async ({ page }) => {
  const multipartBodies: string[] = [];
  await page.route('**/api/openai/images/edits', async (route) => {
    multipartBodies.push(route.request().postData() ?? '');
    await fulfillImage(route);
  });
  await configureWorkbench(page);

  await page.getByRole('button', { name: '图生图' }).click();
  await page.locator('.reference-dropzone-card input[type="file"]').first().setInputFiles(mascotPath);
  await page.getByLabel('画面描述').fill('改成蓝黄色剪纸海报');
  await page.getByRole('button', { name: '生成图片' }).click();
  await expect(page.locator('.result-card')).toHaveCount(1);

  await page.getByRole('button', { name: '遮罩编辑' }).click();
  await page.locator('.composer-panel__controls input[type="file"]').setInputFiles(mascotPath);
  await page.getByLabel('画面描述').fill('替换背景为纸艺星空');
  await page.getByRole('button', { name: '生成图片' }).click();
  await expect.poll(() => multipartBodies.length).toBe(2);
  await expect(page.locator('.result-card')).toHaveCount(1);

  expect(multipartBodies).toHaveLength(2);
  expect(multipartBodies[0]).toContain('name="image"');
  expect(multipartBodies[0]).not.toContain('name="mask"');
  expect(multipartBodies[0]).not.toContain('name="n"');
  expect(multipartBodies[1]).toContain('name="image"');
  expect(multipartBodies[1]).toContain('name="mask"');
  expect(multipartBodies[1]).not.toContain('name="n"');
});

test('adapts a square mask canvas to the requested landscape dimensions before upload', async ({ page }) => {
  let multipartBody: Buffer | null = null;
  await page.route('**/api/openai/images/edits', async (route) => {
    multipartBody = route.request().postDataBuffer();
    await fulfillImage(route);
  });
  await configureWorkbench(page);

  await page.getByRole('button', { name: '遮罩编辑' }).click();
  await page.locator('.reference-dropzone-card input[type="file"]').first().setInputFiles(mascotPath);
  const maskBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is unavailable');
    }
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.arc(512, 512, 320, 0, Math.PI * 2);
    context.fill();
    return canvas.toDataURL('image/png').split(',')[1] ?? '';
  });
  await page.locator('.composer-panel__controls input[type="file"]').setInputFiles({
    name: 'alpha-mask.png',
    mimeType: 'image/png',
    buffer: Buffer.from(maskBase64, 'base64'),
  });
  await page.getByLabel('画面描述').fill('扩展为横向纸艺星空');
  await selectOption(page, /^尺寸 /, /^1536 x 1024$/);
  await page.getByRole('button', { name: '生成图片' }).click();

  await expect(page.locator('.result-card')).toHaveCount(1);
  expect(multipartBody).not.toBeNull();
  const pngFiles = extractPngFiles(multipartBody ?? Buffer.alloc(0));
  expect(readPngDimensions(multipartBody ?? Buffer.alloc(0)).slice(0, 2)).toEqual([
    { width: 1536, height: 1024 },
    { width: 1536, height: 1024 },
  ]);
  expect(pngFiles).toHaveLength(2);

  const [sourcePixels, maskPixels] = await page.evaluate(async ([sourceBase64, maskBase64]) => {
    async function sample(base64: string) {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(image, 0, 0);
      return {
        edge: Array.from(context?.getImageData(1, Math.floor(canvas.height / 2), 1, 1).data ?? []),
        center: Array.from(context?.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data ?? []),
      };
    }

    return Promise.all([sample(sourceBase64), sample(maskBase64)]);
  }, [pngFiles[0]?.toString('base64') ?? '', pngFiles[1]?.toString('base64') ?? '']);

  expect(sourcePixels?.edge[3]).toBe(255);
  expect((sourcePixels?.edge[0] ?? 0) + (sourcePixels?.edge[1] ?? 0) + (sourcePixels?.edge[2] ?? 0)).toBeGreaterThan(100);
  expect(maskPixels?.edge[3]).toBe(255);
  expect(maskPixels?.center[3]).toBeLessThan(16);
});

test('accepts a reference image larger than the legacy 10MB client limit', async ({ page }) => {
  let multipartBytes = 0;
  await page.route('**/api/openai/images/edits', async (route) => {
    multipartBytes = route.request().postDataBuffer()?.byteLength ?? 0;
    await fulfillImage(route);
  });
  await configureWorkbench(page);

  await page.getByRole('button', { name: '图生图' }).click();
  await page.locator('.reference-dropzone-card input[type="file"]').first().setInputFiles({
    name: 'large-reference.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(11 * 1024 * 1024, 1),
  });
  await page.getByLabel('画面描述').fill('验证超过旧 10MB 限制的输入素材可以正常进入创作轮次');
  await page.getByRole('button', { name: '生成图片' }).click();

  await expect(page.locator('.result-card')).toHaveCount(1);
  expect(multipartBytes).toBeGreaterThan(10 * 1024 * 1024);
});

test('normalizes a compatible provider output to the exact requested dimensions', async ({ page }) => {
  await page.route('**/api/openai/images/generations', fulfillImage);
  await configureWorkbench(page);

  await page.getByLabel('画面描述').fill('把兼容端点返回的方图校正为请求尺寸');
  await selectOption(page, /^尺寸 /, /^2048 x 2048$/);
  await page.getByRole('button', { name: '生成图片' }).click();

  const result = page.locator('.result-card img');
  await expect(result).toHaveCount(1);
  await expect.poll(() => result.evaluate((image) => ({
    width: (image as HTMLImageElement).naturalWidth,
    height: (image as HTMLImageElement).naturalHeight,
  }))).toEqual({ width: 2048, height: 2048 });
  await expect(page.getByText('2048 × 2048')).toBeVisible();
  await expect(page.getByText(/已在本地调整为请求尺寸/)).toBeVisible();
});

test('contains a transparent square result inside the requested landscape canvas', async ({ page }) => {
  await page.route('**/api/openai/images/generations', fulfillImage);
  await configureWorkbench(page);

  await page.getByLabel('画面描述').fill('透明背景角色，保持完整主体');
  await selectOption(page, /^尺寸 /, /^1536 x 1024$/);
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^输出格式 /, /^PNG$/);
  await selectOption(page, /^背景 /, /^透明$/);
  await page.getByRole('button', { name: '生成图片' }).click();

  const result = page.locator('.result-card img');
  await expect(result).toHaveCount(1);
  await expect.poll(() => result.evaluate((image) => ({
    width: (image as HTMLImageElement).naturalWidth,
    height: (image as HTMLImageElement).naturalHeight,
  }))).toEqual({ width: 1536, height: 1024 });
  await expect(page.getByText('1536 × 1024 · 本地校准')).toBeVisible();
});

test('contains an opaque square result inside a soft-filled landscape canvas', async ({ page }) => {
  await page.route('**/api/openai/images/generations', fulfillImage);
  await configureWorkbench(page);

  await page.getByLabel('画面描述').fill('不透明背景角色，保持完整主体');
  await selectOption(page, /^尺寸 /, /^1536 x 1024$/);
  await page.getByText('更多设置', { exact: true }).click();
  await selectOption(page, /^背景 /, /^不透明$/);
  await page.getByRole('button', { name: '生成图片' }).click();

  const result = page.locator('.result-card img');
  await expect(result).toHaveCount(1);
  await expect.poll(() => result.evaluate((image) => ({
    width: (image as HTMLImageElement).naturalWidth,
    height: (image as HTMLImageElement).naturalHeight,
  }))).toEqual({ width: 1536, height: 1024 });
  await expect(page.getByText('1536 × 1024 · 本地校准')).toBeVisible();
});
