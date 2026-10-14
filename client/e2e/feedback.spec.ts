import { expect, test, type Page } from '@playwright/test';
import { expectViewportModal } from './helpers/modal-layout';

const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const image = { id: '00000000-0000-4000-8000-000000000001', name: 'screenshot.png', mimeType: 'image/png', sizeBytes: png.length };
const report = { id: '00000000-0000-4000-8000-000000000002', level: 'CRITICAL', status: 'NEW', message: 'I cannot save my assignment.', pagePath: '/dashboard/classes', createdAt: '2026-10-14T00:00:00Z', updatedAt: '2026-10-14T00:00:00Z', user: { id: 10, name: 'SAT Student', email: 'student@example.test', role: 'STUDENT' }, attachments: [image] };

async function session(page: Page, role: 'STUDENT' | 'TEACHER' | 'ADMIN' = 'STUDENT') {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: token, user: { ...report.user, role } } });
    if (path === '/api/account/profile') return route.fulfill({ json: { ...report.user, role, avatar: null, loginMethod: 'GOOGLE' } });
    if (path === '/api/study-sessions/active') return route.fulfill({ json: { session: null } });
    return route.fulfill({ json: [] });
  });
}

test('mobile user keeps a draft when closing and sends severity, text and an image from the header', async ({ page }) => {
  await session(page);
  let uploads = 0;
  let sends = 0;
  await page.route('**/api/feedback/images', route => {
    uploads += 1;
    expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary=');
    expect(route.request().postDataBuffer()?.toString()).toContain('filename="screenshot.png"');
    return route.fulfill({ json: image });
  });
  await page.route('**/api/feedback', route => {
    sends += 1;
    expect(route.request().postDataJSON()).toMatchObject({ level: 'CRITICAL', message: report.message, pagePath: '/dashboard/classes', attachmentIds: [image.id] });
    return route.fulfill({ json: report });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/classes');
  const trigger = page.getByRole('button', { name: 'Send feedback', exact: true });
  await expect(trigger).toHaveText('');
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Send feedback' });
  await expectViewportModal(dialog);
  await expect(page.getByLabel('Your feedback')).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Send feedback', exact: true })).toBeDisabled();
  await expect(dialog.getByText('Tell us what happened or how we can improve.', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Your feedback goes to|Page:|Closing keeps your draft/)).toHaveCount(0);
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  const scale = dialog.getByRole('radiogroup', { name: 'How does this affect you?' });
  await expect(scale.getByRole('radio')).toHaveCount(5);
  await scale.getByRole('radio', { name: 'Critical', exact: true }).click();
  await expect(scale.getByRole('radio', { name: 'Critical', exact: true })).toBeChecked();
  await page.keyboard.down('ArrowRight');
  await expect(scale.getByRole('radio', { name: 'Major issue', exact: true })).toBeChecked();
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowLeft');
  await expect(scale.getByRole('radio', { name: 'Critical', exact: true })).toBeChecked();
  await page.keyboard.up('ArrowLeft');
  await page.getByLabel('Your feedback').fill(report.message);
  await page.getByLabel('Attach feedback images').setInputFiles({ name: image.name, mimeType: image.mimeType, buffer: png });
  await expect(page.getByRole('img', { name: 'Preview of screenshot.png' })).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByLabel('Your feedback')).toHaveValue(report.message);
  await expect(page.getByRole('img', { name: 'Preview of screenshot.png' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await trigger.click();
  await page.screenshot({ path: '../tmp/feedback-mobile.png' });
  await dialog.getByRole('button', { name: 'Send feedback', exact: true }).click();
  await expect(page.getByText('Feedback sent. Thank you for helping us improve!')).toBeVisible();
  expect(uploads).toBe(1); expect(sends).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.mouse.move(195, 500);
  await expect(page.getByText('Feedback sent. Thank you for helping us improve!')).toBeHidden({ timeout: 6000 });
  await trigger.click();
  await expect(page.getByLabel('Your feedback')).toHaveValue('');
  await expect(page.getByRole('img', { name: 'Preview of screenshot.png' })).toHaveCount(0);
});

test('failed submission preserves draft, reuses uploaded images and sends the same retry ID', async ({ page }) => {
  await session(page, 'TEACHER');
  let uploads = 0;
  const ids: string[] = [];
  await page.route('**/api/feedback/images', route => { uploads += 1; return route.fulfill({ json: image }); });
  await page.route('**/api/feedback', route => {
    ids.push(route.request().postDataJSON().submissionId);
    return ids.length === 1 ? route.fulfill({ status: 503, json: { error: 'Please try again.' } }) : route.fulfill({ json: report });
  });
  await page.goto('/dashboard/classes');
  await page.getByRole('button', { name: 'Use dark theme' }).click();
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click();
  await page.getByLabel('Your feedback').fill(report.message);
  await page.screenshot({ path: '../tmp/feedback-scale-desktop.png' });
  await page.getByLabel('Attach feedback images').setInputFiles({ name: image.name, mimeType: image.mimeType, buffer: png });
  const send = page.getByRole('dialog').getByRole('button', { name: 'Send feedback', exact: true });
  await send.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Please try again.' })).toBeVisible();
  await expect(page.getByLabel('Your feedback')).toHaveValue(report.message);
  await send.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(uploads).toBe(1);
  expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]);
});

test('invalid attachments are rejected and in-flight submission blocks dismissal and duplicate clicks', async ({ page }) => {
  await session(page);
  let sends = 0;
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/feedback', async route => { sends += 1; await pending; await route.fulfill({ json: report }); });
  await page.goto('/dashboard/classes');
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click();
  await page.getByLabel('Attach feedback images').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert').filter({ hasText: 'Choose PNG, JPEG, or WebP' })).toBeVisible();
  await page.getByLabel('Your feedback').fill(report.message);
  const dialog = page.getByRole('dialog', { name: 'Send feedback' });
  await dialog.getByRole('button', { name: 'Send feedback', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Sending…', exact: true })).toBeDisabled();
  for (const radio of await dialog.getByRole('radio').all()) await expect(radio).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.mouse.click(2, 2);
  await expect(dialog).toBeVisible();
  release();
  await expect(dialog).toHaveCount(0);
  expect(sends).toBe(1);
});

test('admin filters reports, views an attachment and resolves feedback on mobile in dark mode', async ({ page }) => {
  await session(page, 'ADMIN');
  let resolved = false;
  await page.route(/\/api\/admin\/feedback/, route => {
    if (route.request().method() === 'PATCH') {
      expect(route.request().postDataJSON()).toEqual({ status: 'RESOLVED', expectedStatus: 'NEW' });
      resolved = true;
      return route.fulfill({ json: { ...report, status: 'RESOLVED' } });
    }
    const query = new URL(route.request().url()).searchParams;
    expect(query.get('status')).toBe('NEW');
    return route.fulfill({ json: { items: resolved ? [] : [report], nextCursor: null } });
  });
  await page.route(`**/api/feedback/images/${image.id}`, route => route.fulfill({ json: { url: `data:image/png;base64,${png.toString('base64')}` } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/feedback');
  await expect(page.getByRole('heading', { name: 'Feedback inbox', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use dark theme' }).click();
  await page.getByRole('combobox', { name: 'Feedback level' }).click();
  await page.getByRole('option', { name: 'Critical', exact: true }).click();
  await page.getByRole('button', { name: 'View feedback from SAT Student' }).click();
  const dialog = page.getByRole('dialog', { name: 'Feedback details' });
  await expectViewportModal(dialog);
  await expect(page.getByRole('img', { name: 'Feedback attachment: screenshot.png' })).toBeVisible();
  await page.screenshot({ path: '../tmp/feedback-admin-dark-mobile.png' });
  await page.getByRole('button', { name: 'Mark resolved' }).click();
  await expect(dialog.getByText('Resolved', { exact: true })).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(page.getByRole('heading', { name: 'No feedback found' })).toBeVisible();
  expect(resolved).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('student cannot open the admin inbox and sees no inbox navigation', async ({ page }) => {
  await session(page);
  await page.goto('/dashboard/feedback');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link', { name: 'Feedback inbox' })).toHaveCount(0);
});

test('desktop inbox handles loading errors, pagination and review conflicts', async ({ page }) => {
  await session(page, 'ADMIN');
  let failLoad = true;
  const second = { ...report, id: '00000000-0000-4000-8000-000000000003', level: 'IMPROVEMENT', message: 'Please make it easier to find my classes.', user: { ...report.user, name: 'Another student' }, attachments: [] };
  await page.route(/\/api\/admin\/feedback/, route => {
    if (route.request().method() === 'PATCH') return route.fulfill({ status: 409, json: { error: 'This feedback changed or is unavailable. Refresh before updating it.' } });
    if (failLoad) return route.fulfill({ status: 503, json: { error: 'Feedback is temporarily unavailable.' } });
    return route.fulfill({ json: new URL(route.request().url()).searchParams.has('cursor') ? { items: [second], nextCursor: null } : { items: [report], nextCursor: 'next-page' } });
  });
  await page.route(`**/api/feedback/images/${image.id}`, route => route.fulfill({ status: 503, json: { error: 'Image unavailable.' } }));
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/dashboard/feedback');
  await expect(page.getByRole('alert').filter({ hasText: 'Feedback is temporarily unavailable.' })).toBeVisible();
  failLoad = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('button', { name: 'Load more feedback', exact: true }).click();
  await expect(page.getByText(second.message, { exact: true })).toBeVisible();
  await page.screenshot({ path: '../tmp/feedback-admin-desktop.png' });
  await page.getByRole('button', { name: 'View feedback from SAT Student' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Image unavailable.' })).toBeVisible();
  await page.getByRole('button', { name: 'Start review', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'This feedback changed' })).toBeVisible();
  await expect(page.getByRole('dialog').getByText(report.message)).toBeVisible();
});
