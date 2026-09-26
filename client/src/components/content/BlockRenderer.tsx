// src/components/BlockRenderer.tsx
import React, { useEffect, useState } from 'react';
import type { ContentBlock, TableBlock, PoemBlock } from '../../types/quiz';
import InteractiveText from '../../features/quiz/InteractiveText';
import axiosClient from '../../lib/axios';
import { Button } from '../ui/button';
import { splitReadingParagraphs } from './readingTextFormat';

const getManagedImageUrl = async (assetId: string) => {
  const response = await axiosClient.get<{ success: boolean; data: { url: string; expiresInSeconds: number } }>(`/api/test-images/${encodeURIComponent(assetId)}/access`);
  return response.data.url;
};

function ManagedImage({ assetId, alt }: { assetId: string; alt: string }) {
  const [result, setResult] = useState<{ key: string; url?: string; failed?: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const key = `${assetId}:${retry}`;

  useEffect(() => {
    let active = true;
    void getManagedImageUrl(assetId).then(nextUrl => {
      if (active) setResult({ key, url: nextUrl });
    }).catch(() => {
      if (active) setResult({ key, failed: true });
    });
    return () => { active = false; };
  }, [assetId, key, retry]);

  const url = result?.key === key ? result.url : '';
  const failed = result?.key === key && result.failed;
  if (failed) return <div role="alert" className="rounded-lg border border-border p-3 text-sm text-muted-foreground">Image unavailable. <Button type="button" variant="outline" size="sm" onClick={() => setRetry(value => value + 1)}>Retry</Button></div>;
  if (!url) return <div role="status" className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">Loading image…</div>;
  return <img src={url} alt={alt} onError={() => {
    if (retry % 2 === 0) setRetry(value => value + 1);
    else setResult({ key, failed: true });
  }} className="max-w-lg max-h-80 w-auto h-auto object-contain rounded-md shadow-xs border border-gray-200" />;
}

interface Props {
  blocks: ContentBlock[];
  subject: string;
  readOnly?: boolean;
  variant?: 'default' | 'preview' | 'exam';
}

// --- 1. Component hiển thị Bảng (Table) ---
const TableRenderer = ({ block, isMath, readOnly }: { block: TableBlock, isMath: boolean, readOnly: boolean }) => (
  <div className="exam-content my-5 w-full max-w-full overflow-hidden rounded-none border border-[#4B5563] bg-white text-[#1A1A1A]">
    {/* Tiêu đề bảng */}
    {block.title && (
      <div className="border-b border-[#4B5563] bg-white px-4 py-3 text-center text-sm font-semibold text-black">
        {isMath ? <InteractiveText content={block.title} isMath readOnly={readOnly} inheritTypography /> : block.title}
      </div>
    )}

    <div className="w-full overflow-x-auto">
      <table className="min-w-full table-auto border-collapse text-left">
        {/* Header */}
        <thead className="border-b border-[#4B5563] bg-white text-black">
          <tr>
            {block.headers.map((header, idx) => (
              <th key={idx} scope="col" className="min-w-[120px] border-r border-[#4B5563] px-4 py-2.5 align-top text-sm font-semibold last:border-r-0">
                <InteractiveText content={header} isMath={isMath} readOnly={readOnly} inheritTypography />
              </th>
            ))}
          </tr>
        </thead>
        {/* Body */}
        <tbody className="divide-y divide-[#4B5563] text-black">
          {block.rows.map((row, rIdx) => (
            <tr key={rIdx} className="bg-white">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="min-w-[120px] border-r border-[#4B5563] px-4 py-3 align-top last:border-r-0">
                  <InteractiveText content={cell} isMath={isMath} readOnly={readOnly} inheritTypography />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Ghi chú chân bảng */}
    {block.note && (
      <div className="border-t border-[#4B5563] bg-white px-4 py-2.5 text-xs italic leading-5 text-black">
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

  const hasIntro = /(?:notes|sentences):$/i.test(lines[0]) || /researching a topic/i.test(lines[0]);
  const introLine = hasIntro ? lines[0] : '';
  const bulletLines = hasIntro ? lines.slice(1) : lines;

  return (
    <div className={`${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : "font-['Source_Serif_4','Georgia',serif] text-[16px] leading-relaxed"} lining-nums tabular-nums font-normal text-[#1a1a1a] tracking-normal`}>
      
      {introLine && (
        <div className="mb-3 leading-relaxed">
          <InteractiveText content={introLine} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam} />
        </div>
      )}

      {/* 2. HIỂN THỊ BULLET POINTS (Các dòng còn lại) */}
      {bulletLines.length > 0 && (
        <div className="pl-2"> {/* Thêm chút padding trái nếu muốn list thụt vào so với câu dẫn */}
          <ul className="list-disc space-y-2 pl-6 text-foreground">
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
              <div key={index} className="space-y-4 leading-relaxed">
                {(isMath ? [block.content] : splitReadingParagraphs(block.content)).map((paragraph, paragraphIndex) => {
                  const isCrossTextLabel = /^Text [12]$/i.test(paragraph);
                  return isCrossTextLabel ? (
                    <div key={paragraphIndex} className="font-semibold text-foreground">
                      {paragraph}
                    </div>
                  ) : (
                    <InteractiveText key={paragraphIndex} content={paragraph} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam} />
                  );
                })}
              </div>
            );
          
          case 'image':
            return (
              <div key={index} className="flex flex-col items-center justify-center my-4">
                {block.assetId
                  ? <ManagedImage assetId={block.assetId} alt={block.alt || 'Question image'} />
                  : block.src ? <img src={block.src} alt={block.alt || 'Question image'} className="max-w-lg max-h-80 w-auto h-auto object-contain rounded-md shadow-xs border border-gray-200" /> : null}
                {block.caption && <div className="mt-2 max-w-lg text-center text-sm text-gray-500">{isMath ? <InteractiveText content={block.caption} isMath readOnly={readOnly} inheritTypography /> : block.caption}</div>}
              </div>
            );

          case 'table':
            return <TableRenderer key={index} block={block} isMath={isMath} readOnly={readOnly} />;

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
