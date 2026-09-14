import type { RefObject } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
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
  anchorRef: RefObject<HTMLElement | null>;
  isMobile: boolean;
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

const isFormattingToolbar = (target: EventTarget | null) => target instanceof HTMLElement
  && Boolean(target.closest('[data-error-log-toolbar]'));

export function ExpandedReflectionEditor(props: ExpandedReflectionEditorProps) {
  const closeFromSurface = (open: boolean) => {
    if (!open) props.onClose(false);
  };
  const keepOpenForToolbar = (event: { target: EventTarget | null; preventDefault: () => void }) => {
    if (isFormattingToolbar(event.target)) event.preventDefault();
  };

  if (props.isMobile) {
    return <Sheet open modal={false} onOpenChange={closeFromSurface}>
      <SheetContent
        side="bottom"
        showOverlay={false}
        className="max-h-[85vh] gap-0 rounded-t-xl border-ui-border p-0"
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

  return <Popover open modal={false} onOpenChange={closeFromSurface}>
    <PopoverAnchor virtualRef={props.anchorRef} />
    <PopoverContent
      side="bottom"
      align="start"
      sideOffset={6}
      collisionPadding={16}
      sticky="always"
      className="w-[min(48rem,calc(100vw-2rem))] p-0"
      onOpenAutoFocus={event => event.preventDefault()}
      onCloseAutoFocus={event => event.preventDefault()}
      onInteractOutside={keepOpenForToolbar}
    >
      <header className="flex items-start gap-3 border-b border-ui-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-sm font-medium text-foreground">{fieldLabels[props.active.field]}</h2>
          <p className="truncate text-xs text-muted-foreground">{props.active.entry.source || 'Untitled entry'}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close reflection editor" onClick={() => props.onClose(true)}><X /></Button>
      </header>
      <EditorBody {...props} />
    </PopoverContent>
  </Popover>;
}

function EditorBody({ active, draftStore, editorRef, onChange, onFlush, onClose, onNavigate, onResolveConflict, onFormatChange, onFormatCommand }: ExpandedReflectionEditorProps) {
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

  return <div className="space-y-3 p-4">
    <span id={labelId} className="sr-only">{fieldLabels[active.field]} for {active.entry.source || 'untitled entry'}</span>
    <RichTextEditor
      key={active.key}
      ref={editorRef}
      id={`${active.key}-editor`}
      labelledBy={labelId}
      expanded
      autoFocus
      hideToolbar
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
    <p className="text-xs text-muted-foreground">Tab moves between reflection cells. Ctrl/Cmd+Enter saves and closes.</p>
  </div>;
}
