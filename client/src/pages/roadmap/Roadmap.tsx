import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { BookOpen, Check, ChevronRight, LockKeyhole, Map, Plus, Shuffle, Target } from 'lucide-react';
import axiosClient from '@/lib/axios';
import { updateStoredAuthUser } from '@/lib/authSession';
import { appToast } from '@/components/ui/toast';
import { Badge, Card, EmptyState, Modal, PageHeader } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { TaxonomyDomain } from '@/features/test-creation/create-test.types';
import type { BankQuestion } from '@/features/question-bank/question-bank.types';
import { useDashboardBack } from '@/features/navigation/DashboardBackContext';
import type { MilestoneQuestionPage, Roadmap as RoadmapData, RoadmapMilestone } from './roadmap.types';

const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

export default function Roadmap() {
  const [cachedRole] = useState<'STUDENT' | 'ADMIN'>(() => localStorage.getItem('userRole') === 'ADMIN' ? 'ADMIN' : 'STUDENT');
  const [role, setRole] = useState<'STUDENT' | 'ADMIN' | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void axiosClient.get<{ role: string }, { role: string }>('/api/account/profile', { signal: controller.signal })
      .then(profile => {
        if (controller.signal.aborted) return;
        const authoritativeRole = profile.role === 'ADMIN' ? 'ADMIN' : 'STUDENT';
        updateStoredAuthUser({ role: authoritativeRole });
        setRole(authoritativeRole);
      })
      .catch(() => { if (!controller.signal.aborted) setRole(cachedRole); });
    return () => controller.abort();
  }, [cachedRole]);
  if (!role) return <LoadingState className="h-full" label="Loading roadmap…" />;
  if (role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <AdminRoadmap />;
}

function AdminRoadmap() {
  const [roadmaps, setRoadmaps] = useState<RoadmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [roadmapModal, setRoadmapModal] = useState(false);
  const [milestoneModal, setMilestoneModal] = useState(false);
  const [roadmapTitle, setRoadmapTitle] = useState('');
  const [roadmapDescription, setRoadmapDescription] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [theory, setTheory] = useState('');
  const [requiredCount, setRequiredCount] = useState(10);
  const [skillCodes, setSkillCodes] = useState<string[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyDomain[]>([]);
  const [saving, setSaving] = useState(false);
  const active = roadmaps[0] || null;
  const load = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get<RoadmapData[], RoadmapData[]>('/api/roadmaps');
      setRoadmaps(Array.isArray(response) ? response : []);
    }
    catch (error) { appToast.error(errorMessage(error, 'Unable to load roadmaps.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    void Promise.all([
      axiosClient.get<TaxonomyDomain[], TaxonomyDomain[]>('/api/tests/taxonomy?subject=RW'),
      axiosClient.get<TaxonomyDomain[], TaxonomyDomain[]>('/api/tests/taxonomy?subject=MATH'),
    ]).then(([rw, math]) => setTaxonomy([...rw, ...math])).catch(() => setTaxonomy([]));
  }, []);
  const createRoadmap = async () => {
    setSaving(true);
    try {
      await axiosClient.post('/api/roadmaps', { title: roadmapTitle, description: roadmapDescription });
      setRoadmapModal(false); setRoadmapTitle(''); setRoadmapDescription(''); await load(); appToast.success('Roadmap created');
    } catch (error) { appToast.error(errorMessage(error, 'Unable to create the roadmap.')); }
    finally { setSaving(false); }
  };
  const createMilestone = async () => {
    if (!active) return;
    setSaving(true);
    try {
      await axiosClient.post(`/api/roadmaps/${active.id}/milestones`, {
        title: milestoneTitle, description: milestoneDescription, theoryBlocks: [{ type: 'text', content: theory }],
        requiredQuestionCount: requiredCount, skillCodes,
      });
      setMilestoneModal(false); setMilestoneTitle(''); setMilestoneDescription(''); setTheory(''); setRequiredCount(10); setSkillCodes([]); await load(); appToast.success('Milestone added');
    } catch (error) { appToast.error(errorMessage(error, 'Unable to create the milestone.')); }
    finally { setSaving(false); }
  };
  const publish = async () => {
    if (!active) return;
    setSaving(true);
    try { await axiosClient.post(`/api/roadmaps/${active.id}/publish`); await load(); appToast.success('Roadmap published'); }
    catch (error) { appToast.error(errorMessage(error, 'Unable to publish the roadmap.')); }
    finally { setSaving(false); }
  };
  if (loading) return <LoadingState className="h-full" label="Loading roadmap builder…" />;
  return <div className="h-full overflow-y-auto"><main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
    <PageHeader title="Roadmap Builder" description="Publish one ordered learning path backed by System Question Bank skills." actions={<><Button variant="outline" onClick={() => setRoadmapModal(true)}><Plus aria-hidden="true" />New roadmap</Button>{active && <Button disabled={saving || active.status === 'PUBLISHED'} onClick={() => void publish()}>{active.status === 'PUBLISHED' ? 'Published' : 'Publish roadmap'}</Button>}</>} />
    {!active ? <EmptyState icon={<Map aria-hidden="true" />} title="No roadmap yet" description="Create the first admin-managed learning path." action={<Button onClick={() => setRoadmapModal(true)}>Create roadmap</Button>} /> : <>
      <Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="text-heading font-semibold text-foreground">{active.title}</h2><Badge tone={active.status === 'PUBLISHED' ? 'success' : active.status === 'ARCHIVED' ? 'neutral' : 'warning'}>{active.status?.toLowerCase()}</Badge></div>{active.description && <p className="mt-2 text-body text-muted-foreground">{active.description}</p>}</div><Button variant="outline" onClick={() => setMilestoneModal(true)}><Plus aria-hidden="true" />Add milestone</Button></div></Card>
      <section className="space-y-3" aria-label="Roadmap milestones">{active.milestones.length ? active.milestones.map((milestone, index) => <Card key={milestone.id} className="p-5"><div className="flex gap-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-body font-semibold">{index + 1}</span><div className="min-w-0 flex-1"><h3 className="text-title font-semibold text-foreground">{milestone.title}</h3>{milestone.description && <p className="mt-1 text-body text-muted-foreground">{milestone.description}</p>}<div className="mt-3 flex flex-wrap gap-2">{milestone.skills.map(skill => <Badge key={skill.code} tone="neutral">{skill.name}</Badge>)}</div><p className="mt-3 text-caption text-muted-foreground">Completion: answer {milestone.requiredQuestionCount} distinct questions</p></div></div></Card>) : <EmptyState title="No milestones" description="Add theory and select the skills that define this milestone's practice pool." />}</section>
    </>}
    <Modal open={roadmapModal} onClose={() => setRoadmapModal(false)} presentation="content-dialog" title="New roadmap" subtitle="Roadmaps remain private until published." footer={<><Button variant="outline" onClick={() => setRoadmapModal(false)}>Cancel</Button><Button disabled={saving} onClick={() => void createRoadmap()}>{saving ? 'Creating…' : 'Create roadmap'}</Button></>}><div className="space-y-4"><Field><FieldLabel>Title</FieldLabel><Input value={roadmapTitle} onChange={event => setRoadmapTitle(event.target.value)} /></Field><Field><FieldLabel>Description <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Textarea value={roadmapDescription} onChange={event => setRoadmapDescription(event.target.value)} /></Field></div></Modal>
    <Modal open={milestoneModal} onClose={() => setMilestoneModal(false)} presentation="content-dialog" title="Add milestone" subtitle="Every published System question matching the selected skills becomes practice content." className="max-w-3xl!" footer={<><Button variant="outline" onClick={() => setMilestoneModal(false)}>Cancel</Button><Button disabled={saving} onClick={() => void createMilestone()}>{saving ? 'Adding…' : 'Add milestone'}</Button></>}><div className="max-h-[68vh] space-y-5 overflow-y-auto pr-1"><Field><FieldLabel>Title</FieldLabel><Input value={milestoneTitle} onChange={event => setMilestoneTitle(event.target.value)} /></Field><Field><FieldLabel>Description <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Input value={milestoneDescription} onChange={event => setMilestoneDescription(event.target.value)} /></Field><Field><FieldLabel>Theory</FieldLabel><Textarea className="min-h-40" value={theory} onChange={event => setTheory(event.target.value)} /></Field><Field><FieldLabel>Questions required</FieldLabel><Input type="number" min={1} max={200} value={requiredCount} onChange={event => setRequiredCount(Number(event.target.value))} /></Field><Field><FieldLabel>Practice skills</FieldLabel><div className="space-y-4 rounded-card border border-ui-border p-4">{taxonomy.map(domain => <div key={domain.code}><p className="text-body font-medium text-foreground">{domain.name}</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{domain.skills.map(skill => <label key={skill.code} className="flex items-center gap-2 text-body text-foreground"><Checkbox checked={skillCodes.includes(skill.code)} onCheckedChange={checked => setSkillCodes(current => checked ? [...current, skill.code] : current.filter(code => code !== skill.code))} />{skill.name}</label>)}</div></div>)}</div></Field></div></Modal>
  </main></div>;
}

export function StudentRoadmap() {
  const navigate = useNavigate();
  const [roadmap, setRoadmap] = useState<RoadmapData | null | undefined>(undefined);
  const [selected, setSelected] = useState<RoadmapMilestone | null>(null);
  const [questions, setQuestions] = useState<MilestoneQuestionPage | null>(null);
  const [questionPage, setQuestionPage] = useState(1);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, { solutionLocked: boolean; isCorrect?: boolean; correctAnswer?: string; explanation?: string | null }>>({});
  const [randomOpen, setRandomOpen] = useState(false);
  const [randomSubject, setRandomSubject] = useState<'RW' | 'MATH'>('RW');
  const [randomCount, setRandomCount] = useState(10);
  const [creatingRandom, setCreatingRandom] = useState(false);
  const load = async () => {
    try {
      const response = await axiosClient.get<RoadmapData | null, RoadmapData | null>('/api/roadmaps');
      const nextRoadmap = response && !Array.isArray(response)
        ? { ...response, milestones: Array.isArray(response.milestones) ? response.milestones : [] }
        : null;
      setRoadmap(nextRoadmap);
      setSelected(current => current ? nextRoadmap?.milestones.find(milestone => milestone.id === current.id) || current : null);
    }
    catch (error) { appToast.error(errorMessage(error, 'Unable to load your roadmap.')); setRoadmap(null); }
  };
  useEffect(() => { void load(); }, []);
  const loadQuestions = async (milestone: RoadmapMilestone, page = 1) => {
    setSelected(milestone); setQuestionPage(page); setLoadingQuestions(true);
    try { setQuestions(await axiosClient.get<MilestoneQuestionPage, MilestoneQuestionPage>(`/api/roadmaps/milestones/${milestone.id}/questions?page=${page}&limit=20`)); }
    catch (error) { appToast.error(errorMessage(error, 'Unable to load milestone practice.')); }
    finally { setLoadingQuestions(false); }
  };
  const confirmTheory = async () => {
    if (!selected) return;
    try { await axiosClient.post(`/api/roadmaps/milestones/${selected.id}/confirm-theory`); appToast.success('Theory marked as reviewed'); await load(); }
    catch (error) { appToast.error(errorMessage(error, 'Unable to save theory progress.')); }
  };
  const submitAnswer = async (question: BankQuestion) => {
    const selectedChoice = answers[question.id];
    if (!selectedChoice || !selected) return;
    try {
      const result = await axiosClient.post<{ solutionLocked: boolean; isCorrect?: boolean; correctAnswer?: string; explanation?: string | null }>(`/api/roadmaps/milestones/${selected.id}/questions/${question.id}/answers`, { selectedChoice });
      setResults(current => ({ ...current, [question.id]: result }));
      await load();
    } catch (error) { appToast.error(errorMessage(error, 'Unable to save this answer.')); }
  };
  const createRandom = async () => {
    setCreatingRandom(true);
    try {
      const quiz = await axiosClient.post<{ id: number }, { id: number }>('/api/question-bank/random-quizzes', { subject: randomSubject, count: randomCount });
      navigate(`/test/${quiz.id}`);
    } catch (error) { appToast.error(errorMessage(error, 'Unable to create a random quiz.')); }
    finally { setCreatingRandom(false); }
  };
  if (roadmap === undefined) return <LoadingState className="h-full" label="Loading your roadmap…" />;
  if (!roadmap) return <div className="h-full overflow-y-auto p-4 md:p-6"><EmptyState icon={<Map aria-hidden="true" />} title="Roadmap coming soon" description="Your learning roadmap has not been published yet." /></div>;
  if (selected) return <MilestoneWorkspace milestone={selected} questions={questions} loading={loadingQuestions} answers={answers} results={results} page={questionPage} onBack={() => { setSelected(null); setQuestions(null); }} onLoadPage={page => void loadQuestions(selected, page)} onAnswerChange={(id, value) => setAnswers(current => ({ ...current, [id]: value }))} onSubmit={question => void submitAnswer(question)} onConfirmTheory={() => void confirmTheory()} />;
  return <div className="h-full overflow-y-auto"><main className="mx-auto w-full max-w-5xl space-y-8 p-4 md:p-6">
    <PageHeader title={roadmap.title} description={roadmap.description || 'Follow the milestones, review the theory, and complete focused practice.'} actions={<Button variant="outline" onClick={() => setRandomOpen(true)}><Shuffle aria-hidden="true" />Create random quiz</Button>} />
    <section className="relative space-y-4" aria-label="Learning milestones">{roadmap.milestones.length === 0 ? <EmptyState icon={<Map aria-hidden="true" />} title="No milestones yet" description="The published roadmap does not contain any milestones." /> : roadmap.milestones.map((milestone, index) => {
      const progress = Math.min(100, Math.round(((milestone.answeredCount || 0) / milestone.requiredQuestionCount) * 100));
      return <Card key={milestone.id} className={`p-5 ${milestone.locked ? 'opacity-70' : ''}`}><div className="flex items-start gap-4"><span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${milestone.completedAt ? 'bg-success-soft text-success' : 'bg-muted text-foreground'}`}>{milestone.completedAt ? <Check aria-hidden="true" /> : milestone.locked ? <LockKeyhole aria-hidden="true" /> : index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-heading font-semibold text-foreground">{milestone.title}</h2>{milestone.description && <p className="mt-1 text-body text-muted-foreground">{milestone.description}</p>}</div><Button variant={milestone.completedAt ? 'outline' : 'default'} disabled={milestone.locked} onClick={() => void loadQuestions(milestone)}>{milestone.completedAt ? 'Practice again' : 'Continue'}<ChevronRight aria-hidden="true" /></Button></div><div className="mt-4"><div className="mb-2 flex justify-between text-caption text-muted-foreground"><span>{milestone.answeredCount || 0} of {milestone.requiredQuestionCount} questions completed</span><span>{progress}%</span></div><Progress value={progress} /></div></div></div></Card>;
    })}</section>
    <Modal open={randomOpen} onClose={() => setRandomOpen(false)} presentation="content-dialog" title="Create a random quiz" subtitle="Only unseen, published System Question Bank questions are selected." footer={<><Button variant="outline" onClick={() => setRandomOpen(false)}>Cancel</Button><Button disabled={creatingRandom} onClick={() => void createRandom()}>{creatingRandom ? 'Creating…' : 'Start quiz'}</Button></>}><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Subject</FieldLabel><Select value={randomSubject} onValueChange={value => setRandomSubject(value as 'RW' | 'MATH')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RW">Reading & Writing</SelectItem><SelectItem value="MATH">Math</SelectItem></SelectContent></Select></Field><Field><FieldLabel>Question count</FieldLabel><Input type="number" min={1} max={40} value={randomCount} onChange={event => setRandomCount(Number(event.target.value))} /></Field></div></Modal>
  </main></div>;
}

function MilestoneWorkspace({ milestone, questions, loading, answers, results, page, onBack, onLoadPage, onAnswerChange, onSubmit, onConfirmTheory }: { milestone: RoadmapMilestone; questions: MilestoneQuestionPage | null; loading: boolean; answers: Record<string, string>; results: Record<string, { solutionLocked: boolean; isCorrect?: boolean; correctAnswer?: string; explanation?: string | null }>; page: number; onBack: () => void; onLoadPage: (page: number) => void; onAnswerChange: (id: string, value: string) => void; onSubmit: (question: BankQuestion) => void; onConfirmTheory: () => void }) {
  useDashboardBack(onBack);
  return <div className="h-full overflow-y-auto"><main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6"><PageHeader title={milestone.title} description={milestone.description || 'Review the theory, then work through the complete practice pool.'} />
    <Card className="p-5"><div className="flex items-start gap-3"><BookOpen className="mt-0.5 text-primary" aria-hidden="true" /><div className="min-w-0 flex-1"><h2 className="text-title font-semibold text-foreground">Theory</h2><div className="mt-3 space-y-3 text-body leading-7 text-foreground">{(milestone.theoryBlocks || []).map((block, index) => <p key={index} className="whitespace-pre-wrap">{block.content}</p>)}</div><Button className="mt-4" variant="outline" onClick={onConfirmTheory}>{milestone.theoryConfirmedAt ? <><Check aria-hidden="true" />Reviewed</> : 'Mark theory as reviewed'}</Button></div></div></Card>
    <section><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-heading font-semibold text-foreground">Practice questions</h2><p className="mt-1 text-caption text-muted-foreground">All published questions matching this milestone's skills.</p></div>{questions && <Badge tone="neutral">{questions.pagination.total} questions</Badge>}</div>
      {loading ? <LoadingState label="Loading practice questions…" /> : !questions?.items.length ? <EmptyState icon={<Target aria-hidden="true" />} title="No practice questions" description="This milestone does not have published questions yet." /> : <div className="space-y-4">{questions.items.map((question, index) => {
        const result = results[question.id];
        return <Card key={question.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Question {(page - 1) * questions.pagination.limit + index + 1}</p><Badge tone="neutral">{question.skill.name}</Badge></div><p className="mt-4 whitespace-pre-wrap text-title font-medium leading-7 text-foreground">{question.questionText}</p>{question.type === 'MCQ' ? <div className="mt-4 grid gap-2">{question.choices.map(choice => <Button key={choice.id} type="button" variant={answers[question.id] === choice.id ? 'secondary' : 'outline'} className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left" onClick={() => onAnswerChange(question.id, choice.id)}><span className="font-semibold">{choice.id}.</span>{choice.text}</Button>)}</div> : <Input className="mt-4" value={answers[question.id] || ''} onChange={event => onAnswerChange(question.id, event.target.value)} placeholder="Enter your answer" />}{result && <div className={`mt-4 rounded-control border p-3 text-body ${result.solutionLocked ? 'border-warning/30 bg-warning-soft' : result.isCorrect ? 'border-success/30 bg-success-soft' : 'border-danger/30 bg-danger-soft'}`}>{result.solutionLocked ? 'Answer review is locked while an assigned quiz using this question is open.' : result.isCorrect ? 'Correct.' : `Not quite. The correct answer is ${result.correctAnswer}.`}{!result.solutionLocked && result.explanation && <p className="mt-2 text-muted-foreground">{result.explanation}</p>}</div>}<div className="mt-4 flex justify-end"><Button disabled={!answers[question.id]} onClick={() => onSubmit(question)}>Check answer</Button></div></Card>;
      })}<div className="flex justify-end gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => onLoadPage(page - 1)}>Previous</Button><Button variant="outline" disabled={page >= questions.pagination.totalPages} onClick={() => onLoadPage(page + 1)}>Next</Button></div></div>}
    </section>
  </main></div>;
}
