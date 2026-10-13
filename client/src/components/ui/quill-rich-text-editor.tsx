import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

import { cn } from '@/lib/utils';
import { getRichTextShortcut, type RichTextEditorHandle, type RichTextEditorProps, type RichTextFormats } from '@/components/ui/rich-text-editor';

const basicToolbar = [
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['clean'],
];
const basicFormats = ['bold', 'italic', 'underline', 'list', 'link'];
const standardModules = { toolbar: basicToolbar };
const standardModulesWithoutToolbar = { toolbar: false };
const emptyFormats: RichTextFormats = { bold: false, italic: false, underline: false, list: null, link: null };
type InlineFormat = 'bold' | 'italic' | 'underline';
const isNativeInlineShortcut = (shortcut: ReturnType<typeof getRichTextShortcut>) => shortcut === 'bold'
  || shortcut === 'italic'
  || shortcut === 'underline';
const getInlineFormatShortcut = (event: { altKey: boolean; code: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): InlineFormat | null => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return null;
  if (event.code === 'KeyB') return 'bold';
  if (event.code === 'KeyI') return 'italic';
  if (event.code === 'KeyU') return 'underline';
  return null;
};

const QuillRichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function QuillRichTextEditor({ id, labelledBy, value, onChange, placeholder, disabled = false, className, compact = false, expanded = false, fill = false, autoFocus = false, hideToolbar = false, onFormatChange, onShortcut }, forwardedRef) {
  const rootRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<ReactQuill>(null);
  const lastSelection = useRef<{ index: number; length: number } | null>(null);
  const preservedSelection = useRef<{ index: number; length: number } | null>(null);
  const lastFormats = useRef<RichTextFormats>(emptyFormats);
  const formatFrame = useRef<number | null>(null);
  const compositionFrame = useRef<number | null>(null);
  const deferredCompositionFormats = useRef(new Set<InlineFormat>());

  const publishFormats = () => {
    const editor = quillRef.current?.getEditor();
    const selection = editor?.getSelection() || lastSelection.current;
    const formats = editor && selection ? editor.getFormat(selection) : {};
    const next: RichTextFormats = {
      bold: Boolean(formats.bold),
      italic: Boolean(formats.italic),
      underline: Boolean(formats.underline),
      list: formats.list === 'ordered' || formats.list === 'bullet' ? formats.list : null,
      link: typeof formats.link === 'string' ? formats.link : null,
    };
    const previous = lastFormats.current;
    if (previous.bold === next.bold && previous.italic === next.italic && previous.underline === next.underline && previous.list === next.list && previous.link === next.link) return;
    lastFormats.current = next;
    onFormatChange?.(next);
  };

  const scheduleFormats = () => {
    if (formatFrame.current !== null) cancelAnimationFrame(formatFrame.current);
    formatFrame.current = requestAnimationFrame(() => {
      formatFrame.current = null;
      publishFormats();
    });
  };

  const withEditor = (callback: (editor: ReturnType<ReactQuill['getEditor']>, selection: { index: number; length: number }) => void) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const selection = preservedSelection.current || editor.getSelection() || lastSelection.current || { index: editor.getLength() - 1, length: 0 };
    preservedSelection.current = null;
    editor.setSelection(selection.index, selection.length, 'silent');
    editor.focus();
    callback(editor, selection);
    lastSelection.current = editor.getSelection() || selection;
    publishFormats();
    scheduleFormats();
  };

  useImperativeHandle(forwardedRef, () => ({
    preserveSelection() {
      // Capture synchronously before a link input takes focus. Quill's delayed
      // selection-change events can otherwise replace the selected text with a caret.
      const selection = quillRef.current?.getEditor().getSelection() || lastSelection.current;
      preservedSelection.current = selection ? { ...selection } : null;
    },
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
      withEditor((editor, selection) => {
        if (selection.length > 0) {
          editor.removeFormat(selection.index, selection.length, 'user');
          return;
        }
        const formats = editor.getFormat(selection);
        ['bold', 'italic', 'underline', 'list', 'link'].forEach(format => {
          if (formats[format]) editor.format(format, false, 'user');
        });
      });
    },
    focus() { withEditor(() => {}); },
  }));

  useEffect(() => () => {
    if (formatFrame.current !== null) cancelAnimationFrame(formatFrame.current);
    if (compositionFrame.current !== null) cancelAnimationFrame(compositionFrame.current);
  }, []);

  useEffect(() => {
    const selection = window.getSelection();
    // Lazy loading must not steal a word selection the student already made in the question pane.
    if (autoFocus && (!selection || selection.isCollapsed || rootRef.current?.contains(selection.anchorNode))) rootRef.current?.querySelector<HTMLElement>('.ql-editor')?.focus();
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
      'overflow-hidden rounded-control border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
      '[&_.ql-toolbar.ql-snow]:border-0 [&_.ql-toolbar.ql-snow]:border-b [&_.ql-toolbar.ql-snow]:border-ui-border [&_.ql-toolbar.ql-snow]:bg-muted/20',
      '[&_.ql-container.ql-snow]:border-0 [&_.ql-editor]:min-h-40 [&_.ql-editor]:font-sans [&_.ql-editor]:text-sm [&_.ql-editor]:leading-6 [&_.ql-editor]:text-foreground',
      '[&_.ql-editor.ql-blank:before]:text-muted-foreground! [&_.ql-editor.ql-blank:before]:not-italic! [&_.ql-stroke]:stroke-muted-foreground [&_.ql-fill]:fill-muted-foreground',
      disabled && 'pointer-events-none opacity-60',
      compact && !fill && '[&_.ql-editor]:min-h-24 [&_.ql-editor]:max-h-60 [&_.ql-editor]:overflow-y-auto [&_.ql-toolbar]:p-1',
      expanded && !fill && '[&_.ql-editor]:min-h-72 [&_.ql-editor]:max-h-96 [&_.ql-editor]:overflow-y-auto',
      // Override the legacy fixed container height and Quill's unlayered
      // theme border only when the editor fills its owning surface.
      fill && 'flex min-h-0 flex-1 flex-col [&_.ql-container.ql-snow]:flex [&_.ql-container.ql-snow]:h-auto! [&_.ql-container.ql-snow]:border-0! [&_.ql-container.ql-snow]:min-h-0 [&_.ql-container.ql-snow]:flex-1 [&_.ql-container.ql-snow]:flex-col [&_.ql-editor]:h-auto [&_.ql-editor]:min-h-0 [&_.ql-editor]:flex-1 [&_.ql-editor]:overflow-y-auto',
      className,
    )}
    onKeyDownCapture={event => {
      const composingFormat = event.nativeEvent.isComposing ? getInlineFormatShortcut(event) : null;
      if (composingFormat) {
        event.preventDefault();
        event.stopPropagation();
        const deferred = deferredCompositionFormats.current;
        if (deferred.has(composingFormat)) deferred.delete(composingFormat);
        else deferred.add(composingFormat);
        return;
      }
      const shortcut = onShortcut ? getRichTextShortcut(event) : null;
      if (!shortcut) return;
      // Quill's keyboard module owns inline shortcuts. Its binding applies the
      // pending format directly to a collapsed caret during ordinary input;
      // composing shortcuts are deferred above. The app dispatcher still owns
      // navigation, exit, lists, and links.
      if (isNativeInlineShortcut(shortcut)) return;
      event.preventDefault();
      event.stopPropagation();
      onShortcut?.(shortcut);
    }}
    onKeyDown={event => {
      const shortcut = onShortcut ? getRichTextShortcut(event) : null;
      if (isNativeInlineShortcut(shortcut)) event.stopPropagation();
    }}
    onKeyUpCapture={event => {
      if (isNativeInlineShortcut(onShortcut ? getRichTextShortcut(event) : null)) scheduleFormats();
    }}
    onCompositionEndCapture={() => {
      const deferred = [...deferredCompositionFormats.current];
      deferredCompositionFormats.current.clear();
      if (deferred.length === 0) return;
      if (compositionFrame.current !== null) cancelAnimationFrame(compositionFrame.current);
      compositionFrame.current = requestAnimationFrame(() => {
        compositionFrame.current = null;
        withEditor((editor, selection) => {
          deferred.forEach(format => editor.format(format, !editor.getFormat(selection)[format], 'user'));
        });
      });
    }}
  >
    <ReactQuill
      ref={quillRef}
      className={fill ? 'flex min-h-0 flex-1 flex-col' : undefined}
      id={id}
      theme="snow"
      value={value}
      onChange={(nextValue, _delta, source) => {
        if (source === 'user' && nextValue !== value) onChange(nextValue);
        scheduleFormats();
      }}
      onChangeSelection={range => {
        if (range) lastSelection.current = range;
        scheduleFormats();
      }}
      placeholder={placeholder}
      readOnly={disabled}
      modules={hideToolbar ? standardModulesWithoutToolbar : standardModules}
      formats={basicFormats}
      useSemanticHTML
    />
  </div>;
});

export default QuillRichTextEditor;
