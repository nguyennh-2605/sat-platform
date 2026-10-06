// src/components/BlockRenderer.tsx
import React, { useEffect, useState } from 'react';
import type { ContentBlock, TableBlock, PoemBlock } from '../../types/quiz';
import InteractiveText from '../../features/quiz/InteractiveText';
import { Button } from '../ui/button';
import { splitReadingParagraphs } from './readingTextFormat';
import { getManagedImageUrl } from './managedImageAccess';

function ManagedImage({ assetId, alt, disableActions = false }: { assetId: string; alt: string; disableActions?: boolean }) {
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
  if (failed) return <div role="alert" className="rounded-lg border border-border p-3 text-sm text-muted-foreground">Image unavailable.{!disableActions && <> <Button type="button" variant="outline" size="sm" onClick={() => setRetry(value => value + 1)}>Retry</Button></>}</div>;
  if (!url) return <div role="status" className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">Loading image…</div>;
  // Question diagrams can have transparent backgrounds and black labels.
  // Keep their original light canvas in both dashboard themes.
  return <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => {
    if (retry % 2 === 0) setRetry(value => value + 1);
    else setResult({ key, failed: true });
  }} className="h-auto max-h-[32rem] w-auto max-w-full rounded-control border border-ui-border bg-white object-contain shadow-xs" />;
}

interface Props {
  blocks: ContentBlock[];
  subject: string;
  readOnly?: boolean;
  variant?: 'default' | 'preview' | 'exam';
  // Review uses the dashboard theme; exams and their previews use paper colors.
  appearance?: 'paper' | 'theme';
  disableImageActions?: boolean;
}

// --- 1. Component hiển thị Bảng (Table) ---
const TableRenderer = ({ block, isMath, readOnly, themed }: { block: TableBlock, isMath: boolean, readOnly: boolean, themed: boolean }) => (
  <div className={`exam-content my-5 w-full max-w-full overflow-hidden rounded-none border ${themed ? 'border-ui-border-strong bg-surface text-foreground' : 'border-[#4B5563] bg-white text-[#1A1A1A]'}`}>
    {/* Tiêu đề bảng */}
    {block.title && (
      <div className={`border-b px-4 py-3 text-center text-sm font-semibold ${themed ? 'border-ui-border-strong' : 'border-[#4B5563]'}`}>
        {isMath ? <InteractiveText content={block.title} isMath readOnly={readOnly} inheritTypography /> : block.title}
      </div>
    )}

    <div className="w-full overflow-x-auto">
      <table className="min-w-full table-auto border-collapse text-left">
        {/* Header */}
        <thead className={`border-b ${themed ? 'border-ui-border-strong' : 'border-[#4B5563]'}`}>
          <tr>
            {block.headers.map((header, idx) => (
              <th key={idx} scope="col" className={`min-w-[120px] border-r px-4 py-2.5 align-top text-sm font-semibold last:border-r-0 ${themed ? 'border-ui-border-strong' : 'border-[#4B5563]'}`}>
                <InteractiveText content={header} isMath={isMath} readOnly={readOnly} inheritTypography />
              </th>
            ))}
          </tr>
        </thead>
        {/* Body */}
        <tbody className={`divide-y ${themed ? 'divide-ui-border-strong' : 'divide-[#4B5563]'}`}>
          {block.rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} className={`min-w-[120px] border-r px-4 py-3 align-top last:border-r-0 ${themed ? 'border-ui-border-strong' : 'border-[#4B5563]'}`}>
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
      <div className={`border-t px-4 py-2.5 text-xs italic leading-5 ${themed ? 'border-ui-border-strong' : 'border-[#4B5563]'}`}>
        {isMath ? <InteractiveText content={block.note} isMath readOnly={readOnly} inheritTypography /> : block.note}
      </div>
    )}
  </div>
);

// --- 2. Component hiển thị Thơ (Poem) ---
const PoemRenderer = ({ block, isMath, readOnly, preview, exam, themed }: { block: PoemBlock, isMath: boolean, readOnly: boolean, preview: boolean, exam: boolean, themed: boolean }) => (
  <div className={`my-6 pl-6 border-l-4 p-5 rounded-r-md ${themed ? 'border-ui-border-strong bg-muted/30' : 'border-[#A9CFC1] bg-gray-50'}`}>
    {/* Tiêu đề bài thơ */}
    {block.title && (
      <div className={`mb-3 text-lg font-bold ${preview || exam ? 'font-sans' : 'font-serif'}`}>
        {isMath ? <InteractiveText content={block.title} isMath readOnly={readOnly} inheritTypography /> : block.title}
      </div>
    )}
    
    {/* Nội dung thơ (Font sans cho nghệ thuật) */}
    <div className={`${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : "font-['Source_Serif_4','Georgia',serif] text-[16px] leading-relaxed"} lining-nums tabular-nums font-normal text-inherit tracking-normal`}>
      {block.lines.map((line, idx) => (
        // Thêm padding-left cho các dòng chẵn để tạo hiệu ứng thụt đầu dòng thơ
        <div key={idx} className={idx % 2 !== 0 ? "pl-4" : ""}>
          <InteractiveText content={line} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam} />
        </div>
      ))}
    </div>

    {/* Tác giả */}
    {block.author && (
      <div className={`mt-4 text-right text-sm font-semibold italic ${themed ? 'text-muted-foreground' : 'text-gray-600'}`}>
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
      <div className={`${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : "font-['Source_Serif_4','Georgia',serif] text-[16px] leading-relaxed"} lining-nums tabular-nums font-normal text-inherit tracking-normal`}>
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
    <div className={`${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : "font-['Source_Serif_4','Georgia',serif] text-[16px] leading-relaxed"} lining-nums tabular-nums font-normal text-inherit tracking-normal`}>
      
      {introLine && (
        <div className="mb-3 leading-relaxed">
          <InteractiveText content={introLine} isMath={isMath} readOnly={readOnly} inheritTypography={preview || exam} />
        </div>
      )}

      {/* 2. HIỂN THỊ BULLET POINTS (Các dòng còn lại) */}
      {bulletLines.length > 0 && (
        <div className="pl-2"> {/* Thêm chút padding trái nếu muốn list thụt vào so với câu dẫn */}
          <ul className="list-disc space-y-2 pl-6 text-inherit">
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

const BlockRenderer: React.FC<Props> = ({ blocks, subject, readOnly = false, variant = 'default', appearance = 'paper', disableImageActions = false }) => {
  if (!blocks || !Array.isArray(blocks)) return null;
  const isMath = subject === 'MATH';
  const preview = variant === 'preview';
  const exam = variant === 'exam';
  const themed = appearance === 'theme';

  return (
    <div className={`flex flex-col gap-4 ${themed ? 'text-foreground' : 'text-gray-800'} ${preview ? 'font-sans text-[15px] leading-6' : exam ? 'exam-content' : ''}`}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'text':
            return (
              <div key={index} className="space-y-4 leading-relaxed">
                {(isMath ? [block.content] : splitReadingParagraphs(block.content)).map((paragraph, paragraphIndex) => {
                  const isCrossTextLabel = /^Text [12]$/i.test(paragraph);
                  return isCrossTextLabel ? (
                    <div key={paragraphIndex} className="font-semibold">
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
                  ? <ManagedImage assetId={block.assetId} alt={block.alt || 'Question image'} disableActions={disableImageActions} />
                  : block.src ? <img src={block.src} alt={block.alt || 'Question image'} loading="lazy" decoding="async" className="h-auto max-h-[32rem] w-auto max-w-full rounded-control border border-ui-border bg-white object-contain shadow-xs" /> : null}
                {block.caption && <div className={`mt-2 max-w-lg text-center text-sm ${themed ? 'text-muted-foreground' : 'text-gray-500'}`}>{isMath ? <InteractiveText content={block.caption} isMath readOnly={readOnly} inheritTypography /> : block.caption}</div>}
              </div>
            );

          case 'table':
            return <TableRenderer key={index} block={block} isMath={isMath} readOnly={readOnly} themed={themed} />;

          case 'poem':
            return <PoemRenderer key={index} block={block} isMath={isMath} readOnly={readOnly} preview={preview} exam={exam} themed={themed}/>;

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
