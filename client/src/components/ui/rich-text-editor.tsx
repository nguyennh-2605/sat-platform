import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

import { cn } from '@/lib/utils';

const basicToolbar = [
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['clean'],
];

const basicFormats = ['bold', 'italic', 'underline', 'list', 'link'];

interface RichTextEditorProps {
  id?: string;
  labelledBy?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  autoFocus?: boolean;
  hideToolbar?: boolean;
  onFormatChange?: (formats: RichTextFormats) => void;
}

interface RichTextFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  list: 'ordered' | 'bullet' | null;
  link: string | null;
}

interface RichTextEditorHandle {
  toggleInline: (format: 'bold' | 'italic' | 'underline') => void;
  toggleList: (list: 'ordered' | 'bullet') => void;
  setLink: (href: string | null) => void;
  clearFormatting: () => void;
  focus: () => void;
}

const EMPTY_FORMATS: RichTextFormats = { bold: false, italic: false, underline: false, list: null, link: null };

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor({ id, labelledBy, value, onChange, placeholder, disabled = false, className, compact = false, autoFocus = false, hideToolbar = false, onFormatChange }, forwardedRef) {
  const rootRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<ReactQuill>(null);
  const lastSelection = useRef<{ index: number; length: number } | null>(null);

  const withEditor = (callback: (editor: ReturnType<ReactQuill['getEditor']>, selection: { index: number; length: number }) => void) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection() || lastSelection.current || { index: editor.getLength() - 1, length: 0 };
    editor.setSelection(selection.index, selection.length, 'silent');
    editor.focus();
    callback(editor, selection);
  };

  useImperativeHandle(forwardedRef, () => ({
    toggleInline(format) {
      withEditor((editor, selection) => editor.format(format, !editor.getFormat(selection)[format], 'user'));
    },
    toggleList(list) {
      withEditor((editor, selection) => editor.format('list', editor.getFormat(selection).list === list ? false : list, 'user'));
    },
    setLink(href) {
      withEditor(editor => editor.format('link', href || false, 'user'));
    },
    clearFormatting() {
      withEditor((editor, selection) => editor.removeFormat(selection.index, selection.length, 'user'));
    },
    focus() { quillRef.current?.getEditor().focus(); },
  }));

  const publishFormats = () => {
    const editor = quillRef.current?.getEditor();
    const selection = editor?.getSelection() || lastSelection.current;
    if (!editor || !selection) return onFormatChange?.(EMPTY_FORMATS);
    const formats = editor.getFormat(selection);
    onFormatChange?.({
      bold: Boolean(formats.bold), italic: Boolean(formats.italic), underline: Boolean(formats.underline),
      list: formats.list === 'ordered' || formats.list === 'bullet' ? formats.list : null,
      link: typeof formats.link === 'string' ? formats.link : null,
    });
  };

  useEffect(() => {
    if (autoFocus) rootRef.current?.querySelector<HTMLElement>('.ql-editor')?.focus();
  }, [autoFocus]);

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
      compact && '[&_.ql-editor]:min-h-24 [&_.ql-editor]:max-h-80 [&_.ql-editor]:overflow-y-auto [&_.ql-toolbar]:p-1',
      className,
    )}
  >
    <ReactQuill
      ref={quillRef}
      id={id}
      theme="snow"
      value={value}
      onChange={nextValue => { if (nextValue !== value) onChange(nextValue); queueMicrotask(publishFormats); }}
      onChangeSelection={range => { if (range) lastSelection.current = range; queueMicrotask(publishFormats); }}
      placeholder={placeholder}
      readOnly={disabled}
      modules={{ toolbar: hideToolbar ? false : basicToolbar }}
      formats={basicFormats}
      useSemanticHTML
    />
  </div>;
});

export { RichTextEditor, EMPTY_FORMATS };
export type { RichTextEditorHandle, RichTextFormats };
