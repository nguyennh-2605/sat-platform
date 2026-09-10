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
const richTextToPlainText = value => sanitizeHtml(value || '', { allowedTags: [], allowedAttributes: {} })
  .replace(/&(?:nbsp|#160|#x0*a0);/gi, ' ')
  .replace(/[\s\u200B-\u200D\uFEFF]/g, ' ').trim();
const isRichTextEmpty = value => !richTextToPlainText(value);

module.exports = { sanitizeReflection, richTextToPlainText, isRichTextEmpty };
