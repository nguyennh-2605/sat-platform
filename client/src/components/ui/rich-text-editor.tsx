import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ClipboardEvent } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

import { cn } from '@/lib/utils';
import { sanitizeRichText } from '@/components/ui/rich-text-content';

const basicToolbar = [
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['clean'],
];

const basicFormats = ['bold', 'italic', 'underline', 'list', 'link'];
const standardModules = { toolbar: basicToolbar };
const standardModulesWithoutToolbar = { toolbar: false };
const hasUsableArrayConstructor = typeof Array.prototype.constructor === 'function';

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

const QuillRichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function QuillRichTextEditor({ id, labelledBy, value, onChange, placeholder, disabled = false, className, compact = false, autoFocus = false, hideToolbar = false, onFormatChange }, forwardedRef) {
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
      onChange={(nextValue, _delta, source) => {
        if (source === 'user' && nextValue !== value) onChange(nextValue);
        queueMicrotask(publishFormats);
      }}
      onChangeSelection={range => { if (range) lastSelection.current = range; queueMicrotask(publishFormats); }}
      placeholder={placeholder}
      readOnly={disabled}
      modules={hideToolbar ? standardModulesWithoutToolbar : standardModules}
      formats={basicFormats}
      useSemanticHTML
    />
  </div>;
});

const NativeRichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function NativeRichTextEditor({ id, labelledBy, value, onChange, placeholder, disabled = false, className, compact = false, autoFocus = false, hideToolbar = false, onFormatChange }, forwardedRef) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSelection = useRef<Range | null>(null);
  const lastEmittedValue = useRef(value);

  const publishFormats = () => {
    const editor = editorRef.current;
    const selection = document.getSelection();
    const anchor = selection?.anchorNode;
    if (!editor || !anchor || !editor.contains(anchor)) return onFormatChange?.(EMPTY_FORMATS);
    const element = anchor.nodeType === Node.ELEMENT_NODE ? anchor as Element : anchor.parentElement;
    const list = element?.closest('ol') ? 'ordered' : element?.closest('ul') ? 'bullet' : null;
    const link = element?.closest('a')?.getAttribute('href') || null;
    onFormatChange?.({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      list,
      link,
    });
  };

  const rememberSelection = () => {
    const editor = editorRef.current;
    const selection = document.getSelection();
    if (editor && selection?.rangeCount && selection.anchorNode && editor.contains(selection.anchorNode)) {
      lastSelection.current = selection.getRangeAt(0).cloneRange();
    }
    publishFormats();
  };

  const emitValue = () => {
    const nextValue = editorRef.current?.innerHTML || '';
    lastEmittedValue.current = nextValue;
    onChange(nextValue);
  };

  const runCommand = (command: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    editor.focus();
    const selection = document.getSelection();
    if (selection && lastSelection.current) {
      selection.removeAllRanges();
      selection.addRange(lastSelection.current);
    }
    document.execCommand(command, false, commandValue);
    rememberSelection();
    emitValue();
  };

  useImperativeHandle(forwardedRef, () => ({
    toggleInline(format) { runCommand(format); },
    toggleList(list) { runCommand(list === 'ordered' ? 'insertOrderedList' : 'insertUnorderedList'); },
    setLink(href) { runCommand(href ? 'createLink' : 'unlink', href || undefined); },
    clearFormatting() { runCommand('removeFormat'); },
    focus() { editorRef.current?.focus(); },
  }));

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === lastEmittedValue.current || editor.innerHTML === value) return;
    editor.innerHTML = sanitizeRichText(value);
    lastEmittedValue.current = value;
  }, [value]);

  useEffect(() => {
    if (autoFocus) editorRef.current?.focus();
  }, [autoFocus]);

  const pastePlainOrSafeHtml = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    if (html) return runCommand('insertHTML', sanitizeRichText(html));
    const wrapper = document.createElement('div');
    wrapper.textContent = text;
    runCommand('insertHTML', wrapper.innerHTML.replace(/\r?\n/g, '<br>'));
  };

  return <div
    data-slot="rich-text-editor"
    className={cn(
      'overflow-hidden rounded-lg border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
      disabled && 'pointer-events-none opacity-60',
      className,
    )}
  >
    {!hideToolbar && <div className="flex flex-wrap gap-1 border-b border-ui-border bg-muted/20 p-1" role="toolbar" aria-label="Rich text formatting">
      <button type="button" className="rounded px-2 py-1 font-semibold hover:bg-muted" onMouseDown={event => event.preventDefault()} onClick={() => runCommand('bold')} aria-label="Bold">B</button>
      <button type="button" className="rounded px-2 py-1 italic hover:bg-muted" onMouseDown={event => event.preventDefault()} onClick={() => runCommand('italic')} aria-label="Italic">I</button>
      <button type="button" className="rounded px-2 py-1 underline hover:bg-muted" onMouseDown={event => event.preventDefault()} onClick={() => runCommand('underline')} aria-label="Underline">U</button>
      <button type="button" className="rounded px-2 py-1 hover:bg-muted" onMouseDown={event => event.preventDefault()} onClick={() => runCommand('insertOrderedList')} aria-label="Numbered list">1.</button>
      <button type="button" className="rounded px-2 py-1 hover:bg-muted" onMouseDown={event => event.preventDefault()} onClick={() => runCommand('insertUnorderedList')} aria-label="Bulleted list">•</button>
      <button type="button" className="rounded px-2 py-1 hover:bg-muted" onMouseDown={event => event.preventDefault()} onClick={() => runCommand('removeFormat')} aria-label="Clear formatting">Clear</button>
    </div>}
    <div
      ref={editorRef}
      id={id}
      role="textbox"
      aria-multiline="true"
      aria-labelledby={labelledBy}
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={cn(
        'min-h-40 px-3 py-2 font-sans text-sm leading-6 text-foreground outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
        compact && 'min-h-24 max-h-80 overflow-y-auto',
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }}
      onInput={emitValue}
      onFocus={rememberSelection}
      onKeyUp={rememberSelection}
      onMouseUp={rememberSelection}
      onBlur={rememberSelection}
      onPaste={pastePlainOrSafeHtml}
    />
  </div>;
});

const RichTextEditor = hasUsableArrayConstructor ? QuillRichTextEditor : NativeRichTextEditor;

export { RichTextEditor, EMPTY_FORMATS };
export type { RichTextEditorHandle, RichTextFormats };
