// src/components/BlockRenderer.tsx
import React from 'react';
import parse from 'html-react-parser';
import type { ContentBlock, TableBlock, PoemBlock } from '../types/quiz';

// --- 1. Component hiển thị Bảng (Table) ---
const TableRenderer = ({ block }: { block: TableBlock }) => (
  <div className="my-6 w-full overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm
      font-sans text-[1.125rem] font-normal text-slate-800 leading-[1.5] tracking-[-0.01em]">
    {/* Tiêu đề bảng */}
    {block.title && (
      <div className="bg-gray-100 px-4 py-3 text-center font-bold text-gray-800 border-b border-gray-300">
        {block.title}
      </div>
    )}

    <div className="overflow-x-auto">
      <table className="w-full text-left">
        {/* Header */}
        <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
          <tr>
            {block.headers.map((header, idx) => (
              <th key={idx} className="px-4 py-3 border-r border-gray-200 last:border-r-0 whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        {/* Body */}
        <tbody className="divide-y divide-gray-200">
          {block.rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-gray-50 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-4 py-3 text-gray-700 border-r border-gray-200 last:border-r-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Ghi chú chân bảng */}
    {block.note && (
      <div className="bg-gray-50 px-4 py-2 text-xs italic text-gray-500 border-t border-gray-200">
        {block.note}
      </div>
    )}
  </div>
);

// --- 2. Component hiển thị Thơ (Poem) ---
const PoemRenderer = ({ block }: { block: PoemBlock }) => (
  <div className="my-6 pl-6 border-l-4 border-indigo-300 bg-gray-50 p-5 rounded-r-md">
    {/* Tiêu đề bài thơ */}
    {block.title && (
      <div className="mb-3 font-serif font-bold text-lg text-gray-800">
        {block.title}
      </div>
    )}
    
    {/* Nội dung thơ (Font sans cho nghệ thuật) */}
    <div className="font-sans text-gray-800 leading-relaxed text-lg space-y-1">
      {block.lines.map((line, idx) => (
        // Thêm padding-left cho các dòng chẵn để tạo hiệu ứng thụt đầu dòng thơ
        <div key={idx} className={idx % 2 !== 0 ? "pl-4" : ""}>
          {line}
        </div>
      ))}
    </div>

    {/* Tác giả */}
    {block.author && (
      <div className="mt-4 text-right text-sm font-semibold text-gray-600 italic">
        — {block.author}
      </div>
    )}
  </div>
);

// --- 3. Component Chính ---
interface Props {
  blocks: ContentBlock[];
}

const BlockRenderer: React.FC<Props> = ({ blocks }) => {
  if (!blocks || !Array.isArray(blocks)) return null;

  return (
    <div className="flex flex-col gap-4 text-gray-800">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'text':
            return (
              <div key={index} className="leading-relaxed">
                {parse(block.content)}
              </div>
            );
          
          case 'image':
            return (
              <div key={index} className="flex justify-center my-4">
                <img 
                  src={block.src} 
                  alt={block.alt || 'Question image'} 
                  className="max-w-full h-auto rounded-md shadow-sm border border-gray-200"
                />
                {block.caption && <p className="text-center text-sm text-gray-500 mt-2">{block.caption}</p>}
              </div>
            );

          case 'table':
            return <TableRenderer key={index} block={block} />;

          case 'poem':
            return <PoemRenderer key={index} block={block} />;

          default:
            return null;
        }
      })}
    </div>
  );
};

export default BlockRenderer;