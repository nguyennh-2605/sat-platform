import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface FormattedTextRendererProps {
  text: string;       // Bắt buộc phải là chuỗi
  className?: string; // Có thể có hoặc không (optional)
  inheritTypography?: boolean;
}

const FormattedTextRenderer: React.FC<FormattedTextRendererProps> = ({ text, className = "", inheritTypography = false }) => {
  if (!text) return null;

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
          p: ({ node, ...props }) => <p className="whitespace-pre-wrap" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-2 my-3" {...props} />,
          li: ({ node, ...props }) => <li className="pl-1" {...props} />
        }}
      >
        {text.trim()}
      </ReactMarkdown>
    </div>
  );
};

export default FormattedTextRenderer;
