import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ReadingText from './ReadingText';
import { readingTextToHtml, splitReadingParagraphs, splitReadingSegments } from './readingTextFormat';

describe('Reading text formatting', () => {
  it('keeps blank-line paragraphs and joins soft line wraps', () => {
    expect(splitReadingParagraphs('First line\ncontinues.\n\nSecond paragraph.')).toEqual([
      'First line continues.', 'Second paragraph.',
    ]);
  });

  it('underlines only complete same-line pairs and treats escaped pairs as text', () => {
    expect(splitReadingSegments('A ==word==, \\==literal and ==unfinished\nline')).toEqual([
      { text: 'A ', underlined: false },
      { text: 'word', underlined: true },
      { text: ', ==literal and ==unfinished\nline', underlined: false },
    ]);
  });

  it('escapes authored markup in both static and annotatable renderers', () => {
    const content = 'Safe ==<img src=x>== and <script>alert(1)</script>';
    expect(readingTextToHtml(content)).toBe('Safe <u>&lt;img src=x&gt;</u> and &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(renderToStaticMarkup(<ReadingText content={content} />)).toBe('Safe <u>&lt;img src=x&gt;</u> and &lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
