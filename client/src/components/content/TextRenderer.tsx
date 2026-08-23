import { useLayoutEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormattedTextRendererProps {
  text: string;       // Bắt buộc phải là chuỗi
  className?: string; // Có thể có hoặc không (optional)
  inheritTypography?: boolean;
  latexOnly?: boolean;
}

const unwrapLatexDelimiters = (value: string) => {
  const trimmed = value.trim();
  const wrappers: Array<[string, string]> = [['$$', '$$'], ['\\[', '\\]'], ['\\(', '\\)'], ['$', '$']];
  const wrapper = wrappers.find(([start, end]) => trimmed.startsWith(start) && trimmed.endsWith(end));
  return wrapper ? trimmed.slice(wrapper[0].length, -wrapper[1].length).trim() : trimmed;
};

const hasLegacyMathDelimiters = (value: string) => /(^|[^\\])\$/.test(value);

type LatexSegment = { type: 'math' | 'text'; value: string };

const decodeLatexText = (value: string) => value
  .replace(/\\([%&#_$])/g, '$1')
  .replace(/\\([{}])/g, '$1')
  .replace(/\\ /g, ' ')
  .replace(/~/g, '\u00a0');

// KaTeX intentionally lays out one expression as an unbreakable unit. Math
// questions, however, contain prose in top-level \text{...} commands. Pull
// those prose runs back into normal inline text so the browser can wrap them,
// while leaving nested \text commands inside fractions and other formulas
// untouched.
const splitLatexForWrapping = (value: string): LatexSegment[] => {
  const segments: LatexSegment[] = [];
  let mathStart = 0;
  let depth = 0;
  let index = 0;

  while (index < value.length) {
    if (value[index] === '\\') {
      if (depth === 0 && value.startsWith('\\text{', index)) {
        if (index > mathStart) segments.push({ type: 'math', value: value.slice(mathStart, index) });

        const contentStart = index + '\\text{'.length;
        let cursor = contentStart;
        let textDepth = 1;
        while (cursor < value.length && textDepth > 0) {
          if (value[cursor] === '\\') {
            cursor += 2;
            continue;
          }
          if (value[cursor] === '{') textDepth += 1;
          if (value[cursor] === '}') textDepth -= 1;
          cursor += 1;
        }

        if (textDepth !== 0) return [{ type: 'math', value }];
        segments.push({ type: 'text', value: decodeLatexText(value.slice(contentStart, cursor - 1)) });
        index = cursor;
        mathStart = cursor;
        continue;
      }

      index += 2;
      continue;
    }

    if (value[index] === '{') depth += 1;
    if (value[index] === '}') depth = Math.max(0, depth - 1);
    index += 1;
  }

  if (mathStart < value.length) segments.push({ type: 'math', value: value.slice(mathStart) });
  return segments.filter(segment => segment.value.length > 0);
};

const renderLatex = (value: string) => katex.renderToString(value, {
  displayMode: false,
  throwOnError: false,
  strict: false,
  trust: false,
  output: 'htmlAndMathml',
  macros: { '\\frac': '\\dfrac' },
});

const InlineLatex = ({ value }: { value: string }) => {
  const elementRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const updateOverflow = () => {
      // Ignore sub-pixel rounding differences; they should never create a
      // scrollbar around a small inline expression.
      setIsOverflowing(element.scrollWidth > element.clientWidth + 2);
    };

    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span
      ref={elementRef}
      className={`inline-block max-w-full align-middle ${isOverflowing ? 'overflow-x-auto overflow-y-hidden' : 'overflow-visible'}`}
      dangerouslySetInnerHTML={{ __html: renderLatex(value) }}
    />
  );
};

const renderWrappedLatex = (value: string) => splitLatexForWrapping(value).map((segment, index) => segment.type === 'text' ? (
  <span key={index} className="whitespace-pre-wrap">{segment.value}</span>
) : (
  <InlineLatex key={index} value={segment.value} />
));

const FormattedTextRenderer: React.FC<FormattedTextRendererProps> = ({ text, className = "", inheritTypography = false, latexOnly = false }) => {
  if (!text) return null;

  // Existing Math tests used prose with $...$ fragments. Keep those readable
  // while all newly imported Math content is validated as raw strict LaTeX.
  if (latexOnly && hasLegacyMathDelimiters(text)) {
    return (
      <div className={`${inheritTypography ? '' : 'text-[16px] leading-relaxed'} lining-nums text-gray-800 space-y-3 ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[[rehypeKatex, { macros: { '\\frac': '\\dfrac' }, strict: false }]]}
          components={{
            p: ({ node, ...props }) => { void node; return <p className="whitespace-pre-wrap" {...props} />; },
          }}
        >
          {text.trim()}
        </ReactMarkdown>
      </div>
    );
  }

  if (latexOnly) {
    const normalizedLatex = unwrapLatexDelimiters(text);
    const hasInlineNoteMarker = /^\[NOTE\](?:\s|$)/i.test(normalizedLatex);

    if (hasInlineNoteMarker) {
      const noteLines = normalizedLatex
        .replace(/^\[NOTE\]\s*/i, '')
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean);

      return (
        <div className={`${inheritTypography ? '' : 'text-[16px] leading-relaxed'} max-w-full space-y-2 text-gray-800 ${className}`}>
          {noteLines.map((line, index) => (
            <div key={index} className="whitespace-normal break-words leading-relaxed">
              {renderWrappedLatex(line)}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={`${inheritTypography ? '' : 'text-[16px] leading-relaxed'} max-w-full whitespace-normal break-words text-gray-800 ${className}`}>
        {renderWrappedLatex(normalizedLatex)}
      </div>
    );
  }

  return (
    <div className={`${inheritTypography ? '' : 'font-serif text-[16px] leading-relaxed'} lining-nums text-gray-800 space-y-3 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[
          [rehypeKatex, { 
            macros: {
              "\\frac": "\\dfrac" // Ép mọi phân số thành bản to chuẩn
            },
            strict: false 
          }]
        ]}
        components={{
          p: ({ node, ...props }) => { void node; return <p className="whitespace-pre-wrap" {...props} />; },
          ul: ({ node, ...props }) => { void node; return <ul className="list-disc pl-5 space-y-2 my-3" {...props} />; },
          li: ({ node, ...props }) => { void node; return <li className="pl-1" {...props} />; }
        }}
      >
        {text.trim()}
      </ReactMarkdown>
    </div>
  );
};

export default FormattedTextRenderer;
