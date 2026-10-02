import { describe, expect, it } from 'vitest';
import { isChoiceVisualPlaceholder, splitChoiceVisuals } from './choiceVisuals';
import type { ContentBlock } from '@/types/quiz';

describe('choice visuals', () => {
  it('moves imported choice images beside their matching answers', () => {
    const blocks: ContentBlock[] = [
      { type: 'image', src: 'data:image/png;base64,prompt', alt: 'Prompt graph' },
      { type: 'text', content: '\\text{Choice A}' },
      { type: 'image', src: 'data:image/png;base64,a', alt: 'Choice A graph' },
      { type: 'text', content: '\\text{ }' },
      { type: 'text', content: '\\text{Choice B}' },
      { type: 'image', src: 'data:image/png;base64,b', alt: 'Choice B graph' },
    ];

    const result = splitChoiceVisuals(blocks);
    expect(result.promptBlocks).toEqual([blocks[0]]);
    expect(result.choiceBlocks.A).toEqual([blocks[2]]);
    expect(result.choiceBlocks.B).toEqual([blocks[5]]);
  });

  it('leaves ordinary blocks untouched', () => {
    const blocks: ContentBlock[] = [{ type: 'text', content: 'A normal passage' }];
    expect(splitChoiceVisuals(blocks)).toEqual({ promptBlocks: blocks, choiceBlocks: {} });
  });

  it('recognizes the importer placeholder text', () => {
    expect(isChoiceVisualPlaceholder('\\text{See choice A above.}', 'A')).toBe(true);
    expect(isChoiceVisualPlaceholder('A real answer', 'A')).toBe(false);
  });
});
