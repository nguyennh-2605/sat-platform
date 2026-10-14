import { expect, test, type Page } from '@playwright/test';

const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.';
// After midnight in the study timezone, while a UTC CI runner is still on the previous day.
const studyClock = new Date('2026-10-13T18:30:00Z');
const dayKey = (offset = 0) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(studyClock);
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
test.use({ timezoneId: 'UTC' });
const task = { key: 'personal:one', id: 'one', source: 'PERSONAL', type: 'PERSONAL', title: 'Review algebra', description: 'Work through saved problems', className: null, classId: null, testId: null, createdAt: new Date().toISOString(), dueAt: null as string | null, plannedDate: null as string | null, plannedStartMinutes: null as number | null, plannedEndMinutes: null as number | null, completedAt: null as string | null, completed: false, completionMode: 'USER', priority: 'NORMAL', position: 1, href: null, canEdit: true, canDelete: true, canComplete: true };

async function chooseStudyDay(page: Page, value: string) {
  await page.getByRole('button', { name: 'Event date', exact: true }).click();
  const date = new Date(`${value}T00:00:00`);
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const dayButton = page.getByRole('grid').getByRole('button', { name: new RegExp(`${month} ${date.getDate()}(?:st|nd|rd|th)?, ${date.getFullYear()}`) });
  if (!await dayButton.count()) await page.getByRole('button', { name: /next month/i }).click();
  await dayButton.click();
}

async function setup(page: Page, { width = 1440, theme = 'light', failSchedule = false, failCreate = false, failPractice = false, failComplete = false, dense = false, planned = false, lowerTitle = false, emptyPractice = false, longPracticeTitle = false } = {}) {
  await page.clock.setFixedTime(studyClock);
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(({ token, theme }) => { localStorage.setItem('token', token); localStorage.setItem('userId', '7'); localStorage.setItem('userRole', 'STUDENT'); localStorage.setItem('userName', 'Alex Student'); localStorage.setItem('dashboardTheme', theme); }, { token, theme });
  let items = [
    { ...task, title: lowerTitle ? 'review algebra' : task.title, ...(planned ? { plannedDate: dayKey(), plannedStartMinutes: 540, plannedEndMinutes: 600 } : {}) },
    { ...task, key: 'student-test:assigned', id: 'assigned', source: 'CLASSROOM', type: 'TEST', title: 'Module check', className: 'SAT Class', testId: 9, deliveryId: 'assigned', dueAt: `${dayKey(4)}T10:00:00Z`, completionMode: 'SOURCE', href: '/test/9?deliveryId=assigned', canEdit: false, canDelete: false, canComplete: false },
  ];
  if (dense) {
    const titles = ['Linear equations practice', 'Review exponent rules', 'Reading: evidence questions', 'Vocabulary revision', 'Check saved mistakes', 'Practice ratios', 'Quadratic equations', 'Geometry recap', 'Weekend review'];
    items = items.concat(titles.map((title, index) => ({ ...task, key: `personal:preview-${index}`, id: `preview-${index}`, title, type: index === 2 || index === 7 ? 'QUIZ' : index === 3 ? 'VOCABULARY' : index === 4 ? 'ANNOUNCEMENT' : 'PERSONAL', plannedDate: dayKey(Math.floor(index / 2)), plannedStartMinutes: index === 4 ? null : 540 + index % 2 * 120, plannedEndMinutes: index === 4 ? null : 630 + index % 2 * 120, completed: index === 1, dueAt: index === 4 ? `${dayKey(3)}T10:00:00Z` : null })));
  }
  const schedules: Array<{ itemKey: string; plannedDate: string | null }> = [];
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: token, user: { id: 7, name: 'Alex Student', role: 'STUDENT' } } });
    if (path === '/api/student/overview') return route.fulfill({ json: {
      generatedAt: new Date().toISOString(), preferences: { satTestDate: `${dayKey(60)}T00:45:00Z`, currentScore: 1210, targetScore: 1450 },
      focus: { type: 'PRACTICE', title: 'Explore Math practice', description: 'Ready for a new session', actionLabel: 'Start practice', href: '/test/1', source: 'SELF_STUDY', testId: 1 },
      review: { savedMistakeCount: 2, href: '/dashboard/error-log' }, classroom: { available: true, membershipCount: 1, todos: [] },
      practice: emptyPractice ? [] : [{ id: 1, title: longPracticeTitle ? 'Advanced algebra: linear equations, functions and inequalities for SAT practice' : 'Math fundamentals', subject: 'MATH', mode: 'PRACTICE', questionCount: 22, duration: 35, attemptStatus: 'NOT_STARTED', progress: 0 }, { id: 2, title: 'Reading module', subject: 'RW', mode: 'PRACTICE', questionCount: 27, duration: 32, attemptStatus: 'DOING', progress: 40 }, { id: 3, title: 'Mixed review', subject: 'MATH', mode: 'EXAM', questionCount: 22, duration: 35, attemptStatus: 'COMPLETED', progress: 100 }],
      progress: { windowDays: 90, overallAccuracy: 72, completedTests: 2, questionsAnswered: 49, rwAccuracy: 75, mathAccuracy: 68, trend: [] }, recentResults: [],
    } });
    if (path === '/api/vocabulary/practice') return failPractice ? route.fulfill({ status: 503, json: { error: 'Schedule unavailable' } }) : route.fulfill({ json: { dueCount: 6, newCount: 10, studiedToday: 2, dailyReviewLimit: 20, dailyNewLimit: 10, activeSession: null, nextDueAt: null } });
    if (path === '/api/student/tasks' && request.method() === 'POST') { const body = request.postDataJSON(); if (failCreate) return route.fulfill({ status: 500, json: { error: 'Unable to save event' } }); items.push({ ...task, ...body, id: 'new', key: 'personal:new', description: body.details }); return route.fulfill({ status: 201, json: items.at(-1) }); }
    if (path === '/api/student/tasks') {
      const planned = items.filter(item => item.plannedDate);
      const week = planned.filter(item => item.plannedDate! >= dayKey() && item.plannedDate! <= dayKey(6));
      const weekCompleted = week.filter(item => item.completed).length;
      const calendar = [...new Set(planned.map(item => item.plannedDate))].map(date => ({ date, total: planned.filter(item => item.plannedDate === date).length, incomplete: planned.filter(item => item.plannedDate === date && !item.completed).length }));
      return route.fulfill({ json: { items, summary: { todayRemaining: planned.filter(item => !item.completed && item.plannedDate === dayKey()).length, weekCompleted, weekTotal: week.length, weekPercentage: week.length ? Math.round(100 * weekCompleted / week.length) : 0 }, calendar } });
    }
    if (path === '/api/student/tasks/schedule') {
      const body = request.postDataJSON(); schedules.push(body);
      if (failSchedule) return route.fulfill({ status: 500, json: { error: 'Unable to save study day' } });
      items = items.map(item => item.key === body.itemKey ? { ...item, plannedDate: body.plannedDate, plannedStartMinutes: body.plannedStartMinutes ?? item.plannedStartMinutes, plannedEndMinutes: body.plannedEndMinutes ?? item.plannedEndMinutes, ...(body.calendarColor !== undefined ? { calendarColor: body.calendarColor } : {}) } : item);
      return route.fulfill({ json: body });
    }
    if (path === '/api/student/tasks/state') { const body = request.postDataJSON(); if (failComplete) return route.fulfill({ status: 500, json: { error: 'Unable to update completion' } }); items = items.map(item => item.key === body.itemKey ? { ...item, completed: body.completed } : item); return route.fulfill({ json: body }); }
    if (path.startsWith('/api/student/tasks/') && request.method() === 'PATCH') { const body = request.postDataJSON(); items = items.map(item => item.id === path.split('/').at(-1) ? { ...item, ...body, description: body.details } : item); return route.fulfill({ json: {} }); }
    if (path.startsWith('/api/student/tasks/') && request.method() === 'DELETE') { items = items.filter(item => item.id !== path.split('/').at(-1)); return route.fulfill({ json: {} }); }
    return route.fulfill({ json: [] });
  });
  await page.goto('/dashboard');
  return { schedules, items: () => items };
}

const eventButton = (page: Page, title: string) => page.getByRole('button', { name: `Event: ${title}`, exact: true });
async function expectCompletedBox(page: Page, title: string) {
  const button = eventButton(page, title);
  await expect(button).toBeVisible();
  const overviewRow = page.locator('[data-overview-event]').filter({ has: button });
  const container = await overviewRow.count() ? overviewRow : button;
  const line = container.locator('[data-event-completion-line]');
  await expect(line).toBeVisible();
  const box = await container.boundingBox();
  const strike = await line.boundingBox();
  expect(Math.abs(strike!.x - box!.x)).toBeLessThan(1);
  expect(Math.abs(strike!.width - box!.width)).toBeLessThan(1);
  expect(Math.abs(strike!.y - box!.y - box!.height / 2)).toBeLessThan(1);
}
const timeSlot = (page: Page, date: string, minute: number) => page.locator(`[data-calendar-slot="${date}:${minute}"]`);
async function openPlanner(page: Page) { await page.getByRole('link', { name: 'Open planner' }).click(); await expect(page.getByRole('heading', { name: 'Study planner', exact: true })).toBeVisible(); }

test('overview keeps its original sections and opens the selected calendar date', async ({ page }) => {
  await setup(page);
  await expect(page.getByRole('region', { name: 'Study summary' })).toBeVisible();
  await expect(page.getByText('Practice Picks', { exact: true })).toBeVisible();
  await expect(page.getByText('Calendar', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Task view' }).click();
  await page.getByRole('option', { name: 'Tomorrow', exact: true }).click();
  await openPlanner(page);
  await expect(page.locator('[data-study-date]')).toHaveAttribute('data-study-date', dayKey(1));
  await expect(page.getByRole('tab', { name: 'Day', exact: true })).toHaveAttribute('data-state', 'active');
  await expect(page.getByRole('heading', { name: 'Unscheduled' })).toHaveCount(0);
});

test.describe('study dates in the Vietnamese browser timezone', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' });

  test('Today and Tomorrow agree with the UTC browser after platform midnight', async ({ page }) => {
    await setup(page, { planned: true });
    await expect(eventButton(page, 'Review algebra')).toBeVisible();
    await openPlanner(page);
    await expect(page.locator('[data-study-date]')).toHaveAttribute('data-study-date', '2026-10-14');
    await expect(timeSlot(page, '2026-10-14', 570)).toHaveCount(1);
    await page.goto('/dashboard');
    await page.getByRole('combobox', { name: 'Task view' }).click();
    await page.getByRole('option', { name: 'Tomorrow', exact: true }).click();
    await openPlanner(page);
    await expect(page.locator('[data-study-date]')).toHaveAttribute('data-study-date', '2026-10-15');
  });
});

for (const [width, theme] of [[320, 'light'], [390, 'dark'], [1440, 'light'], [1440, 'dark']] as const) {
  test(`Practice Picks keeps readable states and fits ${width}px in ${theme}`, async ({ page }) => {
    await setup(page, { width, theme, planned: true, longPracticeTitle: width < 400 });
    const picks = page.getByRole('region', { name: 'Practice Picks' });
    await picks.scrollIntoViewIfNeeded();
    await expect(picks.locator('[data-practice-pick]')).toHaveCount(3);
    await expect(picks.getByRole('button', { name: /^Start / })).toBeVisible();
    await expect(picks.getByRole('button', { name: 'Continue Reading module', exact: true })).toBeVisible();
    await expect(picks.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    await expect(picks.getByText('Completed', { exact: true })).toBeVisible();
    await expect(picks.getByRole('button', { name: 'Try again Mixed review', exact: true })).toBeVisible();
    expect(await picks.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await picks.screenshot({ path: `../tmp/student-practice-picks-${width}-${theme}.png`, animations: 'disabled' });
  });
}

test('Practice Picks keeps start, continue and retry actions connected to the selected test', async ({ page }) => {
  await setup(page);
  for (const [name, id, title, duration] of [['Start Math fundamentals', 1, 'Math fundamentals', 35], ['Continue Reading module', 2, 'Reading module', 32], ['Try again Mixed review', 3, 'Mixed review', 35]] as const) {
    await page.getByRole('region', { name: 'Practice Picks' }).getByRole('button', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/test/${id}$`));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('current_exam_info') || '{}'))).toMatchObject({ id, title, duration });
    await page.goto('/dashboard');
  }
});

test('Practice Picks has an empty state and still links to the practice library', async ({ page }) => {
  await setup(page, { width: 320, emptyPractice: true });
  const picks = page.getByRole('region', { name: 'Practice Picks' });
  await picks.scrollIntoViewIfNeeded();
  await expect(picks.getByText('No practice tests available', { exact: true })).toBeVisible();
  await expect(picks.getByRole('link', { name: 'View all', exact: true })).toHaveAttribute('href', '/dashboard/practice-test');
});

test('unplanned tasks and teacher deadlines do not appear in Overview or any calendar view', async ({ page }) => {
  await setup(page);
  await expect(page.getByText('Nothing here yet', { exact: true })).toBeVisible();
  await expect(page.locator('[data-overview-event]')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Study summary' })).toContainText('All caught up');
  await openPlanner(page);
  for (const view of ['Day', 'Week', 'Month']) {
    await page.getByRole('tab', { name: view, exact: true }).click();
    await expect(page.locator('[data-event-key]')).toHaveCount(0);
  }
});

for (const [width, theme] of [[320, 'light'], [1440, 'dark']] as const) {
  test(`Overview goal and SAT dialogs center on the viewport at ${width}px`, async ({ page }) => {
    await setup(page, { width, theme, planned: true });
    for (const name of ['Edit score goal', 'Change SAT date']) {
      const trigger = page.getByRole('button', { name, exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const centered = await dialog.evaluate(element => {
        const box = element.getBoundingClientRect();
        return { x: Math.abs(box.x + box.width / 2 - innerWidth / 2), y: Math.abs(box.y + box.height / 2 - innerHeight / 2), fits: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight };
      });
      expect(centered.x).toBeLessThan(1);
      expect(centered.y).toBeLessThan(1);
      expect(centered.fits).toBe(true);
      await page.screenshot({ path: `../tmp/student-overview-${name === 'Edit score goal' ? 'goal' : 'sat'}-modal-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
      await page.mouse.click(4, 100);
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  });

  test(`Overview completion circles toggle without opening a dialog at ${width}px`, async ({ page }) => {
    const state = await setup(page, { width, theme, planned: true });
    const row = page.locator('[data-overview-event="personal:one"]');
    const circle = row.getByRole('checkbox');
    await expect(circle).toHaveAccessibleName('Complete Review algebra');
    await expect(circle).toHaveCSS('width', '24px');
    expect(await circle.evaluate(element => parseFloat(getComputedStyle(element).borderRadius) >= element.clientWidth / 2)).toBe(true);
    await circle.click();
    await expect(circle).toBeChecked();
    await expect(circle).toHaveAccessibleName('Reopen Review algebra');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectCompletedBox(page, 'Review algebra');
    await expect(page.getByRole('region', { name: 'Study summary' })).toContainText('All caught up');
    expect(state.items()[0].completed).toBe(true);
    await circle.focus();
    await page.keyboard.press('Space');
    await expect(circle).not.toBeChecked();
    await expect(row.locator('[data-event-completion-line]')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(state.items()[0].completed).toBe(false);
    await circle.click();
    await expect(circle).toBeChecked();
    await page.reload();
    await expect(circle).toBeChecked();
    await openPlanner(page);
    await expectCompletedBox(page, 'Review algebra');
  });
}

test('a failed quick completion keeps the task pending and allows a retry', async ({ page }) => {
  const state = await setup(page, { planned: true, failComplete: true });
  const row = page.locator('[data-overview-event="personal:one"]');
  const circle = row.getByRole('checkbox');
  await circle.click();
  await expect(page.getByText('Unable to update completion', { exact: true })).toBeVisible();
  await expect(circle).toBeEnabled();
  await expect(circle).not.toBeChecked();
  await expect(row.locator('[data-event-completion-line]')).toHaveCount(0);
  expect(state.items()[0].completed).toBe(false);
});

for (const [width, theme] of [[320, 'light'], [1440, 'dark']] as const) {
  test(`Overview events share calendar details, edits and completion at ${width}px`, async ({ page }) => {
    const state = await setup(page, { width, theme, planned: true, lowerTitle: true });
    const row = page.locator('[data-overview-event="personal:one"]');
    await expect(row).toContainText('Review algebra');
    await expect(row).toContainText('09:00 – 10:00');
    await expect(row).not.toContainText('Personal');
    await expect(page.getByRole('button', { name: /^Reorder / })).toHaveCount(0);
    await expect(row.getByRole('checkbox', { name: 'Complete Review algebra', exact: true })).not.toBeChecked();
    await expect(eventButton(page, 'Review algebra')).not.toHaveClass(/bg-calendar-/);
    const titleBox = await row.locator('[data-event-title]').boundingBox();
    const timeBox = await row.locator('[data-event-time]').boundingBox();
    expect(timeBox!.x).toBeGreaterThan(titleBox!.x);
    expect(Math.abs(timeBox!.y - titleBox!.y)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `../tmp/student-overview-events-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
    await eventButton(page, 'Review algebra').click();
    await expect(page.getByRole('dialog')).toContainText('Event details');
    await expect(page.getByRole('dialog')).toContainText('Work through saved problems');
    await expect(page.getByRole('dialog').getByRole('textbox')).toHaveCount(0);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Start time').fill('11:00');
    await page.getByLabel('End time').fill('12:30');
    await page.getByRole('combobox', { name: 'Event color' }).click();
    await page.getByRole('option', { name: 'Teal', exact: true }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(row).toContainText('11:00 – 12:30');
    await expect(eventButton(page, 'Review algebra')).not.toHaveClass(/bg-calendar-/);
    await openPlanner(page);
    await expect(eventButton(page, 'Review algebra')).toHaveClass(/bg-calendar-vocabulary-soft/);
    await expect(eventButton(page, 'Review algebra')).toContainText('11:00 – 12:30');
    await eventButton(page, 'Review algebra').click();
    await page.getByRole('button', { name: 'Mark complete', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('/dashboard');
    await expectCompletedBox(page, 'Review algebra');
    await page.screenshot({ path: `../tmp/student-overview-events-completed-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
    await eventButton(page, 'Review algebra').click();
    await page.getByRole('button', { name: 'Reopen event', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(state.items()[0].completed).toBe(false);
    await expect(row.locator('[data-event-completion-line]')).toHaveCount(0);
    await eventButton(page, 'Review algebra').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete event', exact: true }).click();
    await expect(row).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await openPlanner(page);
    await expect(eventButton(page, 'Review algebra')).toHaveCount(0);
  });
}

test('clicking a time slot creates an event with a persisted start and end time', async ({ page }) => {
  const state = await setup(page);
  await openPlanner(page);
  await timeSlot(page, dayKey(), 570).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Start time')).toHaveValue('09:30');
  await expect(page.getByLabel('End time')).toHaveValue('10:30');
  await page.getByLabel('Event title', { exact: true }).fill('read an SAT passage');
  await page.getByLabel('Notes', { exact: true }).fill('Practice evidence questions');
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.items().find(item => item.id === 'new')).toMatchObject({ title: 'Read an SAT passage', plannedDate: dayKey(), plannedStartMinutes: 570, plannedEndMinutes: 630 });
  await expect(eventButton(page, 'Read an SAT passage')).toBeVisible();
  await expect(eventButton(page, 'Read an SAT passage')).toHaveCSS('border-radius', '0px');
  const event = page.locator('[data-event-key="personal:new"]');
  await expect(event).toHaveCSS('top', '608px');
  await expect(event).toHaveCSS('height', '64px');
  await page.reload();
  await expect(eventButton(page, 'Read an SAT passage')).toBeVisible();
});

test('event editing persists title, date and time together, and completed events stay struck through', async ({ page }) => {
  const state = await setup(page, { planned: true });
  await openPlanner(page);
  await eventButton(page, 'Review algebra').click();
  await expect(page.getByRole('dialog')).toContainText('Event details');
  await expect(page.getByLabel('Event title', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('Work through saved problems');
  await expect(page.getByRole('dialog')).toContainText('09:00 – 10:00');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Event title', { exact: true })).toBeFocused();
  await page.getByLabel('Event title', { exact: true }).fill('Review algebra carefully');
  await page.getByLabel('Start time').fill('11:00');
  await page.getByLabel('End time').fill('12:30');
  await chooseStudyDay(page, dayKey(1));
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.items()[0]).toMatchObject({ title: 'Review algebra carefully', plannedDate: dayKey(1), plannedStartMinutes: 660, plannedEndMinutes: 750 });
  await eventButton(page, 'Review algebra carefully').click();
  await page.getByRole('button', { name: 'Mark complete', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(eventButton(page, 'Review algebra carefully')).toBeVisible();
  await expectCompletedBox(page, 'Review algebra carefully');
  await page.reload();
  await eventButton(page, 'Review algebra carefully').click();
  await page.getByRole('button', { name: 'Reopen event', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.items()[0].completed).toBe(false);
  await eventButton(page, 'Review algebra carefully').click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete event', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.items().some(item => item.id === 'one')).toBe(false);
});

test('invalid times keep the event form and do not save', async ({ page }) => {
  const state = await setup(page);
  await openPlanner(page);
  await timeSlot(page, dayKey(), 540).click();
  await page.getByLabel('Event title', { exact: true }).fill('Invalid range');
  await page.getByLabel('End time').fill('08:30');
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'End time' })).toBeVisible();
  expect(state.items()).toHaveLength(2);
});

test('failed creation keeps the draft available and does not show a phantom event', async ({ page }) => {
  const state = await setup(page, { failCreate: true });
  await openPlanner(page);
  await timeSlot(page, dayKey(), 540).click();
  await page.getByLabel('Event title', { exact: true }).fill('Retry event');
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await expect(page.getByText('Unable to save event', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Event title', { exact: true })).toHaveValue('Retry event');
  expect(state.items()).toHaveLength(2);
});

test('linking coursework schedules it without editing its deadline or source completion', async ({ page }) => {
  const state = await setup(page);
  await openPlanner(page);
  await timeSlot(page, dayKey(), 660).click();
  await page.getByRole('combobox', { name: 'Link a task (optional)' }).click();
  await page.getByRole('option', { name: 'Module check · Test', exact: true }).click();
  await expect(page.getByLabel('Event title', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.items().find(item => item.id === 'assigned')).toMatchObject({ plannedDate: dayKey(), plannedStartMinutes: 660, plannedEndMinutes: 720, dueAt: `${dayKey(4)}T10:00:00Z`, completed: false });
  await eventButton(page, 'Module check').click();
  await expect(page.getByRole('button', { name: 'Mark complete', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Month', exact: true }).click();
  await expect(eventButton(page, 'Module check')).toHaveCount(1);
  await page.goto('/dashboard');
  await expect(eventButton(page, 'Module check')).toContainText('11:00 – 12:00');
  await expect(page.locator('[data-overview-event="student-test:assigned"]').getByRole('checkbox')).toBeDisabled();
  await eventButton(page, 'Module check').click();
  await expect(page.getByRole('dialog')).toContainText('Event details');
  await expect(page.getByRole('button', { name: 'Mark complete', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
});

test('keyboard slot navigation and outside dismissal preserve unsaved input', async ({ page }) => {
  await setup(page);
  await openPlanner(page);
  const slot = timeSlot(page, dayKey(), 540);
  await slot.focus();
  await page.keyboard.press('ArrowDown');
  await expect(timeSlot(page, dayKey(), 570)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(timeSlot(page, dayKey(), 570)).toBeFocused();
  await timeSlot(page, dayKey(), 570).click();
  await page.getByLabel('Event title', { exact: true }).fill('Unsaved event');
  await page.getByRole('dialog').locator('..').click({ position: { x: 10, y: 10 } });
  await expect(page.getByRole('dialog')).toContainText('Discard changes?');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Event title', { exact: true })).toHaveValue('Unsaved event');
  await page.getByRole('button', { name: 'Event date', exact: true }).click();
  await expect(page.getByRole('grid')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('grid')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Day, Week and Month retain the selected date and expose time slots or day creation', async ({ page }) => {
  await setup(page, { planned: true });
  await openPlanner(page);
  await expect(page.locator('[data-calendar-slot]')).toHaveCount(48);
  await page.getByRole('tab', { name: 'Week', exact: true }).click();
  await expect(page.locator('[data-calendar-slot]')).toHaveCount(336);
  await expect(eventButton(page, 'Review algebra')).toBeVisible();
  await page.getByRole('tab', { name: 'Month', exact: true }).click();
  await expect(page.locator('[data-calendar-slot]')).toHaveCount(0);
  await expect(page.locator('[data-study-date]')).toHaveAttribute('data-study-date', dayKey());
  await page.locator(`[data-study-day="${dayKey(1)}"]`).getByRole('button', { name: /^Add event on/ }).click();
  await expect(page.getByRole('checkbox', { name: 'All-day event', exact: true })).toBeChecked();
  await page.getByLabel('Event title', { exact: true }).fill('All-day review');
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Day', exact: true }).click();
  await expect(eventButton(page, 'All-day review')).toBeVisible();
});

test('legacy day-only events remain in All day and can be given a time', async ({ page }) => {
  const state = await setup(page);
  await openPlanner(page);
  await page.getByRole('button', { name: 'Add event', exact: true }).click();
  await page.getByRole('combobox', { name: 'Link a task (optional)' }).click();
  await page.getByRole('option', { name: 'Review algebra · Personal', exact: true }).click();
  await page.getByRole('checkbox', { name: 'All-day event' }).check();
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(eventButton(page, 'Review algebra')).toContainText('All day');
  await eventButton(page, 'Review algebra').click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('checkbox', { name: 'All-day event' }).uncheck();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.items()[0].plannedStartMinutes).toBe(540);
});

test('dragging an event moves its time and Undo restores the entire previous range', async ({ page }) => {
  const state = await setup(page, { planned: true });
  await openPlanner(page);
  await timeSlot(page, dayKey(), 660).scrollIntoViewIfNeeded();
  const from = await eventButton(page, 'Review algebra').boundingBox();
  const to = await timeSlot(page, dayKey(), 660).boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + 15);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2 + 10, from!.y + 25);
  await page.mouse.move(to!.x + to!.width / 2, to!.y + 15, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeInViewport();
  expect(state.schedules.at(-1)).toMatchObject({ plannedStartMinutes: 660, plannedEndMinutes: 720 });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
  expect(state.items()[0]).toMatchObject({ plannedStartMinutes: 540, plannedEndMinutes: 600 });
});

test('invalid deep-link dates fall back to today', async ({ page }) => {
  await setup(page);
  await page.goto('/dashboard/study-planner?date=2026-02-29&view=day');
  await expect(page.locator('[data-study-date]')).toHaveAttribute('data-study-date', dayKey());
});

for (const width of [320, 1440]) {
  test(`calendar wheel scrolling moves the entire planner page at ${width}px`, async ({ page }) => {
    await setup(page, { width, planned: true });
    await page.setViewportSize({ width, height: 640 });
    await openPlanner(page);
    const planner = page.locator('[data-study-planner-page]');
    for (const view of ['Day', 'Week', 'Month']) {
      await page.getByRole('heading', { name: 'Study planner', exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('tab', { name: view, exact: true }).click();
      const calendar = view === 'Month' ? page.getByRole('region', { name: 'Month calendar' }) : page.locator('[data-time-grid]');
      const before = await planner.evaluate(element => element.scrollTop);
      const bounds = await calendar.boundingBox();
      await page.mouse.move(bounds!.x + 100, bounds!.y + 160);
      await page.mouse.wheel(0, 400);
      await expect.poll(() => planner.evaluate(element => element.scrollTop)).toBeGreaterThan(before);
      expect(await calendar.evaluate(element => element.scrollTop)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole('heading', { name: 'Study planner', exact: true }).scrollIntoViewIfNeeded();
    await page.getByRole('tab', { name: 'Day', exact: true }).click();
    await timeSlot(page, dayKey(), 1410).click();
    await expect(page.getByLabel('Start time')).toHaveValue('23:30');
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}

for (const [width, theme] of [[320, 'light'], [390, 'dark'], [1440, 'light'], [1440, 'dark']] as const) {
  test(`time calendar, modal and toolbar fit ${width}px in ${theme}`, async ({ page }) => {
    await setup(page, { width, theme, dense: true });
    await openPlanner(page);
    await expect(page.getByRole('heading', { name: 'Unscheduled' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const view of ['Day', 'Week', 'Month']) {
      await page.getByRole('tab', { name: view, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('heading', { name: 'Study planner', exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('tab', { name: view, exact: true }).blur();
      await page.screenshot({ path: `../tmp/student-planner-time-${view.toLowerCase()}-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
    }
    await page.getByRole('tab', { name: 'Day', exact: true }).click();
    await page.getByRole('button', { name: 'Add event', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.getByRole('dialog').evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true);
    expect(await page.getByRole('dialog').locator('..').evaluate(element => element.getBoundingClientRect().left)).toBe(0);
    expect(await page.getByRole('dialog').evaluate(element => Math.abs(element.getBoundingClientRect().left + element.getBoundingClientRect().width / 2 - innerWidth / 2))).toBeLessThan(1);
    await page.screenshot({ path: `../tmp/student-planner-event-modal-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await eventButton(page, 'Linear equations practice').click();
    await expect(page.getByRole('dialog')).toContainText('Event details');
    await expect(page.getByRole('dialog').getByRole('textbox')).toHaveCount(0);
    await page.screenshot({ path: `../tmp/student-planner-event-details-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Edit event');
    await page.screenshot({ path: `../tmp/student-planner-event-edit-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
test('an event can end at 24:00 without spilling into the next study day', async ({ page }) => {
  const state = await setup(page);
  await openPlanner(page);
  await timeSlot(page, dayKey(), 1410).click();
  await expect(page.getByLabel('Start time')).toHaveValue('23:30');
  await expect(page.getByLabel('End time')).toHaveValue('24:00');
  await page.getByLabel('Event title', { exact: true }).fill('Late review');
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.items().find(item => item.id === 'new')).toMatchObject({ plannedDate: dayKey(), plannedStartMinutes: 1410, plannedEndMinutes: 1440 });
  await expect(eventButton(page, 'Late review')).toBeVisible();
});

test('the event modal remains within a short mobile viewport', async ({ page }) => {
  await setup(page, { width: 320 });
  await page.setViewportSize({ width: 320, height: 568 });
  await openPlanner(page);
  await page.getByRole('button', { name: 'Add event', exact: true }).click();
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate(element => element.getBoundingClientRect().top >= 0 && element.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  await expect(page.getByRole('button', { name: 'Create event', exact: true })).toBeVisible();
  await page.getByLabel('Notes', { exact: true }).fill('Reachable by scrolling the form');
  await page.screenshot({ path: '../tmp/student-planner-event-modal-320-short.png', fullPage: true, animations: 'disabled' });
});

test('a failed move rolls the event back to its original day and time', async ({ page }) => {
  const state = await setup(page, { planned: true, failSchedule: true });
  await openPlanner(page);
  await timeSlot(page, dayKey(), 660).scrollIntoViewIfNeeded();
  const from = await eventButton(page, 'Review algebra').boundingBox();
  const to = await timeSlot(page, dayKey(), 660).boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + 15);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2 + 10, from!.y + 25);
  await page.mouse.move(to!.x + to!.width / 2, to!.y + 15, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText('Unable to save study day', { exact: true })).toBeVisible();
  await expect(page.locator('[data-event-key="personal:one"]')).toHaveCSS('top', '576px');
  expect(state.items()[0]).toMatchObject({ plannedDate: dayKey(), plannedStartMinutes: 540, plannedEndMinutes: 600 });
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
});

test('personal events retain selected colors, neutral text and distinct hour dividers', async ({ page }) => {
  const state = await setup(page);
  await openPlanner(page);
  await expect(page.getByText('Times in Asia/Ho_Chi_Minh. Select a time slot to add an event.', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-calendar-weekday]').first()).toHaveCSS('font-size', '14px');
  await expect(page.locator('[data-calendar-hour="09:00"]')).toHaveCSS('font-size', '14px');
  const halfHour = timeSlot(page, dayKey(), 540);
  const wholeHour = timeSlot(page, dayKey(), 570);
  const divider = (element: HTMLElement | SVGElement) => getComputedStyle(element).borderBottomColor;
  expect(await halfHour.evaluate(divider)).not.toBe(await wholeHour.evaluate(divider));
  await halfHour.click();
  await page.getByLabel('Event title', { exact: true }).fill('Colored revision');
  await page.getByRole('combobox', { name: 'Event color', exact: true }).click();
  await page.getByRole('option', { name: 'Violet', exact: true }).click();
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.items().find(item => item.id === 'new')).toMatchObject({ calendarColor: 'VIOLET' });
  const event = eventButton(page, 'Colored revision');
  await expect(event).toHaveClass(/bg-calendar-coursework-soft/);
  const firstBackground = await event.evaluate(element => getComputedStyle(element).backgroundColor);
  const titleColor = await event.locator('[data-event-title]').evaluate(element => getComputedStyle(element).color);
  expect(titleColor).toBe(await page.getByRole('heading', { name: 'Study planner', exact: true }).evaluate(element => getComputedStyle(element).color));
  const timeColor = await event.locator('[data-event-time]').evaluate(element => getComputedStyle(element).color);
  expect(timeColor).not.toBe(titleColor);
  await page.reload();
  await expect(event).toHaveClass(/bg-calendar-coursework-soft/);
  await event.click();
  await expect(page.getByRole('dialog')).toContainText('Violet');
  await expect(page.getByRole('combobox', { name: 'Event color', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Event color', exact: true })).toContainText('Violet');
  await page.getByRole('combobox', { name: 'Event color', exact: true }).click();
  await page.getByRole('option', { name: 'Teal', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.items().find(item => item.id === 'new')).toMatchObject({ calendarColor: 'TEAL' });
  await expect(event).toHaveClass(/bg-calendar-vocabulary-soft/);
  // The button transitions its background after the modal closes; wait for the rendered color.
  await expect(event).not.toHaveCSS('background-color', firstBackground);
  await page.reload();
  await expect(event).toHaveClass(/bg-calendar-vocabulary-soft/);
  await expect(event).not.toHaveCSS('background-color', firstBackground);
});
