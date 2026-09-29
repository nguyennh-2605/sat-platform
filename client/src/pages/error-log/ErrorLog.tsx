import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TableVirtuoso, Virtuoso, type TableComponents, type TableVirtuosoHandle, type VirtuosoHandle } from 'react-virtuoso';
import { CircleDashed, Plus } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading';
import { useSearchParams } from 'react-router-dom';

import { EmptyState, Modal, PageHeader } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { DataSurface } from '@/components/ui/data-surface';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EMPTY_FORMATS, type RichTextEditorHandle, type RichTextFormats, type RichTextShortcut } from '@/components/ui/rich-text-editor';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { appToast } from '@/components/ui/toast';
import axiosClient from '../../lib/axios';
import { cachedGet, invalidateQueryCache } from '../../lib/queryCache';
import { useDebounce } from '../../hooks/useDebounce';
import { useIsMobile } from '../../hooks/use-mobile';
import { ErrorLogDesktopRow, ErrorLogMobileCard, type ActivePreviewSnapshot, type ErrorLogRowActions } from './ErrorLogRows';
import { ErrorLogToolbar, type ErrorLogFacets } from './ErrorLogToolbar';
import { ExpandedReflectionEditor, type ActiveReflection } from './ExpandedReflectionEditor';
import { GoogleSheetsExportButton } from './GoogleSheetsExportButton';
import { QuestionModal } from './QuestionModal';
import { cellKey, useReflectionDrafts, type EditableField } from './useReflectionDrafts';
import { usePreviewExpansionStore } from './usePreviewExpansionStore';
import { type ErrorEntry, type ReviewStatus } from './types';

interface ErrorPage { items: ErrorEntry[]; nextCursor: string | null }
interface TaxonomySkill { code: string; name: string }
interface TaxonomyDomain { code: string; name: string; subject: 'RW' | 'MATH'; skills: TaxonomySkill[] }

const reflectionFields: EditableField[] = ['whyWrong', 'whyRight'];
const emptyFacets: ErrorLogFacets = { all: 0, needsReview: 0, reviewed: 0, categories: [] };
const statusPreferenceKey = 'error-log-review-status';
const errorLogIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tableComponents: TableComponents<ErrorEntry> = {
  Table: props => <Table {...props} unwrapped className="w-full table-fixed border-separate border-spacing-0" />,
  TableHead: TableHeader,
  TableBody,
  TableRow: props => <TableRow {...props} className="[&>td]:border-b [&>td]:border-ui-border/60" />,
};

const initialStatus = (queryValue?: string | null): ReviewStatus => {
  if (queryValue === 'ALL' || queryValue === 'REVIEWED' || queryValue === 'NEEDS_REVIEW') return queryValue;
  if (typeof window === 'undefined') return 'NEEDS_REVIEW';
  const stored = window.localStorage.getItem(statusPreferenceKey);
  return stored === 'ALL' || stored === 'REVIEWED' || stored === 'NEEDS_REVIEW' ? stored : 'NEEDS_REVIEW';
};

const sameFormats = (left: RichTextFormats, right: RichTextFormats) => left.bold === right.bold
  && left.italic === right.italic
  && left.underline === right.underline
  && left.list === right.list
  && left.link === right.link;

export default function ErrorLog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedEntryId = searchParams.get('entry');
  const isMobile = useIsMobile();
  const [compactLayout, setCompactLayout] = useState(false);
  const [logs, setLogs] = useState<ErrorEntry[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ReviewStatus>(() => requestedEntryId ? 'ALL' : initialStatus(searchParams.get('status')));
  const [category, setCategory] = useState(() => requestedEntryId ? '' : searchParams.get('category')?.trim().slice(0, 120) || '');
  const debouncedSearch = useDebounce(search, 250);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [facets, setFacets] = useState<ErrorLogFacets>(emptyFacets);
  const [facetsLoaded, setFacetsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [questionEntry, setQuestionEntry] = useState<ErrorEntry | null>(null);
  const [manualEntry, setManualEntry] = useState<ErrorEntry | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ErrorEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<ActivePreviewSnapshot | null>(null);
  const [activeFormats, setActiveFormats] = useState<RichTextFormats>(EMPTY_FORMATS);
  const [linkRequest, setLinkRequest] = useState(0);
  const [navigationPending, setNavigationPending] = useState(false);
  const activeEditor = useRef<RichTextEditorHandle>(null);
  const activeKeyRef = useRef<string | null>(null);
  const dataSurface = useRef<HTMLElement | null>(null);
  const tableRef = useRef<TableVirtuosoHandle>(null);
  const mobileRef = useRef<VirtuosoHandle>(null);
  const request = useRef<AbortController | null>(null);
  const loadPromise = useRef<Promise<ErrorPage | null> | null>(null);
  const facetsRequest = useRef<AbortController | null>(null);
  const rowReviewStates = useRef(new Map<string, boolean>());
  const rowVersions = useRef(new Map<string, number>());
  const loadedDeepLink = useRef<string | null>(null);

  const saved = useCallback((entry: ErrorEntry) => {
    const previous = rowReviewStates.current.get(entry.id);
    const reviewed = Boolean(entry.reviewedAt);
    rowReviewStates.current.set(entry.id, reviewed);
    if (previous !== undefined && previous !== reviewed) {
      const delta = reviewed ? 1 : -1;
      setFacets(value => ({
        ...value,
        needsReview: Math.max(0, value.needsReview - delta),
        reviewed: Math.max(0, value.reviewed + delta),
      }));
    }
    if (entry.version !== undefined) rowVersions.current.set(entry.id, entry.version);
    setLogs(rows => rows.map(row => row.id === entry.id ? { ...row, ...entry } : row));
  }, []);
  const getVersion = useCallback((id: string) => rowVersions.current.get(id), []);
  const { store: draftStore, change, flush, resolveConflict } = useReflectionDrafts(saved, getVersion);
  const previewStore = usePreviewExpansionStore();
  const filterKey = JSON.stringify([debouncedSearch, status, category, reload]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (status === 'ALL') next.delete('status'); else next.set('status', status);
    if (category) next.set('category', category); else next.delete('category');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [category, searchParams, setSearchParams, status]);

  useLayoutEffect(() => {
    const surface = dataSurface.current;
    if (!surface) return;
    const update = (width: number) => setCompactLayout(width < 900);
    update(surface.getBoundingClientRect().width);
    const observer = new ResizeObserver(entries => update(entries[0]?.contentRect.width ?? surface.getBoundingClientRect().width));
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  const load = useCallback((cursor: string | null, replace = false): Promise<ErrorPage | null> => {
    if (loadPromise.current && !replace) return loadPromise.current;
    if (replace) request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    const operation = (async () => {
      try {
        const params = { limit: 40, cursor: cursor || undefined, search: debouncedSearch || undefined, status, category: category || undefined };
        const data = await axiosClient.get<ErrorPage>('/api/error-logs', { params, signal: controller.signal });
        if (controller.signal.aborted) return null;
        if (replace) {
          rowReviewStates.current.clear();
          rowVersions.current.clear();
          previewStore.prune(new Set(data.items.flatMap(item => reflectionFields.map(field => cellKey(item.id, field)))));
        }
        data.items.forEach(item => {
          rowReviewStates.current.set(item.id, Boolean(item.reviewedAt));
          if (item.version !== undefined) rowVersions.current.set(item.id, item.version);
        });
        setLogs(rows => replace ? data.items : [...rows, ...data.items.filter(item => !rows.some(row => row.id === item.id))]);
        setNextCursor(data.nextCursor);
        return data;
      } catch {
        if (!controller.signal.aborted) setError('Unable to load your error log. Please try again.');
        return null;
      } finally {
        if (request.current === controller) {
          request.current = null;
          setLoading(false);
        }
      }
    })();
    loadPromise.current = operation;
    void operation.finally(() => {
      if (loadPromise.current === operation) loadPromise.current = null;
    });
    return operation;
  }, [category, debouncedSearch, previewStore, status]);

  useEffect(() => {
    setLogs([]);
    setNextCursor(null);
    void load(null, true);
    return () => request.current?.abort();
  }, [load, reload]);

  useEffect(() => {
    facetsRequest.current?.abort();
    const controller = new AbortController();
    facetsRequest.current = controller;
    setFacetsLoaded(false);
    void axiosClient.get<ErrorLogFacets>('/api/error-logs/facets', {
      params: { search: debouncedSearch || undefined, category: category || undefined },
      signal: controller.signal,
    }).then(data => {
      if (!controller.signal.aborted) {
        setFacets(data);
        setFacetsLoaded(true);
      }
    }).catch(() => {
      // Keep counts hidden and retain the last category options when metadata fails.
    });
    return () => controller.abort();
  }, [category, debouncedSearch, reload]);

  const scrollToRow = useCallback((rowIndex: number) => {
    if (compactLayout) mobileRef.current?.scrollToIndex({ index: rowIndex, align: 'center', behavior: 'auto' });
    else tableRef.current?.scrollToIndex({ index: rowIndex, align: 'center', behavior: 'auto' });
  }, [compactLayout]);

  useEffect(() => {
    if (loading || !requestedEntryId || !errorLogIdPattern.test(requestedEntryId) || loadedDeepLink.current === requestedEntryId) return;
    const controller = new AbortController();
    void axiosClient.get<ErrorEntry>(`/api/error-logs/${requestedEntryId}`, { signal: controller.signal })
      .then(entry => {
        if (controller.signal.aborted) return;
        loadedDeepLink.current = requestedEntryId;
        rowReviewStates.current.set(entry.id, Boolean(entry.reviewedAt));
        if (entry.version !== undefined) rowVersions.current.set(entry.id, entry.version);
        setLogs(rows => [entry, ...rows.filter(row => row.id !== entry.id)]);
        requestAnimationFrame(() => scrollToRow(0));
      })
      .catch(() => {
        if (!controller.signal.aborted) appToast.error('Unable to open this Error Log entry.');
      });
    return () => controller.abort();
  }, [loading, requestedEntryId, scrollToRow]);

  const activate = useCallback((key: string, previewValue: string) => {
    if (active && active !== key) {
      const [id, field] = active.split(':');
      flush(id, field as EditableField);
    }
    setActivePreview({ key, value: previewValue });
    setActiveFormats(EMPTY_FORMATS);
    setActive(key);
    activeKeyRef.current = key;
    const [entryId] = key.split(':');
    const rowIndex = logs.findIndex(entry => entry.id === entryId);
    if (rowIndex >= 0) requestAnimationFrame(() => scrollToRow(rowIndex));
  }, [active, flush, logs, scrollToRow]);

  const deactivate = useCallback((restoreFocus = false) => {
    const closingKey = active;
    if (active) {
      const [id, field] = active.split(':');
      flush(id, field as EditableField);
    }
    setActive(null);
    setActivePreview(null);
    setActiveFormats(EMPTY_FORMATS);
    activeKeyRef.current = null;
    if (!restoreFocus || !closingKey) return;
    const [entryId] = closingKey.split(':');
    const rowIndex = logs.findIndex(entry => entry.id === entryId);
    const focusCell = () => {
      const target = [...document.querySelectorAll<HTMLElement>('[data-reflection-key]')]
        .find(element => element.dataset.reflectionKey === closingKey);
      target?.focus();
      return Boolean(target);
    };
    requestAnimationFrame(() => {
      if (focusCell()) return;
      if (rowIndex >= 0) scrollToRow(rowIndex);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!focusCell()) document.querySelector<HTMLInputElement>('[data-error-log-toolbar] input')?.focus();
      }));
    });
  }, [active, flush, logs, scrollToRow]);

  const navigate = useCallback((direction: -1 | 1) => {
    if (!active || navigationPending) return;
    const keys = logs.flatMap(entry => reflectionFields.map(field => cellKey(entry.id, field)));
    const currentIndex = keys.indexOf(active);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0) {
      deactivate(true);
      return;
    }
    const [activeId, activeField] = active.split(':');
    flush(activeId, activeField as EditableField);
    const selectTarget = (target: string, entries: ErrorEntry[], rowIndex: number) => {
      const [targetId, targetField] = target.split(':');
      const targetEntry = entries.find(entry => entry.id === targetId);
      const previewValue = draftStore.getDraft(target)?.value
        ?? targetEntry?.[targetField as EditableField]
        ?? '';
      setActiveFormats(EMPTY_FORMATS);
      setActivePreview({ key: target, value: previewValue });
      setActive(target);
      activeKeyRef.current = target;
      requestAnimationFrame(() => scrollToRow(rowIndex));
    };
    if (targetIndex < keys.length) {
      selectTarget(keys[targetIndex], logs, Math.floor(targetIndex / reflectionFields.length));
      return;
    }
    if (direction < 0 || !nextCursor) {
      deactivate(true);
      return;
    }
    const expectedActive = active;
    setNavigationPending(true);
    void load(nextCursor).then(page => {
      if (!page || activeKeyRef.current !== expectedActive) return;
      const loadedIds = new Set(logs.map(entry => entry.id));
      const nextEntry = page.items.find(entry => !loadedIds.has(entry.id));
      if (!nextEntry) {
        if (!page.nextCursor) deactivate(true);
        return;
      }
      selectTarget(cellKey(nextEntry.id, 'whyWrong'), [...logs, ...page.items], logs.length);
    }).finally(() => setNavigationPending(false));
  }, [active, deactivate, draftStore, flush, load, logs, navigationPending, nextCursor, scrollToRow]);

  const formatChange = useCallback((next: RichTextFormats) => {
    setActiveFormats(previous => sameFormats(previous, next) ? previous : next);
  }, []);
  const command = useCallback((next: Extract<RichTextShortcut, 'bold' | 'italic' | 'underline' | 'ordered-list' | 'bullet-list' | 'link'>) => {
    if (next === 'link') {
      setLinkRequest(value => value + 1);
      return;
    }
    if (next === 'ordered-list' || next === 'bullet-list') activeEditor.current?.toggleList(next === 'ordered-list' ? 'ordered' : 'bullet');
    else activeEditor.current?.toggleInline(next);
  }, []);
  const changeStatus = useCallback((value: ReviewStatus) => {
    deactivate();
    setStatus(value);
    window.localStorage.setItem(statusPreferenceKey, value);
  }, [deactivate]);
  const clearFilters = useCallback(() => {
    deactivate();
    setSearch('');
    setCategory('');
    setStatus('ALL');
    window.localStorage.setItem(statusPreferenceKey, 'ALL');
  }, [deactivate]);
  const openSource = useCallback((entry: ErrorEntry) => {
    const origin = entry.origin ?? (entry.questionId ? 'SYSTEM_QUESTION' : 'MANUAL');
    if (origin === 'SYSTEM_QUESTION') {
      setQuestionEntry(entry);
      return;
    }
    if (entry.sourceUrl) {
      window.open(entry.sourceUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const rowActions = useMemo<ErrorLogRowActions>(() => ({
    activate,
    openSource,
    editEntry: setManualEntry,
    deleteEntry: setDeleteTarget,
  }), [activate, openSource]);

  const activeReflection = useMemo<ActiveReflection | null>(() => {
    if (!active) return null;
    const [entryId, field] = active.split(':');
    const entry = logs.find(item => item.id === entryId);
    if (!entry || (field !== 'whyWrong' && field !== 'whyRight')) return null;
    return { entry, field, key: active };
  }, [active, logs]);

  const deleteEntry = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axiosClient.delete(`/api/error-logs/${deleteTarget.id}`);
      invalidateQueryCache('/api/error-logs');
      setDeleteTarget(null);
      setReload(value => value + 1);
    } catch {
      appToast.error('Unable to delete this entry.');
    } finally {
      setDeleting(false);
    }
  };

  const hasFilters = Boolean(search || category || status !== 'ALL');
  const headers = <TableRow className="h-11 bg-muted/20 hover:bg-muted/20 [&>th]:border-b [&>th]:border-ui-border-strong">
    <TableHead className="w-[4%] px-1"><span className="sr-only">Status</span></TableHead>
    <TableHead className="w-[11%] border-r border-ui-border/60 px-2">Category</TableHead>
    <TableHead className="w-[17%] border-r border-ui-border/60 px-2">Source</TableHead>
    <TableHead className="w-[7%] px-2">Correct</TableHead>
    <TableHead className="w-[7%] border-r border-ui-border/70 px-2">Yours</TableHead>
    <TableHead className="w-[25%] border-r border-ui-border/70 px-2">Why I chose wrong</TableHead>
    <TableHead className="w-[25%] px-2">Why answer is right</TableHead>
    <TableHead className="w-[4%] px-1"><span className="sr-only">Actions</span></TableHead>
  </TableRow>;

  return <main className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 md:p-6">
    <PageHeader title="Error Log" description="Reflect on mistakes and explain the reasoning that leads to the correct answer." actions={<div className="flex flex-wrap items-center justify-end gap-2"><GoogleSheetsExportButton draftStore={draftStore} /><Button onClick={() => setManualEntry('new')}><Plus />Add entry</Button></div>} />
    <DataSurface ref={dataSurface} className="relative flex min-h-0 flex-1 flex-col">
      <ErrorLogToolbar
        search={search}
        status={status}
        category={category}
        facets={facets}
        facetsLoaded={facetsLoaded}
        active={Boolean(active)}
        formats={activeFormats}
        editor={activeEditor}
        draftStore={draftStore}
        linkRequest={linkRequest}
        onSearchChange={value => { deactivate(); setSearch(value); }}
        onStatusChange={changeStatus}
        onCategoryChange={value => { deactivate(); setCategory(value); }}
        onReset={clearFilters}
      />
      <div className="relative flex min-h-0 flex-1 flex-col">{logs.length ? compactLayout ? <Virtuoso
        ref={mobileRef}
        key={filterKey}
        className="min-h-0 flex-1"
        data={logs}
        computeItemKey={(_index, entry) => entry.id}
        increaseViewportBy={300}
        endReached={() => { if (nextCursor && !error) void load(nextCursor); }}
        itemContent={(_index, entry) => <ErrorLogMobileCard entry={entry} activeKey={active} activePreview={activePreview} draftStore={draftStore} previewStore={previewStore} actions={rowActions} />}
      /> : <TableVirtuoso
        ref={tableRef}
        key={filterKey}
        className="min-h-0 flex-1"
        data={logs}
        components={tableComponents}
        computeItemKey={(_index, entry) => entry.id}
        increaseViewportBy={400}
        endReached={() => { if (nextCursor && !error) void load(nextCursor); }}
        fixedHeaderContent={() => headers}
        itemContent={(_index, entry) => <ErrorLogDesktopRow entry={entry} activeKey={active} activePreview={activePreview} draftStore={draftStore} previewStore={previewStore} actions={rowActions} />}
      /> : loading ? <LoadingRows mobile={compactLayout} headers={headers} /> : <div className="flex flex-1 items-center justify-center p-6">{error
        ? <div className="space-y-3 text-center" role="alert"><p>Unable to load your error log.</p><Button variant="outline" onClick={() => void load(null, true)}>Retry</Button></div>
        : <EmptyState icon={<CircleDashed />} title={hasFilters ? 'No matching entries' : 'No mistakes to review'} description={hasFilters ? 'Adjust your search or filters.' : 'Wrong answers from submitted tests appear here automatically.'} action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined} />}</div>}
      {logs.length > 0 && loading && <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-ui-border bg-surface px-3 py-1.5 text-xs text-muted-foreground shadow-sm" role="status"><LoadingSpinner size="xs" />Loading more…</div>}
      {logs.length > 0 && error && <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-control border border-danger/30 bg-surface px-3 py-1.5 text-xs text-danger shadow-sm" role="alert"><span>More entries could not be loaded.</span><Button variant="ghost" size="sm" onClick={() => void load(nextCursor)}>Retry</Button></div>}</div>
      {activeReflection && <ExpandedReflectionEditor
        active={activeReflection}
        isMobile={isMobile}
        navigationPending={navigationPending}
        draftStore={draftStore}
        editorRef={activeEditor}
        onChange={value => change(activeReflection.entry.id, activeReflection.field, value)}
        onFlush={() => flush(activeReflection.entry.id, activeReflection.field)}
        onClose={deactivate}
        onNavigate={navigate}
        onResolveConflict={resolution => resolveConflict(activeReflection.entry.id, activeReflection.field, resolution)}
        onFormatChange={formatChange}
        onFormatCommand={command}
      />}
    </DataSurface>
    <QuestionModal key={questionEntry?.id || 'closed'} entry={questionEntry} onClose={() => setQuestionEntry(null)} />
    {manualEntry && <ManualEntryDialog entry={manualEntry} onClose={() => setManualEntry(null)} onSaved={() => { setManualEntry(null); setReload(value => value + 1); }} />}
    <Modal open={Boolean(deleteTarget)} onClose={() => { if (!deleting) setDeleteTarget(null); }} presentation="content-dialog" title="Delete error entry?" className="max-w-md!" footer={<><Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={deleting} onClick={() => void deleteEntry()}>Delete entry</Button></>}><p>This permanently removes this study note.</p></Modal>
  </main>;
}

function LoadingRows({ mobile, headers }: { mobile: boolean; headers: ReactNode }) {
  if (mobile) return <div className="flex-1 space-y-4 p-4" aria-label="Loading error log">{Array.from({ length: 4 }, (_, index) => <div key={index} className="space-y-3 border-b border-ui-border/60 pb-4"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-16 w-full" /></div>)}</div>;
  return <Table unwrapped className="w-full table-fixed" aria-label="Loading error log"><TableHeader>{headers}</TableHeader><TableBody>{Array.from({ length: 5 }, (_, index) => <TableRow key={index}><TableCell colSpan={8} className="h-16"><Skeleton className="h-4 w-full" /></TableCell></TableRow>)}</TableBody></Table>;
}

function ManualEntryDialog({ entry, onClose, onSaved }: { entry: ErrorEntry | 'new'; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState({ source: entry === 'new' ? '' : entry.source || '', sourceUrl: entry === 'new' ? '' : entry.sourceUrl || '', category: entry === 'new' ? '' : entry.category || '', correctAnswer: entry === 'new' ? '' : entry.correctAnswer || '', userAnswer: entry === 'new' ? '' : entry.userAnswer || '' });
  const [clientMutationId] = useState(() => entry === 'new' ? crypto.randomUUID() : null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyDomain[]>([]);
  const [taxonomyStatus, setTaxonomyStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [taxonomyReload, setTaxonomyReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const origin = entry === 'new' ? 'MANUAL' : entry.origin ?? (entry.questionId ? 'SYSTEM_QUESTION' : 'MANUAL');
  const showSourceUrl = origin === 'MANUAL';
  const knownCategories = useMemo(() => new Set(taxonomy.flatMap(domain => domain.skills.map(skill => skill.name))), [taxonomy]);
  const hasCustomCategory = Boolean(draft.category && taxonomyStatus === 'ready' && !knownCategories.has(draft.category) && draft.category !== 'General');

  useEffect(() => {
    let active = true;
    setTaxonomyStatus('loading');
    void cachedGet<TaxonomyDomain[]>('/api/tests/taxonomy', {
      ttlMs: 24 * 60 * 60 * 1000,
      force: taxonomyReload > 0,
    }).then(data => {
      if (!active) return;
      setTaxonomy(data);
      setTaxonomyStatus('ready');
    }).catch(() => {
      if (active) setTaxonomyStatus('error');
    });
    return () => { active = false; };
  }, [taxonomyReload]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        source: draft.source,
        category: draft.category,
        correctAnswer: draft.correctAnswer,
        userAnswer: draft.userAnswer,
        ...(showSourceUrl ? { sourceUrl: draft.sourceUrl } : {}),
      };
      if (entry === 'new') await axiosClient.post('/api/error-logs', { ...payload, clientMutationId });
      else await axiosClient.patch(`/api/error-logs/${entry.id}`, { ...payload, ...(entry.version !== undefined ? { expectedVersion: entry.version } : {}) });
      invalidateQueryCache('/api/error-logs');
      onSaved();
    } catch (requestError) {
      const response = (requestError as { response?: { status?: number; data?: { message?: string } } }).response;
      setError(response?.status === 409
        ? 'This entry changed in another tab. Close and reopen it before editing.'
        : response?.data?.message || 'Unable to save this entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const saveDisabled = saving || !draft.source.trim() || !draft.category || !draft.userAnswer.trim() || !draft.correctAnswer.trim();
  return <Modal open onClose={() => { if (!saving) onClose(); }} presentation="content-dialog" title={entry === 'new' ? 'Add an error entry' : 'Edit entry details'} subtitle={entry === 'new' ? 'Add context here, then write your reflection in the table.' : 'Update the source, category, and answers for this entry.'} className="max-w-lg!" footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saveDisabled} onClick={() => void save()}>{saving ? 'Saving…' : 'Save entry'}</Button></>}>
    <div className="space-y-4">
      <Field><FieldLabel htmlFor="manual-source">Source name</FieldLabel><Input id="manual-source" maxLength={200} placeholder="Khan Academy worksheet" value={draft.source} onChange={event => setDraft(value => ({ ...value, source: event.target.value }))} /></Field>
      {showSourceUrl && <Field><FieldLabel htmlFor="manual-sourceUrl">External link (optional)</FieldLabel><Input id="manual-sourceUrl" type="url" maxLength={2048} placeholder="https://…" value={draft.sourceUrl} onChange={event => setDraft(value => ({ ...value, sourceUrl: event.target.value }))} /></Field>}
      <Field>
        <FieldLabel htmlFor="manual-category">Category</FieldLabel>
        <Select value={draft.category || undefined} disabled={taxonomyStatus !== 'ready'} onValueChange={value => setDraft(current => ({ ...current, category: value }))}>
          <SelectTrigger id="manual-category" className="w-full"><SelectValue placeholder={taxonomyStatus === 'loading' ? 'Loading categories…' : 'Choose a category'} /></SelectTrigger>
          <SelectContent position="popper" align="start">
            {hasCustomCategory && <SelectGroup><SelectLabel>Current category</SelectLabel><SelectItem value={draft.category}>{draft.category}</SelectItem></SelectGroup>}
            <SelectGroup><SelectLabel>Other</SelectLabel><SelectItem value="General">General</SelectItem></SelectGroup>
            {taxonomy.map(domain => <SelectGroup key={domain.code}>
              <SelectLabel>{domain.subject === 'RW' ? 'Reading & Writing' : 'Math'} · {domain.name}</SelectLabel>
              {domain.skills.map(skill => <SelectItem key={skill.code} value={skill.name}>{skill.name}</SelectItem>)}
            </SelectGroup>)}
          </SelectContent>
        </Select>
        {taxonomyStatus === 'error' && <div className="flex items-center justify-between gap-3 text-sm text-danger" role="alert"><span>Categories could not be loaded.</span><Button type="button" variant="ghost" size="sm" onClick={() => setTaxonomyReload(value => value + 1)}>Retry</Button></div>}
      </Field>
      <Field><FieldLabel htmlFor="manual-correctAnswer">Correct answer</FieldLabel><Input id="manual-correctAnswer" maxLength={100} placeholder="B" value={draft.correctAnswer} onChange={event => setDraft(value => ({ ...value, correctAnswer: event.target.value }))} /></Field>
      <Field><FieldLabel htmlFor="manual-userAnswer">Your answer</FieldLabel><Input id="manual-userAnswer" maxLength={100} placeholder="A or Omitted" value={draft.userAnswer} onChange={event => setDraft(value => ({ ...value, userAnswer: event.target.value }))} /></Field>
      {error && <p role="alert" className="text-danger">{error}</p>}
    </div>
  </Modal>;
}
