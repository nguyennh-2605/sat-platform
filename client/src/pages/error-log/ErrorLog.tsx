import { useCallback, useEffect, useRef, useState, type RefObject, type ReactNode } from 'react';
import { TableVirtuoso, Virtuoso, type TableComponents } from 'react-virtuoso';
import { Bold, CircleDashed, ExternalLink, Italic, Link2, List, ListOrdered, Loader2, Pencil, Plus, RemoveFormatting, Trash2, Underline } from 'lucide-react';
import { EmptyState, Modal, PageHeader } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataSurface, DataToolbar, DataToolbarGroup, DataToolbarSearch } from '@/components/ui/data-surface';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EMPTY_FORMATS, type RichTextEditorHandle, type RichTextFormats } from '@/components/ui/rich-text-editor';
import { Field, FieldLabel } from '@/components/ui/field';
import { appToast } from '@/components/ui/toast';
import axiosClient from '../../lib/axios';
import { invalidateQueryCache } from '../../lib/queryCache';
import { useDebounce } from '../../hooks/useDebounce';
import { useIsMobile } from '../../hooks/use-mobile';
import { QuestionModal } from './QuestionModal';
import { RichTextCellEditor } from './RichTextCellEditor';
import { cellKey, useReflectionDrafts, type EditableField } from './useReflectionDrafts';
import { type ErrorEntry, type ReviewStatus } from './types';

interface ErrorPage { items: ErrorEntry[]; nextCursor: string | null; total: number; needsReview: number }
const REFLECTIONS = [
  { field: 'whyWrong', label: 'Why I chose wrong' },
  { field: 'whyRight', label: 'Why answer is right' },
] as const;
const tableComponents: TableComponents<ErrorEntry> = {
  Table: props => <Table {...props} unwrapped className="w-full table-fixed border-separate border-spacing-0" />,
  TableHead: TableHeader, TableBody, TableRow,
};

export default function ErrorLog() {
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState<ErrorEntry[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ReviewStatus>('ALL');
  const [category, setCategory] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const debouncedCategory = useDebounce(category, 250);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState({ total: 0, needsReview: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [questionEntry, setQuestionEntry] = useState<ErrorEntry | null>(null);
  const [manualEntry, setManualEntry] = useState<ErrorEntry | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ErrorEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const activeEditor = useRef<RichTextEditorHandle>(null);
  const [activeFormats, setActiveFormats] = useState<RichTextFormats>(EMPTY_FORMATS);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const rowReviewStates = useRef(new Map<string, boolean>());
  const saved = useCallback((entry: ErrorEntry) => {
    const previous = rowReviewStates.current.get(entry.id);
    const reviewed = Boolean(entry.reviewedAt);
    rowReviewStates.current.set(entry.id, reviewed);
    if (previous !== undefined && previous !== reviewed) {
      const delta = reviewed ? -1 : 1;
      setCounts(value => ({
        total: value.total + (status === 'ALL' ? 0 : status === 'NEEDS_REVIEW' ? delta : -delta),
        needsReview: Math.max(0, value.needsReview + (status === 'REVIEWED' ? 0 : delta)),
      }));
    }
    setLogs(rows => rows.map(row => row.id === entry.id ? { ...row, ...entry } : row));
  }, [status]);
  const { drafts, change, flush } = useReflectionDrafts(saved);
  const filterKey = JSON.stringify([debouncedSearch, status, debouncedCategory, reload]);

  const load = useCallback(async (cursor: string | null, replace = false) => {
    if (busy.current && !replace) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    busy.current = true;
    setLoading(true); setError('');
    try {
      const params = { limit: 40, cursor: cursor || undefined, search: debouncedSearch || undefined, status, category: debouncedCategory || undefined };
      const data = await axiosClient.get<ErrorPage>('/api/error-logs', { params, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (replace) rowReviewStates.current.clear();
      data.items.forEach(item => rowReviewStates.current.set(item.id, Boolean(item.reviewedAt)));
      setLogs(rows => replace ? data.items : [...rows, ...data.items.filter(item => !rows.some(row => row.id === item.id))]);
      setNextCursor(data.nextCursor);
      setCounts({ total: data.total, needsReview: data.needsReview });
    } catch {
      if (!controller.signal.aborted) setError('Unable to load your error log. Please try again.');
    } finally {
      if (!controller.signal.aborted) { busy.current = false; setLoading(false); }
    }
  }, [debouncedSearch, status, debouncedCategory]);

  useEffect(() => {
    setLogs([]); setNextCursor(null);
    void load(null, true);
    return () => request.current?.abort();
  }, [load, reload]);

  const activate = (key: string) => {
    if (active && active !== key) {
      const [id, field] = active.split(':');
      flush(id, field as EditableField);
    }
    setActiveFormats(EMPTY_FORMATS);
    setActive(key);
  };
  const deactivate = () => {
    if (active) {
      const [id, field] = active.split(':');
      flush(id, field as EditableField);
    }
    setActive(null);
    setActiveFormats(EMPTY_FORMATS);
  };
  const hasFilters = Boolean(search || category || status !== 'ALL');
  const clearFilters = () => { deactivate(); setSearch(''); setCategory(''); setStatus('ALL'); };
  const openSource = (entry: ErrorEntry) => {
    if (entry.questionId) return setQuestionEntry(entry);
    if (entry.sourceUrl) {
      window.open(entry.sourceUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setManualEntry(entry);
  };
  const deleteEntry = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axiosClient.delete(`/api/error-logs/${deleteTarget.id}`);
      invalidateQueryCache('/api/error-logs');
      setDeleteTarget(null); setReload(value => value + 1);
    } catch { appToast.error('Unable to delete this entry.'); }
    finally { setDeleting(false); }
  };

  return <main className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 md:p-6">
    <PageHeader title="Error Log" description="Reflect on mistakes and explain the reasoning that leads to the correct answer." actions={<Button onClick={() => setManualEntry('new')}><Plus />Add entry</Button>} />
    <DataSurface className="relative flex min-h-0 flex-1 flex-col">
      <DataToolbar><DataToolbarGroup>
        <DataToolbarSearch label="Search error log" placeholder="Search errors…" value={search} onChange={event => { deactivate(); setSearch(event.target.value); }} />
        <Select value={status} onValueChange={value => { deactivate(); setStatus(value as ReviewStatus); }}><SelectTrigger className="w-36" aria-label="Review status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem><SelectItem value="NEEDS_REVIEW">Needs review</SelectItem><SelectItem value="REVIEWED">Reviewed</SelectItem></SelectContent></Select>
        <Input className="w-40" aria-label="Exact category filter" placeholder="Exact category…" value={category} onChange={event => { deactivate(); setCategory(event.target.value); }} />
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}>Reset</Button>}
      </DataToolbarGroup></DataToolbar>
      <FormattingToolbar editor={activeEditor} active={Boolean(active)} formats={activeFormats} />
      <div className="border-b border-ui-border px-4 py-2 text-xs text-muted-foreground" aria-live="polite">{loading && !logs.length ? 'Loading errors…' : `${counts.total} ${counts.total === 1 ? 'error' : 'errors'} · ${counts.needsReview} need review`}<span className="ml-3">Both reflections complete a review.</span></div>
      {logs.length ? (isMobile ? <Virtuoso
        key={filterKey}
        className="min-h-0 flex-1"
        data={logs}
        computeItemKey={(_index, entry) => entry.id}
        increaseViewportBy={300}
        endReached={() => { if (nextCursor && !error) void load(nextCursor); }}
        itemContent={(_index, entry) => <article className="space-y-4 border-b border-ui-border/60 p-3">
          <header className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">{entry.category || 'General'}</p><Button variant="link" className={`h-auto max-w-full justify-start whitespace-normal p-0 text-left ${entry.sourceUrl ? 'underline underline-offset-4' : ''}`} onClick={() => openSource(entry)}>{entry.source || 'Untitled entry'}{entry.sourceUrl && <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />}</Button></div><Badge variant="outline" className="shrink-0">{entry.reviewedAt ? 'Reviewed' : 'Needs review'}</Badge></header>
          <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Correct</p><p className="font-medium text-success">{entry.correctAnswer || '—'}</p></div><div><p className="text-xs text-muted-foreground">Yours</p><p className="font-medium text-danger">{entry.userAnswer || 'Omitted'}</p></div></div>
          {REFLECTIONS.map(({ field, label }) => { const key = cellKey(entry.id, field); return <section key={field}><h3 className="mb-1 text-xs font-medium text-muted-foreground">{label}</h3><RichTextCellEditor id={key} label={`${label} for ${entry.source}`} value={drafts[key]?.value ?? entry[field] ?? ''} draft={drafts[key]} active={active === key} editorRef={activeEditor} onActivate={() => activate(key)} onChange={value => change(entry.id, field, value)} onFlush={() => flush(entry.id, field)} onFormatChange={setActiveFormats} /></section>; })}
          <div className="flex justify-end gap-1">{!entry.questionId && <Button variant="ghost" size="icon-sm" aria-label={`Edit details for ${entry.source}`} onClick={() => setManualEntry(entry)}><Pencil /></Button>}<Button variant="ghost" size="icon-sm" aria-label={`Delete ${entry.source}`} disabled={Object.entries(drafts).some(([key, draft]) => key.startsWith(`${entry.id}:`) && draft.status !== 'saved')} onClick={() => setDeleteTarget(entry)}><Trash2 /></Button></div>
        </article>}
      /> : <TableVirtuoso
        key={filterKey} className="min-h-0 flex-1" data={logs} components={tableComponents}
        computeItemKey={(_index, entry) => entry.id} increaseViewportBy={400}
        endReached={() => { if (nextCursor && !error) void load(nextCursor); }}
        fixedHeaderContent={() => <TableRow className="bg-surface">
          <TableHead className="w-[12%] px-2">Category</TableHead><TableHead className="w-[18%] px-2">Source</TableHead><TableHead className="w-[7%] px-2">Correct</TableHead><TableHead className="w-[7%] px-2">Yours</TableHead>
          {REFLECTIONS.map(item => <TableHead className="w-[28%] px-2" key={item.field}>{item.label}</TableHead>)}
        </TableRow>}
        itemContent={(_index, entry) => <>
          <TableCell className="align-top break-words px-2 font-medium">{entry.category || 'General'}</TableCell>
          <TableCell className="align-top px-2"><Button variant="link" className={`h-auto max-w-full whitespace-normal p-0 text-left ${entry.sourceUrl ? 'underline underline-offset-4' : ''}`} onClick={() => openSource(entry)}>{entry.source || 'Untitled entry'}{entry.sourceUrl && <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />}</Button><div className="mt-2 flex flex-wrap items-center gap-1"><Badge variant="outline">{entry.reviewedAt ? 'Reviewed' : 'Needs review'}</Badge>{!entry.questionId && <Button variant="ghost" size="icon-sm" aria-label={`Edit details for ${entry.source}`} onClick={() => setManualEntry(entry)}><Pencil /></Button>}<Button variant="ghost" size="icon-sm" aria-label={`Delete ${entry.source}`} disabled={Object.entries(drafts).some(([key, draft]) => key.startsWith(`${entry.id}:`) && draft.status !== 'saved')} onClick={() => setDeleteTarget(entry)}><Trash2 /></Button></div></TableCell>
          <TableCell className="align-top break-words px-2 font-medium text-success">{entry.correctAnswer || '—'}</TableCell><TableCell className="align-top break-words px-2 font-medium text-danger">{entry.userAnswer || 'Omitted'}</TableCell>
          {REFLECTIONS.map(({ field, label }) => {
            const key = cellKey(entry.id, field);
            return <TableCell key={field} className="align-top px-2"><RichTextCellEditor id={key} label={`${label} for ${entry.source}`} value={drafts[key]?.value ?? entry[field] ?? ''} draft={drafts[key]} active={active === key} editorRef={activeEditor} onActivate={() => activate(key)} onChange={value => change(entry.id, field, value)} onFlush={() => flush(entry.id, field)} onFormatChange={setActiveFormats} /></TableCell>;
          })}
        </>}
      />) : <div className="flex flex-1 items-center justify-center p-6">{loading ? <Loader2 className="animate-spin" aria-label="Loading error log" /> : error ? <p role="alert">{error}</p> : <EmptyState icon={<CircleDashed />} title={hasFilters ? 'No matching entries' : 'No mistakes to review'} description={hasFilters ? 'Adjust your search or filters.' : 'Wrong answers from submitted tests appear here automatically.'} action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined} />}</div>}
      {logs.length > 0 && loading && <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-ui-border bg-surface px-3 py-1.5 text-xs text-muted-foreground shadow-sm" role="status"><Loader2 className="size-3 animate-spin" />Loading more…</div>}
      {logs.length > 0 && error && <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-control border border-danger/30 bg-surface px-3 py-1.5 text-xs text-danger shadow-sm" role="alert"><span>More entries could not be loaded.</span><Button variant="ghost" size="sm" onClick={() => void load(nextCursor)}>Retry</Button></div>}
    </DataSurface>
    <QuestionModal key={questionEntry?.id || 'closed'} entry={questionEntry} onClose={() => setQuestionEntry(null)} />
    {manualEntry && <ManualEntryDialog entry={manualEntry} onClose={() => setManualEntry(null)} onSaved={() => { setManualEntry(null); setReload(value => value + 1); }} />}
    <Modal open={Boolean(deleteTarget)} onClose={() => { if (!deleting) setDeleteTarget(null); }} presentation="content-dialog" title="Delete error entry?" className="max-w-md!" footer={<><Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={deleting} onClick={() => void deleteEntry()}>Delete entry</Button></>}><p>This permanently removes this study note.</p></Modal>
  </main>;
}

function FormattingToolbar({ editor, active, formats }: { editor: RefObject<RichTextEditorHandle | null>; active: boolean; formats: RichTextFormats }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState('');
  const openLink = (open: boolean) => {
    setLinkOpen(open);
    setLinkError('');
    if (open) setLinkValue(formats.link || '');
  };
  const applyLink = () => {
    const value = linkValue.trim();
    if (!value) {
      editor.current?.setLink(null);
      setLinkOpen(false);
      return;
    }
    try {
      const url = new URL(value);
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error();
      editor.current?.setLink(url.toString());
      setLinkOpen(false);
    } catch {
      setLinkError('Enter a complete http, https, or mailto link.');
    }
  };
  return <div role="toolbar" aria-label="Reflection formatting" className="flex min-h-10 flex-wrap items-center gap-1 border-b border-ui-border bg-muted/10 px-3 py-1.5">
    <span className="mr-2 text-xs text-muted-foreground">{active ? 'Format selected text' : 'Select a reflection cell to format text'}</span>
    <FormatButton label="Bold" active={formats.bold} disabled={!active} onPress={() => editor.current?.toggleInline('bold')}><Bold /></FormatButton>
    <FormatButton label="Italic" active={formats.italic} disabled={!active} onPress={() => editor.current?.toggleInline('italic')}><Italic /></FormatButton>
    <FormatButton label="Underline" active={formats.underline} disabled={!active} onPress={() => editor.current?.toggleInline('underline')}><Underline /></FormatButton>
    <span className="mx-1 h-5 border-l border-ui-border" aria-hidden="true" />
    <FormatButton label="Numbered list" active={formats.list === 'ordered'} disabled={!active} onPress={() => editor.current?.toggleList('ordered')}><ListOrdered /></FormatButton>
    <FormatButton label="Bulleted list" active={formats.list === 'bullet'} disabled={!active} onPress={() => editor.current?.toggleList('bullet')}><List /></FormatButton>
    <Popover open={linkOpen} onOpenChange={openLink}>
      <PopoverTrigger asChild><Button type="button" variant={formats.link ? 'secondary' : 'ghost'} size="icon-sm" disabled={!active} aria-label="Add or edit link" aria-pressed={Boolean(formats.link)} title="Add or edit link"><Link2 /></Button></PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <Field><FieldLabel htmlFor="reflection-link">Link</FieldLabel><Input id="reflection-link" type="url" value={linkValue} onChange={event => setLinkValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyLink(); } }} placeholder="https://…" />{linkError && <p className="text-xs text-danger" role="alert">{linkError}</p>}</Field>
        <div className="mt-3 flex justify-end gap-2">{formats.link && <Button variant="ghost" size="sm" onClick={() => { editor.current?.setLink(null); setLinkOpen(false); }}>Remove</Button>}<Button size="sm" onClick={applyLink}>Apply</Button></div>
      </PopoverContent>
    </Popover>
    <FormatButton label="Clear formatting" disabled={!active} onPress={() => editor.current?.clearFormatting()}><RemoveFormatting /></FormatButton>
  </div>;
}

function FormatButton({ label, active = false, disabled, onPress, children }: { label: string; active?: boolean; disabled: boolean; onPress: () => void; children: ReactNode }) {
  return <Button type="button" variant={active ? 'secondary' : 'ghost'} size="icon-sm" disabled={disabled} aria-label={label} aria-pressed={active} title={label} onPointerDown={event => event.preventDefault()} onClick={onPress}>{children}</Button>;
}

function ManualEntryDialog({ entry, onClose, onSaved }: { entry: ErrorEntry | 'new'; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState({ source: entry === 'new' ? '' : entry.source || '', sourceUrl: entry === 'new' ? '' : entry.sourceUrl || '', category: entry === 'new' ? '' : entry.category || '', correctAnswer: entry === 'new' ? '' : entry.correctAnswer || '', userAnswer: entry === 'new' ? '' : entry.userAnswer || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setSaving(true); setError('');
    try {
      const payload = { ...draft, category: draft.category.trim() || 'General' };
      if (entry === 'new') await axiosClient.post('/api/error-logs', payload);
      else await axiosClient.patch(`/api/error-logs/${entry.id}`, payload);
      invalidateQueryCache('/api/error-logs');
      onSaved();
    } catch { setError('Unable to save this entry. Please try again.'); }
    finally { setSaving(false); }
  };
  return <Modal open onClose={() => { if (!saving) onClose(); }} presentation="content-dialog" title={entry === 'new' ? 'Add an error entry' : 'Edit entry details'} subtitle="Add context here, then write your reflection in the table." className="max-w-lg!" footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving || !draft.source.trim() || !draft.userAnswer.trim() || !draft.correctAnswer.trim()} onClick={() => void save()}>{saving ? 'Saving…' : 'Save entry'}</Button></>}>
    <div className="space-y-4">{([{ field: 'source', label: 'Source name', max: 200, type: 'text', placeholder: 'Khan Academy worksheet' }, { field: 'sourceUrl', label: 'External link (optional)', max: 2048, type: 'url', placeholder: 'https://…' }, { field: 'category', label: 'Category', max: 120, type: 'text', placeholder: 'Algebra' }, { field: 'correctAnswer', label: 'Correct answer', max: 100, type: 'text', placeholder: 'B' }, { field: 'userAnswer', label: 'Your answer', max: 100, type: 'text', placeholder: 'A or Omitted' }] as const).map(({ field, label, max, type, placeholder }) => <Field key={field}><FieldLabel htmlFor={`manual-${field}`}>{label}</FieldLabel><Input id={`manual-${field}`} type={type} maxLength={max} placeholder={placeholder} value={draft[field]} onChange={event => setDraft(value => ({ ...value, [field]: event.target.value }))} /></Field>)}{error && <p role="alert" className="text-danger">{error}</p>}</div>
  </Modal>;
}
