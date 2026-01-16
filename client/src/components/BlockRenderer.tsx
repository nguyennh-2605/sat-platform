// src/components/BlockRenderer.tsx
import React from 'react';
import parse from 'html-react-parser';
// 👇 IMPORT TỪ ĐÂY
import type { ContentBlock } from '../types/quiz';

interface Props {
  blocks: ContentBlock[];
}

const BlockRenderer: React.FC<Props> = ({ blocks }) => {
  if (!blocks) return null;
  
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return <div key={index}>{parse(block.content)}</div>;
        }
        if (block.type === 'image') {
          return <img key={index} src={block.src} alt={block.alt} />;
        }
        return null;
      })}
    </div>
  );
};

export default BlockRenderer;