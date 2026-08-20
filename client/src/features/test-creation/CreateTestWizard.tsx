import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardPaste,
  FileText,
  LoaderCircle,
  Save,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import BlockRenderer from '../../components/content/BlockRenderer';
import { AppHeader, Badge, Button, Card, Input, Select } from '../../components/ui/AppUI';
import { ui } from '../../components/ui/styles';
import type { ContentBlock } from '../../types/quiz';

type Subject = 'RW' | 'MATH';
type TestMode = 'PRACTICE' | 'EXAM';
type Step = 'SETUP' | 'IMPORT' | 'REVIEW';
type IssueSeverity = 'error' | 'warning';

interface TaxonomySkill { code: string; name: string; sortOrder: number }
interface TaxonomyDomain { code: string; name: string; subject: Subject; sortOrder: number; skills: TaxonomySkill[] }
interface ImportIssue { severity: IssueSeverity; code: string; message: string }
interface ImportChoice { id: string; text: string }
interface ImportQuestion {
  clientId: string;
  module: number;
  order: number;
  type: 'MCQ' | 'SPR';
  blocks: ContentBlock[];
  questionText: string;
  choices: ImportChoice[];
  correctAnswer: string;
  explanation?: string;
  domainCode: string;
  skillCode: string;
  issues: ImportIssue[];
}
interface ImportModule { order: number; name: string; questions: ImportQuestion[] }
interface ImportPreview {
  fileName?: string;
  modules: ImportModule[];
  summary: { questionCount: number; classifiedCount: number; errorCount: number; warningCount: number };
  issues: ImportIssue[];
}

const steps: Array<{ key: Step; label: string }> = [
  { key: 'SETUP', label: 'Setup' },
  { key: 'IMPORT', label: 'Import' },
  { key: 'REVIEW', label: 'Review' },
];

const emptyPreview = (): ImportPreview => ({
  modules: [],
  summary: { questionCount: 0, classifiedCount: 0, errorCount: 0, warningCount: 0 },
  issues: [],
});

const fileTitle = (fileName: string) => fileName
  .replace(/\.[^/.]+$/, '')
  .replace(/[._-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^./, character => character.toLocaleUpperCase());

const requestErrorMessage = (error: unknown, fallback: string) => {
  const response = (error as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error || fallback;
};

const reviewIssues = (question: ImportQuestion, taxonomy: TaxonomyDomain[]): ImportIssue[] => {
  const issues = question.issues.filter(item => ![
    'MISSING_QUESTION_TEXT', 'MISSING_ANSWER', 'MISSING_DOMAIN', 'MISSING_SKILL', 'MISSING_CHOICES', 'ANSWER_NOT_IN_CHOICES',
  ].includes(item.code));
  const domain = taxonomy.find(item => item.code === question.domainCode);
  const skill = domain?.skills.find(item => item.code === question.skillCode);

  if (!question.questionText.trim()) issues.push({ severity: 'error', code: 'MISSING_QUESTION_TEXT', message: 'Question text is missing.' });
  if (!question.correctAnswer.trim()) issues.push({ severity: 'error', code: 'MISSING_ANSWER', message: 'Correct answer is missing.' });
  if (!domain) issues.push({ severity: 'error', code: 'MISSING_DOMAIN', message: 'Choose a content domain.' });
  if (!skill) issues.push({ severity: 'error', code: 'MISSING_SKILL', message: 'Choose a skill that belongs to the content domain.' });
  if (question.type === 'MCQ' && question.choices.length < 2) issues.push({ severity: 'error', code: 'MISSING_CHOICES', message: 'Multiple-choice questions need answer choices.' });
  if (question.type === 'MCQ' && question.correctAnswer && !question.choices.some(choice => choice.id === question.correctAnswer.toUpperCase())) {
    issues.push({ severity: 'error', code: 'ANSWER_NOT_IN_CHOICES', message: 'Correct answer does not match any answer choice.' });
  }
  return issues;
};

const reviewPreview = (preview: ImportPreview, taxonomy: TaxonomyDomain[]): ImportPreview => {
  const modules = preview.modules.map(module => ({
    ...module,
    questions: module.questions.map(question => ({ ...question, issues: reviewIssues(question, taxonomy) })),
  }));
  const allIssues = [...preview.issues, ...modules.flatMap(module => module.questions.flatMap(question => question.issues))];
  const questions = modules.flatMap(module => module.questions);
  return {
    ...preview,
    modules,
    summary: {
      questionCount: questions.length,
      classifiedCount: questions.filter(question => question.domainCode && question.skillCode).length,
      errorCount: allIssues.filter(item => item.severity === 'error').length,
      warningCount: allIssues.filter(item => item.severity === 'warning').length,
    },
  };
};

const CreateTestWizard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('SETUP');
  const [form, setForm] = useState({
    title: '',
    subject: 'RW' as Subject,
    duration: 64,
    moduleCount: 2,
    mode: 'PRACTICE' as TestMode,
    category: 'PRACTICE',
    testDate: '',
  });
  const [taxonomy, setTaxonomy] = useState<TaxonomyDomain[]>([]);
  const [preview, setPreview] = useState<ImportPreview>(emptyPreview);
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [rawText, setRawText] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [importError, setImportError] = useState('');
  const userRole = localStorage.getItem('userRole') || 'TEACHER';
  const folderIdParam = searchParams.get('folderId');
  const folderId = folderIdParam ? Number(folderIdParam) : undefined;

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const response = await axiosClient.get<TaxonomyDomain[], TaxonomyDomain[]>(`/api/tests/taxonomy?subject=${form.subject}`);
        setTaxonomy(response);
      } catch (error) {
        console.error(error);
        toast.error('Unable to load the SAT content taxonomy');
      }
    };
    void loadTaxonomy();
  }, [form.subject]);

  useEffect(() => {
    if (taxonomy.length > 0) setPreview(current => current.modules.length ? reviewPreview(current, taxonomy) : current);
  }, [taxonomy]);

  const questions = useMemo(() => preview.modules.flatMap(module => module.questions), [preview]);
  const selectedQuestion = questions.find(question => question.clientId === selectedQuestionId) || questions[0] || null;
  const selectedDomain = taxonomy.find(domain => domain.code === selectedQuestion?.domainCode);
  const blockingErrors = preview.summary.errorCount > 0 || preview.summary.questionCount === 0;

  useEffect(() => {
    if (selectedQuestion && selectedQuestion.clientId !== selectedQuestionId) setSelectedQuestionId(selectedQuestion.clientId);
  }, [selectedQuestion, selectedQuestionId]);

  const applyPreview = (nextPreview: ImportPreview) => {
    const reviewed = reviewPreview(nextPreview, taxonomy);
    setPreview(reviewed);
    const firstQuestion = reviewed.modules[0]?.questions[0];
    if (firstQuestion) setSelectedQuestionId(firstQuestion.clientId);
  };

  const updateQuestion = (clientId: string, updater: (question: ImportQuestion) => ImportQuestion) => {
    setPreview(current => reviewPreview({
      ...current,
      modules: current.modules.map(module => ({
        ...module,
        questions: module.questions.map(question => question.clientId === clientId ? updater(question) : question),
      })),
    }, taxonomy));
  };

  const handleSetupNext = () => {
    if (!form.title.trim()) return toast.error('Enter a test name');
    if (!Number.isFinite(form.duration) || form.duration < 1) return toast.error('Enter a valid duration');
    setStep('IMPORT');
  };

  const parseFile = async (file: File) => {
    setIsParsing(true);
    setImportError('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('subject', form.subject);
      body.append('moduleCount', String(form.moduleCount));
      const response = await axiosClient.post<ImportPreview, ImportPreview>('/api/test-imports/preview', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (!form.title.trim()) setForm(current => ({ ...current, title: fileTitle(file.name) }));
      applyPreview(response);
      setStep('REVIEW');
      toast.success('Document parsed. Review the questions before saving.');
    } catch (error: unknown) {
      console.error(error);
      const message = requestErrorMessage(error, 'Unable to parse this document.');
      setImportError(message);
      toast.error(message);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const parsePastedText = async () => {
    if (!rawText.trim()) return toast.error('Paste test content before previewing it');
    setIsParsing(true);
    setImportError('');
    try {
      const response = await axiosClient.post<ImportPreview, ImportPreview>('/api/test-imports/preview-text', {
        text: rawText,
        subject: form.subject,
        moduleCount: form.moduleCount,
      });
      applyPreview(response);
      setStep('REVIEW');
      toast.success('Text parsed. Review the questions before saving.');
    } catch (error: unknown) {
      const message = requestErrorMessage(error, 'Unable to parse the supplied text.');
      setImportError(message);
      toast.error(message);
    } finally {
      setIsParsing(false);
    }
  };

  const saveTest = async () => {
    if (blockingErrors) return toast.error('Resolve all errors before creating the exam');
    setIsSaving(true);
    try {
      const moduleDuration = Math.max(1, Math.floor(form.duration / Math.max(1, preview.modules.length)));
      await axiosClient.post('/api/tests/create', {
        title: form.title.trim(),
        subject: form.subject,
        duration: Number(form.duration),
        mode: form.mode,
        category: userRole === 'ADMIN' ? form.category : 'CLASS',
        testDate: userRole === 'ADMIN' && form.category === 'REAL' ? form.testDate || undefined : undefined,
        folderId,
        sections: preview.modules.map(module => ({
          name: module.name,
          order: module.order,
          duration: moduleDuration,
          questions: module.questions.map(question => ({
            type: question.type,
            blocks: question.blocks,
            questionText: question.questionText,
            choices: question.choices,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            domainCode: question.domainCode,
            skillCode: question.skillCode,
          })),
        })),
      });
      toast.success('Exam created. Assign it from Practice Center when you are ready.');
      navigate('/dashboard/practice-test');
    } catch (error: unknown) {
      console.error(error);
      toast.error(requestErrorMessage(error, 'Unable to create the exam'));
    } finally {
      setIsSaving(false);
    }
  };

  const selectedIndex = questions.findIndex(question => question.clientId === selectedQuestion?.clientId);
  const moveQuestion = (direction: -1 | 1) => {
    const next = questions[selectedIndex + direction];
    if (next) setSelectedQuestionId(next.clientId);
  };

  return (
    <div className={ui.page}>
      <AppHeader
        title="Create Exam"
        subtitle="Import, review, and organize SAT questions"
        rightContent={step === 'REVIEW' ? <Button size="sm" disabled={blockingErrors || isSaving} onClick={saveTest}><Save size={15} />{isSaving ? 'Creating…' : 'Create exam'}</Button> : undefined}
      />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={`${ui.content} flex min-h-full flex-col gap-6`}>
          <div className="flex items-center gap-2" aria-label="Create exam progress">
            {steps.map((item, index) => {
              const active = item.key === step;
              const complete = steps.findIndex(stepItem => stepItem.key === step) > index;
              return <div key={item.key} className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-semibold ${active || complete ? 'border-[#1B7A5A] bg-[#E8F5EF] text-[#145F47]' : 'border-[#E2EDE9] bg-white text-[#6B7280]'}`}>{complete ? <CheckCircle2 size={15} /> : index + 1}</span><span className={`text-xs font-medium ${active ? 'text-[#1A1A1A]' : 'text-[#6B7280]'}`}>{item.label}</span>{index < steps.length - 1 && <span className="h-px w-7 bg-[#C2DDD4]" />}</div>;
            })}
          </div>

          {step === 'SETUP' && (
            <Card className="mx-auto w-full max-w-3xl p-6 lg:p-8">
              <div className="mb-6"><h2 className="text-lg font-semibold text-[#1A1A1A]">Test details</h2><p className="mt-1 text-sm text-[#6B7280]">Set up the exam before importing its questions.</p></div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Test name" className="md:col-span-2"><Input className="w-full" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="e.g. SAT Reading Practice Test 1" autoFocus /></Field>
                <Field label="Subject"><Select className="w-full" value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value as Subject }))}><option value="RW">Reading & Writing</option><option value="MATH">Math</option></Select></Field>
                <Field label="Duration (minutes)"><Input className="w-full" type="number" min={1} value={form.duration} onChange={event => setForm(current => ({ ...current, duration: Number(event.target.value) }))} /></Field>
                <Field label="Modules"><Select className="w-full" value={form.moduleCount} onChange={event => setForm(current => ({ ...current, moduleCount: Number(event.target.value) }))}><option value={1}>1 module</option><option value={2}>2 modules</option></Select></Field>
                <Field label="Test mode"><div className="grid grid-cols-2 gap-2"><ModeButton active={form.mode === 'PRACTICE'} icon={<FileText size={16} />} title="Practice" text="Flexible practice" onClick={() => setForm(current => ({ ...current, mode: 'PRACTICE' }))} /><ModeButton active={form.mode === 'EXAM'} icon={<ShieldCheck size={16} />} title="Secure exam" text="Timed exam rules" onClick={() => setForm(current => ({ ...current, mode: 'EXAM' }))} /></div></Field>
                {userRole === 'ADMIN' && <Field label="Publication" className="md:col-span-2"><div className="flex flex-wrap items-center gap-3"><Select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value, testDate: event.target.value === 'REAL' ? current.testDate : '' }))}><option value="PRACTICE">Practice</option><option value="REAL">Official</option></Select>{form.category === 'REAL' && <Input type="date" value={form.testDate} onChange={event => setForm(current => ({ ...current, testDate: event.target.value }))} />}</div></Field>}
              </div>
              <div className="mt-8 flex justify-end"><Button onClick={handleSetupNext}>Continue <ArrowRight size={16} /></Button></div>
            </Card>
          )}

          {step === 'IMPORT' && (
            <div className="mx-auto w-full max-w-3xl space-y-4">
              <Card className="p-6 lg:p-8">
                <div className="flex flex-col items-center rounded-xl border border-dashed border-[#C2DDD4] bg-[#F2F8F5] px-6 py-12 text-center">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#1B7A5A] text-white"><UploadCloud size={21} /></div>
                  <h2 className="text-lg font-semibold text-[#1A1A1A]">Upload test file</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#6B7280]">Import a searchable PDF, DOCX, or TXT file. The parser runs on our server and does not use AI.</p>
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void parseFile(file); }} />
                  <Button className="mt-5" disabled={isParsing} onClick={() => fileInputRef.current?.click()}>{isParsing ? <LoaderCircle size={16} className="animate-spin" /> : <UploadCloud size={16} />}{isParsing ? 'Parsing document…' : 'Choose file'}</Button>
                  <p className="mt-3 text-xs text-[#6B7280]">Maximum 15 MB · Scanned PDFs must be converted to searchable PDFs first.</p>
                </div>
                {importError && <ImportNotice tone="error" message={importError} />}
              </Card>

              <Card className="p-5">
                <button onClick={() => setPasteOpen(open => !open)} className="flex w-full items-center justify-between text-left"><span><span className="flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]"><ClipboardPaste size={17} className="text-[#1B7A5A]" />Paste structured text</span><span className="mt-1 block text-xs text-[#6B7280]">Use MODULE, QUESTION, Domain, Skill, and Answer labels for the most accurate import.</span></span><ChevronRight size={17} className={`text-[#6B7280] transition-transform ${pasteOpen ? 'rotate-90' : ''}`} /></button>
                {pasteOpen && <div className="mt-4 border-t border-[#E2EDE9] pt-4"><textarea value={rawText} onChange={event => setRawText(event.target.value)} className="min-h-56 w-full rounded-lg border border-[#E2EDE9] bg-white p-3 font-mono text-sm text-[#1A1A1A] outline-none focus:border-[#1B7A5A] focus:ring-2 focus:ring-[#1B7A5A]/20" placeholder="=== MODULE 1 ===&#10;&#10;QUESTION 1&#10;Domain: Information and Ideas&#10;Skill: Inferences&#10;…" /><div className="mt-3 flex justify-end"><Button disabled={isParsing} onClick={() => void parsePastedText()}>{isParsing ? <LoaderCircle size={16} className="animate-spin" /> : <ClipboardPaste size={16} />}Preview text</Button></div></div>}
              </Card>
              <div className="flex"><Button variant="ghost" onClick={() => setStep('SETUP')}><ArrowLeft size={16} />Back</Button></div>
            </div>
          )}

          {step === 'REVIEW' && (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-xs text-[#6B7280]"><span className="font-medium text-[#1A1A1A]">{preview.fileName || 'Pasted content'}</span><span>{preview.summary.questionCount} questions</span><span>{preview.summary.classifiedCount} classified</span><span className={preview.summary.errorCount ? 'font-semibold text-red-700' : 'text-[#1B7A5A]'}>{preview.summary.errorCount} errors</span><span className={preview.summary.warningCount ? 'font-medium text-amber-700' : ''}>{preview.summary.warningCount} warnings</span></Card>
              {preview.issues.map((item, index) => <ImportNotice key={`${item.code}-${index}`} tone={item.severity} message={item.message} />)}
              <div className="grid min-h-[620px] grid-cols-1 overflow-hidden rounded-xl border border-[#E2EDE9] bg-white lg:grid-cols-[220px_minmax(0,1fr)_280px]">
                <aside className="border-b border-[#E2EDE9] bg-[#F9FCFA] p-3 lg:border-b-0 lg:border-r"><p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">Questions</p><div className="flex max-h-44 gap-1 overflow-x-auto lg:max-h-none lg:flex-col lg:overflow-y-auto">{preview.modules.map(module => <div key={module.order}><p className="mb-1 mt-2 px-2 text-[10px] font-medium text-[#6B7280]">{module.name}</p>{module.questions.map(question => <button key={question.clientId} onClick={() => setSelectedQuestionId(question.clientId)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${selectedQuestion?.clientId === question.clientId ? 'bg-[#E8F5EF] font-medium text-[#145F47]' : 'text-[#4B5563] hover:bg-[#EAF2EE]'}`}><StatusIcon issues={question.issues} /><span className="whitespace-nowrap">Q{question.order}</span><span className="hidden truncate lg:block">{question.domainCode ? 'Classified' : 'Needs review'}</span></button>)}</div>)}</div></aside>
                <section className="min-w-0 border-b border-[#E2E9ED] p-5 lg:border-b-0 lg:border-r lg:p-6">{selectedQuestion ? <QuestionPreview question={selectedQuestion} subject={form.subject} /> : <div className="flex h-full items-center justify-center text-sm text-[#6B7280]">Select a question to review.</div>}</section>
                <aside className="min-w-0 bg-[#F9FCFA] p-5">{selectedQuestion ? <QuestionEditor question={selectedQuestion} domain={selectedDomain} taxonomy={taxonomy} onChange={updateQuestion} /> : null}</aside>
              </div>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => moveQuestion(-1)} disabled={selectedIndex <= 0}><ChevronLeft size={16} />Previous</Button><Button variant="ghost" size="sm" onClick={() => moveQuestion(1)} disabled={selectedIndex < 0 || selectedIndex >= questions.length - 1}>Next<ChevronRight size={16} /></Button></div><div className="flex items-center justify-end gap-2"><Button variant="outline" onClick={() => setStep('IMPORT')}>Replace import</Button><Button disabled={blockingErrors || isSaving} onClick={saveTest}><Save size={16} />{isSaving ? 'Creating…' : 'Create exam'}</Button></div></Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-medium text-[#1A1A1A]">{label}</span>{children}</label>;
}

function ModeButton({ active, icon, title, text, onClick }: { active: boolean; icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-h-20 items-start gap-2 rounded-lg border p-3 text-left transition-colors ${active ? 'border-[#1B7A5A] bg-[#E8F5EF] text-[#145F47]' : 'border-[#E2EDE9] bg-white text-[#6B7280] hover:bg-[#F2F8F5]'}`}><span className="mt-0.5">{icon}</span><span><span className="block text-xs font-semibold">{title}</span><span className="mt-1 block text-[11px] leading-4">{text}</span></span></button>;
}

function ImportNotice({ tone, message }: { tone: IssueSeverity; message: string }) {
  const warning = tone === 'warning';
  return <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${warning ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-800'}`}><CircleAlert size={17} className="mt-0.5 shrink-0" /><span>{message}</span></div>;
}

function StatusIcon({ issues }: { issues: ImportIssue[] }) {
  const hasError = issues.some(item => item.severity === 'error');
  const hasWarning = issues.some(item => item.severity === 'warning');
  if (hasError) return <CircleAlert size={14} className="shrink-0 text-red-600" aria-label="Has errors" />;
  if (hasWarning) return <CircleAlert size={14} className="shrink-0 text-amber-600" aria-label="Has warnings" />;
  return <CheckCircle2 size={14} className="shrink-0 text-[#1B7A5A]" aria-label="Ready" />;
}

function QuestionPreview({ question, subject }: { question: ImportQuestion; subject: Subject }) {
  const usableBlocks = question.blocks.filter(block => block.type !== 'image' || block.src);
  return <div><div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-medium text-[#6B7280]">Module {question.module} · Question {question.order}</p><h2 className="mt-1 text-lg font-semibold text-[#1A1A1A]">Question preview</h2></div><Badge tone={question.type === 'SPR' ? 'gold' : 'green'}>{question.type === 'SPR' ? 'Student-produced response' : 'Multiple choice'}</Badge></div>{usableBlocks.length > 0 && <div className="mb-5"><BlockRenderer blocks={usableBlocks} subject={subject} readOnly /></div>}<p className="whitespace-pre-wrap text-sm leading-7 text-[#1A1A1A]">{question.questionText || 'Question text is missing.'}</p>{question.type === 'MCQ' && <div className="mt-6 space-y-2">{question.choices.map(choice => <div key={choice.id} className="flex gap-3 rounded-lg border border-[#E2EDE9] px-3 py-2.5 text-sm text-[#374151]"><span className="font-semibold text-[#145F47]">{choice.id}</span><span className="whitespace-pre-wrap">{choice.text}</span></div>)}</div>}{question.type === 'SPR' && <div className="mt-6 rounded-lg border border-dashed border-[#C2DDD4] bg-[#F2F8F5] p-3 text-sm text-[#6B7280]">Student-produced response</div>}</div>;
}

function QuestionEditor({ question, domain, taxonomy, onChange }: { question: ImportQuestion; domain?: TaxonomyDomain; taxonomy: TaxonomyDomain[]; onChange: (id: string, updater: (question: ImportQuestion) => ImportQuestion) => void }) {
  const update = (patch: Partial<ImportQuestion>) => onChange(question.clientId, current => ({ ...current, ...patch }));
  return <div className="space-y-5"><div><h2 className="text-sm font-semibold text-[#1A1A1A]">Classification</h2><p className="mt-1 text-xs leading-5 text-[#6B7280]">Required for SAT performance analytics.</p></div><Field label="Content domain"><Select className="w-full" value={question.domainCode} onChange={event => update({ domainCode: event.target.value, skillCode: '' })}><option value="">Choose domain</option>{taxonomy.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</Select></Field><Field label="Skill"><Select className="w-full" value={question.skillCode} disabled={!domain} onChange={event => update({ skillCode: event.target.value })}><option value="">Choose skill</option>{domain?.skills.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</Select></Field><div className="border-t border-[#E2EDE9] pt-5"><h2 className="text-sm font-semibold text-[#1A1A1A]">Question details</h2><label className="mt-3 block text-xs font-medium text-[#1A1A1A]">Correct answer</label><Input className="mt-1 w-full" value={question.correctAnswer} onChange={event => update({ correctAnswer: event.target.value.toUpperCase() })} placeholder={question.type === 'MCQ' ? 'A' : 'Answer'} /><label className="mt-4 block text-xs font-medium text-[#1A1A1A]">Explanation <span className="font-normal text-[#6B7280]">(optional)</span></label><textarea className="mt-1 min-h-24 w-full rounded-lg border border-[#E2EDE9] bg-white p-3 text-sm text-[#1A1A1A] outline-none focus:border-[#1B7A5A] focus:ring-2 focus:ring-[#1B7A5A]/20" value={question.explanation || ''} onChange={event => update({ explanation: event.target.value })} /></div>{question.issues.length > 0 && <div className="border-t border-[#E2EDE9] pt-4"><p className="mb-2 text-xs font-semibold text-[#1A1A1A]">Validation</p><div className="space-y-2">{question.issues.map(item => <ImportNotice key={item.code} tone={item.severity} message={item.message} />)}</div></div>}</div>;
}

export default CreateTestWizard;
