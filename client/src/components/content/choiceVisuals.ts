import type { ContentBlock } from '@/types/quiz';

const plainText = (value: string) => value
  .replace(/\\text\{([^{}]*)\}/g, '$1')
  .replace(/[{}\\]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const choiceMarker = (block: ContentBlock) => {
  if (block.type !== 'text') return null;
  return plainText(block.content).match(/^Choice\s+([A-D])$/i)?.[1]?.toUpperCase() || null;
};

const isBlankTextBlock = (block: ContentBlock) => block.type === 'text' && plainText(block.content) === '';

export const splitChoiceVisuals = (blocks: ContentBlock[]) => {
  const source = Array.isArray(blocks) ? blocks : [];
  const markers = source
    .map((block, index) => ({ id: choiceMarker(block), index }))
    .filter((entry): entry is { id: string; index: number } => Boolean(entry.id));

  if (!markers.length) return { promptBlocks: source, choiceBlocks: {} as Record<string, ContentBlock[]> };

  const choiceBlocks: Record<string, ContentBlock[]> = {};
  for (let markerIndex = 0; markerIndex < markers.length; markerIndex += 1) {
    const marker = markers[markerIndex];
    const end = markers[markerIndex + 1]?.index ?? source.length;
    const segment = source.slice(marker.index + 1, end).filter(block => !isBlankTextBlock(block));
    if (!segment.some(block => block.type === 'image')) {
      return { promptBlocks: source, choiceBlocks: {} as Record<string, ContentBlock[]> };
    }
    choiceBlocks[marker.id] = segment;
  }

  return { promptBlocks: source.slice(0, markers[0].index).filter(block => !isBlankTextBlock(block)), choiceBlocks };
};

export const isChoiceVisualPlaceholder = (value: string, choiceId: string) => {
  const normalized = plainText(value).replace(/[.]$/, '').trim();
  return normalized.toLowerCase() === `see choice ${choiceId.toUpperCase()} above`.toLowerCase();
};
