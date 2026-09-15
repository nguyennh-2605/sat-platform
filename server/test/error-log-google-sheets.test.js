const test = require('node:test');
const assert = require('node:assert/strict');

const {
  _errorLogGoogleSheetsHelpers: {
    EXPORT_HEADERS,
    attachPartialSpreadsheet,
    buildExportCellRows,
    buildLayoutRequests,
    categoryOptions,
    chunkCellRows,
    entrySourceUrl,
    normalizeGoogleAccessToken,
    normalizePlatformOrigin,
    mapGoogleError,
    richTextCell,
  },
} = require('../src/services/error-log-google-sheets.service');

const SYSTEM_ENTRY = {
  id: '00000000-0000-4000-8000-000000000001',
  origin: 'SYSTEM_QUESTION',
  source: '=Practice Test 4 · Module 2 · Question 4',
  sourceUrl: null,
  category: 'Words in Context',
  correctAnswer: 'B',
  userAnswer: 'D',
  whyWrong: '<p>I guessed <strong>precipitating</strong>.</p><ul><li>It looked familiar &amp; plausible.</li></ul>',
  whyRight: '<p>The context means <em>caused</em>.</p>',
  questionId: 10,
};

test('native export rows follow the reference columns and keep user text non-executable', () => {
  const rows = buildExportCellRows([SYSTEM_ENTRY], 'http://localhost:5173');
  assert.deepEqual(rows[0].values.map(cell => cell.userEnteredValue.stringValue), EXPORT_HEADERS);
  assert.equal(rows[1].values.length, 8);
  assert.equal(rows[1].values[0].userEnteredValue.numberValue, 1);
  assert.equal(rows[1].values[1].userEnteredValue.stringValue, 'Words in Context');
  assert.equal(rows[1].values[2].userEnteredValue.stringValue, SYSTEM_ENTRY.source);
  assert.equal(rows[1].values[2].userEnteredValue.formulaValue, undefined);
  assert.equal(rows[1].values[2].textFormatRuns[0].format.link.uri, 'http://localhost:5173/dashboard/error-log');
  assert.equal(rows[1].values[5].userEnteredValue.stringValue, 'I guessed precipitating.\n\n• It looked familiar & plausible.');
  assert.deepEqual(rows[1].values[5].textFormatRuns, [
    { startIndex: 0, format: {} },
    { startIndex: 10, format: { bold: true } },
    { startIndex: 23, format: {} },
  ]);
  assert.equal(rows[1].values[6].userEnteredValue.stringValue, 'The context means caused.');
  assert.ok(rows[1].values[6].textFormatRuns.some(run => run.format.italic));
  assert.equal(rows[1].values[7].userEnteredValue.stringValue, '');
});

test('rich text cells preserve combined formats, links, and UTF-16 run indexes', () => {
  const cell = richTextCell('<p>🙂 <strong><em>Both</em></strong> <u>under</u> <a href="https://example.com/?a=1&amp;b=2">link</a></p>');
  assert.equal(cell.userEnteredValue.stringValue, '🙂 Both under link');
  assert.deepEqual(cell.textFormatRuns, [
    { startIndex: 0, format: {} },
    { startIndex: 3, format: { bold: true, italic: true } },
    { startIndex: 7, format: {} },
    { startIndex: 8, format: { underline: true } },
    { startIndex: 13, format: {} },
    { startIndex: 14, format: { link: { uri: 'https://example.com/?a=1&b=2' } } },
  ]);
});

test('system sources return to Error Log while manual sources keep validated links', () => {
  assert.equal(entrySourceUrl(SYSTEM_ENTRY, 'https://sat.example'), 'https://sat.example/dashboard/error-log');
  assert.equal(entrySourceUrl({ origin: 'MANUAL', sourceUrl: 'https://example.com/task' }, 'https://sat.example'), 'https://example.com/task');
  assert.equal(entrySourceUrl({ origin: 'MANUAL', sourceUrl: 'javascript:alert(1)' }, 'https://sat.example'), null);
});

test('layout requests preserve the reference styling, dropdown, and fitted data rows', () => {
  const categories = ['Words in Context', 'Inferences'];
  const requests = buildLayoutRequests({ sheetId: 7, rowCount: 2, categories });
  const validation = requests.find(request => request.setDataValidation)?.setDataValidation;
  assert.deepEqual(validation.range, { sheetId: 7, startRowIndex: 1, endRowIndex: 3, startColumnIndex: 1, endColumnIndex: 2 });
  assert.deepEqual(validation.rule.condition.values, categories.map(userEnteredValue => ({ userEnteredValue })));
  const categoryRules = requests.filter(request => request.addConditionalFormatRule);
  assert.equal(categoryRules.length, 2);
  assert.equal(categoryRules[0].addConditionalFormatRule.rule.booleanRule.condition.type, 'TEXT_EQ');
  assert.ok(requests.some(request => request.autoResizeDimensions?.dimensions.dimension === 'ROWS'));
  assert.ok(requests.some(request => request.updateSheetProperties?.properties.gridProperties.frozenRowCount === 1));
});

test('export input validation accepts only safe tokens and configured platform origins', () => {
  assert.equal(normalizeGoogleAccessToken('a'.repeat(20)), 'a'.repeat(20));
  assert.throws(() => normalizeGoogleAccessToken('short'), error => error.statusCode === 400);
  assert.throws(() => normalizeGoogleAccessToken(`valid${'a'.repeat(20)} token`), error => error.statusCode === 400);
  assert.equal(normalizePlatformOrigin('http://localhost:5173'), 'http://localhost:5173');
  assert.throws(() => normalizePlatformOrigin('https://attacker.example'), error => error.statusCode === 400);
  assert.throws(() => normalizePlatformOrigin('javascript:alert(1)'), error => error.statusCode === 400);
});

test('large cell payloads are split into ordered, non-overlapping update chunks', () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({ values: [{ userEnteredValue: { stringValue: `${index}-${'x'.repeat(20)}` } }] }));
  const chunks = chunkCellRows(rows, 100);
  assert.ok(chunks.length > 1);
  assert.deepEqual(chunks.flatMap(chunk => chunk.rows), rows);
  chunks.forEach((chunk, index) => {
    assert.equal(chunk.startRowIndex, chunks.slice(0, index).reduce((sum, item) => sum + item.rows.length, 0));
  });
});

test('category options contain every SAT skill plus distinct legacy values', () => {
  const options = categoryOptions([
    { category: 'Words in Context' },
    { category: null },
    { category: 'Words in Context' },
    { category: 'Algebra' },
  ]);
  assert.equal(options[0], 'General');
  assert.ok(options.includes('Words in Context'));
  assert.ok(options.includes('Linear Equations in One Variable'));
  assert.equal(options.at(-1), 'Algebra');
  assert.equal(options.filter(category => category === 'Words in Context').length, 1);
});

test('Google API errors distinguish scopes, disabled APIs, policy, and quota failures', () => {
  const mapped = [
    mapGoogleError({ response: { status: 403, data: { error: { errors: [{ reason: 'insufficientPermissions' }] } } } }),
    mapGoogleError({ response: { status: 403, data: { error: { errors: [{ reason: 'accessNotConfigured' }] } } } }),
    mapGoogleError({ response: { status: 403, data: { error: { details: [{ reason: 'DOMAIN_POLICY' }] } } } }),
    mapGoogleError({ response: { status: 403, data: { error: { status: 'RESOURCE_EXHAUSTED' } } } }),
    mapGoogleError({ response: { status: 403, data: { error: { message: 'Permission denied for an unknown reason.' } } } }),
  ];

  assert.deepEqual(mapped.map(error => [error.statusCode, error.body.code]), [
    [403, 'GOOGLE_SHEETS_PERMISSION_DENIED'],
    [503, 'GOOGLE_SHEETS_API_DISABLED'],
    [403, 'GOOGLE_SHEETS_POLICY_BLOCKED'],
    [503, 'GOOGLE_SHEETS_RATE_LIMITED'],
    [403, 'GOOGLE_SHEETS_PERMISSION_DENIED'],
  ]);
  assert.match(mapped[4].body.message, /API is enabled/);
});

test('a post-create failure exposes the incomplete spreadsheet without exposing the token', () => {
  const error = attachPartialSpreadsheet(
    mapGoogleError({ response: { status: 429 } }),
    { spreadsheetId: 'sheet-123', spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit' },
  );
  assert.equal(error.statusCode, 503);
  assert.equal(error.body.partialSpreadsheetId, 'sheet-123');
  assert.equal(error.body.partialSpreadsheetUrl, 'https://docs.google.com/spreadsheets/d/sheet-123/edit');
  assert.match(error.body.message, /may be incomplete/);
  assert.equal(Object.hasOwn(error.body, 'googleAccessToken'), false);
});
