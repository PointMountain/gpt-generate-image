import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const mascotPath = resolve(process.cwd(), 'public/tokencanvas-hero.png');

async function openDropdown(page: Page, label: RegExp) {
  const composer = page.getByLabel('创作配方编辑器');
  await composer.getByRole('button', { name: label }).click();
  return page.getByRole('listbox');
}

test.describe('creation workbench layout quality', () => {
  test('prompt text keeps readable inset spacing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const padding = await page.getByLabel('画面描述').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        left: Number.parseFloat(style.paddingLeft),
        right: Number.parseFloat(style.paddingRight),
      };
    });

    expect(padding.left).toBeGreaterThanOrEqual(8);
    expect(padding.right).toBeGreaterThanOrEqual(8);
  });

  test('core controls reserve width according to their content', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const composer = page.getByLabel('创作配方编辑器');

    const sizeWidth = (await composer.getByRole('button', { name: /^尺寸 / }).boundingBox())?.width ?? 0;
    const countWidth = (await composer.getByRole('button', { name: /^张数 / }).boundingBox())?.width ?? 0;
    const qualityWidth = (await composer.getByRole('button', { name: /^质量 / }).boundingBox())?.width ?? 0;

    expect(sizeWidth).toBeGreaterThanOrEqual(104);
    expect(countWidth).toBeGreaterThanOrEqual(64);
    expect(qualityWidth).toBeGreaterThanOrEqual(104);
  });

  test('desktop core control values are never visually truncated', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    for (const id of ['image-size-value', 'image-count-value', 'image-quality-value']) {
      const metrics = await page.locator(`#${id}`).evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(metrics.scrollWidth, `${id} should fit inside its trigger`).toBeLessThanOrEqual(metrics.clientWidth);
    }
  });

  test('dropdown menus are wide enough for their longest option', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const sizeMenu = await openDropdown(page, /^尺寸 /);
    const sizeMetrics = await sizeMenu.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      top: element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(sizeMetrics.width).toBeGreaterThanOrEqual(176);
    expect(sizeMetrics.top).toBeGreaterThanOrEqual(0);
    expect(sizeMetrics.bottom).toBeLessThanOrEqual(900);
    expect(sizeMetrics.scrollWidth).toBeLessThanOrEqual(sizeMetrics.clientWidth);
    await page.keyboard.press('Escape');

    const qualityMenu = await openDropdown(page, /^质量 /);
    const qualityMetrics = await qualityMenu.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      top: element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(qualityMetrics.width).toBeGreaterThanOrEqual(184);
    expect(qualityMetrics.top).toBeGreaterThanOrEqual(0);
    expect(qualityMetrics.bottom).toBeLessThanOrEqual(900);
    expect(qualityMetrics.scrollWidth).toBeLessThanOrEqual(qualityMetrics.clientWidth);
  });

  test('mobile navigation stays docked while scrolling without covering the final content', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const navigation = page.getByRole('navigation', { name: '移动端主导航' });
    const initialBox = await navigation.boundingBox();
    const position = await navigation.evaluate((element) => getComputedStyle(element).position);

    expect(position).toBe('fixed');
    expect(initialBox).not.toBeNull();
    expect(Math.abs((initialBox?.y ?? 0) + (initialBox?.height ?? 0) - 844)).toBeLessThanOrEqual(1);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    const scrolledBox = await navigation.boundingBox();
    const finalContentBox = await page.locator('.canvas-shell__content > *').last().boundingBox();

    expect(scrolledBox).not.toBeNull();
    expect(Math.abs((scrolledBox?.y ?? 0) + (scrolledBox?.height ?? 0) - 844)).toBeLessThanOrEqual(1);
    expect(finalContentBox).not.toBeNull();
    expect((finalContentBox?.y ?? 0) + (finalContentBox?.height ?? 0)).toBeLessThanOrEqual(scrolledBox?.y ?? 0);
  });

  test('advanced settings summary and fields align as one control group', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const summary = page.getByLabel('创作配方编辑器').locator('.generation-controls__advanced > summary');

    const summaryStyle = await summary.evaluate((element) => {
      const style = getComputedStyle(element);
      return { display: style.display, alignItems: style.alignItems };
    });

    expect(summaryStyle.display).toBe('flex');
    expect(summaryStyle.alignItems).toBe('center');
  });

  test('tablet uses an uncrushed single-column workbench', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: '造境' })).toBeHidden();
    const composerWidth = (await page.getByLabel('创作配方编辑器').boundingBox())?.width ?? 0;
    const canvasWidth = (await page.locator('.canvas-shell').boundingBox())?.width ?? 0;

    expect(composerWidth).toBeGreaterThanOrEqual(560);
    expect(canvasWidth).toBeGreaterThanOrEqual(720);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(768);
  });

  test('small-phone controls keep a 44px touch target', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const undersized = await page.locator('button, input:not([type="hidden"]), textarea').evaluateAll((elements) => (
      elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
        const isEnabled = !(element instanceof HTMLButtonElement || element instanceof HTMLInputElement)
          || !element.disabled;

        if (!isVisible || !isEnabled || (rect.width >= 44 && rect.height >= 44)) {
          return [];
        }

        return [{
          name: element.getAttribute('aria-label') || element.textContent?.trim() || element.id || element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }];
      })
    ));

    expect(undersized).toEqual([]);
  });

  test('small-phone layout survives 125% text scaling without horizontal clipping', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '20px';
    });

    const metrics = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth,
    }));

    expect(metrics.contentWidth).toBe(metrics.viewportWidth);
  });

  test('small-phone material editing controls remain easy to tap', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByRole('button', { name: '图生图' }).click();
    await page.locator('input[type="file"][multiple]').setInputFiles(mascotPath);

    const undersized = await page.locator('button, summary, label:has(input[type="file"])').evaluateAll((elements) => (
      elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
        const isDisabled = element instanceof HTMLButtonElement && element.disabled;

        if (!isVisible || isDisabled || (rect.width >= 44 && rect.height >= 44)) {
          return [];
        }

        return [{
          name: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }];
      })
    ));

    expect(undersized).toEqual([]);
  });

  test('small-phone connection drawer controls remain easy to tap', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByRole('button', { name: '打开模型连接设置' }).click();
    const dialog = page.getByRole('dialog', { name: '连接图像模型' });
    await dialog.locator('details.settings-disclosure > summary').click();

    const undersized = await dialog.locator('button, summary, input:not([type="checkbox"])').evaluateAll((elements) => (
      elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
        const isDisabled = (element instanceof HTMLButtonElement || element instanceof HTMLInputElement)
          && element.disabled;

        if (!isVisible || isDisabled || (rect.width >= 44 && rect.height >= 44)) {
          return [];
        }

        return [{
          name: element.getAttribute('aria-label') || element.textContent?.trim() || element.id || element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }];
      })
    ));

    expect(undersized).toEqual([]);
  });
});
