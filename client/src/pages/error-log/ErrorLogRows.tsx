import { memo } from 'react';
import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableCell } from '@/components/ui/table';
import { ReviewStatusIcon } from './ErrorLogToolbar';
import { RichTextCellEditor } from './RichTextCellEditor';
import { cellKey, useRowDirty, type EditableField, type ReflectionDraftStore } from './useReflectionDrafts';
import type { PreviewExpansionStore } from './usePreviewExpansionStore';
import type { ErrorEntry } from './types';

const reflections = [
  { field: 'whyWrong', label: 'Why I chose wrong' },
  { field: 'whyRight', label: 'Why answer is right' },
] as const;

export interface ErrorLogRowActions {
  activate: (key: string, previewValue: string) => void;
  openSource: (entry: ErrorEntry) => void;
  editEntry: (entry: ErrorEntry) => void;
  deleteEntry: (entry: ErrorEntry) => void;
}

export interface ActivePreviewSnapshot {
  key: string;
  value: string;
}

interface ErrorLogRowProps {
  entry: ErrorEntry;
  activeKey: string | null;
  activePreview: ActivePreviewSnapshot | null;
  draftStore: ReflectionDraftStore;
  previewStore: PreviewExpansionStore;
  actions: ErrorLogRowActions;
}

function SourceButton({ entry, onOpen }: { entry: ErrorEntry; onOpen: () => void }) {
  const origin = entry.origin ?? (entry.questionId ? 'SYSTEM_QUESTION' : 'MANUAL');
  const clickable = origin === 'SYSTEM_QUESTION' || Boolean(entry.sourceUrl);
  if (!clickable) {
    return <span className="block max-w-full break-words text-sm font-medium">{entry.source || 'Untitled entry'}</span>;
  }
  return <Button variant="link" className={`h-auto max-w-full justify-start whitespace-normal p-0 text-left ${entry.sourceUrl ? 'underline underline-offset-4' : ''}`} onClick={onOpen}>
    {entry.source || 'Untitled entry'}{entry.sourceUrl && <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />}
  </Button>;
}

function RowMenu({ entry, disabled, actions }: { entry: ErrorEntry; disabled: boolean; actions: ErrorLogRowActions }) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" disabled={disabled} aria-label={`Actions for ${entry.source}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => actions.editEntry(entry)}><Pencil />Edit details</DropdownMenuItem>
      <DropdownMenuItem variant="destructive" onSelect={() => actions.deleteEntry(entry)}><Trash2 />Delete entry</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function ReflectionCell({ entry, field, label, activeKey, activePreview, draftStore, previewStore, previewMaxHeight, actions }: ErrorLogRowProps & { field: EditableField; label: string; previewMaxHeight: string }) {
  const key = cellKey(entry.id, field);
  return <RichTextCellEditor
    entryId={entry.id}
    field={field}
    label={`${label} for ${entry.source}`}
    persistedValue={entry[field] || ''}
    active={activeKey === key}
    activePreviewValue={activePreview?.key === key ? activePreview.value : undefined}
    draftStore={draftStore}
    previewStore={previewStore}
    previewMaxHeight={previewMaxHeight}
    onActivate={previewValue => actions.activate(key, previewValue)}
  />;
}

export const ErrorLogDesktopRow = memo(function ErrorLogDesktopRow(props: ErrorLogRowProps) {
  const { entry, draftStore, actions } = props;
  const dirty = useRowDirty(draftStore, entry.id);
  return <>
    <TableCell className="w-[4%] px-1 text-center align-top"><ReviewStatusIcon reviewed={Boolean(entry.reviewedAt)} /></TableCell>
    <TableCell className="w-[11%] break-words border-r border-ui-border/60 px-2 align-top font-medium">{entry.category || 'General'}</TableCell>
    <TableCell className="w-[17%] border-r border-ui-border/60 px-2 align-top"><SourceButton entry={entry} onOpen={() => actions.openSource(entry)} /></TableCell>
    <TableCell className="w-[7%] break-words px-2 align-top font-medium tabular-nums text-success">{entry.correctAnswer || '—'}</TableCell>
    <TableCell className="w-[7%] break-words border-r border-ui-border/70 px-2 align-top font-medium tabular-nums text-danger">{entry.userAnswer || 'Omitted'}</TableCell>
    {reflections.map(({ field, label }) => <TableCell key={field} className={`w-[25%] p-0 align-top ${field === 'whyWrong' ? 'border-r border-ui-border/70' : ''}`}><ReflectionCell {...props} field={field} label={label} previewMaxHeight="max-h-80" /></TableCell>)}
    <TableCell className="w-[4%] px-1 text-right align-top"><RowMenu entry={entry} disabled={dirty} actions={actions} /></TableCell>
  </>;
});

export const ErrorLogMobileCard = memo(function ErrorLogMobileCard(props: ErrorLogRowProps) {
  const { entry, actions, draftStore } = props;
  const dirty = useRowDirty(draftStore, entry.id);
  return <article className="space-y-3 border-b border-ui-border/60 p-3">
    <header className="flex items-start gap-2">
      <ReviewStatusIcon reviewed={Boolean(entry.reviewedAt)} />
      <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{entry.category || 'General'}</p><SourceButton entry={entry} onOpen={() => actions.openSource(entry)} /></div>
      <RowMenu entry={entry} disabled={dirty} actions={actions} />
    </header>
    <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Correct</p><p className="font-medium tabular-nums text-success">{entry.correctAnswer || '—'}</p></div><div><p className="text-xs text-muted-foreground">Yours</p><p className="font-medium tabular-nums text-danger">{entry.userAnswer || 'Omitted'}</p></div></div>
    {reflections.map(({ field, label }) => <section key={field}><h3 className="mb-1 text-xs font-medium text-muted-foreground">{label}</h3><ReflectionCell {...props} field={field} label={label} previewMaxHeight="max-h-72" /></section>)}
  </article>;
});
