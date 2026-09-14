import { useEffect, type RefObject } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DataDock } from '@/components/ui/data-surface';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { RichTextEditor, type RichTextEditorHandle, type RichTextFormats, type RichTextShortcut } from '@/components/ui/rich-text-editor';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { ErrorEntry } from './types';
import { cellKey, useCellDraft, type EditableField, type ReflectionDraftStore } from './useReflectionDrafts';

export interface ActiveReflection {
  entry: ErrorEntry;
  field: EditableField;
  key: string;
}

interface ExpandedReflectionEditorProps {
  active: ActiveReflection;
  isMobile: boolean;
  navigationPending: boolean;
  draftStore: ReflectionDraftStore;
  editorRef: RefObject<RichTextEditorHandle | null>;
  onChange: (value: string) => void;
  onFlush: () => void;
  onClose: (restoreFocus: boolean) => void;
  onNavigate: (direction: -1 | 1) => void;
  onResolveConflict: (resolution: 'latest' | 'mine') => void;
  onFormatChange: (formats: RichTextFormats) => void;
  onFormatCommand: (command: Extract<RichTextShortcut, 'bold' | 'italic' | 'underline' | 'ordered-list' | 'bullet-list' | 'link'>) => void;
}

const fieldLabels: Record<EditableField, string> = {
  whyWrong: 'Why I chose wrong',
  whyRight: 'Why answer is right',
};

const isReflectionEditingSurface = (target: EventTarget | null) => target instanceof Element
  && Boolean(target.closest('[data-reflection-editor], [data-reflection-toolbar]'));

export function ExpandedReflectionEditor(props: ExpandedReflectionEditorProps) {
  const { active, isMobile, onClose } = props;

  useEffect(() => {
    if (isMobile) return;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!isReflectionEditingSurface(event.target)) onClose(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointerDown, true);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointerDown, true);
  }, [active.key, isMobile, onClose]);

  const closeFromSurface = (open: boolean) => {
    if (!open) props.onClose(false);
  };
  const keepOpenForToolbar = (event: { target: EventTarget | null; preventDefault: () => void }) => {
    if (isReflectionEditingSurface(event.target)) event.preventDefault();
  };

  if (props.isMobile) {
    return <Sheet open modal={false} onOpenChange={closeFromSurface}>
      <SheetContent
        data-reflection-editor
        side="bottom"
        showOverlay={false}
        className="max-h-[85vh] gap-0 rounded-t-xl border-2 border-ring/80 p-0"
        onOpenAutoFocus={event => event.preventDefault()}
        onCloseAutoFocus={event => event.preventDefault()}
        onInteractOutside={keepOpenForToolbar}
      >
        <SheetHeader className="border-b border-ui-border pr-12">
          <SheetTitle>{fieldLabels[props.active.field]}</SheetTitle>
          <SheetDescription className="truncate">{props.active.entry.source || 'Untitled entry'}</SheetDescription>
        </SheetHeader>
        <EditorBody {...props} />
      </SheetContent>
    </Sheet>;
  }

  const titleId = `${props.active.key}-dock-title`;
  const source = props.active.entry.source || 'Untitled entry';
  return <DataDock
    data-reflection-editor
    placement="floating"
    role="dialog"
    aria-modal="false"
    aria-labelledby={titleId}
    aria-busy={props.navigationPending}
    className="max-h-[min(30rem,calc(100%-7rem))] animate-in border-2 border-ring/80 fade-in shadow-xl zoom-in-95 duration-150"
  >
      <header className="flex min-h-11 shrink-0 items-center gap-3 border-b border-ui-border px-4 py-2">
        <h2 id={titleId} className="flex min-w-0 flex-1 items-center gap-1.5 font-heading text-sm font-medium text-foreground">
          <span className="shrink-0">{fieldLabels[props.active.field]}</span>
          <span className="text-muted-foreground" aria-hidden="true">·</span>
          <span className="truncate font-normal text-muted-foreground" title={source}>{source}</span>
        </h2>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close reflection editor" onClick={() => props.onClose(false)}><X /></Button>
      </header>
      <EditorBody {...props} />
  </DataDock>;
}

function EditorBody({ active, navigationPending, draftStore, editorRef, onChange, onFlush, onClose, onNavigate, onResolveConflict, onFormatChange, onFormatCommand }: ExpandedReflectionEditorProps) {
  const draft = useCellDraft(draftStore, active.key);
  const value = draft?.value ?? active.entry[active.field] ?? '';
  const labelId = `${cellKey(active.entry.id, active.field)}-expanded-label`;

  const handleShortcut = (shortcut: RichTextShortcut) => {
    if (shortcut === 'previous-cell' || shortcut === 'next-cell') {
      onNavigate(shortcut === 'previous-cell' ? -1 : 1);
      return;
    }
    if (shortcut === 'commit' || shortcut === 'escape') {
      onClose(true);
      return;
    }
    onFormatCommand(shortcut);
  };

  return <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
    <span id={labelId} className="sr-only">{fieldLabels[active.field]} for {active.entry.source || 'untitled entry'}</span>
    <RichTextEditor
      key={active.key}
      ref={editorRef}
      id={`${active.key}-editor`}
      labelledBy={labelId}
      expanded
      autoFocus
      hideToolbar
      className="border-ring/70"
      value={value}
      onChange={onChange}
      onFormatChange={onFormatChange}
      onShortcut={handleShortcut}
      placeholder="Write your reflection…"
    />
    {draft?.conflict ? <div role="alert" className="space-y-2 rounded-control border border-warning/40 bg-warning-soft p-3 text-xs text-foreground">
      <p>{draft.error}</p>
      <div><span className="font-medium">Latest saved version</span>{draft.conflict.latestValue ? <RichTextContent html={draft.conflict.latestValue} className="mt-1 max-h-24 overflow-y-auto" /> : <p className="mt-1 text-muted-foreground">Empty</p>}</div>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onResolveConflict('latest')}>Use latest</Button><Button size="sm" onClick={() => onResolveConflict('mine')}>Keep mine</Button></div>
    </div> : draft?.status === 'error' && <div role="alert" className="flex items-center justify-between gap-3 text-xs text-danger">
      <span>{draft.error}</span><Button size="sm" variant="ghost" onClick={onFlush}>Retry</Button>
    </div>}
    <p className="text-xs text-muted-foreground">{navigationPending ? 'Loading the next reflection…' : 'Tab moves between reflection cells. Ctrl/Cmd+Enter saves and closes.'}</p>
  </div>;
}
