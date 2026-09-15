const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { corsOptions } = require('../config/cors');
const { richTextToSheetText } = require('../utils/error-log-rich-text');
const { skills } = require('../utils/question-taxonomy');

const SHEET_TITLE = 'Error Log';
const EXPORT_HEADERS = ['', 'Category', 'Source', 'Answer', 'Wrong Answer', 'Why choose wrong', 'Why ans right', 'Tips, lesson'];
const MAX_GOOGLE_ACCESS_TOKEN_LENGTH = 4096;
const MAX_CELL_CHARACTERS = 50_000;
const MAX_UPDATE_CHARACTERS = 400_000;
const MAX_DROPDOWN_OPTIONS = 500;
const CANONICAL_ERROR_LOG_CATEGORIES = ['General', ...skills.map(skill => skill.name)];

const COLORS = {
  black: { red: 0, green: 0, blue: 0 },
  white: { red: 1, green: 1, blue: 1 },
  header: { red: 0, green: 1, blue: 1 },
  correct: { red: 0.41568628, green: 0.65882355, blue: 0.30980393 },
  wrong: { red: 1, green: 0, blue: 0 },
  whyWrong: { red: 0.95686275, green: 0.8, blue: 0.8 },
  whyRight: { red: 0.8509804, green: 0.91764706, blue: 0.827451 },
  tips: { red: 0.8117647, green: 0.8862745, blue: 0.9529412 },
};

const REFERENCE_CATEGORY_COLORS = new Map([
  ['Words in Context', { red: 1, green: 0.8980392, blue: 0.627451 }],
  ['Text Structure and Purpose', { red: 1, green: 0.78431374, blue: 0.6666667 }],
  ['Transitions', { red: 0.7490196, green: 0.88235295, blue: 0.9647059 }],
  ['Rhetorical Synthesis', { red: 0.83137256, green: 0.92941177, blue: 0.7372549 }],
  ['Central Ideas and Details', { red: 0.7764706, green: 0.85882354, blue: 0.88235295 }],
  ['Command of Evidence', { red: 0.9019608, green: 0.8117647, blue: 0.9490196 }],
  ['Boundaries', { red: 0.06666667, green: 0.4509804, blue: 0.29411766 }],
  ['Inferences', { red: 0.69411767, green: 0.007843138, blue: 0.007843138 }],
]);

const FALLBACK_CATEGORY_COLORS = [
  { red: 1, green: 0.8980392, blue: 0.627451 },
  { red: 0.7490196, green: 0.88235295, blue: 0.9647059 },
  { red: 0.83137256, green: 0.92941177, blue: 0.7372549 },
  { red: 0.9019608, green: 0.8117647, blue: 0.9490196 },
  { red: 0.7764706, green: 0.85882354, blue: 0.88235295 },
];

const normalizeGoogleAccessToken = value => {
  if (typeof value !== 'string') {
    throw new ApiError(400, { code: 'GOOGLE_SHEETS_AUTH_REQUIRED', message: 'Connect Google Drive before exporting.' });
  }
  const token = value.trim();
  if (token.length < 20 || token.length > MAX_GOOGLE_ACCESS_TOKEN_LENGTH || /[\s\u0000-\u001f\u007f]/.test(token)) {
    throw new ApiError(400, { code: 'GOOGLE_SHEETS_AUTH_REQUIRED', message: 'Google authorization is invalid or expired. Please reconnect.' });
  }
  return token;
};

const normalizePlatformOrigin = value => {
  if (typeof value !== 'string') {
    throw new ApiError(400, { message: 'Platform origin is required for exported source links.' });
  }
  let origin;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value) throw new Error();
    origin = parsed.origin;
  } catch {
    throw new ApiError(400, { message: 'Platform origin must be a complete http or https origin.' });
  }
  if (!Array.isArray(corsOptions.origin) || !corsOptions.origin.includes(origin)) {
    throw new ApiError(400, { message: 'Platform origin is not allowed.' });
  }
  return origin;
};

const cellText = value => String(value ?? '').slice(0, MAX_CELL_CHARACTERS);
const stringCell = value => ({ userEnteredValue: { stringValue: cellText(value) } });
const numberCell = value => ({ userEnteredValue: { numberValue: value } });

const linkedCell = (label, uri) => {
  const value = cellText(label);
  const cell = stringCell(value);
  if (!value || !uri) return cell;
  return {
    ...cell,
    textFormatRuns: [{ startIndex: 0, format: { link: { uri } } }],
  };
};

const richTextCell = value => {
  const richText = richTextToSheetText(value || '');
  const text = cellText(richText.text);
  const textFormatRuns = richText.textFormatRuns.filter(run => run.startIndex < text.length);
  return {
    ...stringCell(text),
    ...(textFormatRuns.length ? { textFormatRuns } : {}),
  };
};

const entrySourceUrl = (entry, platformOrigin) => {
  const systemEntry = entry.origin === 'SYSTEM_QUESTION' || (!entry.origin && entry.questionId);
  if (systemEntry) return `${platformOrigin}/dashboard/error-log`;
  if (typeof entry.sourceUrl !== 'string') return null;
  try {
    const url = new URL(entry.sourceUrl);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

const buildExportCellRows = (entries, platformOrigin) => [
  { values: EXPORT_HEADERS.map(stringCell) },
  ...entries.map((entry, index) => ({ values: [
    numberCell(index + 1),
    stringCell(entry.category || 'General'),
    linkedCell(entry.source || 'Untitled source', entrySourceUrl(entry, platformOrigin)),
    stringCell(entry.correctAnswer || ''),
    stringCell(entry.userAnswer || ''),
    richTextCell(entry.whyWrong),
    richTextCell(entry.whyRight),
    stringCell(''),
  ] })),
];

const chunkCellRows = (rows, maxCharacters = MAX_UPDATE_CHARACTERS) => {
  const chunks = [];
  let startRowIndex = 0;
  let currentRows = [];
  let currentCharacters = 0;

  for (const row of rows) {
    const rowCharacters = JSON.stringify(row).length;
    if (currentRows.length && currentCharacters + rowCharacters > maxCharacters) {
      chunks.push({ startRowIndex, rows: currentRows });
      startRowIndex += currentRows.length;
      currentRows = [];
      currentCharacters = 0;
    }
    currentRows.push(row);
    currentCharacters += rowCharacters;
  }
  if (currentRows.length) chunks.push({ startRowIndex, rows: currentRows });
  return chunks;
};

const categoryOptions = entries => {
  const canonical = new Set(CANONICAL_ERROR_LOG_CATEGORIES);
  const legacy = [...new Set(entries.map(entry => String(entry.category || 'General').trim()).filter(Boolean))]
    .filter(category => !canonical.has(category))
    .sort((left, right) => left.localeCompare(right));
  return [...CANONICAL_ERROR_LOG_CATEGORIES, ...legacy];
};

const categoryColor = (category, index) => REFERENCE_CATEGORY_COLORS.get(category.trim())
  || FALLBACK_CATEGORY_COLORS[index % FALLBACK_CATEGORY_COLORS.length];

const isDark = color => (0.2126 * color.red) + (0.7152 * color.green) + (0.0722 * color.blue) < 0.45;

const border = () => ({ style: 'SOLID', colorStyle: { rgbColor: COLORS.black } });
const borders = () => ({ top: border(), bottom: border(), left: border(), right: border() });

const repeatCell = (sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex, userEnteredFormat, fields) => ({
  repeatCell: {
    range: { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex },
    cell: { userEnteredFormat },
    fields,
  },
});

const buildLayoutRequests = ({ sheetId, rowCount, categories }) => {
  const endRowIndex = Math.max(1, rowCount + 1);
  const requests = [
    {
      updateSheetProperties: {
        properties: { sheetId, title: SHEET_TITLE, gridProperties: { frozenRowCount: 1 } },
        fields: 'title,gridProperties.frozenRowCount',
      },
    },
    repeatCell(sheetId, 0, endRowIndex, 0, EXPORT_HEADERS.length, {
      borders: borders(),
      verticalAlignment: 'MIDDLE',
      wrapStrategy: 'WRAP',
      textFormat: { fontFamily: 'Times New Roman', fontSize: 12 },
    }, 'userEnteredFormat(borders,verticalAlignment,wrapStrategy,textFormat)'),
    repeatCell(sheetId, 0, 1, 1, EXPORT_HEADERS.length, {
      backgroundColorStyle: { rgbColor: COLORS.header },
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE',
      wrapStrategy: 'WRAP',
      textFormat: { fontFamily: 'Times New Roman', fontSize: 14, bold: true },
    }, 'userEnteredFormat(backgroundColorStyle,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)'),
    repeatCell(sheetId, 1, endRowIndex, 0, 5, {
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE',
    }, 'userEnteredFormat(horizontalAlignment,verticalAlignment)'),
    repeatCell(sheetId, 1, endRowIndex, 1, 3, {
      textFormat: { fontFamily: 'Times New Roman', fontSize: 12, bold: true },
    }, 'userEnteredFormat.textFormat'),
    repeatCell(sheetId, 1, endRowIndex, 2, 3, {
      hyperlinkDisplayType: 'LINKED',
    }, 'userEnteredFormat.hyperlinkDisplayType'),
    repeatCell(sheetId, 1, endRowIndex, 3, 4, {
      textFormat: { fontFamily: 'Times New Roman', fontSize: 12, bold: true, foregroundColorStyle: { rgbColor: COLORS.correct } },
    }, 'userEnteredFormat.textFormat'),
    repeatCell(sheetId, 1, endRowIndex, 4, 5, {
      textFormat: { fontFamily: 'Times New Roman', fontSize: 12, bold: true, foregroundColorStyle: { rgbColor: COLORS.wrong } },
    }, 'userEnteredFormat.textFormat'),
    repeatCell(sheetId, 1, endRowIndex, 5, 6, {
      backgroundColorStyle: { rgbColor: COLORS.whyWrong }, horizontalAlignment: 'LEFT', verticalAlignment: 'TOP',
    }, 'userEnteredFormat(backgroundColorStyle,horizontalAlignment,verticalAlignment)'),
    repeatCell(sheetId, 1, endRowIndex, 6, 7, {
      backgroundColorStyle: { rgbColor: COLORS.whyRight }, horizontalAlignment: 'LEFT', verticalAlignment: 'TOP',
    }, 'userEnteredFormat(backgroundColorStyle,horizontalAlignment,verticalAlignment)'),
    repeatCell(sheetId, 1, endRowIndex, 7, 8, {
      backgroundColorStyle: { rgbColor: COLORS.tips }, horizontalAlignment: 'LEFT', verticalAlignment: 'TOP',
    }, 'userEnteredFormat(backgroundColorStyle,horizontalAlignment,verticalAlignment)'),
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 42 },
        fields: 'pixelSize',
      },
    },
  ];

  [46, 175, 190, 100, 110, 395, 395, 280].forEach((pixelSize, columnIndex) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: columnIndex, endIndex: columnIndex + 1 },
        properties: { pixelSize },
        fields: 'pixelSize',
      },
    });
  });

  if (rowCount > 0) {
    if (categories.length > 0 && categories.length <= MAX_DROPDOWN_OPTIONS) {
      requests.push({
        setDataValidation: {
          range: { sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: 1, endColumnIndex: 2 },
          rule: {
            condition: { type: 'ONE_OF_LIST', values: categories.map(userEnteredValue => ({ userEnteredValue })) },
            strict: true,
            showCustomUi: true,
          },
        },
      });
    }

    categories.slice(0, 100).forEach((category, index) => {
      const background = categoryColor(category, index);
      requests.push({
        addConditionalFormatRule: {
          index,
          rule: {
            ranges: [{ sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: 1, endColumnIndex: 2 }],
            booleanRule: {
              condition: {
                type: 'TEXT_EQ',
                values: [{ userEnteredValue: category }],
              },
              format: {
                backgroundColorStyle: { rgbColor: background },
                textFormat: {
                  bold: true,
                  ...(isDark(background) ? { foregroundColorStyle: { rgbColor: COLORS.white } } : {}),
                },
              },
            },
          },
        },
      });
    });

    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: endRowIndex },
      },
    });
  }

  return requests;
};

const mapGoogleError = error => {
  const status = Number(error?.response?.status || error?.code);
  const googleError = error?.response?.data?.error;
  const reasons = new Set([
    ...(Array.isArray(googleError?.errors) ? googleError.errors.map(item => item?.reason) : []),
    ...(Array.isArray(googleError?.details) ? googleError.details.map(item => item?.reason) : []),
    googleError?.status,
  ].filter(Boolean));
  const message = String(googleError?.message || error?.message || '').toLowerCase();
  if (status === 401) {
    return new ApiError(400, { code: 'GOOGLE_SHEETS_AUTH_REQUIRED', message: 'Google authorization expired. Please reconnect and try again.' });
  }
  if (status === 429 || ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded', 'RESOURCE_EXHAUSTED'].some(reason => reasons.has(reason))) {
    return new ApiError(503, { code: 'GOOGLE_SHEETS_RATE_LIMITED', message: 'Google Sheets is busy. Please try again shortly.' });
  }
  if (reasons.has('accessNotConfigured') || reasons.has('SERVICE_DISABLED') || message.includes('has not been used in project') || message.includes('is disabled')) {
    return new ApiError(503, { code: 'GOOGLE_SHEETS_API_DISABLED', message: 'Google Sheets API is not enabled for SAT Platform. Contact support.' });
  }
  if (reasons.has('ORG_RESTRICTION_VIOLATION') || reasons.has('DOMAIN_POLICY')) {
    return new ApiError(403, { code: 'GOOGLE_SHEETS_POLICY_BLOCKED', message: 'Your Google Workspace policy does not allow this export.' });
  }
  if (status === 403 && (reasons.has('insufficientPermissions') || reasons.has('ACCESS_TOKEN_SCOPE_INSUFFICIENT'))) {
    return new ApiError(403, { code: 'GOOGLE_SHEETS_PERMISSION_DENIED', message: 'Reconnect Google Drive and grant file access to export this log.' });
  }
  if (status === 403) {
    return new ApiError(403, { code: 'GOOGLE_SHEETS_PERMISSION_DENIED', message: 'Google Sheets denied the export. Check that the API is enabled and that your account allows Drive file access.' });
  }
  return new ApiError(502, { code: 'GOOGLE_SHEETS_EXPORT_FAILED', message: 'Google Sheets could not create the export. Please try again.' });
};

const attachPartialSpreadsheet = (error, createdSpreadsheet) => {
  if (!createdSpreadsheet) return error;
  error.body = {
    ...error.body,
    message: `${error.body.message} A Google Sheet was created but may be incomplete.`,
    partialSpreadsheetId: createdSpreadsheet.spreadsheetId,
    partialSpreadsheetUrl: createdSpreadsheet.spreadsheetUrl,
  };
  return error;
};

const createSheetsClient = accessToken => {
  // Keep the comparatively large Google API client off the server startup path.
  const { google } = require('googleapis');
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
};

const loadExportEntries = userId => prisma.errorLog.findMany({
  where: { userId },
  select: {
    id: true,
    origin: true,
    source: true,
    sourceUrl: true,
    category: true,
    correctAnswer: true,
    userAnswer: true,
    whyWrong: true,
    whyRight: true,
    questionId: true,
    createdAt: true,
  },
  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
});

const exportToGoogleSheet = async ({ userId, googleAccessToken, platformOrigin }) => {
  const accessToken = normalizeGoogleAccessToken(googleAccessToken);
  const safePlatformOrigin = normalizePlatformOrigin(platformOrigin);
  const entries = await loadExportEntries(userId);
  const cellRows = buildExportCellRows(entries, safePlatformOrigin);
  const categories = categoryOptions(entries);
  const sheets = createSheetsClient(accessToken);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  let createdSpreadsheet = null;
  try {
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `SAT Platform Error Log - ${date}`,
          locale: 'en_US',
          timeZone: process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh',
        },
        sheets: [{
          properties: {
            title: SHEET_TITLE,
            gridProperties: { rowCount: Math.max(100, entries.length + 1), columnCount: EXPORT_HEADERS.length },
          },
        }],
      },
      fields: 'spreadsheetId,spreadsheetUrl,sheets.properties',
    });
    const spreadsheetId = created.data.spreadsheetId;
    const sheetId = created.data.sheets?.[0]?.properties?.sheetId;
    if (!spreadsheetId || !Number.isInteger(sheetId)) throw new Error('Google Sheets returned an incomplete create response.');
    createdSpreadsheet = {
      spreadsheetId,
      spreadsheetUrl: created.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };

    for (const chunk of chunkCellRows(cellRows)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{
          updateCells: {
            range: {
              sheetId,
              startRowIndex: chunk.startRowIndex,
              endRowIndex: chunk.startRowIndex + chunk.rows.length,
              startColumnIndex: 0,
              endColumnIndex: EXPORT_HEADERS.length,
            },
            rows: chunk.rows,
            fields: 'userEnteredValue,textFormatRuns',
          },
        }] },
      });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: buildLayoutRequests({ sheetId, rowCount: entries.length, categories }) },
    });

    return {
      spreadsheetId,
      spreadsheetUrl: createdSpreadsheet.spreadsheetUrl,
      rowCount: entries.length,
    };
  } catch (error) {
    const mapped = error instanceof ApiError ? error : mapGoogleError(error);
    throw attachPartialSpreadsheet(mapped, createdSpreadsheet);
  }
};

module.exports = {
  exportToGoogleSheet,
  _errorLogGoogleSheetsHelpers: {
    EXPORT_HEADERS,
    attachPartialSpreadsheet,
    buildExportCellRows,
    buildLayoutRequests,
    categoryOptions,
    categoryColor,
    chunkCellRows,
    entrySourceUrl,
    normalizeGoogleAccessToken,
    normalizePlatformOrigin,
    mapGoogleError,
    richTextCell,
  },
};
