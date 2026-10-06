import type { RefObject } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { RichTextEditor, type RichTextEditorHandle, type RichTextFormats, type RichTextShortcut } from '@/components/ui/rich-text-editor';
import { cn } from '@/lib/utils';
import { DraftSaveIndicator, FormattingControls } from './ErrorLogToolbar';
import { QuestionPanel } from './QuestionModal';
import type { ErrorEntry } from './types';
import { cellKey, useCellDraft, type EditableField, type ReflectionDraftStore } from './useReflectionDrafts';

export interface ActiveReflection {
  entry: ErrorEntry;
  field: EditableField;
  key: string;
}

interface ExpandedReflectionEditorProps {
  active: ActiveReflection;
  compactLayout: boolean;
  portalContainer: HTMLElement | null;
  showQuestion: boolean;
  formats: RichTextFormats;
  linkRequest: number;
  navigationPending: boolean;
  draftStore: ReflectionDraftStore;
  editorRef: RefObject<RichTextEditorHandle | null>;
  onChange: (value: string) => void;
  onFlush: () => void;
  onClose: (restoreFocus: boolean) => void;
  onNavigate: (direction: -1 | 1) => void;
  onSelectField: (field: EditableField) => void;
  onQuestionToggle: () => void;
  onResolveConflict: (resolution: 'latest' | 'mine') => void;
  onFormatChange: (formats: RichTextFormats) => void;
  onFormatCommand: (command: Extract<RichTextShortcut, 'bold' | 'italic' | 'underline' | 'ordered-list' | 'bullet-list' | 'link'>) => void;
}

const fieldLabels: Record<EditableField, string> = {
  whyWrong: 'Why I chose wrong',
  whyRight: 'Why answer is right',
};

export function ExpandedReflectionEditor(props: ExpandedReflectionEditorProps) {
  const { active, compactLayout, onClose } = props;
  const hasQuestion = (active.entry.origin ?? (active.entry.questionId ? 'SYSTEM_QUESTION' : 'MANUAL')) === 'SYSTEM_QUESTION';
  const showQuestion = hasQuestion && props.showQuestion;

  return <Dialog open modal={false} onOpenChange={open => { if (!open) onClose(false); }}>
    <DialogContent
      data-reflection-editor
      portalContainer={props.portalContainer}
      showOverlay={false}
      showCloseButton={false}
      aria-describedby={undefined}
      aria-busy={props.navigationPending}
      className={cn(
        'absolute bottom-3 left-auto right-3 top-auto z-40 flex max-h-[calc(100%-1.5rem)] max-w-none flex-col gap-0 overflow-hidden rounded-none border-2 border-foreground/70 bg-surface p-0 shadow-overlay ring-0 translate-x-0 translate-y-0 sm:max-w-none',
        showQuestion ? 'h-[min(44rem,calc(100%-1.5rem))] w-[min(72rem,calc(100%-1.5rem))]' : 'h-[min(28rem,calc(100%-1.5rem))] w-[min(48rem,calc(100%-1.5rem))]',
      )}
      onOpenAutoFocus={event => event.preventDefault()}
      onCloseAutoFocus={event => event.preventDefault()}
      onEscapeKeyDown={event => {
        if (event.target instanceof Element && event.target.closest('[aria-label="Edit reflection link"]')) event.preventDefault();
      }}
      onInteractOutside={event => {
        // Opening Source or another reflection is a transition within this
        // workspace, not a dismissal. All other outside interactions close it.
        if (event.target instanceof Element && event.target.closest('[data-error-log-source], [data-reflection-key], [data-dictionary-lookup]')) event.preventDefault();
      }}
    >
      <DialogTitle className="sr-only">{fieldLabels[active.field]} for {active.entry.source || 'untitled entry'}</DialogTitle>
      <div className="shrink-0 border-b border-ui-border p-2">
        <FormattingControls key={active.key} editor={props.editorRef} active formats={props.formats} linkRequest={props.linkRequest} actions={<>
          <DraftSaveIndicator store={props.draftStore} />
          {hasQuestion && <Button type="button" variant="outline" size="sm" aria-expanded={showQuestion} onPointerDown={event => event.preventDefault()} onClick={props.onQuestionToggle}>{showQuestion ? 'Hide question' : 'View question'}</Button>}
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close reflection editor" onClick={() => onClose(true)}><X /></Button>
        </>} />
      </div>
      <div className={cn('grid min-h-0 flex-1 overflow-hidden', showQuestion && !compactLayout ? 'grid-cols-2 grid-rows-1' : showQuestion ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-1')}>
        <section hidden={!showQuestion} aria-label="Question context" className={cn('min-h-0 min-w-0 overflow-y-auto border-ui-border p-4', compactLayout ? 'max-h-[35dvh] shrink-0 border-b' : 'border-r')}>
          {showQuestion && <QuestionPanel key={active.entry.id} entry={active.entry} />}
        </section>
        <div className="flex min-h-0 min-w-0 flex-col">
          {showQuestion && <div role="group" aria-label="Reflection field" className="flex shrink-0 flex-wrap gap-1 border-b border-ui-border p-2">
            {(['whyWrong', 'whyRight'] as const).map(field => <Button key={field} type="button" variant={active.field === field ? 'secondary' : 'ghost'} size="sm" disabled={props.navigationPending} aria-pressed={active.field === field} onClick={() => props.onSelectField(field)}>{fieldLabels[field]}</Button>)}
          </div>}
          <EditorBody {...props} />
        </div>
      </div>
    </DialogContent>
  </Dialog>;
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

  return <div data-reflection-body className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <span id={labelId} className="sr-only">{fieldLabels[active.field]} for {active.entry.source || 'untitled entry'}</span>
    <RichTextEditor
      key={active.key}
      ref={editorRef}
      id={`${active.key}-editor`}
      labelledBy={labelId}
      fill
      autoFocus
      hideToolbar
      className="rounded-none border-0 bg-transparent focus-within:ring-0"
      value={value}
      onChange={onChange}
      onFormatChange={onFormatChange}
      onShortcut={handleShortcut}
      placeholder="Write your reflection…"
    />
    {draft?.conflict ? <div role="alert" className="max-h-48 shrink-0 space-y-2 overflow-y-auto border-t border-warning/40 bg-warning-soft p-3 text-xs text-foreground">
      <p>{draft.error}</p>
      <div><span className="font-medium">Latest saved version</span>{draft.conflict.latestValue ? <RichTextContent html={draft.conflict.latestValue} className="mt-1 max-h-24 overflow-y-auto" /> : <p className="mt-1 text-muted-foreground">Empty</p>}</div>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onResolveConflict('latest')}>Use latest</Button><Button size="sm" onClick={() => onResolveConflict('mine')}>Keep mine</Button></div>
    </div> : draft?.status === 'error' && <div role="alert" className="flex shrink-0 items-center justify-between gap-3 border-t border-ui-border p-3 text-xs text-danger">
      <span>{draft.error}</span><Button size="sm" variant="ghost" onClick={onFlush}>Retry</Button>
    </div>}
    {navigationPending && <p role="status" className="shrink-0 px-3 py-2 text-xs text-muted-foreground">Loading the next reflection…</p>}
  </div>;
}
