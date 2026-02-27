// src/components/BlockRenderer.tsx
import React from 'react';
import type { ContentBlock, TableBlock, PoemBlock } from '../types/quiz';
import InteractiveText from './InteractiveText';

interface Props {
  blocks: ContentBlock[];
  subject: string;
  readOnly?: boolean;
}

// --- 1. Component hiển thị Bảng (Table) ---
const TableRenderer = ({ block, isMath, readOnly }: { block: TableBlock, isMath: boolean, readOnly: boolean }) => (
  <div className="my-6 w-full overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm
      font-['Source_Serif_4',_'Georgia',_serif] lining-nums tabular-nums text-[16px] font-normal text-[#1a1a1a] leading-relaxed tracking-normal">
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
                <InteractiveText content={header} isMath={isMath} readOnly={readOnly} />
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
                  <InteractiveText content={cell} isMath={isMath} readOnly={readOnly} />
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
const PoemRenderer = ({ block, isMath, readOnly }: { block: PoemBlock, isMath: boolean, readOnly: boolean }) => (
  <div className="my-6 pl-6 border-l-4 border-indigo-300 bg-gray-50 p-5 rounded-r-md">
    {/* Tiêu đề bài thơ */}
    {block.title && (
      <div className="mb-3 font-serif font-bold text-lg text-gray-800">
        {block.title}
      </div>
    )}
    
    {/* Nội dung thơ (Font sans cho nghệ thuật) */}
    <div className="font-['Source_Serif_4',_'Georgia',_serif] lining-nums tabular-nums text-[16px] font-normal text-[#1a1a1a] leading-relaxed tracking-normal">
      {block.lines.map((line, idx) => (
        // Thêm padding-left cho các dòng chẵn để tạo hiệu ứng thụt đầu dòng thơ
        <div key={idx} className={idx % 2 !== 0 ? "pl-4" : ""}>
          <InteractiveText content={line} isMath={isMath} readOnly={readOnly} />
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

const NotesRenderer = ({ lines, isMath, readOnly }: { lines: string[], isMath: boolean, readOnly: boolean }) => {
  // Guard clause: Nếu không có dữ liệu thì không render gì cả
  if (!lines || lines.length === 0) return null;

  // TÁCH DỮ LIỆU:
  // introLine: Lấy phần tử đầu tiên
  // bulletLines: Lấy toàn bộ các phần tử còn lại
  const [introLine, ...bulletLines] = lines;

  return (
    <div className="font-['Source_Serif_4',_'Georgia',_serif] lining-nums tabular-nums text-[16px] font-normal text-[#1a1a1a] leading-relaxed tracking-normal">
      
      <div className="mb-3 leading-relaxed">
        <InteractiveText content={introLine} readOnly={readOnly} />
      </div>

      {/* 2. HIỂN THỊ BULLET POINTS (Các dòng còn lại) */}
      {bulletLines.length > 0 && (
        <div className="pl-2"> {/* Thêm chút padding trái nếu muốn list thụt vào so với câu dẫn */}
          <ul className="list-disc pl-6 space-y-2 text-slate-800">
            {bulletLines.map((line, idx) => (
              <li key={idx} className="pl-1 leading-normal">
                <InteractiveText content={line} isMath={isMath} readOnly={readOnly}/>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const BlockRenderer: React.FC<Props> = ({ blocks, subject, readOnly = false }) => {
  if (!blocks || !Array.isArray(blocks)) return null;
  const isMath = subject === 'MATH';

  return (
    <div className="flex flex-col gap-4 text-gray-800">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'text':
            return (
              <div key={index} className="leading-relaxed">
                <InteractiveText content={block.content} isMath={isMath} readOnly={readOnly}/>
              </div>
            );
          
          case 'image':
            return (
              <div key={index} className="flex flex-col items-center justify-center my-4">
                <img 
                  src={block.src} 
                  alt={block.alt || 'Question image'} 
                  className="max-w-lg max-h-80 w-auto h-auto object-contain rounded-md shadow-sm border border-gray-200"
                />
                {block.caption && <p className="text-center text-sm text-gray-500 mt-2 max-w-lg">{block.caption}</p>}
              </div>
            );

          case 'table':
            return <TableRenderer key={index} block={block} isMath={isMath} readOnly={readOnly} />;

          case 'poem':
            return <PoemRenderer key={index} block={block} isMath={isMath} readOnly={readOnly}/>;

          case 'note':
            return <NotesRenderer key={index} lines={block.lines} isMath={isMath} readOnly={readOnly}/>;

          default:
            return null;
        }
      })}
    </div>
  );
};

export default BlockRenderer;