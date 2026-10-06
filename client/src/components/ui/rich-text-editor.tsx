import { forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';
import { sanitizeRichText } from '@/components/ui/rich-text-content';
import { Skeleton } from '@/components/ui/skeleton';
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
  expanded?: boolean;
  fill?: boolean;
  autoFocus?: boolean;
  hideToolbar?: boolean;
  onFormatChange?: (formats: RichTextFormats) => void;
  onShortcut?: (shortcut: RichTextShortcut) => void;
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

type RichTextShortcut = 'bold' | 'italic' | 'underline' | 'ordered-list' | 'bullet-list' | 'link' | 'previous-cell' | 'next-cell' | 'commit' | 'escape';

function getRichTextShortcut(event: KeyboardEvent<HTMLElement>): RichTextShortcut | null {
  if (event.nativeEvent.isComposing || event.key === 'Process') return null;
  if (event.key === 'Tab') return event.shiftKey ? 'previous-cell' : 'next-cell';
  if (event.key === 'Escape') return 'escape';

  const modifier = event.ctrlKey || event.metaKey;
  if (!modifier) return null;
  if (event.code === 'Enter' || event.key === 'Enter') return 'commit';
  if (event.shiftKey && event.code === 'Digit7') return 'ordered-list';
  if (event.shiftKey && event.code === 'Digit8') return 'bullet-list';
  if (event.code === 'KeyB') return 'bold';
  if (event.code === 'KeyI') return 'italic';
  if (event.code === 'KeyU') return 'underline';
  if (event.code === 'KeyK') return 'link';
  return null;
}

const EMPTY_FORMATS: RichTextFormats = { bold: false, italic: false, underline: false, list: null, link: null };
const LazyQuillRichTextEditor = lazy(() => import('@/components/ui/quill-rich-text-editor'));

const QuillRichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function QuillRichTextEditor(props, forwardedRef) {
  return <Suspense fallback={<Skeleton className={props.fill ? 'min-h-0 flex-1' : 'min-h-24 border border-input'} role="status" aria-label="Loading editor" />}>
    <LazyQuillRichTextEditor ref={forwardedRef} {...props} />
  </Suspense>;
});

const NativeRichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function NativeRichTextEditor({ id, labelledBy, value, onChange, placeholder, disabled = false, className, compact = false, expanded = false, fill = false, autoFocus = false, hideToolbar = false, onFormatChange, onShortcut }, forwardedRef) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSelection = useRef<Range | null>(null);
  const lastEmittedValue = useRef(value);
  const lastFormats = useRef<RichTextFormats>(EMPTY_FORMATS);

  const publishFormats = () => {
    const editor = editorRef.current;
    const selection = document.getSelection();
    const anchor = selection?.anchorNode;
    if (!editor || !anchor || !editor.contains(anchor)) return;
    const element = anchor.nodeType === Node.ELEMENT_NODE ? anchor as Element : anchor.parentElement;
    const list = element?.closest('ol') ? 'ordered' : element?.closest('ul') ? 'bullet' : null;
    const link = element?.closest('a')?.getAttribute('href') || null;
    const next: RichTextFormats = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      list,
      link,
    };
    const previous = lastFormats.current;
    if (previous.bold === next.bold && previous.italic === next.italic && previous.underline === next.underline && previous.list === next.list && previous.link === next.link) return;
    lastFormats.current = next;
    onFormatChange?.(next);
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
    const selection = window.getSelection();
    if (autoFocus && (!selection || selection.isCollapsed || editorRef.current?.contains(selection.anchorNode))) editorRef.current?.focus();
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
      fill && 'flex min-h-0 flex-1 flex-col',
      className,
    )}
    onKeyDownCapture={event => {
      const shortcut = onShortcut ? getRichTextShortcut(event) : null;
      if (!shortcut) return;
      event.preventDefault();
      event.stopPropagation();
      onShortcut?.(shortcut);
    }}
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
        compact && !fill && 'min-h-24 max-h-80 overflow-y-auto',
        expanded && !fill && 'min-h-72 max-h-96 overflow-y-auto',
        fill && 'min-h-0 flex-1 overflow-y-auto',
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
export { getRichTextShortcut };
export type { RichTextEditorHandle, RichTextEditorProps, RichTextFormats, RichTextShortcut };
