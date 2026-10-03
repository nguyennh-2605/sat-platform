const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const zlib = require('node:zlib');
const puppeteer = require('puppeteer');

const DEFAULT_SOURCE_PATH = path.resolve(__dirname, '../../tmp/sat-eqb-downloader/out/sat_eqb/data.jsonl');
const DEFAULT_DATASET_PATH = path.resolve(__dirname, '../data/eqb-question-bank-v1.json.gz');
const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, '../data/eqb-math-graph-assets-v1.json.gz');

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const canonicalJson = value => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const canonicalHash = value => sha256(canonicalJson(value));

const attributeValue = (markup, name) => {
  const match = new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(markup || '');
  return match?.[1] || '';
};

const figureMatches = html => [...String(html || '').matchAll(/<figure\b[\s\S]*?<\/figure>/gi)]
  .filter(match => /<svg\b/i.test(match[0]));

const svgMatches = html => String(html || '').match(/<svg\b[\s\S]*?<\/svg>/gi) || [];

const accessibleDescription = figureHtml => {
  const svgOpen = /<svg\b[^>]*>/i.exec(figureHtml)?.[0] || '';
  const shortDescription = attributeValue(svgOpen, 'aria-label').replace(/\s*Refer to long description\.?\s*$/i, '').trim();
  const longDescriptionMarkup = /<div\b[^>]*class=["'][^"']*\bsr-only\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(figureHtml)?.[1] || '';
  const longDescription = longDescriptionMarkup
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return [shortDescription, longDescription].filter(Boolean).join(' ').trim() || 'SAT math graph or diagram';
};

const renderSvg = async ({ page, svg }) => {
  await page.setViewport({ width: 1600, height: 1600, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;background:#fff}svg{display:block}svg text{font-family:Georgia,"Times New Roman",serif!important}</style></head><body>${svg}</body></html>`);
  const dimensions = await page.$eval('svg', graph => {
    const box = graph.getBBox();
    const padding = 12;
    const x = Math.floor(box.x - padding);
    const y = Math.floor(box.y - padding);
    const width = Math.ceil(box.width + padding * 2);
    const height = Math.ceil(box.height + padding * 2);
    graph.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    graph.setAttribute('width', String(width));
    graph.setAttribute('height', String(height));
    return { width, height };
  });
  const element = await page.$('svg');
  const png = await element.screenshot({ type: 'png', omitBackground: false });
  return { png: Buffer.from(png), width: dimensions.width * 2, height: dimensions.height * 2 };
};

const htmlToSonderMathText = async ({ page, html }) => page.evaluate(rawHtml => {
  const escape = value => [...String(value || '')].map(character => ({
    '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\char36{}', '%': '\\%', '&': '\\&', '#': '\\#', '_': '\\_', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}',
  })[character] || character).join('');
  const symbols = { '−': '-', '×': '\\times ', '÷': '\\div ', '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ', 'π': '\\pi ', 'θ': '\\theta ', '°': '{}^{\\circ}', '∞': '\\infty ', '·': '\\cdot ', '∠': '\\angle ', '±': '\\pm ', '⁢': '', '⁡': '', '′': "'", '–': '-', '∼': '\\sim ', '≈': '\\approx ' };
  const prose = value => {
    if (!value) return '';
    if ([...'≠≤≥'].some(character => value.includes(character))) {
      return value.split(/([≠≤≥])/).filter(Boolean).map(part => symbols[part] || `\\text{${escape(part)}}`).join(' ');
    }
    return `\\text{${escape(value)}}`;
  };
  const meaningfulChildren = node => [...node.childNodes].filter(child => child.nodeType !== Node.TEXT_NODE || child.textContent.trim());
  const math = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent.trim();
      if (!value) return '';
      return /^[A-Za-z]{2,}$/.test(value) ? `\\mathit{${escape(value)}}` : escape(value);
    }
    const children = meaningfulChildren(node);
    const parts = children.map(math);
    const tag = node.localName;
    const text = node.textContent.trim();
    if (['mi', 'mn', 'mo'].includes(tag)) {
      if (['sin', 'cos', 'tan', 'log', 'ln'].includes(text)) return `\\${text} `;
      if (text.length > 1 && /^[A-Za-z]+$/.test(text)) return `\\mathrm{${text}}`;
      return [...text].map(character => (symbols[character] || escape(character))).join('') + '{}';
    }
    if (tag === 'mtext') return prose(text);
    if (tag === 'mfrac') return `\\frac{${parts[0]}}{${parts[1]}}`;
    if (tag === 'msup') return `{${parts[0]}}^{${parts[1]}}`;
    if (tag === 'msub') return `{${parts[0]}}_{${parts[1]}}`;
    if (tag === 'msqrt') return `\\sqrt{${parts.join('')}}`;
    if (tag === 'mroot') return `\\sqrt[${parts[1]}]{${parts[0]}}`;
    if (tag === 'mfenced') {
      const open = node.getAttribute('open') || '(';
      const close = node.getAttribute('close') || ')';
      return `${open === '{' ? '\\{' : open}${parts.join(',')}${close === '}' ? '\\}' : close}`;
    }
    if (tag === 'mover') {
      const accent = children[1]?.textContent.trim();
      const command = ['¯', '―', '̅', '‾', '_'].includes(accent) ? 'overline'
        : ['^', 'ˆ', '̂'].includes(accent) ? 'widehat'
          : ['→', '⃗'].includes(accent) ? 'overrightarrow' : 'overset';
      return command === 'overset' ? `\\overset{${parts[1]}}{${parts[0]}}` : `\\${command}{${parts[0]}}`;
    }
    if (tag === 'menclose') return `\\overline{${parts.join('')}}`;
    return parts.join(' ');
  };
  const render = (node, isMath = true) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent.replace(/\s+/g, ' ');
      return isMath ? prose(value) : value;
    }
    const tag = node.localName;
    if (['script', 'style', 'svg'].includes(tag)) return '';
    if (tag === 'math') return ` ${math(node)} `;
    if (tag === 'img') return prose(node.getAttribute('alt') || '');
    if (tag === 'br') return '\n';
    let value = [...node.childNodes].map(child => render(child, isMath)).join('');
    if (['p', 'div', 'li', 'tr', 'blockquote'].includes(tag)) value += '\n\n';
    return value;
  };
  const document = new DOMParser().parseFromString(`<body>${rawHtml || ''}</body>`, 'text/html');
  return render(document.body, true).replace(/\n{3,}/g, '\n\n').trim();
}, html);

const readSourceRows = async sourcePath => {
  const rows = [];
  const input = fs.createReadStream(sourcePath, { encoding: 'utf8' });
  for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (record.metadata?.test !== 'Math') continue;
    const content = record.content || {};
    const stemFigures = figureMatches(content.stem_html);
    const choiceFigures = (content.answer_options || []).flatMap(option => figureMatches(option.content_html));
    if (stemFigures.length || choiceFigures.length) rows.push({ record, stemFigures, choiceFigures });
  }
  return rows;
};

const makeImage = async ({ page, figureHtml, field }) => {
  const svgs = svgMatches(figureHtml);
  if (svgs.length !== 1) throw new Error(`Expected exactly one SVG in ${field}.`);
  const rendered = await renderSvg({ page, svg: svgs[0] });
  const imageSha256 = sha256(rendered.png);
  return {
    field,
    sha256: imageSha256,
    mimeType: 'image/png',
    width: rendered.width,
    height: rendered.height,
    alt: accessibleDescription(figureHtml),
    bytesBase64: rendered.png.toString('base64'),
  };
};

const main = async () => {
  const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SOURCE_PATH;
  const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUTPUT_PATH;
  const datasetPath = process.argv[4] ? path.resolve(process.argv[4]) : DEFAULT_DATASET_PATH;
  const dataset = JSON.parse(zlib.gunzipSync(fs.readFileSync(datasetPath)).toString('utf8'));
  const datasetRows = new Map(dataset.rows.map(row => [row.id, row]));
  const sources = await readSourceRows(sourcePath);
  if (sources.length !== 250) throw new Error(`Expected 250 Math questions with SVG visuals; received ${sources.length}.`);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const outputRows = [];
  try {
    for (const [index, source] of sources.entries()) {
      const questionId = `eqb-${sha256(source.record.question_key).slice(0, 32)}`;
      const datasetRow = datasetRows.get(questionId);
      if (!datasetRow || datasetRow.subject !== 'MATH') throw new Error(`Missing Math dataset row ${questionId}.`);
      const content = source.record.content || {};
      const replacementBlocks = structuredClone(datasetRow.blocks || []);
      const replacementChoices = structuredClone(datasetRow.choices || []);
      let replacementQuestionText = datasetRow.questionText;
      const images = [];

      const stemMatches = figureMatches(content.stem_html);
      if (stemMatches.length > 1) throw new Error(`Expected at most one stem graph for ${questionId}.`);
      if (stemMatches.length === 1) {
        const figure = stemMatches[0];
        const before = String(content.stem_html || '').slice(0, figure.index);
        const after = String(content.stem_html || '').slice(figure.index + figure[0].length);
        const beforeText = await htmlToSonderMathText({ page, html: before });
        const afterText = await htmlToSonderMathText({ page, html: after });
        const image = await makeImage({ page, figureHtml: figure[0], field: 'stem' });
        images.push(image);
        if (beforeText && afterText) replacementBlocks.push({ type: 'text', content: beforeText });
        replacementBlocks.push({ type: 'image', imageSha256: image.sha256, alt: image.alt });
        replacementQuestionText = afterText || beforeText;
        if (!replacementQuestionText) throw new Error(`Math graph question ${questionId} has no text outside its figure.`);
      }

      for (const option of content.answer_options || []) {
        const figures = figureMatches(option.content_html);
        if (!figures.length) continue;
        if (figures.length !== 1) throw new Error(`Expected one graph for choice ${option.letter} in ${questionId}.`);
        const image = await makeImage({ page, figureHtml: figures[0][0], field: `choice-${option.letter}` });
        images.push(image);
        replacementBlocks.push({ type: 'text', content: `\\text{Choice ${option.letter}}` });
        replacementBlocks.push({ type: 'image', imageSha256: image.sha256, alt: `${option.letter}. ${image.alt}` });
        const choice = replacementChoices.find(candidate => candidate.id === option.letter);
        if (!choice) throw new Error(`Missing choice ${option.letter} in ${questionId}.`);
        choice.text = `\\text{See choice ${option.letter} above.}`;
      }

      outputRows.push({
        questionId,
        sourceQuestionId: source.record.metadata?.question_id,
        expectedLegacyContentSha256: canonicalHash({
          blocks: datasetRow.blocks,
          questionText: datasetRow.questionText,
          choices: datasetRow.choices,
        }),
        replacementBlocks,
        replacementQuestionText,
        replacementChoices,
        images,
      });
      if ((index + 1) % 25 === 0) console.log(`Rendered ${index + 1}/${sources.length} Math graph questions.`);
    }
  } finally {
    await browser.close();
  }

  const payload = {
    schemaVersion: 1,
    sourceCount: outputRows.length,
    imageCount: outputRows.reduce((sum, row) => sum + row.images.length, 0),
    generatedAt: new Date().toISOString(),
    rows: outputRows,
  };
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
  fs.writeFileSync(outputPath, compressed);
  console.log(JSON.stringify({
    outputPath,
    questionCount: payload.sourceCount,
    imageCount: payload.imageCount,
    compressedBytes: compressed.length,
    sha256: sha256(compressed),
  }));
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
