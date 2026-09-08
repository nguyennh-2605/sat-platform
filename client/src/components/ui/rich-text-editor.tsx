import { useEffect, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

import { cn } from '@/lib/utils';

const basicToolbar = [
  ['bold', 'italic'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['clean'],
];

const basicFormats = ['bold', 'italic', 'list', 'link'];

interface RichTextEditorProps {
  id?: string;
  labelledBy?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function RichTextEditor({ id, labelledBy, value, onChange, placeholder, disabled = false, className }: RichTextEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = rootRef.current?.querySelector<HTMLElement>('.ql-editor');
    if (!editor) return;
    if (labelledBy) editor.setAttribute('aria-labelledby', labelledBy);
    else editor.removeAttribute('aria-labelledby');
  }, [labelledBy]);

  return <div
    ref={rootRef}
    data-slot="rich-text-editor"
    className={cn(
      'overflow-hidden rounded-lg border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
      '[&_.ql-toolbar.ql-snow]:border-0 [&_.ql-toolbar.ql-snow]:border-b [&_.ql-toolbar.ql-snow]:border-ui-border [&_.ql-toolbar.ql-snow]:bg-muted/20',
      '[&_.ql-container.ql-snow]:border-0 [&_.ql-editor]:min-h-40 [&_.ql-editor]:font-sans [&_.ql-editor]:text-sm [&_.ql-editor]:leading-6 [&_.ql-editor]:text-foreground',
      '[&_.ql-editor.ql-blank:before]:text-muted-foreground [&_.ql-editor.ql-blank:before]:not-italic [&_.ql-stroke]:stroke-muted-foreground [&_.ql-fill]:fill-muted-foreground',
      disabled && 'pointer-events-none opacity-60',
      className,
    )}
  >
    <ReactQuill
      id={id}
      theme="snow"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={disabled}
      modules={{ toolbar: basicToolbar }}
      formats={basicFormats}
      useSemanticHTML
    />
  </div>;
}

export { RichTextEditor };
