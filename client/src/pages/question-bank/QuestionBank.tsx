import { useCallback, useEffect, useState } from 'react';
import { Archive, BookCopy, Edit3, Plus } from 'lucide-react';
import axiosClient from '@/lib/axios';
import { appToast } from '@/components/ui/toast';
import { Badge, EmptyState, Modal, PageHeader } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DataPagination, DataStateRow, DataSurface, DataTableViewport, DataToolbar, DataToolbarActions, DataToolbarGroup, DataToolbarSearch } from '@/components/ui/data-surface';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TaxonomyDomain } from '@/features/test-creation/create-test.types';
import type { BankChoice, BankQuestion, BankQuestionDifficulty, BankQuestionPage, BankQuestionStatus, BankQuestionType, BankSubject } from '@/features/question-bank/question-bank.types';

interface EditorDraft {
  subject: BankSubject;
  type: BankQuestionType;
  difficulty: BankQuestionDifficulty;
  status: Exclude<BankQuestionStatus, 'ARCHIVED'>;
  domainCode: string;
  skillCode: string;
  questionText: string;
  choices: BankChoice[];
  correctAnswer: string;
  explanation: string;
}

const emptyDraft = (): EditorDraft => ({
  subject: 'RW', type: 'MCQ', difficulty: 'MEDIUM', status: 'DRAFT', domainCode: '', skillCode: '', questionText: '',
  choices: 'ABCD'.split('').map(id => ({ id, text: '' })), correctAnswer: 'A', explanation: '',
});

const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

export default function QuestionBank() {
  const role = localStorage.getItem('userRole') || 'TEACHER';
  const isAdmin = role === 'ADMIN';
  const [data, setData] = useState<BankQuestionPage | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<'ALL' | BankSubject>('ALL');
  const [status, setStatus] = useState<'ALL' | BankQuestionStatus>('ALL');
  const [source, setSource] = useState<'MINE' | 'SYSTEM'>(isAdmin ? 'SYSTEM' : 'MINE');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [draft, setDraft] = useState<EditorDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '40', source });
      if (search.trim()) params.set('search', search.trim());
      if (subject !== 'ALL') params.set('subject', subject);
      if (status !== 'ALL') params.set('status', status);
      setData(await axiosClient.get<BankQuestionPage, BankQuestionPage>(`/api/question-bank?${params}`));
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to load the question bank.'));
    } finally { setLoading(false); }
  }, [page, search, source, status, subject]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, search.trim() ? 300 : 0);
    return () => window.clearTimeout(timeout);
  }, [load, search]);
  useEffect(() => {
    void axiosClient.get<TaxonomyDomain[], TaxonomyDomain[]>(`/api/tests/taxonomy?subject=${draft.subject}`).then(setTaxonomy).catch(() => setTaxonomy([]));
  }, [draft.subject]);

  const selectedDomain = taxonomy.find(item => item.code === draft.domainCode);
  const openCreate = () => { setEditing(null); setDraft(emptyDraft()); setEditorVisible(true); };
  const openEdit = (question: BankQuestion) => {
    setEditing(question);
    setDraft({
      subject: question.subject, type: question.type, difficulty: question.difficulty,
      status: question.status === 'ARCHIVED' ? 'DRAFT' : question.status,
      domainCode: question.domain.code, skillCode: question.skill.code, questionText: question.questionText,
      choices: question.choices.length ? question.choices : 'ABCD'.split('').map(id => ({ id, text: '' })),
      correctAnswer: question.correctAnswer || '', explanation: question.explanation || '',
    });
    setEditorVisible(true);
  };
  const closeEditor = () => { setEditing(null); setDraft(emptyDraft()); setEditorVisible(false); };
  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...draft, blocks: [], choices: draft.type === 'MCQ' ? draft.choices : [] };
      if (editing) await axiosClient.put(`/api/question-bank/${editing.id}`, payload);
      else await axiosClient.post('/api/question-bank', payload);
      appToast.success(editing ? 'Question updated' : 'Question created');
      closeEditor();
      await load();
    } catch (requestError) { appToast.error(errorMessage(requestError, 'Unable to save this question.')); }
    finally { setSaving(false); }
  };
  const archive = async (question: BankQuestion) => {
    try {
      await axiosClient.patch(`/api/question-bank/${question.id}/status`, { status: 'ARCHIVED' });
      appToast.success('Question archived');
      await load();
    } catch (requestError) { appToast.error(errorMessage(requestError, 'Unable to archive this question.')); }
  };
  const hasFilters = Boolean(search || subject !== 'ALL' || status !== 'ALL');
  const title = isAdmin ? 'System Question Bank' : source === 'SYSTEM' ? 'System Question Bank' : 'My Question Bank';

  return <div className="h-full overflow-y-auto"><main className="mx-auto w-full max-w-screen-2xl space-y-6 p-4 md:p-6">
    <PageHeader title={title} description={isAdmin ? 'Create and publish reusable questions for roadmaps, practice, and teacher tests.' : 'Build reusable questions and select published system questions for your tests.'} actions={(isAdmin || source === 'MINE') ? <Button onClick={openCreate}><Plus aria-hidden="true" />New question</Button> : undefined} />
    <DataSurface>
      <DataToolbar>
        <DataToolbarSearch value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search questions..." />
        <DataToolbarGroup>
          {!isAdmin && <Select value={source} onValueChange={value => { setSource(value as 'MINE' | 'SYSTEM'); setPage(1); }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MINE">My questions</SelectItem><SelectItem value="SYSTEM">System questions</SelectItem></SelectContent></Select>}
          <Select value={subject} onValueChange={value => { setSubject(value as 'ALL' | BankSubject); setPage(1); }}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All subjects</SelectItem><SelectItem value="RW">Reading & Writing</SelectItem><SelectItem value="MATH">Math</SelectItem></SelectContent></Select>
          <Select value={status} onValueChange={value => { setStatus(value as 'ALL' | BankQuestionStatus); setPage(1); }} disabled={!isAdmin && source === 'SYSTEM'}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Active</SelectItem><SelectItem value="DRAFT">Draft</SelectItem><SelectItem value="PUBLISHED">Published</SelectItem><SelectItem value="ARCHIVED">Archived</SelectItem></SelectContent></Select>
        </DataToolbarGroup>
        <DataToolbarActions><Badge tone="neutral">{data?.pagination.total ?? '—'} questions</Badge></DataToolbarActions>
      </DataToolbar>
      <DataTableViewport><Table><TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Classification</TableHead><TableHead>Difficulty</TableHead><TableHead>Status</TableHead><TableHead className="w-28 text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
        {loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>) : error ? <DataStateRow colSpan={5}><EmptyState title="Question bank unavailable" description={error} action={<Button variant="outline" onClick={() => void load()}>Retry</Button>} /></DataStateRow> : !data?.items.length ? <DataStateRow colSpan={5}><EmptyState icon={<BookCopy aria-hidden="true" />} title={hasFilters ? 'No matching questions' : 'No questions yet'} description={hasFilters ? 'Change or clear the current filters.' : 'Create the first reusable question for this collection.'} /></DataStateRow> : data.items.map(question => <TableRow key={question.id}>
          <TableCell className="max-w-xl"><p className="line-clamp-2 text-body font-medium text-foreground">{question.questionText}</p><p className="mt-1 text-caption text-muted-foreground">{question.subject === 'RW' ? 'Reading & Writing' : 'Math'} · {question.type} · Version {question.version}</p></TableCell>
          <TableCell><p className="text-body text-foreground">{question.domain.name}</p><p className="text-caption text-muted-foreground">{question.skill.name}</p></TableCell>
          <TableCell><span className="capitalize">{question.difficulty.toLowerCase()}</span></TableCell>
          <TableCell><Badge tone={question.status === 'PUBLISHED' ? 'success' : question.status === 'ARCHIVED' ? 'neutral' : 'warning'}>{question.status.toLowerCase()}</Badge></TableCell>
          <TableCell><div className="flex justify-end gap-1">{(isAdmin || source === 'MINE') && <><Button variant="ghost" size="icon-sm" aria-label="Edit question" onClick={() => openEdit(question)}><Edit3 aria-hidden="true" /></Button>{question.status !== 'ARCHIVED' && <Button variant="ghost" size="icon-sm" aria-label="Archive question" onClick={() => void archive(question)}><Archive aria-hidden="true" /></Button>}</>}</div></TableCell>
        </TableRow>)}
      </TableBody></Table></DataTableViewport>
      {data && data.pagination.totalPages > 1 && <DataPagination><p className="text-caption text-muted-foreground">Page {data.pagination.page} of {data.pagination.totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Next</Button></div></DataPagination>}
    </DataSurface>
    <Modal open={editorVisible} onClose={closeEditor} presentation="content-dialog" title={editing ? 'Edit question' : 'New question'} subtitle="Each save creates an immutable content version." className="max-w-3xl!" footer={<><Button variant="outline" disabled={saving} onClick={closeEditor}>Cancel</Button><Button disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : editing ? 'Save new version' : 'Create question'}</Button></>}>
      <div className="grid max-h-[68vh] gap-5 overflow-y-auto pr-1 sm:grid-cols-2">
        <Field><FieldLabel>Subject</FieldLabel><Select value={draft.subject} onValueChange={value => setDraft(current => ({ ...current, subject: value as BankSubject, type: value === 'RW' ? 'MCQ' : current.type, domainCode: '', skillCode: '' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RW">Reading & Writing</SelectItem><SelectItem value="MATH">Math</SelectItem></SelectContent></Select></Field>
        <Field><FieldLabel>Question type</FieldLabel><Select value={draft.type} disabled={draft.subject === 'RW'} onValueChange={value => setDraft(current => ({ ...current, type: value as BankQuestionType, correctAnswer: value === 'MCQ' ? 'A' : '' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MCQ">Multiple choice</SelectItem><SelectItem value="SPR">Student-produced response</SelectItem></SelectContent></Select></Field>
        <Field><FieldLabel>Domain</FieldLabel><Select value={draft.domainCode || undefined} onValueChange={value => setDraft(current => ({ ...current, domainCode: value, skillCode: '' }))}><SelectTrigger><SelectValue placeholder="Choose domain" /></SelectTrigger><SelectContent>{taxonomy.map(domain => <SelectItem key={domain.code} value={domain.code}>{domain.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field><FieldLabel>Skill</FieldLabel><Select value={draft.skillCode || undefined} disabled={!selectedDomain} onValueChange={value => setDraft(current => ({ ...current, skillCode: value }))}><SelectTrigger><SelectValue placeholder="Choose skill" /></SelectTrigger><SelectContent>{selectedDomain?.skills.map(skill => <SelectItem key={skill.code} value={skill.code}>{skill.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field><FieldLabel>Difficulty</FieldLabel><Select value={draft.difficulty} onValueChange={value => setDraft(current => ({ ...current, difficulty: value as BankQuestionDifficulty }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EASY">Easy</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HARD">Hard</SelectItem></SelectContent></Select></Field>
        <Field><FieldLabel>Publication</FieldLabel><Select value={draft.status} onValueChange={value => setDraft(current => ({ ...current, status: value as 'DRAFT' | 'PUBLISHED' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DRAFT">Draft</SelectItem><SelectItem value="PUBLISHED">Published</SelectItem></SelectContent></Select></Field>
        <Field className="sm:col-span-2"><FieldLabel>Question</FieldLabel><Textarea className="min-h-28" value={draft.questionText} onChange={event => setDraft(current => ({ ...current, questionText: event.target.value }))} /></Field>
        {draft.type === 'MCQ' && <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">{draft.choices.map((choice, index) => <Field key={choice.id}><FieldLabel>Choice {choice.id}</FieldLabel><Input value={choice.text} onChange={event => setDraft(current => ({ ...current, choices: current.choices.map((item, choiceIndex) => choiceIndex === index ? { ...item, text: event.target.value } : item) }))} /></Field>)}</div>}
        <Field><FieldLabel>Correct answer</FieldLabel>{draft.type === 'MCQ' ? <Select value={draft.correctAnswer} onValueChange={value => setDraft(current => ({ ...current, correctAnswer: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{'ABCD'.split('').map(id => <SelectItem key={id} value={id}>{id}</SelectItem>)}</SelectContent></Select> : <Input value={draft.correctAnswer} onChange={event => setDraft(current => ({ ...current, correctAnswer: event.target.value }))} />}</Field>
        <Field className="sm:col-span-2"><FieldLabel>Explanation <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Textarea className="min-h-24" value={draft.explanation} onChange={event => setDraft(current => ({ ...current, explanation: event.target.value }))} /></Field>
      </div>
    </Modal>
  </main></div>;
}
