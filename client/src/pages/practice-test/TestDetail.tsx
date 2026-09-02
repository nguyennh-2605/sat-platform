import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Archive, Check, Copy, FilePenLine, LoaderCircle, Pencil, RotateCcw, Send, Trash2, TriangleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ContentBlock } from '@/types/quiz';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Tabs } from '@/components/ui/AppUI';
import { useDashboardBack } from '@/features/navigation/DashboardBackContext';
import BlockRenderer from '@/components/content/BlockRenderer';
import FormattedTextRenderer from '@/components/content/TextRenderer';
import axiosClient from '@/lib/axios';
import { invalidateQueryCache } from '@/lib/queryCache';
import { AssignTestsComposer, type ComposerTest } from '@/features/classroom/activity-composer/ActivityComposers';

type DetailTab = 'OVERVIEW' | 'QUESTIONS';
type TestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

interface TestQuestion {
  id: number; order: number; type: 'MCQ' | 'SPR'; questionText: string; blocks: ContentBlock[];
  choices: Array<{ id: string; text: string }>; correctAnswer: string; explanation?: string | null;
}
interface TestSection { id: number; name: string; order: number; duration: number; questions: TestQuestion[] }
interface TestDetailData {
  id: number; title: string; description?: string | null; duration: number; subject: 'RW' | 'MATH'; mode: 'PRACTICE' | 'EXAM'; category: string;
  status: TestStatus; scope: 'SYSTEM' | 'PERSONAL'; createdAt: string; updatedAt: string; authorId?: number | null; author?: { name?: string | null; role: string } | null;
  isOwner: boolean; hasAttempts: boolean; hasUsage: boolean; deliveryCount: number; questionCount: number; sections: TestSection[];
  capabilities: { canEdit: boolean; canArchive: boolean; canRestore: boolean; canDelete: boolean; canDuplicate: boolean; canCopyToSystem: boolean };
}

const statusLabel = { DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' } as const;

export default function TestDetail() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<TestDetailData | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  useDashboardBack(() => navigate('/dashboard/practice-test'));

  const loadTest = useCallback(async () => {
    if (!testId) return;
    setLoading(true);
    setError('');
    try {
      setTest(await axiosClient.get<TestDetailData, TestDetailData>(`/api/tests/${testId}/content`));
    } catch (requestError) {
      console.error(requestError);
      setError(errorMessage(requestError, 'Unable to load this test.'));
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => { void loadTest(); }, [loadTest]);
  const composerTests = useMemo<ComposerTest[]>(() => test ? [{ id: test.id, title: test.title, duration: test.duration, subject: test.subject, mode: test.mode, questionCount: test.questionCount }] : [], [test]);

  const updateStatus = async (status: TestStatus) => {
    if (!test) return;
    setWorking(true);
    try {
      await axiosClient.patch(`/api/tests/${test.id}/status`, { status });
      invalidateQueryCache('/api/tests');
      toast.success(status === 'ARCHIVED' ? 'Test archived' : 'Test restored');
      await loadTest();
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to update this test.'));
    } finally {
      setWorking(false);
    }
  };

  const duplicate = async () => {
    if (!test) return;
    setWorking(true);
    try {
      const copy = await axiosClient.post<{ id: number }, { id: number }>(`/api/tests/${test.id}/duplicate`);
      invalidateQueryCache('/api/tests');
      toast.success('Draft copy created in My Tests');
      navigate(`/dashboard/practice-test/create?edit=${copy.id}`);
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to duplicate this test.'));
    } finally {
      setWorking(false);
    }
  };

  const copyToSystem = async () => {
    if (!test) return;
    setWorking(true);
    try {
      const copy = await axiosClient.post<{ id: number }, { id: number }>(`/api/tests/${test.id}/copy-to-system`);
      invalidateQueryCache('/api/tests');
      toast.success('Teacher test copied to the System Library');
      navigate(`/dashboard/practice-test/create?edit=${copy.id}`);
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to copy this test to the System Library.'));
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    if (!test) return;
    setWorking(true);
    try {
      await axiosClient.delete(`/api/tests/${test.id}`);
      invalidateQueryCache('/api/tests');
      toast.success('Test permanently deleted');
      navigate('/dashboard/practice-test');
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to delete this test.'));
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="mx-auto max-w-screen-2xl space-y-4 p-4 md:p-6"><div className="h-24 animate-pulse rounded-card bg-muted" /><div className="h-80 animate-pulse rounded-card bg-muted" /></div>;
  if (!test || error) return <div className="mx-auto max-w-screen-2xl p-4 md:p-6"><EmptyState icon={<TriangleAlert size={23} />} title="Test not found" description={error || 'This test may have been removed or you may not have access.'} /></div>;

  return <div className="h-full overflow-y-auto bg-background"><main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
    <PageHeader title={test.title} description={`${test.subject === 'MATH' ? 'Math' : 'Reading & Writing'} · ${test.mode === 'EXAM' ? 'Exam' : 'Practice'}`} actions={<div className="flex flex-wrap items-center gap-2">{test.status === 'PUBLISHED' && <Button variant="outline" size="sm" disabled={working} onClick={() => setAssignOpen(true)}><Send size={15} />Assign</Button>}{test.capabilities.canRestore && <Button variant="outline" size="sm" disabled={working} onClick={() => void updateStatus('PUBLISHED')}><RotateCcw size={15} />Restore</Button>}{test.capabilities.canEdit && <Button size="sm" disabled={working} onClick={() => navigate(`/dashboard/practice-test/create?edit=${test.id}`)}><Pencil size={15} />Edit test</Button>}{test.capabilities.canDuplicate && <Button variant={test.capabilities.canEdit ? 'outline' : 'primary'} size="sm" disabled={working} onClick={() => void duplicate()}>{working ? <LoaderCircle size={15} className="animate-spin" /> : <Copy size={15} />}{test.scope === 'SYSTEM' && localStorage.getItem('userRole') === 'TEACHER' ? 'Duplicate to My Tests' : 'Duplicate'}</Button>}{test.capabilities.canCopyToSystem && <Button size="sm" disabled={working} onClick={() => void copyToSystem()}>{working ? <LoaderCircle size={15} className="animate-spin" /> : <Copy size={15} />}Copy to System Library</Button>}</div>} />
    <div className="overflow-x-auto"><Tabs items={[{ value: 'OVERVIEW' as const, label: 'Overview' }, { value: 'QUESTIONS' as const, label: `Questions (${test.questionCount})` }]} value={activeTab} onValueChange={setActiveTab} ariaLabel="Test detail sections" /></div>

    {activeTab === 'OVERVIEW' ? <Overview test={test} onArchive={() => void updateStatus('ARCHIVED')} onDelete={() => setDeleteOpen(true)} working={working} /> : <Questions test={test} />}
  </main>
  <Modal open={deleteOpen} onClose={() => !working && setDeleteOpen(false)} closeOnBackdrop={!working} presentation="content-dialog" title="Delete test?" subtitle={test.title} className="max-w-md!" footer={<><Button variant="outline" disabled={working} onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" disabled={working} onClick={() => void remove()}>{working ? 'Deleting…' : 'Delete permanently'}</Button></>}><p className="text-sm leading-6 text-muted-foreground">Tests with classroom or attempt history cannot be permanently deleted. Archive them to preserve student records.</p></Modal>
  <AssignTestsComposer open={assignOpen} onClose={() => setAssignOpen(false)} initialTests={composerTests} initialSource={test.scope === 'SYSTEM' ? 'SYSTEM' : 'MY'} onCreated={() => invalidateQueryCache('/api/tests', '/api/class-activities')} />
  </div>;
}

function Overview({ test, onArchive, onDelete, working }: { test: TestDetailData; onArchive: () => void; onDelete: () => void; working: boolean }) {
  const role = localStorage.getItem('userRole');
  const publicationCopy = test.scope === 'SYSTEM'
    ? test.status === 'PUBLISHED' ? 'This platform test is available to students and teachers.' : test.status === 'DRAFT' ? 'Publish this test to make it available across the platform.' : 'Restore this test to return it to the active System Library.'
    : role === 'ADMIN' ? `Owned by ${test.author?.name || 'a teacher'}. Copy it to the System Library to create a platform-owned draft.` : test.status === 'PUBLISHED' ? 'This test can be selected when creating a Classroom activity.' : 'Publish this test before assigning it to a class.';
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><Card className="p-5 md:p-6"><h2 className="text-title font-semibold">Test overview</h2><div className="mt-5 grid gap-px overflow-hidden rounded-card border border-ui-border bg-ui-border sm:grid-cols-2"><Metric label="Subject" value={test.subject === 'MATH' ? 'Math' : 'Reading & Writing'} /><Metric label="Type" value={test.mode === 'EXAM' ? 'Exam' : 'Practice'} /><Metric label="Questions" value={String(test.questionCount)} /><Metric label="Duration" value={`${test.duration} minutes`} /><Metric label="Created" value={formatDate(test.createdAt)} /><Metric label="Last updated" value={formatDate(test.updatedAt)} /></div>{test.description && <div className="mt-5"><h3 className="text-caption font-medium text-muted-foreground">Description</h3><p className="mt-2 text-body leading-6 text-foreground">{test.description}</p></div>}</Card><Card className="h-fit p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-title font-semibold">Publication</h2><StatusBadge status={test.status} /></div><p className="mt-3 text-body leading-6 text-muted-foreground">{publicationCopy}</p>{(test.capabilities.canArchive || test.capabilities.canDelete) && <div className="mt-5 space-y-2">{test.capabilities.canArchive && <Button variant="outline" className="w-full" disabled={working} onClick={onArchive}><Archive size={16} />Archive test</Button>}{test.capabilities.canDelete && <Button variant="ghost" className="w-full text-danger hover:bg-danger-soft hover:text-danger" disabled={working} onClick={onDelete}><Trash2 size={16} />Delete permanently</Button>}</div>}{(!test.capabilities.canEdit && test.hasUsage) && <p className="mt-4 rounded-control bg-muted p-3 text-caption text-muted-foreground">This test has classroom history and is read-only. Duplicate it to create a new editable version.</p>}</Card></div>;
}

function Questions({ test }: { test: TestDetailData }) {
  return <div className="space-y-4">{test.sections.map(section => <Card key={section.id} className="overflow-hidden p-0"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-muted/30 px-5 py-4"><div><h2 className="text-title font-semibold">{section.name}</h2><p className="mt-1 text-caption text-muted-foreground">{section.questions.length} questions · {section.duration} min</p></div></div><div className="divide-y divide-ui-border">{section.questions.map(question => <article key={question.id} className="p-5 md:p-6"><div className="mb-4 flex items-center justify-between gap-3"><p className="text-caption font-semibold text-muted-foreground">Question {question.order}</p><Badge>{question.type === 'SPR' ? 'Student-produced response' : 'Multiple choice'}</Badge></div>{question.blocks?.length > 0 && <BlockRenderer blocks={question.blocks} subject={test.subject} readOnly variant="preview" />}<QuestionText text={question.questionText} math={test.subject === 'MATH'} />{question.type === 'MCQ' && <div className="mt-4 grid gap-2">{question.choices.map(choice => <div key={choice.id} className={`flex gap-3 rounded-control border px-3 py-2.5 text-body ${choice.id === question.correctAnswer ? 'border-success/30 bg-success-soft' : 'border-ui-border bg-surface'}`}><span className="font-semibold">{choice.id}</span><QuestionText text={choice.text} math={test.subject === 'MATH'} /></div>)}</div>}{question.type === 'SPR' && <p className="mt-4 rounded-control border border-ui-border bg-muted p-3 text-body">Answer: <span className="font-semibold">{question.correctAnswer}</span></p>}</article>)}</div></Card>)}</div>;
}

function QuestionText({ text, math }: { text: string; math: boolean }) { return math ? <FormattedTextRenderer text={text} inheritTypography latexOnly /> : <p className="whitespace-pre-wrap text-body leading-6 text-foreground">{text}</p>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-surface p-4"><p className="text-caption text-muted-foreground">{label}</p><p className="mt-1 text-body font-medium text-foreground">{value}</p></div>; }
function StatusBadge({ status }: { status: TestStatus }) { return <Badge className="gap-1.5 px-1.5 text-muted-foreground">{status === 'PUBLISHED' ? <Check size={13} /> : status === 'DRAFT' ? <FilePenLine size={13} /> : <Archive size={13} />}{statusLabel[status]}</Badge>; }
const formatDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Unknown' : format(date, 'MMM d, yyyy · HH:mm'); };
const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
