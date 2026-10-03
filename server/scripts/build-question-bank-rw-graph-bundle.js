const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const zlib = require('node:zlib');
const puppeteer = require('puppeteer');
const sanitizeHtml = require('sanitize-html');
const { _imageHelpers } = require('../src/services/test-image.service');

const DEFAULT_SOURCE_PATH = path.resolve(__dirname, '../../tmp/sat-eqb-downloader/out/sat_eqb/data.jsonl');
const DEFAULT_DATASET_PATH = path.resolve(__dirname, '../data/eqb-question-bank-v1.json.gz');
const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, '../data/eqb-rw-graph-assets-v1.json.gz');
const EXPECTED_GRAPH_COUNT = 62;

const argumentValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? path.resolve(process.argv[index + 1]) : fallback;
};

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const canonicalJson = value => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const canonicalHash = value => sha256(canonicalJson(value));

const htmlToText = rawHtml => {
  const withMarkup = String(rawHtml || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<(?:p|div|li|blockquote|h[1-6])\b[^>]*>/gi, '\n\n')
    .replace(/<\/(?:p|div|li|blockquote|h[1-6])>/gi, '\n\n')
    .replace(/<u\b[^>]*>/gi, '==').replace(/<\/u>/gi, '==')
    .replace(/<(?:strong|b)\b[^>]*>/gi, '**').replace(/<\/(?:strong|b)>/gi, '**')
    .replace(/<(?:em|i)\b[^>]*>/gi, '*').replace(/<\/(?:em|i)>/gi, '*');
  return sanitizeHtml(withMarkup, { allowedTags: [], allowedAttributes: {} })
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const removeScreenReaderOnlyMarkup = rawHtml => String(rawHtml || '')
  .replace(/<(div|span|p)\b(?=[^>]*\bclass=(?:"[^"]*\bsr-only\b[^"]*"|'[^']*\bsr-only\b[^']*'))[^>]*>[\s\S]*?<\/\1>/gi, '');

const attributeValue = (markup, name) => {
  const match = new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i').exec(markup);
  return sanitizeHtml(match?.[1] || match?.[2] || '', { allowedTags: [], allowedAttributes: {} }).trim();
};

const readDataset = datasetPath => {
  const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(datasetPath)).toString('utf8'));
  return new Map(payload.rows.map(row => [row.id, row]));
};

const readSourceGraphs = async sourcePath => {
  const records = [];
  const input = readline.createInterface({ input: fs.createReadStream(sourcePath), crlfDelay: Infinity });
  for await (const line of input) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (record.metadata?.test !== 'Reading and Writing') continue;
    const promptHtml = String(record.content?.prompt_html || '');
    const svgMatches = promptHtml.match(/<svg\b[\s\S]*?<\/svg>/gi) || [];
    if (!svgMatches.length) continue;
    if (svgMatches.length !== 1) throw new Error(`Expected one SVG for ${record.metadata?.question_id}.`);
    const figureMatch = /<figure\b[\s\S]*?<\/figure>/i.exec(promptHtml);
    if (!figureMatch || !figureMatch[0].includes(svgMatches[0])) {
      throw new Error(`SVG figure boundary missing for ${record.metadata?.question_id}.`);
    }
    records.push({ record, promptHtml, figureHtml: figureMatch[0], svg: svgMatches[0] });
  }
  if (records.length !== EXPECTED_GRAPH_COUNT) {
    throw new Error(`Expected ${EXPECTED_GRAPH_COUNT} Reading and Writing SVG questions; received ${records.length}.`);
  }
  return records;
};

const graphAlt = figureHtml => {
  const svgOpen = /<svg\b[^>]*>/i.exec(figureHtml)?.[0] || '';
  const shortDescription = attributeValue(svgOpen, 'aria-label').replace(/\s*Refer to long description\.?\s*$/i, '');
  const longDescriptionMarkup = /<div\b[^>]*class=(?:"[^"]*\bsr-only\b[^"]*"|'[^']*\bsr-only\b[^']*')[^>]*>([\s\S]*?)<\/div>/i.exec(figureHtml)?.[1] || '';
  const longDescription = htmlToText(longDescriptionMarkup);
  const svgTextFallback = htmlToText(figureHtml.replace(/<\/text>/gi, ' </text>'));
  return [shortDescription, longDescription].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    || svgTextFallback.replace(/\s+/g, ' ').trim();
};

const renderSvg = async ({ page, svg }) => {
  const width = Math.ceil(Number(attributeValue(svg.slice(0, svg.indexOf('>') + 1), 'width')) || 800);
  const height = Math.ceil(Number(attributeValue(svg.slice(0, svg.indexOf('>') + 1), 'height')) || 800);
  await page.setViewport({ width: Math.max(1, width), height: Math.max(1, height), deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;background:#fff}svg{display:block}svg text{font-family:Georgia,"Times New Roman",serif!important}</style></head><body>${svg}</body></html>`);
  await page.$eval('svg', graph => {
    const box = graph.getBBox();
    const viewBox = graph.viewBox.baseVal;
    const padding = 8;
    const minX = Math.min(viewBox.x, box.x) - padding;
    const minY = Math.min(viewBox.y, box.y) - padding;
    const maxX = Math.max(viewBox.x + viewBox.width, box.x + box.width) + padding;
    const maxY = Math.max(viewBox.y + viewBox.height, box.y + box.height) + padding;
    graph.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
    graph.setAttribute('width', String(maxX - minX));
    graph.setAttribute('height', String(maxY - minY));
  });
  const element = await page.$('svg');
  if (!element) throw new Error('Rendered SVG element was not found.');
  const png = await element.screenshot({ type: 'png', omitBackground: false });
  const dimensions = _imageHelpers.imageDimensions(png, 'image/png');
  if (!dimensions || png.length > _imageHelpers.MAX_IMAGE_BYTES) throw new Error('Rendered graph PNG failed image validation.');
  return { png, width: dimensions[0], height: dimensions[1] };
};

const main = async () => {
  const sourcePath = argumentValue('--source', DEFAULT_SOURCE_PATH);
  const datasetPath = argumentValue('--dataset', DEFAULT_DATASET_PATH);
  const outputPath = argumentValue('--output', DEFAULT_OUTPUT_PATH);
  const dataset = readDataset(datasetPath);
  const sourceGraphs = await readSourceGraphs(sourcePath);
  const previousRows = fs.existsSync(outputPath)
    ? new Map(JSON.parse(zlib.gunzipSync(fs.readFileSync(outputPath)).toString('utf8')).rows.map(row => [row.questionId, row]))
    : new Map();
  const requiresRendering = sourceGraphs.some(source => {
    const questionId = `eqb-${sha256(source.record.question_key).slice(0, 32)}`;
    return !previousRows.get(questionId)?.image;
  });
  const browser = requiresRendering ? await puppeteer.launch({ headless: true, timeout: 120_000 }) : null;
  const page = browser ? await browser.newPage() : null;
  const rows = [];
  try {
    for (const [index, source] of sourceGraphs.entries()) {
      const questionId = `eqb-${sha256(source.record.question_key).slice(0, 32)}`;
      const legacy = dataset.get(questionId);
      if (!legacy || legacy.subject !== 'RW' || legacy.blocks.some(block => block?.type === 'image')) {
        throw new Error(`Legacy Reading and Writing row is unavailable for ${questionId}.`);
      }
      const previousRow = previousRows.get(questionId);
      const rendered = previousRow?.image
        ? {
          png: Buffer.from(previousRow.image.bytesBase64, 'base64'),
          width: previousRow.image.width,
          height: previousRow.image.height,
        }
        : await renderSvg({ page, svg: source.svg });
      const { png, width, height } = rendered;
      const imageSha256 = sha256(png);
      const promptWithoutFigure = removeScreenReaderOnlyMarkup(source.promptHtml.replace(source.figureHtml, ''));
      const passage = htmlToText(promptWithoutFigure);
      const replacementBlocks = [
        { type: 'image', imageSha256, alt: graphAlt(source.figureHtml) || 'Question graph' },
        ...(passage ? [{ type: 'text', content: passage }] : []),
      ];
      rows.push({
        questionId,
        sourceQuestionId: source.record.metadata.question_id,
        expectedLegacyBlocksSha256: canonicalHash(legacy.blocks),
        ...(previousRow ? {
          previousReplacementBlocks: previousRow.previousReplacementBlocks || previousRow.replacementBlocks,
        } : {}),
        replacementBlocks,
        image: {
          sha256: imageSha256,
          mimeType: 'image/png',
          width,
          height,
          bytesBase64: png.toString('base64'),
        },
      });
      process.stdout.write(`Rendered ${index + 1}/${sourceGraphs.length}\r`);
    }
  } finally {
    if (browser) await browser.close();
  }

  rows.sort((left, right) => left.questionId.localeCompare(right.questionId));
  const payload = { schemaVersion: 2, sourceCount: rows.length, rows };
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9, mtime: 0 });
  fs.writeFileSync(outputPath, compressed);
  process.stdout.write('\n');
  console.log(JSON.stringify({
    outputPath,
    questions: rows.length,
    compressedBytes: compressed.length,
    sha256: sha256(compressed),
  }, null, 2));
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
