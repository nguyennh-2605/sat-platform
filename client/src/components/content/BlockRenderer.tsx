// src/components/BlockRenderer.tsx
import React from 'react';
import type { ContentBlock, TableBlock, PoemBlock } from '../../types/quiz';
import InteractiveText from '../../features/quiz/InteractiveText';

interface Props {
  blocks: ContentBlock[];
  subject: string;
  readOnly?: boolean;
  variant?: 'default' | 'preview' | 'exam';
}

// --- 1. Component hiển thị Bảng (Table) ---
const TableRenderer = ({ block, isMath, readOnly, preview, exam }: { block: TableBlock, isMath: boolean, readOnly: boolean, preview: boolean, exam: boolean }) => (
  <div className={`my-5 w-full max-w-full overflow-hidden rounded-xl border border-[#B9CBC4] bg-white text-[#1A1A1A] ${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : "font-['Source_Serif_4',_'Georgia',_serif] text-[16px] leading-relaxed"}`}>
    {/* Tiêu đề bảng */}
    {block.title && (
      <div className="border-b border-[#B9CBC4] bg-[#E8F5EF] px-4 py-3 text-left text-sm font-semibold text-[#145F47]">
        {block.title}
      </div>
    )}

    <div className="w-full overflow-x-auto">
      <table className="min-w-full table-auto border-collapse text-left">
        {/* Header */}
        <thead className="border-b border-[#C9D8D2] bg-[#F2F8F5] text-[#374151]">
          <tr>
            {block.headers.map((header, idx) => (
              <th key={idx} scope="col" className="min-w-[120px] border-r border-[#C9D8D2] px-4 py-2.5 align-top text-sm font-semibold last:border-r-0">
                <InteractiveText content={header} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam} />
              </th>
            ))}
          </tr>
        </thead>
        {/* Body */}
        <tbody className="divide-y divide-[#D2DED9] text-[#374151]">
          {block.rows.map((row, rIdx) => (
            <tr key={rIdx} className="even:bg-[#FBFDFC]">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="min-w-[120px] border-r border-[#D2DED9] px-4 py-3 align-top last:border-r-0">
                  <InteractiveText content={cell} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Ghi chú chân bảng */}
    {block.note && (
      <div className="border-t border-[#C9D8D2] bg-[#F8FBF9] px-4 py-2.5 text-xs italic leading-5 text-[#5E6B66]">
        {block.note}
      </div>
    )}
  </div>
);

// --- 2. Component hiển thị Thơ (Poem) ---
const PoemRenderer = ({ block, isMath, readOnly, preview, exam }: { block: PoemBlock, isMath: boolean, readOnly: boolean, preview: boolean, exam: boolean }) => (
  <div className="my-6 pl-6 border-l-4 border-[#A9CFC1] bg-gray-50 p-5 rounded-r-md">
    {/* Tiêu đề bài thơ */}
    {block.title && (
      <div className={`mb-3 text-lg font-bold text-gray-800 ${preview || exam ? 'font-sans' : 'font-serif'}`}>
        {block.title}
      </div>
    )}
    
    {/* Nội dung thơ (Font sans cho nghệ thuật) */}
    <div className={`${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : "font-['Source_Serif_4',_'Georgia',_serif] text-[16px] leading-relaxed"} lining-nums tabular-nums font-normal text-[#1a1a1a] tracking-normal`}>
      {block.lines.map((line, idx) => (
        // Thêm padding-left cho các dòng chẵn để tạo hiệu ứng thụt đầu dòng thơ
        <div key={idx} className={idx % 2 !== 0 ? "pl-4" : ""}>
          <InteractiveText content={line} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam} />
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

const NotesRenderer = ({ lines, isMath, readOnly, preview, exam }: { lines: string[], isMath: boolean, readOnly: boolean, preview: boolean, exam: boolean }) => {
  // Guard clause: Nếu không có dữ liệu thì không render gì cả
  if (!lines || lines.length === 0) return null;

  // TÁCH DỮ LIỆU:
  // introLine: Lấy phần tử đầu tiên
  // bulletLines: Lấy toàn bộ các phần tử còn lại
  const [introLine, ...bulletLines] = lines;

  return (
    <div className={`${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : "font-['Source_Serif_4',_'Georgia',_serif] text-[16px] leading-relaxed"} lining-nums tabular-nums font-normal text-[#1a1a1a] tracking-normal`}>
      
      <div className="mb-3 leading-relaxed">
        <InteractiveText content={introLine} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam} />
      </div>

      {/* 2. HIỂN THỊ BULLET POINTS (Các dòng còn lại) */}
      {bulletLines.length > 0 && (
        <div className="pl-2"> {/* Thêm chút padding trái nếu muốn list thụt vào so với câu dẫn */}
          <ul className="list-disc pl-6 space-y-2 text-slate-800">
            {bulletLines.map((line, idx) => (
              <li key={idx} className="pl-1 leading-normal">
                <InteractiveText content={line} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam}/>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const BlockRenderer: React.FC<Props> = ({ blocks, subject, readOnly = false, variant = 'default' }) => {
  if (!blocks || !Array.isArray(blocks)) return null;
  const isMath = subject === 'MATH';
  const preview = variant === 'preview';
  const exam = variant === 'exam';

  return (
    <div className={`flex flex-col gap-4 text-gray-800 ${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : ''}`}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'text':
            return (
              <div key={index} className="leading-relaxed">
                <InteractiveText content={block.content} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam}/>
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
            return <TableRenderer key={index} block={block} isMath={isMath} readOnly={readOnly} preview={preview} exam={exam} />;

          case 'poem':
            return <PoemRenderer key={index} block={block} isMath={isMath} readOnly={readOnly} preview={preview} exam={exam}/>;

          case 'note':
            return <NotesRenderer key={index} lines={block.lines} isMath={isMath} readOnly={readOnly} preview={preview} exam={exam}/>;

          default:
            return null;
        }
      })}
    </div>
  );
};

export default BlockRenderer;
