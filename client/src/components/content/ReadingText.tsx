import type { ReactNode } from 'react';
import { splitReadingSegments } from './readingTextFormat';

export default function ReadingText({ content }: { content: string }): ReactNode {
  return splitReadingSegments(content).map((segment, index) => segment.underlined
    ? <u key={index}>{segment.text}</u>
    : segment.text);
}
