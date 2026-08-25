import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Edit3, FileText, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { capitalizeFirstLetter } from '../../utils/text';
import toast from 'react-hot-toast';
import { Textarea } from '@/components/ui/textarea';
import axiosClient from '../../lib/axios';
import { Button, Card, EmptyState, Input, Modal, PageHeader, TableShell } from '../../components/ui/AppUI';
import { SatCountdown } from '../../features/sat-countdown/SatCountdown';
import { cachedGet, invalidateQueryCache } from '../../lib/queryCache';
import { useDebounce } from '../../hooks/useDebounce';

interface ErrorEntry {
  id: string;
  source: string;
  category: string;
  userAnswer: string;
  correctAnswer: string;
  whyWrong: string;
  whyRight: string;
  createdAt?: string;
}

interface ErrorLogPage { items: ErrorEntry[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }
const ERROR_LOG_PAGE_SIZE = 10;
const blankEntry = (): Partial<ErrorEntry> => ({ source: '', category: '', userAnswer: '', correctAnswer: '', whyWrong: '', whyRight: '' });

const getCategoryStyle = (category: string) => {
  const normalized = category.toLowerCase();
  if (normalized.includes('word') || normalized.includes('vocab')) return 'border-warning/20 bg-warning-soft text-warning';
  if (normalized.includes('reading') || normalized.includes('structure') || normalized.includes('inference')) return 'border-danger/20 bg-danger-soft text-danger';
  if (normalized.includes('grammar') || normalized.includes('convention')) return 'border-success/20 bg-success-soft text-success';
  if (normalized.includes('math') || normalized.includes('logic')) return 'border-primary/25 bg-primary-soft text-primary';
  return 'border-ui-border bg-muted text-subtle-foreground';
};

export default function ErrorLog() {
  const [logs, setLogs] = useState<ErrorEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ErrorEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [formData, setFormData] = useState<Partial<ErrorEntry>>(blankEntry);
  const debouncedSearch = useDebounce(searchTerm, 250);

  const fetchLogs = useCallback(async (force = false) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ page: String(currentPage), pageSize: String(ERROR_LOG_PAGE_SIZE) });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      const data = await cachedGet<ErrorLogPage>(`/api/error-logs?${params}`, { ttlMs: 20_000, force });
      setLogs(data.items);
      setTotalEntries(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      toast.error('Unable to load error log');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  const openCreate = () => { setFormData(blankEntry()); setShowModal(true); };
  const openEdit = (entry: ErrorEntry) => { setFormData(entry); setShowModal(true); };

  const handleSave = async () => {
    if (!formData.source?.trim() || !formData.userAnswer || !formData.correctAnswer) {
      toast.error('Complete the required fields');
      return;
    }
    const payload = {
      source: formData.source.trim(),
      category: formData.category?.trim() || 'General',
      userAnswer: formData.userAnswer,
      correctAnswer: formData.correctAnswer,
      whyWrong: formData.whyWrong?.trim() || '',
      whyRight: formData.whyRight?.trim() || '',
    };
    try {
      setIsSaving(true);
      if (formData.id) await axiosClient.put(`/api/error-logs/${formData.id}`, payload);
      else await axiosClient.post('/api/error-logs', payload);
      toast.success(formData.id ? 'Entry updated' : 'Entry saved');
      const created = !formData.id;
      setShowModal(false);
      setFormData(blankEntry());
      invalidateQueryCache('/api/error-logs');
      if (created && currentPage !== 1) setCurrentPage(1);
      else await fetchLogs(true);
    } catch (error) {
      console.error(error);
      toast.error('Unable to save entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/api/error-logs/${deleteTarget.id}`);
      toast.success('Entry deleted');
      setDeleteTarget(null);
      invalidateQueryCache('/api/error-logs');
      if (logs.length === 1 && currentPage > 1) setCurrentPage(page => page - 1);
      else await fetchLogs(true);
    } catch {
      toast.error('Unable to delete entry');
    } finally {
      setIsDeleting(false);
    }
  };

  const firstItem = (currentPage - 1) * ERROR_LOG_PAGE_SIZE + 1;
  const lastItem = Math.min(currentPage * ERROR_LOG_PAGE_SIZE, totalEntries);

  return <div className="h-full overflow-y-auto">
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
        <PageHeader title="Error Log" description="Review mistakes and turn them into study notes." actions={<><SatCountdown /><Button onClick={openCreate}><Plus size={16} aria-hidden="true" />Add entry</Button></>} />
        <Card className="mb-4 flex flex-col justify-between gap-4 p-4 md:flex-row md:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-heading font-semibold text-foreground"><AlertCircle className="text-danger" size={20} aria-hidden="true" />Mistake review</h2>
            <p className="mt-1 text-caption font-medium text-muted-foreground">{isLoading ? 'Syncing…' : `${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'}`}</p>
          </div>
          <div className="flex w-full items-center gap-3 md:w-auto">
            <label className="relative min-w-0 flex-1 md:w-72">
              <span className="sr-only">Search error log</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input type="search" placeholder="Search entries…" className="w-full pl-9" value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setCurrentPage(1); }} />
            </label>
          </div>
        </Card>

        <TableShell className="relative hidden md:block">
          {isLoading && <LoadingOverlay />}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-left text-body">
              <thead className="sticky top-0 z-10 border-b border-ui-border bg-surface-subtle text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-44 px-5 py-3">Category</th><th className="w-56 px-5 py-3">Source</th><th className="w-24 px-4 py-3 text-center">Yours</th><th className="w-24 px-4 py-3 text-center">Correct</th><th className="min-w-[260px] px-5 py-3">Why it was wrong</th><th className="min-w-[260px] px-5 py-3">Why this is right</th><th className="w-24 px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border">
                {!isLoading && logs.length === 0 ? <tr><td colSpan={7}><EmptyState compact surface={false} icon={<AlertCircle size={20} />} title={searchTerm ? 'No matching entries' : 'No entries yet'} description={searchTerm ? 'Try a different search.' : 'Add a mistake to turn it into a study note.'} /></td></tr> : logs.map(log => <tr key={log.id} className="group transition-colors hover:bg-surface-subtle">
                  <td className="px-5 py-4 align-top"><span className={`inline-flex rounded-control border px-2.5 py-1 text-[11px] font-semibold ${getCategoryStyle(log.category)}`}>{log.category}</span></td>
                  <td className="px-5 py-4 align-top font-medium text-subtle-foreground"><div className="flex items-start gap-2"><FileText size={14} className="mt-1 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="line-clamp-2" title={capitalizeFirstLetter(log.source)}>{capitalizeFirstLetter(log.source)}</span></div></td>
                  <td className="px-4 py-4 align-top text-center"><AnswerMark value={log.userAnswer === 'Omitted' ? 'X' : log.userAnswer} correct={false} /></td>
                  <td className="px-4 py-4 align-top text-center"><AnswerMark value={log.correctAnswer} correct /></td>
                  <td className="px-5 py-4 align-top"><p className="line-clamp-3 leading-relaxed text-subtle-foreground hover:line-clamp-none">{log.whyWrong || '—'}</p></td>
                  <td className="px-5 py-4 align-top"><p className="line-clamp-3 leading-relaxed text-subtle-foreground hover:line-clamp-none">{log.whyRight || '—'}</p></td>
                  <td className="px-4 py-4 align-top"><div className="flex justify-center gap-1"><IconAction label="Edit entry" onClick={() => openEdit(log)}><Edit3 size={16} /></IconAction><IconAction danger label="Delete entry" onClick={() => setDeleteTarget(log)}><Trash2 size={16} /></IconAction></div></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <PaginationFooter first={firstItem} last={lastItem} total={totalEntries} page={currentPage} pages={totalPages} onPage={setCurrentPage} />
        </TableShell>

        <div className="relative space-y-3 md:hidden">
          {isLoading && <LoadingOverlay />}
          {!isLoading && logs.length === 0 ? <EmptyState icon={<AlertCircle size={20} />} title={searchTerm ? 'No matching entries' : 'No entries yet'} description={searchTerm ? 'Try a different search.' : 'Add a mistake to turn it into a study note.'} /> : logs.map(log => <Card key={log.id} className="p-4">
            <div className="flex items-start justify-between gap-3"><span className={`inline-flex rounded-control border px-2.5 py-1 text-[11px] font-semibold ${getCategoryStyle(log.category)}`}>{log.category}</span><div className="flex"><IconAction label="Edit entry" onClick={() => openEdit(log)}><Edit3 size={16} /></IconAction><IconAction danger label="Delete entry" onClick={() => setDeleteTarget(log)}><Trash2 size={16} /></IconAction></div></div>
            <p className="mt-3 text-body font-semibold text-foreground">{capitalizeFirstLetter(log.source)}</p>
            <div className="mt-3 flex gap-4"><span className="flex items-center gap-2 text-caption text-muted-foreground">Yours <AnswerMark value={log.userAnswer === 'Omitted' ? 'X' : log.userAnswer} correct={false} /></span><span className="flex items-center gap-2 text-caption text-muted-foreground">Correct <AnswerMark value={log.correctAnswer} correct /></span></div>
            <dl className="mt-4 space-y-3 text-body"><div><dt className="font-semibold text-foreground">Why it was wrong</dt><dd className="mt-1 text-subtle-foreground">{log.whyWrong || '—'}</dd></div><div><dt className="font-semibold text-foreground">Why this is right</dt><dd className="mt-1 text-subtle-foreground">{log.whyRight || '—'}</dd></div></dl>
          </Card>)}
          <PaginationFooter first={firstItem} last={lastItem} total={totalEntries} page={currentPage} pages={totalPages} onPage={setCurrentPage} />
        </div>
    </main>

    <Modal open={showModal} onClose={() => !isSaving && setShowModal(false)} closeOnBackdrop={!isSaving} title={formData.id ? 'Edit error analysis' : 'Add error entry'} subtitle="Capture the mistake, then write the reasoning you want to remember." className="max-w-3xl!" footer={<><Button variant="ghost" disabled={isSaving} onClick={() => setShowModal(false)}>Cancel</Button><Button disabled={isSaving} onClick={() => void handleSave()}>{isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}{isSaving ? 'Saving…' : 'Save entry'}</Button></>}>
      <div className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Source" required><Input autoFocus className="w-full" placeholder="e.g. Test 1 · Module 2 · Question 15" value={formData.source || ''} onChange={event => setFormData({ ...formData, source: event.target.value })} /></Field>
          <Field label="Category"><Input className="w-full" placeholder="e.g. Words in Context" list="error-category-suggestions" value={formData.category || ''} onChange={event => setFormData({ ...formData, category: event.target.value })} /><datalist id="error-category-suggestions"><option value="Words in Context" /><option value="Text Structure and Purpose" /><option value="Cross-Text Connections" /><option value="Inferences" /><option value="Standard English Conventions" /></datalist></Field>
        </div>
        <div className="grid gap-5 rounded-card border border-ui-border bg-surface-subtle p-4 sm:grid-cols-2 sm:p-5">
          <AnswerPicker label="Your answer" tone="danger" value={formData.userAnswer || ''} onChange={userAnswer => setFormData({ ...formData, userAnswer })} />
          <AnswerPicker label="Correct answer" tone="success" value={formData.correctAnswer || ''} onChange={correctAnswer => setFormData({ ...formData, correctAnswer })} />
        </div>
        <Field label="Why was your answer wrong?"><Textarea rows={3} placeholder="Describe the misconception or reasoning error…" value={formData.whyWrong || ''} onChange={event => setFormData({ ...formData, whyWrong: event.target.value })} /></Field>
        <Field label="Why is the correct answer right?"><Textarea rows={3} placeholder="Explain the correct reasoning and key takeaway…" value={formData.whyRight || ''} onChange={event => setFormData({ ...formData, whyRight: event.target.value })} /></Field>
      </div>
    </Modal>

    <Modal open={Boolean(deleteTarget)} onClose={() => !isDeleting && setDeleteTarget(null)} closeOnBackdrop={!isDeleting} title="Delete error entry?" subtitle={deleteTarget ? capitalizeFirstLetter(deleteTarget.source) : undefined} className="max-w-md!" footer={<><Button variant="ghost" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={isDeleting} onClick={() => void handleDelete()}>{isDeleting ? 'Deleting…' : 'Delete entry'}</Button></>}>
      <p className="text-body leading-6 text-subtle-foreground">This permanently removes the study note. This action cannot be undone.</p>
    </Modal>
  </div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-body font-medium text-foreground">{label}{required && <span className="text-danger"> *</span>}</span>{children}</label>;
}

function AnswerPicker({ label, tone, value, onChange }: { label: string; tone: 'danger' | 'success'; value: string; onChange: (value: string) => void }) {
  const activeClass = tone === 'danger' ? 'border-danger bg-danger text-white' : 'border-success bg-success text-white';
  return <fieldset><legend className={`mb-3 text-caption font-semibold uppercase tracking-wide ${tone === 'danger' ? 'text-danger' : 'text-success'}`}>{label}</legend><div className="flex gap-2">{['A', 'B', 'C', 'D'].map(option => <Button key={option} variant="outline" size="icon" aria-pressed={value === option} onClick={() => onChange(option)} className={value === option ? activeClass : undefined}>{option}</Button>)}</div></fieldset>;
}

function AnswerMark({ value, correct }: { value: string; correct: boolean }) {
  return <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-control border text-caption font-bold ${correct ? 'border-success/20 bg-success-soft text-success' : 'border-danger/20 bg-danger-soft text-danger'}`}>{value}</span>;
}

function IconAction({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return <Button variant="ghost" size="icon" onClick={onClick} aria-label={label} title={label} className={danger ? 'text-danger hover:bg-danger-soft' : undefined}>{children}</Button>;
}

function LoadingOverlay() {
  return <div className="absolute inset-0 z-20 flex min-h-48 items-center justify-center bg-surface/80"><div className="flex flex-col items-center gap-2 text-primary"><Loader2 size={28} className="animate-spin" aria-hidden="true" /><span className="text-caption font-semibold">Loading entries…</span></div></div>;
}

function PaginationFooter({ first, last, total, page, pages, onPage }: { first: number; last: number; total: number; page: number; pages: number; onPage: (page: number) => void }) {
  if (total === 0) return null;
  return <div className="flex items-center justify-between gap-3 border-t border-ui-border bg-surface-subtle p-3"><p className="text-caption text-muted-foreground">Showing <strong>{first}–{last}</strong> of <strong>{total}</strong></p><div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></Button><span className="min-w-20 text-center text-caption font-semibold text-subtle-foreground">{page} / {pages}</span><Button variant="outline" size="icon" disabled={page === pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></Button></div></div>;
}
