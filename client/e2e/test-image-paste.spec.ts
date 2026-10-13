import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

const require = createRequire(import.meta.url);
const { previewText } = require('../../server/src/services/test-import.service.js');
test.setTimeout(60_000);
const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.';
const assetId = '12345678-1234-4123-8123-123456789012';
const source = `=== MODULE 1 ===
QUESTION 1
Domain: RW_INFORMATION_AND_IDEAS
Skill: RW_INFERENCES
[IMG]
@meta {"alt":"Triangle diagram"}

[QUESTION]
Which conclusion is supported?
A. First
B. Second
C. Third
D. Fourth
Answer: B`;

async function openEditor(page: Page, failUpload = false) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: { accessToken: token, user: { id: 20, name: 'Teacher Preview', role: 'TEACHER' } } });
    if (url.pathname === '/api/tests/taxonomy') return route.fulfill({ json: [{ code: 'RW_INFORMATION_AND_IDEAS', name: 'Information and Ideas', skills: [{ code: 'RW_INFERENCES', name: 'Inferences' }] }] });
    if (url.pathname === '/api/test-images/uploads') {
      const body = route.request().postDataJSON();
      expect(body.mimeType).toBe('image/png');
      expect(body.sizeBytes).toBeGreaterThan(0);
      if (failUpload) return route.fulfill({ status: 503, json: { error: 'Image storage unavailable' } });
      return route.fulfill({ json: { success: true, data: { asset: { id: assetId }, uploadUrl: 'http://127.0.0.1:4173/image-upload', headers: { 'Content-Type': 'image/png' } } } });
    }
    if (url.pathname.endsWith('/complete')) return route.fulfill({ json: { success: true } });
    if (url.pathname.endsWith('/access')) return route.fulfill({ json: { success: true, data: { url: 'http://127.0.0.1:4173/image-preview', expiresIn: 300 } } });
    if (url.pathname === '/api/test-imports/preview-text') return route.fulfill({ json: previewText(route.request().postDataJSON()) });
    return route.fulfill({ json: [] });
  });
  await page.route('**/image-upload', async route => {
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataBuffer()?.length).toBeGreaterThan(0);
    await route.fulfill({ status: 200, body: '' });
  });
  await page.route('**/image-preview', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><path d="M30 20V135H210Z" fill="white" stroke="black" stroke-width="3"/></svg>' }));
  await page.goto('/dashboard/practice-test/create');
  await page.getByLabel('Test name').fill('Clipboard image test');
  await page.getByRole('tab', { name: 'Import questions' }).click();
  await page.getByLabel('Structured test content').fill(source);
}

async function pasteImage(page: Page, mimeType = 'image/png') {
  return page.getByLabel('Structured test content').evaluate(async (element, type) => {
    const editor = element as HTMLTextAreaElement;
    editor.focus();
    const cursor = editor.value.indexOf('@meta');
    editor.setSelectionRange(cursor, cursor);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!)));
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File([blob], 'clipboard.png', { type }));
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData });
    editor.dispatchEvent(event);
    return event.defaultPrevented;
  }, mimeType);
}

for (const width of [1440, 390]) {
  test(`pastes into an image placeholder and updates the real parser preview at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openEditor(page);
    expect(await pasteImage(page)).toBe(true);
    const editor = page.getByLabel('Structured test content');
    await expect(editor).toHaveValue(source.replace('\n\n[QUESTION]', `\nasset:${assetId}\n\n[QUESTION]`));
    await expect(editor).toBeFocused();
    await expect(page.getByRole('button', { name: 'Update preview' })).toBeEnabled();
    await page.getByRole('button', { name: 'Update preview' }).click();
    await expect(page.getByText('0 errors', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Triangle diagram' })).toBeVisible();
    await expect.poll(() => page.getByRole('img', { name: 'Triangle diagram' }).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: /Continue to review/ })).toBeEnabled();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('image-paste.png'), fullPage: true });
  });
}

test('failed or unsupported clipboard images preserve the source and allow retry', async ({ page }) => {
  await openEditor(page, true);
  expect(await pasteImage(page, 'image/gif')).toBe(true);
  await expect(page.getByText('Choose a PNG, JPEG, or WebP image up to 5 MB')).toBeVisible();
  await expect(page.getByLabel('Structured test content')).toHaveValue(source);
  await pasteImage(page);
  await expect(page.getByText('Image storage unavailable')).toBeVisible();
  await expect(page.getByLabel('Structured test content')).toHaveValue(source);
  await expect(page.getByLabel('Structured test content')).toBeEditable();
  await expect(page.getByRole('button', { name: 'Upload image', exact: true })).toBeEnabled();
  const prevented = await page.getByLabel('Structured test content').evaluate(element => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', 'ordinary text');
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
});
