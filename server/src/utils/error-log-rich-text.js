const sanitizeHtml = require('sanitize-html');

const options = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ol', 'ul', 'li', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: (_tag, attrs) => ({ tagName: 'a', attribs: { href: attrs.href || '', target: '_blank', rel: 'noopener noreferrer' } }),
  },
};

const sanitizeReflection = value => sanitizeHtml(value, options);
const decodeCodePoint = (match, code, radix) => {
  const value = Number.parseInt(code, radix);
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
    ? String.fromCodePoint(value)
    : match;
};
const decodeTextEntities = value => value
  .replace(/&#x([0-9a-f]+);/gi, (match, code) => decodeCodePoint(match, code, 16))
  .replace(/&#([0-9]+);/g, (match, code) => decodeCodePoint(match, code, 10))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'");
const richTextToPlainText = value => decodeTextEntities(sanitizeHtml(value || '', { allowedTags: [], allowedAttributes: {} }))
  .replace(/[\u00a0\s\u200B-\u200D\uFEFF]/g, ' ').trim();

const sameTextFormat = (left, right) => left.bold === right.bold
  && left.italic === right.italic
  && left.underline === right.underline
  && left.link === right.link;

const richTextToSheetText = value => {
  const characters = [];
  const active = { bold: 0, italic: 0, underline: 0, link: null };
  const format = () => ({
    bold: active.bold > 0,
    italic: active.italic > 0,
    underline: active.underline > 0,
    link: active.link,
  });
  const appendText = rawText => {
    let text = decodeTextEntities(rawText)
      .replace(/\r\n?/g, '\n')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00a0/g, ' ');
    if (characters.at(-1)?.character === '\n') text = text.replace(/^[ \t]+/, '');
    const currentFormat = format();
    // Sheets TextFormatRun indexes use UTF-16 offsets, matching JavaScript string indexes.
    for (let index = 0; index < text.length; index += 1) characters.push({ character: text[index], format: currentFormat });
  };
  const appendNewlines = count => {
    while (characters.length && /[ \t]/.test(characters.at(-1).character)) characters.pop();
    let existing = 0;
    for (let index = characters.length - 1; index >= 0 && characters[index].character === '\n'; index -= 1) existing += 1;
    for (let index = existing; index < Math.min(2, count); index += 1) {
      characters.push({ character: '\n', format: { bold: false, italic: false, underline: false, link: null } });
    }
  };

  for (const token of sanitizeReflection(value || '').match(/<[^>]+>|[^<]+/g) || []) {
    if (!token.startsWith('<')) {
      appendText(token);
      continue;
    }
    const match = token.match(/^<\s*(\/)?\s*([a-z0-9]+)/i);
    if (!match) continue;
    const closing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    if (tag === 'br') {
      appendNewlines(1);
    } else if (tag === 'p') {
      if (closing) appendNewlines(2);
      else if (characters.length) appendNewlines(2);
    } else if (tag === 'li') {
      if (closing) appendNewlines(1);
      else {
        if (characters.length && characters.at(-1).character !== '\n') appendNewlines(1);
        appendText('• ');
      }
    } else if (tag === 'ol' || tag === 'ul') {
      if (closing) appendNewlines(2);
    } else if (tag === 'strong' || tag === 'b') {
      active.bold = Math.max(0, active.bold + (closing ? -1 : 1));
    } else if (tag === 'em' || tag === 'i') {
      active.italic = Math.max(0, active.italic + (closing ? -1 : 1));
    } else if (tag === 'u') {
      active.underline = Math.max(0, active.underline + (closing ? -1 : 1));
    } else if (tag === 'a') {
      const href = token.match(/\shref="([^"]*)"/i)?.[1];
      active.link = closing ? null : href ? decodeTextEntities(href) : null;
    }
  }

  while (characters.length && /\s/.test(characters[0].character)) characters.shift();
  while (characters.length && /\s/.test(characters.at(-1).character)) characters.pop();
  const text = characters.map(item => item.character).join('');
  if (!text || !characters.some(item => item.format.bold || item.format.italic || item.format.underline || item.format.link)) {
    return { text, textFormatRuns: [] };
  }

  const textFormatRuns = [];
  let previous;
  characters.forEach((item, startIndex) => {
    if (previous && sameTextFormat(previous, item.format)) return;
    const runFormat = {
      ...(item.format.bold ? { bold: true } : {}),
      ...(item.format.italic ? { italic: true } : {}),
      ...(item.format.underline ? { underline: true } : {}),
      ...(item.format.link ? { link: { uri: item.format.link } } : {}),
    };
    textFormatRuns.push({ startIndex, format: runFormat });
    previous = item.format;
  });
  return { text, textFormatRuns };
};

const isRichTextEmpty = value => !richTextToPlainText(value);

module.exports = { sanitizeReflection, richTextToPlainText, richTextToSheetText, isRichTextEmpty };
