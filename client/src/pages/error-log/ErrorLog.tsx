import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';
import BlockRenderer from '../../components/content/BlockRenderer';
import InteractiveText from '../../features/quiz/InteractiveText';
import type { ContentBlock } from '../../types/quiz';
import { capitalizeFirstLetter } from '../../utils/text';
import axiosClient from '../../lib/axios';
import { EmptyState, Modal, PageHeader } from '../../components/ui/AppUI';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DataPagination,
  DataStateRow,
  DataSurface,
  DataToolbar,
  DataToolbarActions,
  DataToolbarGroup,
  DataToolbarSearch,
} from '@/components/ui/data-surface';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { appToast } from '@/components/ui/toast';
import { cachedGet, invalidateQueryCache } from '../../lib/queryCache';
import { useDebounce } from '../../hooks/useDebounce';

type RootCause =
  | 'KNOWLEDGE_GAP'
  | 'MISREAD_QUESTION'
  | 'MISREAD_PASSAGE'
  | 'WRONG_REASONING'
  | 'CARELESS_MISTAKE'
  | 'TIME_PRESSURE'
  | 'CALCULATION_ERROR'
  | 'GUESSED';
type ReviewStatus = 'ALL' | 'NEEDS_REVIEW' | 'REVIEWED';

interface ErrorQuestion {
  type: 'MCQ' | 'SPR';
  blocks: ContentBlock[];
  questionText: string;
  choices: Array<{ id: string; text: string }>;
  order: number;
  section: {
    name: string;
    order: number;
    test: { title: string; subject: string };
  };
}

interface ErrorEntry {
  id: string;
  source: string | null;
  category: string | null;
  userAnswer: string | null;
  correctAnswer: string | null;
  whyChosen: string | null;
  whyWrong: string | null;
  whyRight: string | null;
  takeaway: string | null;
  rootCause: RootCause | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  submissionId: number | null;
  questionId: number | null;
  question: ErrorQuestion | null;
}

interface ErrorLogPage {
  items: ErrorEntry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

interface EntryDraft {
  source: string;
  category: string;
  userAnswer: string;
  correctAnswer: string;
  whyChosen: string;
  whyWrong: string;
  whyRight: string;
  takeaway: string;
  rootCause: RootCause | '';
}

const ERROR_LOG_PAGE_SIZE = 10;
const ROOT_CAUSES: Array<{ value: RootCause; label: string }> = [
  { value: 'KNOWLEDGE_GAP', label: "Didn't know the concept or vocabulary" },
  { value: 'MISREAD_QUESTION', label: 'Misread the question' },
  { value: 'MISREAD_PASSAGE', label: 'Misread the passage' },
  { value: 'WRONG_REASONING', label: 'Wrong reasoning' },
  { value: 'CARELESS_MISTAKE', label: 'Careless mistake' },
  { value: 'TIME_PRESSURE', label: 'Time pressure' },
  { value: 'CALCULATION_ERROR', label: 'Calculation error' },
  { value: 'GUESSED', label: 'Guessed' },
];

const blankDraft = (): EntryDraft => ({
  source: '',
  category: '',
  userAnswer: '',
  correctAnswer: '',
  whyChosen: '',
  whyWrong: '',
  whyRight: '',
  takeaway: '',
  rootCause: '',
});

const entryDraft = (entry: ErrorEntry): EntryDraft => ({
  source: entry.source || '',
  category: entry.category || '',
  userAnswer: entry.userAnswer || '',
  correctAnswer: entry.correctAnswer || '',
  whyChosen: entry.whyChosen || '',
  whyWrong: entry.whyWrong || '',
  whyRight: entry.whyRight || '',
  takeaway: entry.takeaway || '',
  rootCause: entry.rootCause || '',
});

const reviewIsComplete = (draft: EntryDraft) => Boolean(
  draft.rootCause
  && draft.whyChosen.trim()
  && draft.whyWrong.trim()
  && draft.whyRight.trim()
  && draft.takeaway.trim()
);

const rootCauseLabel = (value: RootCause | null) => ROOT_CAUSES.find(option => option.value === value)?.label || null;
const requestErrorMessage = (error: unknown, fallback: string) => {
  const body = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return body?.error || body?.message || fallback;
};

export default function ErrorLog() {
  const [logs, setLogs] = useState<ErrorEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<ErrorEntry | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ErrorEntry | null>(null);
  const [draft, setDraft] = useState<EntryDraft>(blankDraft);
  const [initialDraft, setInitialDraft] = useState<EntryDraft>(blankDraft);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<ReviewStatus>('ALL');
  const [rootCause, setRootCause] = useState<RootCause | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const debouncedSearch = useDebounce(searchTerm, 250);

  const fetchLogs = useCallback(async (force = false) => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(ERROR_LOG_PAGE_SIZE),
        status,
      });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (rootCause !== 'ALL') params.set('rootCause', rootCause);
      const data = await cachedGet<ErrorLogPage>(`/api/error-logs?${params}`, { ttlMs: 20_000, force });
      setLogs(data.items);
      setTotalEntries(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      setLoadError(requestErrorMessage(error, 'Unable to load your error log.'));
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch, rootCause, status]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  const openCreate = () => {
    const empty = blankDraft();
    setSelectedEntry(null);
    setDraft(empty);
    setInitialDraft(empty);
    setEditorOpen(true);
  };

  const openReview = (entry: ErrorEntry) => {
    const nextDraft = entryDraft(entry);
    setSelectedEntry(entry);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setEditorOpen(true);
  };

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initialDraft), [draft, initialDraft]);
  const closeEditor = () => {
    if (isSaving) return;
    if (isDirty && !window.confirm('Discard your unsaved changes?')) return;
    setEditorOpen(false);
  };

  const handleSave = async (markReviewed: boolean) => {
    if (!selectedEntry && (!draft.source.trim() || !draft.userAnswer.trim() || !draft.correctAnswer.trim())) {
      appToast.error('Complete the source and answer fields.');
      return;
    }
    if (markReviewed && !reviewIsComplete(draft)) {
      appToast.error('Complete every reflection field and choose a root cause.');
      return;
    }

    const analysis = {
      whyChosen: draft.whyChosen,
      whyWrong: draft.whyWrong,
      whyRight: draft.whyRight,
      takeaway: draft.takeaway,
      rootCause: draft.rootCause || null,
      markReviewed,
    };
    const payload = selectedEntry?.questionId
      ? analysis
      : {
          ...analysis,
          source: draft.source,
          category: draft.category || 'General',
          userAnswer: draft.userAnswer,
          correctAnswer: draft.correctAnswer,
        };

    try {
      setIsSaving(true);
      if (selectedEntry) await axiosClient.put(`/api/error-logs/${selectedEntry.id}`, payload);
      else await axiosClient.post('/api/error-logs', payload);
      appToast.success(markReviewed ? 'Review completed' : 'Draft saved');
      setEditorOpen(false);
      invalidateQueryCache('/api/error-logs');
      if (!selectedEntry && currentPage !== 1) setCurrentPage(1);
      else await fetchLogs(true);
    } catch (error) {
      appToast.error(requestErrorMessage(error, 'Unable to save this review.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await axiosClient.delete(`/api/error-logs/${deleteTarget.id}`);
      appToast.success('Entry deleted');
      setDeleteTarget(null);
      invalidateQueryCache('/api/error-logs');
      if (logs.length === 1 && currentPage > 1) setCurrentPage(page => page - 1);
      else await fetchLogs(true);
    } catch (error) {
      appToast.error(requestErrorMessage(error, 'Unable to delete this entry.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatus('ALL');
    setRootCause('ALL');
    setCurrentPage(1);
  };
  const hasFilters = Boolean(searchTerm || status !== 'ALL' || rootCause !== 'ALL');
  const firstItem = totalEntries ? (currentPage - 1) * ERROR_LOG_PAGE_SIZE + 1 : 0;
  const lastItem = Math.min(currentPage * ERROR_LOG_PAGE_SIZE, totalEntries);

  return (
    <div className="h-full overflow-y-auto">
      <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
        <PageHeader
          title="Error Log"
          description="Reconstruct your reasoning, diagnose the mistake, and decide what to do next time."
          actions={<Button onClick={openCreate}><Plus aria-hidden="true" />Add entry</Button>}
        />

        <DataSurface className="hidden md:block">
          <DataToolbar>
            <DataToolbarGroup>
              <div className="mr-2 shrink-0">
                <h2 className="flex items-center gap-2 text-sm font-medium text-foreground"><AlertCircle className="text-danger" aria-hidden="true" />Mistake review</h2>
                <p className="mt-0.5 text-caption text-muted-foreground">{isLoading ? 'Syncing…' : `${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'}`}</p>
              </div>
              <DataToolbarSearch
                label="Search error log"
                placeholder="Search skill, source, or takeaway…"
                value={searchTerm}
                onChange={event => { setSearchTerm(event.target.value); setCurrentPage(1); }}
              />
            </DataToolbarGroup>
            <DataToolbarActions>
              <StatusSelect value={status} onChange={value => { setStatus(value); setCurrentPage(1); }} />
              <RootCauseSelect filter value={rootCause} onChange={value => { setRootCause(value as RootCause | 'ALL'); setCurrentPage(1); }} />
              {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}>Reset</Button>}
            </DataToolbarActions>
          </DataToolbar>

          <Table className="min-w-[860px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-56">Skill</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-24 text-center">Yours</TableHead>
                <TableHead className="w-24 text-center">Correct</TableHead>
                <TableHead className="w-52">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <LoadingRows /> : loadError ? (
                <DataStateRow colSpan={5}>
                  <EmptyState compact surface={false} icon={<AlertCircle />} title="Error log unavailable" description={loadError} action={<Button variant="outline" onClick={() => void fetchLogs(true)}>Retry</Button>} />
                </DataStateRow>
              ) : logs.length === 0 ? (
                <DataStateRow colSpan={5}>
                  <EmptyState
                    compact
                    surface={false}
                    icon={<CircleDashed />}
                    title={hasFilters ? 'No matching entries' : 'No mistakes to review'}
                    description={hasFilters ? 'Adjust your search or filters.' : 'Wrong answers from submitted tests will appear here automatically.'}
                    action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
                  />
                </DataStateRow>
              ) : logs.map(log => (
                <TableRow key={log.id} className="group cursor-pointer" onClick={() => openReview(log)}>
                  <TableCell>
                    <p className="truncate text-body font-medium text-foreground">{log.category || 'General'}</p>
                    {log.rootCause && <p className="mt-0.5 truncate text-caption text-muted-foreground">{rootCauseLabel(log.rootCause)}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-start gap-2">
                      <FileText className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{capitalizeFirstLetter(log.source || 'Untitled entry')}</p>
                        {log.takeaway && <p className="mt-0.5 truncate text-caption text-muted-foreground">{log.takeaway}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center"><AnswerMark value={log.userAnswer || '—'} correct={false} /></TableCell>
                  <TableCell className="text-center"><AnswerMark value={log.correctAnswer || '—'} correct /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-between gap-2">
                      <ReviewBadge reviewed={Boolean(log.reviewedAt)} />
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Open review for ${log.source || 'entry'}`} title="Open review" onClick={event => { event.stopPropagation(); openReview(log); }}><ArrowRight /></Button>
                        <Button variant="ghost" size="icon-sm" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={`Delete ${log.source || 'entry'}`} title="Delete entry" onClick={event => { event.stopPropagation(); setDeleteTarget(log); }}><Trash2 /></Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!isLoading && !loadError && totalEntries > 0 && (
            <DataPagination><PaginationFooter first={firstItem} last={lastItem} total={totalEntries} page={currentPage} pages={totalPages} onPage={setCurrentPage} /></DataPagination>
          )}
        </DataSurface>

        <div className="space-y-3 md:hidden">
          <div className="space-y-2 rounded-card border border-ui-border bg-surface p-3">
            <DataToolbarSearch label="Search error log" placeholder="Search mistakes…" value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setCurrentPage(1); }} />
            <div className="flex flex-wrap gap-2"><StatusSelect value={status} onChange={value => { setStatus(value); setCurrentPage(1); }} /><RootCauseSelect filter value={rootCause} onChange={value => { setRootCause(value as RootCause | 'ALL'); setCurrentPage(1); }} />{hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}>Reset</Button>}</div>
          </div>
          {isLoading ? <MobileLoadingCards /> : loadError ? (
            <EmptyState icon={<AlertCircle />} title="Error log unavailable" description={loadError} action={<Button variant="outline" onClick={() => void fetchLogs(true)}>Retry</Button>} />
          ) : logs.length === 0 ? (
            <EmptyState icon={<CircleDashed />} title={hasFilters ? 'No matching entries' : 'No mistakes to review'} description={hasFilters ? 'Adjust your search or filters.' : 'Wrong answers from submitted tests will appear here automatically.'} action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined} />
          ) : logs.map(log => (
            <Card key={log.id} size="sm">
              <CardHeader>
                <CardTitle className="pr-2">{log.category || 'General'}</CardTitle>
                <ReviewBadge reviewed={Boolean(log.reviewedAt)} />
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-2 font-medium text-foreground">{capitalizeFirstLetter(log.source || 'Untitled entry')}</p>
                <div className="flex gap-4"><span className="flex items-center gap-2 text-caption text-muted-foreground">Yours <AnswerMark value={log.userAnswer || '—'} correct={false} /></span><span className="flex items-center gap-2 text-caption text-muted-foreground">Correct <AnswerMark value={log.correctAnswer || '—'} correct /></span></div>
                {log.takeaway && <p className="line-clamp-2 text-body text-muted-foreground">{log.takeaway}</p>}
                <div className="flex items-center justify-between gap-2 pt-1"><Button variant="outline" onClick={() => openReview(log)}>Open review <ArrowRight /></Button><Button variant="ghost" size="icon" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={`Delete ${log.source || 'entry'}`} onClick={() => setDeleteTarget(log)}><Trash2 /></Button></div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && !loadError && totalEntries > 0 && <div className="rounded-card border border-ui-border bg-surface p-3"><PaginationFooter first={firstItem} last={lastItem} total={totalEntries} page={currentPage} pages={totalPages} onPage={setCurrentPage} /></div>}
        </div>
      </main>

      <ReviewWorkspace
        open={editorOpen}
        entry={selectedEntry}
        draft={draft}
        initialReviewed={Boolean(selectedEntry?.reviewedAt)}
        saving={isSaving}
        onDraft={setDraft}
        onClose={closeEditor}
        onSave={handleSave}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        closeOnBackdrop={!isDeleting}
        presentation="content-dialog"
        title="Delete error entry?"
        subtitle={deleteTarget ? capitalizeFirstLetter(deleteTarget.source || 'Untitled entry') : undefined}
        className="max-w-md!"
        footer={<><Button variant="outline" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={isDeleting} onClick={() => void handleDelete()}>{isDeleting && <Loader2 className="animate-spin" aria-hidden="true" />}Delete entry</Button></>}
      >
        <p className="text-body leading-6 text-muted-foreground">This permanently removes the study note. This action cannot be undone.</p>
      </Modal>
    </div>
  );
}

function ReviewWorkspace({ open, entry, draft, initialReviewed, saving, onDraft, onClose, onSave }: {
  open: boolean;
  entry: ErrorEntry | null;
  draft: EntryDraft;
  initialReviewed: boolean;
  saving: boolean;
  onDraft: (draft: EntryDraft) => void;
  onClose: () => void;
  onSave: (markReviewed: boolean) => Promise<void>;
}) {
  const linkedQuestion = entry?.question || null;
  const complete = reviewIsComplete(draft);
  const objectiveComplete = Boolean(entry || (draft.source.trim() && draft.userAnswer.trim() && draft.correctAnswer.trim()));
  return (
    <Modal
      open={open}
      onClose={onClose}
      presentation="content-dialog"
      title={entry ? 'Question review' : 'Add an error entry'}
      subtitle={entry ? capitalizeFirstLetter(entry.source || 'Untitled entry') : 'Use this for a mistake completed outside the platform.'}
      className="h-[calc(100vh-2rem)] max-w-6xl!"
      footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button variant="outline" disabled={saving} onClick={() => void onSave(false)}>{saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}Save draft</Button><Button disabled={saving || !complete || !objectiveComplete} onClick={() => void onSave(true)}>{saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{initialReviewed ? 'Save review' : 'Mark reviewed'}</Button></>}
    >
      <div className="grid h-full min-h-0 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:overflow-hidden">
        <section className="min-w-0 lg:overflow-y-auto lg:pr-2" aria-labelledby="question-context-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id="question-context-heading" className="text-title font-semibold text-foreground">Question context</h3>
            {entry && <ReviewBadge reviewed={initialReviewed} />}
          </div>
          {entry && linkedQuestion ? <QuestionContext entry={entry} question={linkedQuestion} /> : (
            <ManualContext draft={draft} onDraft={onDraft} locked={Boolean(entry?.questionId)} />
          )}
        </section>

        <section className="min-w-0 border-t border-ui-border pt-4 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0" aria-labelledby="reflection-heading">
          <h3 id="reflection-heading" className="text-title font-semibold text-foreground">Your reflection</h3>
          <p className="mt-1 text-body text-muted-foreground">Write this in your own words. The system will not generate or fill these answers for you.</p>
          <div className="mt-5 space-y-5">
            <Field>
              <FieldLabel htmlFor="error-root-cause">Root cause</FieldLabel>
              <RootCauseSelect id="error-root-cause" value={draft.rootCause} onChange={value => onDraft({ ...draft, rootCause: value as RootCause | '' })} />
              <FieldDescription>Choose the main reason this mistake happened.</FieldDescription>
            </Field>
            <ReflectionField id="why-chosen" label="Why did you choose your answer?" description="Reconstruct what you noticed and the decision you made."><Textarea id="why-chosen" rows={4} maxLength={4000} value={draft.whyChosen} onChange={event => onDraft({ ...draft, whyChosen: event.target.value })} placeholder="I chose this because…" /></ReflectionField>
            <ReflectionField id="reasoning-error" label="What was wrong with that reasoning?" description="Name the exact misconception, unsupported assumption, or missed detail."><Textarea id="reasoning-error" rows={4} maxLength={4000} value={draft.whyWrong} onChange={event => onDraft({ ...draft, whyWrong: event.target.value })} placeholder="That reasoning failed because…" /></ReflectionField>
            <ReflectionField id="correct-reasoning" label="Why is the correct answer right?" description="Explain the logic that makes the correct answer fit."><Textarea id="correct-reasoning" rows={4} maxLength={4000} value={draft.whyRight} onChange={event => onDraft({ ...draft, whyRight: event.target.value })} placeholder="The correct answer works because…" /></ReflectionField>
            <ReflectionField id="takeaway" label="What will you do differently next time?" description="Write one reusable, specific action for a similar question."><Textarea id="takeaway" rows={3} maxLength={2000} value={draft.takeaway} onChange={event => onDraft({ ...draft, takeaway: event.target.value })} placeholder="Next time, I will…" /></ReflectionField>
            {!complete && <div className="flex gap-2 rounded-control border border-warning/30 bg-warning-soft p-3 text-body text-warning"><CircleDashed className="mt-0.5 shrink-0" aria-hidden="true" /><p>Complete all four reflections and choose a root cause to mark this entry reviewed. You can save a partial draft at any time.</p></div>}
          </div>
        </section>
      </div>
    </Modal>
  );
}

function QuestionContext({ entry, question }: { entry: ErrorEntry; question: ErrorQuestion }) {
  const subject = question.section.test.subject;
  return (
    <div className="space-y-5 rounded-card border border-ui-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground"><Badge variant="outline">{subject === 'RW' ? 'Reading & Writing' : 'Math'}</Badge><span>{question.section.name || `Module ${question.section.order}`}</span><span aria-hidden="true">·</span><span>Question {question.order}</span></div>
      {question.blocks?.length > 0 && <BlockRenderer blocks={question.blocks} subject={subject} readOnly variant="exam" />}
      <div className="exam-content font-medium text-foreground"><InteractiveText content={question.questionText} isMath={subject === 'MATH'} readOnly inheritTypography /></div>
      {question.type === 'MCQ' && question.choices?.length > 0 && (
        <div className="space-y-2" aria-label="Answer choices">
          {question.choices.map((choice, index) => {
            const label = String.fromCharCode(65 + index);
            const correct = label === entry.correctAnswer || choice.id === entry.correctAnswer || choice.text === entry.correctAnswer;
            const selected = label === entry.userAnswer || choice.id === entry.userAnswer || choice.text === entry.userAnswer;
            return <div key={`${label}-${index}`} className={`flex gap-3 rounded-control border p-3 ${correct ? 'border-success/40 bg-success-soft' : selected ? 'border-danger/40 bg-danger-soft' : 'border-ui-border bg-surface'}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-semibold ${correct ? 'border-success text-success' : selected ? 'border-danger text-danger' : 'border-ui-border text-muted-foreground'}`}>{label}</span><div className="min-w-0 flex-1 exam-content"><InteractiveText content={choice.text} isMath={subject === 'MATH'} readOnly inheritTypography /></div>{correct ? <CheckCircle2 className="shrink-0 text-success" aria-label="Correct answer" /> : selected ? <XCircle className="shrink-0 text-danger" aria-label="Your answer" /> : null}</div>;
          })}
        </div>
      )}
      <div className="grid gap-3 border-t border-ui-border pt-4 sm:grid-cols-2"><AnswerSummary label="Your answer" value={entry.userAnswer || 'Omitted'} correct={false} /><AnswerSummary label="Correct answer" value={entry.correctAnswer || '—'} correct /></div>
    </div>
  );
}

function ManualContext({ draft, onDraft, locked }: { draft: EntryDraft; onDraft: (draft: EntryDraft) => void; locked: boolean }) {
  return (
    <div className="space-y-4 rounded-card border border-ui-border bg-surface p-4 sm:p-5">
      <p className="text-body text-muted-foreground">Question content is not available for this manual or legacy entry. Add enough context to recognize it later.</p>
      <Field><FieldLabel htmlFor="error-source">Source <span className="text-danger">*</span></FieldLabel><Input id="error-source" autoFocus={!locked} disabled={locked} maxLength={200} value={draft.source} onChange={event => onDraft({ ...draft, source: event.target.value })} placeholder="Test 4 · Module 2 · Question 5" /></Field>
      <Field><FieldLabel htmlFor="error-skill">Skill</FieldLabel><Input id="error-skill" disabled={locked} maxLength={120} list="error-skill-suggestions" value={draft.category} onChange={event => onDraft({ ...draft, category: event.target.value })} placeholder="Words in Context" /><datalist id="error-skill-suggestions"><option value="Words in Context" /><option value="Text Structure and Purpose" /><option value="Cross-Text Connections" /><option value="Inferences" /><option value="Standard English Conventions" /><option value="Algebra" /></datalist></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="error-user-answer">Your answer <span className="text-danger">*</span></FieldLabel><Input id="error-user-answer" disabled={locked} maxLength={100} value={draft.userAnswer} onChange={event => onDraft({ ...draft, userAnswer: event.target.value })} placeholder="D or Omitted" /></Field><Field><FieldLabel htmlFor="error-correct-answer">Correct answer <span className="text-danger">*</span></FieldLabel><Input id="error-correct-answer" disabled={locked} maxLength={100} value={draft.correctAnswer} onChange={event => onDraft({ ...draft, correctAnswer: event.target.value })} placeholder="B" /></Field></div>
    </div>
  );
}

function ReflectionField({ id, label, description, children }: { id: string; label: string; description: string; children: ReactNode }) {
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel>{children}<FieldDescription>{description}</FieldDescription></Field>;
}

function StatusSelect({ value, onChange }: { value: ReviewStatus; onChange: (value: ReviewStatus) => void }) {
  return <Select value={value} onValueChange={value => onChange(value as ReviewStatus)}><SelectTrigger aria-label="Review status" className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem><SelectItem value="NEEDS_REVIEW">Needs review</SelectItem><SelectItem value="REVIEWED">Reviewed</SelectItem></SelectContent></Select>;
}

function RootCauseSelect({ id, value, onChange, filter = false }: { id?: string; value: RootCause | 'ALL' | ''; onChange: (value: RootCause | 'ALL' | '') => void; filter?: boolean }) {
  return <Select value={value || undefined} onValueChange={value => onChange(value as RootCause | 'ALL')}><SelectTrigger id={id} aria-label={filter ? 'Root cause filter' : 'Root cause'} className={filter ? 'w-44' : 'w-full'}><SelectValue placeholder={filter ? 'All root causes' : 'Select a root cause'} /></SelectTrigger><SelectContent>{filter && <SelectItem value="ALL">All root causes</SelectItem>}{ROOT_CAUSES.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}

function ReviewBadge({ reviewed }: { reviewed: boolean }) {
  return reviewed
    ? <Badge variant="outline" className="border-success/30 bg-success-soft text-success"><CheckCircle2 aria-hidden="true" />Reviewed</Badge>
    : <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning"><CircleDashed aria-hidden="true" />Needs review</Badge>;
}

function AnswerMark({ value, correct }: { value: string; correct: boolean }) {
  return <span className={`mx-auto flex min-h-7 min-w-7 max-w-20 items-center justify-center truncate rounded-control border px-2 text-caption font-semibold ${correct ? 'border-success/30 bg-success-soft text-success' : 'border-danger/30 bg-danger-soft text-danger'}`} title={value}>{value}</span>;
}

function AnswerSummary({ label, value, correct }: { label: string; value: string; correct: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-body text-muted-foreground">{label}</span><AnswerMark value={value} correct={correct} /></div>;
}

function LoadingRows() {
  return <>{Array.from({ length: 6 }, (_, index) => <TableRow key={index}><TableCell><Skeleton className="h-4 w-36" /></TableCell><TableCell><Skeleton className="h-4 w-3/4" /></TableCell><TableCell><Skeleton className="mx-auto size-7" /></TableCell><TableCell><Skeleton className="mx-auto size-7" /></TableCell><TableCell><Skeleton className="h-5 w-28" /></TableCell></TableRow>)}</>;
}

function MobileLoadingCards() {
  return <>{Array.from({ length: 3 }, (_, index) => <Card key={index} size="sm"><CardHeader><Skeleton className="h-4 w-36" /><Skeleton className="h-5 w-24" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-8 w-48" /></CardContent></Card>)}</>;
}

function PaginationFooter({ first, last, total, page, pages, onPage }: { first: number; last: number; total: number; page: number; pages: number; onPage: (page: number) => void }) {
  return <><p className="text-caption text-muted-foreground">Showing <strong>{first}–{last}</strong> of <strong>{total}</strong></p><div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft /></Button><span className="min-w-20 text-center text-caption font-semibold text-muted-foreground">{page} / {pages}</span><Button variant="outline" size="icon" disabled={page === pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight /></Button></div></>;
}
