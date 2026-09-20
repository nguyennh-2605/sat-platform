export type ReadingSegment = { text: string; underlined: boolean };

export const splitReadingSegments = (value: string): ReadingSegment[] => {
  const segments: ReadingSegment[] = [];
  let plain = '';
  let index = 0;

  while (index < value.length) {
    if (value.startsWith('\\==', index)) {
      plain += '==';
      index += 3;
      continue;
    }
    if (!value.startsWith('==', index)) {
      plain += value[index];
      index += 1;
      continue;
    }

    const lineEnd = value.indexOf('\n', index + 2);
    const limit = lineEnd < 0 ? value.length : lineEnd;
    let closing = -1;
    for (let cursor = index + 2; cursor < limit;) {
      if (value.startsWith('\\==', cursor)) { cursor += 3; continue; }
      if (value.startsWith('==', cursor)) { closing = cursor; break; }
      cursor += 1;
    }
    const inner = closing < 0 ? '' : value.slice(index + 2, closing).replace(/\\==/g, '==');
    if (!inner.trim()) {
      plain += '==';
      index += 2;
      continue;
    }
    if (plain) segments.push({ text: plain, underlined: false });
    segments.push({ text: inner, underlined: true });
    plain = '';
    index = closing + 2;
  }
  if (plain) segments.push({ text: plain, underlined: false });
  return segments;
};

export const splitReadingParagraphs = (value: string) => value.trim().replace(/\r\n?/g, '\n')
  .split(/\n[ \t]*\n/)
  .map(paragraph => paragraph.replace(/[ \t]*\n[ \t]*/g, ' ').trim())
  .filter(Boolean);

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character] || character);

export const readingTextToHtml = (value: string) => splitReadingSegments(value)
  .map(segment => segment.underlined ? `<u>${escapeHtml(segment.text)}</u>` : escapeHtml(segment.text))
  .join('');
