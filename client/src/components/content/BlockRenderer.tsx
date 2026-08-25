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
  <div className={`my-5 w-full max-w-full overflow-hidden border bg-white text-[#1A1A1A] ${exam ? 'rounded-none border-[#4B5563]' : 'rounded-xl border-[#B9CBC4]'} ${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : "font-['Source_Serif_4','Georgia',serif] text-[16px] leading-relaxed"}`}>
    {/* Tiêu đề bảng */}
    {block.title && (
      <div className={`border-b px-4 py-3 text-sm font-semibold ${exam ? 'border-[#4B5563] bg-white text-center text-black' : 'border-[#B9CBC4] bg-[#E8F5EF] text-left text-[#145F47]'}`}>
        {isMath ? <InteractiveText content={block.title} isMath readOnly={readOnly} inheritTypography /> : block.title}
      </div>
    )}

    <div className="w-full overflow-x-auto">
      <table className="min-w-full table-auto border-collapse text-left">
        {/* Header */}
        <thead className={`border-b ${exam ? 'border-[#4B5563] bg-white text-black' : 'border-[#C9D8D2] bg-[#F2F8F5] text-[#374151]'}`}>
          <tr>
            {block.headers.map((header, idx) => (
              <th key={idx} scope="col" className={`min-w-[120px] border-r px-4 py-2.5 align-top text-sm font-semibold last:border-r-0 ${exam ? 'border-[#4B5563]' : 'border-[#C9D8D2]'}`}>
                <InteractiveText content={header} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam} />
              </th>
            ))}
          </tr>
        </thead>
        {/* Body */}
        <tbody className={`divide-y ${exam ? 'divide-[#4B5563] text-black' : 'divide-[#D2DED9] text-[#374151]'}`}>
          {block.rows.map((row, rIdx) => (
            <tr key={rIdx} className={exam ? 'bg-white' : 'even:bg-[#FBFDFC]'}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} className={`min-w-[120px] border-r px-4 py-3 align-top last:border-r-0 ${exam ? 'border-[#4B5563]' : 'border-[#D2DED9]'}`}>
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
      <div className={`border-t px-4 py-2.5 text-xs italic leading-5 ${exam ? 'border-[#4B5563] bg-white text-black' : 'border-[#C9D8D2] bg-[#F8FBF9] text-[#5E6B66]'}`}>
        {isMath ? <InteractiveText content={block.note} isMath readOnly={readOnly} inheritTypography /> : block.note}
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
        {isMath ? <InteractiveText content={block.title} isMath readOnly={readOnly} inheritTypography /> : block.title}
      </div>
    )}
    
    {/* Nội dung thơ (Font sans cho nghệ thuật) */}
    <div className={`${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : "font-['Source_Serif_4','Georgia',serif] text-[16px] leading-relaxed"} lining-nums tabular-nums font-normal text-[#1a1a1a] tracking-normal`}>
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
        {isMath ? <InteractiveText content={block.author} isMath readOnly={readOnly} inheritTypography /> : <>— {block.author}</>}
      </div>
    )}
  </div>
);

const NotesRenderer = ({ lines, isMath, readOnly, preview, exam }: { lines: string[], isMath: boolean, readOnly: boolean, preview: boolean, exam: boolean }) => {
  // Guard clause: Nếu không có dữ liệu thì không render gì cả
  if (!lines || lines.length === 0) return null;

  const romanItemPattern = /^(?:\\text\{\s*)?\(?(?:VIII|VII|VI|IV|III|II|IX|V|X|I)\)?[.)](?:\s|\\|})/i;
  const firstRomanItem = lines.findIndex(line => romanItemPattern.test(line.trim()));
  const romanItemCount = lines.filter(line => romanItemPattern.test(line.trim())).length;
  const isRomanList = firstRomanItem >= 0 && romanItemCount >= 2;

  if (isRomanList) {
    const introLines = lines.slice(0, firstRomanItem);
    const numberedLines = lines.slice(firstRomanItem);

    return (
      <div className={`${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : "font-['Source_Serif_4','Georgia',serif] text-[16px] leading-relaxed"} lining-nums tabular-nums font-normal text-[#1a1a1a] tracking-normal`}>
        {introLines.length > 0 && (
          <div className="mb-3 space-y-2">
            {introLines.map((line, idx) => (
              <InteractiveText key={idx} content={line} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam} />
            ))}
          </div>
        )}
        <div className="space-y-2">
          {numberedLines.map((line, idx) => (
            <div key={idx} className="leading-relaxed">
              <InteractiveText content={line} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // TÁCH DỮ LIỆU:
  // introLine: Lấy phần tử đầu tiên
  // bulletLines: Lấy toàn bộ các phần tử còn lại
  const [introLine, ...bulletLines] = lines;

  return (
    <div className={`${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : "font-['Source_Serif_4','Georgia',serif] text-[16px] leading-relaxed"} lining-nums tabular-nums font-normal text-[#1a1a1a] tracking-normal`}>
      
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
                  className="max-w-lg max-h-80 w-auto h-auto object-contain rounded-md shadow-xs border border-gray-200"
                />
                {block.caption && <div className="mt-2 max-w-lg text-center text-sm text-gray-500">{isMath ? <InteractiveText content={block.caption} isMath readOnly={readOnly} inheritTypography /> : block.caption}</div>}
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
