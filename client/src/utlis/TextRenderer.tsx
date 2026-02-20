import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface FormattedTextRendererProps {
  text: string;       // Bắt buộc phải là chuỗi
  className?: string; // Có thể có hoặc không (optional)
}

const FormattedTextRenderer: React.FC<FormattedTextRendererProps> = ({ text, className = "" }) => {
  if (!text) return null;

  return (
    <div className={`font-sans text-[15px] leading-relaxed text-gray-800 markdown-body space-y-2 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ node, ...props }) => <p className="mb-2 whitespace-pre-wrap" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1 my-2" {...props} />,
          li: ({ node, ...props }) => <li className="pl-1" {...props} />
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default FormattedTextRenderer;