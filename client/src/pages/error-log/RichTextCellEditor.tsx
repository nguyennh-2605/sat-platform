import { Button } from '@/components/ui/button';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import type { RichTextEditorHandle, RichTextFormats } from '@/components/ui/rich-text-editor';
import type { Ref } from 'react';
import type { CellDraft } from './useReflectionDrafts';

export function RichTextCellEditor({ id, label, value, active, draft, editorRef, onActivate, onChange, onFlush, onResolveConflict, onFormatChange }: {
  id: string; label: string; value: string; active: boolean; draft?: CellDraft;
  editorRef: Ref<RichTextEditorHandle>;
  onActivate: () => void; onChange: (value: string) => void; onFlush: () => void;
  onResolveConflict: (resolution: 'latest' | 'mine') => void;
  onFormatChange: (formats: RichTextFormats) => void;
}) {
  return <div className="min-h-24" onClick={event => { if (!active && !(event.target as HTMLElement).closest('a, button')) onActivate(); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onFlush(); }}>
    {active ? <>
      <span id={`${id}-label`} className="sr-only">{label}</span>
      <RichTextEditor ref={editorRef} id={id} labelledBy={`${id}-label`} compact autoFocus hideToolbar value={value} onChange={onChange} onFormatChange={onFormatChange} placeholder="Write your reflection…" />
    </> : <>
      <RichTextContent html={value} className="line-clamp-4" />
      <Button variant="ghost" size="sm" className="mt-1 text-muted-foreground" aria-label={`Edit ${label}`} onClick={onActivate}>{value ? 'Expand / edit' : 'Add reflection'}</Button>
    </>}
    {draft?.conflict ? <div role="alert" className="mt-2 space-y-2 rounded-control border border-warning/40 bg-warning-soft p-2 text-xs text-foreground">
      <p>{draft.error}</p>
      <div><span className="font-medium">Latest saved version</span>{draft.conflict.latestValue ? <RichTextContent html={draft.conflict.latestValue} className="mt-1 line-clamp-3" /> : <p className="mt-1 text-muted-foreground">Empty</p>}</div>
      <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => onResolveConflict('latest')}>Use latest</Button><Button size="sm" onClick={() => onResolveConflict('mine')}>Keep mine</Button></div>
    </div> : draft && <div role={draft.status === 'error' ? 'alert' : 'status'} className={`mt-1 text-xs ${draft.status === 'error' ? 'text-danger' : 'text-muted-foreground'}`}>
      {draft.status === 'error' ? <>{draft.error}<Button size="sm" variant="ghost" onClick={onFlush}>Retry</Button></> : draft.status === 'saving' ? 'Saving…' : draft.status === 'pending' ? 'Unsaved changes' : 'Saved'}
    </div>}
  </div>;
}
