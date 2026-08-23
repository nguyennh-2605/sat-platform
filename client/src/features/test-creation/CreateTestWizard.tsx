import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Eye,
  FileText,
  ImagePlus,
  LoaderCircle,
  Save,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import BlockRenderer from '../../components/content/BlockRenderer';
import { AppHeader, Badge, Button, Card, Input, Modal, Select } from '../../components/ui/AppUI';
import { DateTimePicker } from '../../components/ui/DateTimePicker';
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
interface ExtractedDocument { fileName: string; text: string }

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

const importTemplate = `=== MODULE 1 ===

QUESTION 1
Domain: Information and Ideas
Skill: Inferences

[TEXT]
Paste the passage or stimulus here.

[TABLE]
Year\tGroup A\tGroup B
2023\t42\t51
2024\t48\t57

Write the question here.
A. First choice
B. Second choice
C. Third choice
D. Fourth choice
Answer: B
Explanation: Optional explanation

QUESTION 2
Domain: Information and Ideas
Skill: Command of Evidence

Write a student-produced response question here.
Answer: 12.5`;

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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
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
  const [guideOpen, setGuideOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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

  const previewText = async (text = rawText) => {
    if (!text.trim()) return toast.error('Enter or upload test content before previewing it');
    setIsParsing(true);
    setImportError('');
    try {
      const response = await axiosClient.post<ImportPreview, ImportPreview>('/api/test-imports/preview-text', {
        text,
        subject: form.subject,
        moduleCount: form.moduleCount,
      });
      applyPreview(response);
      toast.success('Preview updated');
    } catch (error: unknown) {
      const message = requestErrorMessage(error, 'Unable to parse the supplied text.');
      setImportError(message);
      toast.error(message);
    } finally {
      setIsParsing(false);
    }
  };

  const parseFile = async (file: File) => {
    setIsParsing(true);
    setImportError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const extracted = await axiosClient.post<ExtractedDocument, ExtractedDocument>('/api/test-imports/extract', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setRawText(extracted.text);
      if (!form.title.trim()) setForm(current => ({ ...current, title: fileTitle(extracted.fileName) }));
      const response = await axiosClient.post<ImportPreview, ImportPreview>('/api/test-imports/preview-text', {
        text: extracted.text,
        subject: form.subject,
        moduleCount: form.moduleCount,
      });
      applyPreview({ ...response, fileName: extracted.fileName });
      toast.success('Document loaded into the editor');
    } catch (error: unknown) {
      console.error(error);
      const message = requestErrorMessage(error, 'Unable to read this document.');
      setImportError(message);
      toast.error(message);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const insertAtCursor = (text: string) => {
    const editor = editorRef.current;
    const start = editor?.selectionStart ?? rawText.length;
    const end = editor?.selectionEnd ?? rawText.length;
    const separator = start > 0 && rawText[start - 1] !== '\n' ? '\n\n' : '';
    const insertion = `${separator}[IMG]\n${text}\n`;
    setRawText(current => `${current.slice(0, start)}${insertion}${current.slice(end)}`);
    requestAnimationFrame(() => {
      editor?.focus();
      const cursor = start + insertion.length;
      editor?.setSelectionRange(cursor, cursor);
    });
  };

  const uploadImage = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error('Choose an image smaller than 5 MB');
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_PRESET;
    if (!cloudName || !uploadPreset) return toast.error('Cloudinary upload is not configured');
    setIsUploadingImage(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('upload_preset', uploadPreset);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body });
      if (!response.ok) throw new Error('Image upload failed');
      const data = await response.json() as { secure_url?: string };
      if (!data.secure_url) throw new Error('Image URL is missing');
      insertAtCursor(data.secure_url);
      toast.success('Image URL inserted');
    } catch (error) {
      console.error(error);
      toast.error('Unable to upload this image');
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
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
        centerContent={<WizardStepper step={step} />}
        rightContent={step === 'IMPORT'
          ? <Button variant="outline" size="sm" onClick={() => setGuideOpen(true)}><CircleHelp size={15} />Formatting guide</Button>
          : step === 'REVIEW'
            ? <Button size="sm" disabled={blockingErrors || isSaving} onClick={saveTest}><Save size={15} />{isSaving ? 'Creating…' : 'Create exam'}</Button>
            : undefined}
      />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={`${ui.content} flex min-h-full flex-col gap-6`}>
          {step === 'SETUP' && (
            <Card className="wizard-step-enter mx-auto w-full max-w-3xl p-6 lg:p-8">
              <div className="mb-6"><h2 className="text-lg font-semibold text-[#1A1A1A]">Test details</h2><p className="mt-1 text-sm text-[#6B7280]">Set up the exam before importing its questions.</p></div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Test name" className="md:col-span-2"><Input className="w-full" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="e.g. SAT Reading Practice Test 1" autoFocus /></Field>
                <Field label="Subject"><Select className="w-full" value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value as Subject }))}><option value="RW">Reading & Writing</option><option value="MATH">Math</option></Select></Field>
                <Field label="Duration (minutes)"><Input className="w-full" type="number" min={1} value={form.duration} onChange={event => setForm(current => ({ ...current, duration: Number(event.target.value) }))} /></Field>
                <Field label="Modules"><Select className="w-full" value={form.moduleCount} onChange={event => setForm(current => ({ ...current, moduleCount: Number(event.target.value) }))}><option value={1}>1 module</option><option value={2}>2 modules</option></Select></Field>
                <Field label="Test mode"><div className="grid grid-cols-2 gap-2"><ModeButton active={form.mode === 'PRACTICE'} icon={<FileText size={16} />} title="Practice" text="Flexible practice" onClick={() => setForm(current => ({ ...current, mode: 'PRACTICE' }))} /><ModeButton active={form.mode === 'EXAM'} icon={<ShieldCheck size={16} />} title="Secure exam" text="Timed exam rules" onClick={() => setForm(current => ({ ...current, mode: 'EXAM' }))} /></div></Field>
                {userRole === 'ADMIN' && <Field label="Publication" className="md:col-span-2"><div className="flex flex-wrap items-center gap-3"><Select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value, testDate: event.target.value === 'REAL' ? current.testDate : '' }))}><option value="PRACTICE">Practice</option><option value="REAL">Official</option></Select>{form.category === 'REAL' && <DateTimePicker mode="date" value={form.testDate} onChange={testDate => setForm(current => ({ ...current, testDate }))} placeholder="Choose official test date" ariaLabel="Official test date" className="min-w-56" />}</div></Field>}
              </div>
              <div className="mt-8 flex justify-end"><Button onClick={handleSetupNext}>Continue <ArrowRight size={16} /></Button></div>
            </Card>
          )}

          {step === 'IMPORT' && (
            <div className="wizard-step-enter flex min-h-0 flex-1 flex-col gap-4">
              <Card className="flex min-h-[620px] flex-1 flex-col overflow-hidden !border-[#C9D8D2]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C9D8D2] px-4 py-3">
                  <div><h2 className="text-sm font-semibold text-[#1A1A1A]">Import workspace</h2><p className="mt-0.5 text-xs text-[#6B7280]">Edit structured text and check the parsed result side by side.</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void parseFile(file); }} />
                    <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} />
                    <Button variant="outline" size="sm" disabled={isParsing} onClick={() => fileInputRef.current?.click()}>{isParsing ? <LoaderCircle size={15} className="animate-spin" /> : <UploadCloud size={15} />}Upload file</Button>
                    <Button variant="outline" size="sm" disabled={isUploadingImage} onClick={() => imageInputRef.current?.click()}>{isUploadingImage ? <LoaderCircle size={15} className="animate-spin" /> : <ImagePlus size={15} />}Upload image</Button>
                    <Button size="sm" disabled={isParsing || !rawText.trim()} onClick={() => void previewText()}>{isParsing ? <LoaderCircle size={15} className="animate-spin" /> : <Eye size={15} />}Update preview</Button>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
                  <section className="flex min-h-[520px] min-w-0 flex-col border-b border-[#C9D8D2] lg:border-b-0 lg:border-r">
                    <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#C9D8D2] bg-[#F5FAF7] px-4"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#145F47]">Structured text</span><span className="text-[11px] text-[#5E6B66]">{rawText.length.toLocaleString()} characters</span></div>
                    <textarea ref={editorRef} value={rawText} onChange={event => setRawText(event.target.value)} spellCheck={false} className="min-h-0 flex-1 resize-none bg-white p-4 font-mono text-xs leading-6 text-[#1A1A1A] outline-none placeholder:text-[#9CA3AF] focus:bg-[#FCFEFD]" placeholder={importTemplate} />
                  </section>

                  <section className="flex min-h-[520px] min-w-0 flex-col bg-[#F9FCFA]">
                    <div className="flex h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#C9D8D2] bg-[#F5FAF7] px-4">
                      <div className="flex items-center gap-3 text-[11px] text-[#6B7280]"><span className="font-semibold uppercase tracking-[0.08em] text-[#145F47]">Preview</span>{preview.summary.questionCount > 0 && <><span>{preview.summary.questionCount} questions</span><span className={preview.summary.errorCount ? 'font-semibold text-red-700' : 'text-[#1B7A5A]'}>{preview.summary.errorCount} errors</span></>}</div>
                      {selectedQuestion && <div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQuestion(-1)} disabled={selectedIndex <= 0} aria-label="Previous question"><ChevronLeft size={15} /></Button><span className="min-w-16 text-center text-[11px] font-medium text-[#4B5563]">{selectedIndex + 1} / {questions.length}</span><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQuestion(1)} disabled={selectedIndex >= questions.length - 1} aria-label="Next question"><ChevronRight size={15} /></Button></div>}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-5">
                      {selectedQuestion ? <QuestionPreview question={selectedQuestion} subject={form.subject} /> : <div className="flex h-full min-h-72 flex-col items-center justify-center text-center"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8F5EF] text-[#145F47]"><Eye size={19} /></span><p className="mt-3 text-sm font-medium text-[#1A1A1A]">No preview yet</p><p className="mt-1 max-w-xs text-xs leading-5 text-[#6B7280]">Enter structured text or upload a document, then select Update preview.</p></div>}
                    </div>
                  </section>
                </div>
              </Card>
              {importError && <ImportNotice tone="error" message={importError} />}
              <div className="flex items-center justify-between"><Button variant="ghost" onClick={() => setStep('SETUP')}><ArrowLeft size={16} />Back</Button><Button disabled={preview.summary.questionCount === 0} onClick={() => setStep('REVIEW')}>Continue to review<ArrowRight size={16} /></Button></div>
            </div>
          )}

          {step === 'REVIEW' && (
            <div className="wizard-step-enter flex min-h-0 flex-1 flex-col gap-4">
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
      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} closeOnBackdrop title="Test formatting guide" subtitle="Use the same structure for pasted text and uploaded documents." className="!max-w-6xl !shadow-none">
        <FormattingGuide />
      </Modal>
    </div>
  );
};

function WizardStepper({ step }: { step: Step }) {
  const activeIndex = steps.findIndex(item => item.key === step);
  return <div className="flex items-center gap-1.5" aria-label="Create exam progress">{steps.map((item, index) => {
    const active = item.key === step;
    const complete = activeIndex > index;
    return <div key={item.key} className="flex items-center gap-1.5"><span className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-semibold transition-colors duration-200 ${active || complete ? 'border-[#1B7A5A] bg-[#E8F5EF] text-[#145F47]' : 'border-[#E2EDE9] bg-white text-[#6B7280]'}`}>{complete ? <CheckCircle2 size={14} /> : index + 1}</span><span className={`hidden text-xs font-medium transition-colors duration-200 sm:inline ${active ? 'text-[#1A1A1A]' : 'text-[#6B7280]'}`}>{item.label}</span>{index < steps.length - 1 && <span className={`h-px w-5 transition-colors duration-200 lg:w-8 ${complete ? 'bg-[#1B7A5A]' : 'bg-[#C2DDD4]'}`} />}</div>;
  })}</div>;
}

function FormattingGuide() {
  return <div className="grid max-h-[65vh] gap-6 overflow-y-auto pr-1 md:grid-cols-[0.85fr_1.15fr]">
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#145F47]">Required structure</h3>
      <ol className="mt-3 space-y-2.5 text-xs leading-5 text-[#4B5563]">
        <li><strong className="font-semibold text-[#1A1A1A]">1. Modules:</strong> start with <code className="rounded bg-[#E8F5EF] px-1 py-0.5 text-[#145F47]">=== MODULE 1 ===</code>.</li>
        <li><strong className="font-semibold text-[#1A1A1A]">2. Questions:</strong> start each one with <code className="rounded bg-[#E8F5EF] px-1 py-0.5 text-[#145F47]">QUESTION 1</code>.</li>
        <li><strong className="font-semibold text-[#1A1A1A]">3. Classification:</strong> add one <code className="rounded bg-[#E8F5EF] px-1 py-0.5 text-[#145F47]">Domain:</code> and <code className="rounded bg-[#E8F5EF] px-1 py-0.5 text-[#145F47]">Skill:</code> line.</li>
        <li><strong className="font-semibold text-[#1A1A1A]">4. Answers:</strong> use choices A–D for multiple choice, then add <code className="rounded bg-[#E8F5EF] px-1 py-0.5 text-[#145F47]">Answer: B</code>. For student-produced responses, omit choices and enter the value.</li>
      </ol>
      <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-[#145F47]">Optional content blocks</h3>
      <div className="mt-3 space-y-2 text-xs leading-5 text-[#4B5563]">
        <p><code className="rounded bg-[#E8F5EF] px-1 py-0.5 font-semibold text-[#145F47]">[TEXT]</code> A passage or stimulus. Plain untagged passage text is also accepted.</p>
        <p><code className="rounded bg-[#E8F5EF] px-1 py-0.5 font-semibold text-[#145F47]">[TABLE]</code> Put each row on a new line, separate cells with the <strong className="font-semibold text-[#1A1A1A]">Tab key</strong>, and use the first row as the header.</p>
        <p><code className="rounded bg-[#E8F5EF] px-1 py-0.5 font-semibold text-[#145F47]">[POEM]</code> Put each verse line on its own line.</p>
        <p><code className="rounded bg-[#E8F5EF] px-1 py-0.5 font-semibold text-[#145F47]">[NOTE]</code> Put each supporting fact on a new line, optionally beginning with <code>-</code> or <code>•</code>.</p>
        <p><code className="rounded bg-[#E8F5EF] px-1 py-0.5 font-semibold text-[#145F47]">[IMG]</code> Put a publicly accessible image URL on the following line. The Upload image button inserts this block automatically.</p>
      </div>
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900"><strong className="font-semibold">Uploaded documents:</strong> use selectable text in PDF, DOCX, or TXT format. Scanned image-only PDFs cannot be read.</div>
    </div>
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#145F47]">Example template</h3><button type="button" onClick={() => void navigator.clipboard.writeText(importTemplate).then(() => toast.success('Template copied'))} className="text-xs font-semibold text-[#1B7A5A] hover:text-[#145F47]">Copy template</button></div>
      <pre className="max-h-[56vh] overflow-auto whitespace-pre-wrap rounded-lg border border-[#D5E5DF] bg-[#F9FCFA] p-4 font-mono text-[11px] leading-5 text-[#374151]">{importTemplate}</pre>
    </div>
  </div>;
}

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
  return <div className="font-sans text-[15px] leading-6"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-medium text-[#6B7280]">Module {question.module} · Question {question.order}</p><h2 className="mt-1 text-lg font-semibold text-[#1A1A1A]">Question preview</h2></div><Badge tone={question.type === 'SPR' ? 'gold' : 'green'}>{question.type === 'SPR' ? 'Student-produced response' : 'Multiple choice'}</Badge></div>{usableBlocks.length > 0 && <div className="mb-5"><BlockRenderer blocks={usableBlocks} subject={subject} readOnly variant="preview" /></div>}<p className="whitespace-pre-wrap text-[15px] leading-6 text-[#1A1A1A]">{question.questionText || 'Question text is missing.'}</p>{question.type === 'MCQ' && <div className="mt-6 space-y-2">{question.choices.map(choice => <div key={choice.id} className="flex gap-3 rounded-lg border border-[#C9D8D2] bg-white px-3 py-2.5 text-[15px] leading-6 text-[#374151]"><span className="font-semibold text-[#145F47]">{choice.id}</span><span className="whitespace-pre-wrap">{choice.text}</span></div>)}</div>}{question.type === 'SPR' && <div className="mt-6 rounded-lg border border-dashed border-[#C2DDD4] bg-[#F2F8F5] p-3 text-[15px] leading-6 text-[#6B7280]">Student-produced response</div>}</div>;
}

function QuestionEditor({ question, domain, taxonomy, onChange }: { question: ImportQuestion; domain?: TaxonomyDomain; taxonomy: TaxonomyDomain[]; onChange: (id: string, updater: (question: ImportQuestion) => ImportQuestion) => void }) {
  const update = (patch: Partial<ImportQuestion>) => onChange(question.clientId, current => ({ ...current, ...patch }));
  return <div className="space-y-5"><div><h2 className="text-sm font-semibold text-[#1A1A1A]">Classification</h2><p className="mt-1 text-xs leading-5 text-[#6B7280]">Required for SAT performance analytics.</p></div><Field label="Content domain"><Select className="w-full" value={question.domainCode} onChange={event => update({ domainCode: event.target.value, skillCode: '' })}><option value="">Choose domain</option>{taxonomy.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</Select></Field><Field label="Skill"><Select className="w-full" value={question.skillCode} disabled={!domain} onChange={event => update({ skillCode: event.target.value })}><option value="">Choose skill</option>{domain?.skills.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</Select></Field><div className="border-t border-[#E2EDE9] pt-5"><h2 className="text-sm font-semibold text-[#1A1A1A]">Question details</h2><label className="mt-3 block text-xs font-medium text-[#1A1A1A]">Correct answer</label><Input className="mt-1 w-full" value={question.correctAnswer} onChange={event => update({ correctAnswer: event.target.value.toUpperCase() })} placeholder={question.type === 'MCQ' ? 'A' : 'Answer'} /><label className="mt-4 block text-xs font-medium text-[#1A1A1A]">Explanation <span className="font-normal text-[#6B7280]">(optional)</span></label><textarea className="mt-1 min-h-24 w-full rounded-lg border border-[#E2EDE9] bg-white p-3 text-sm text-[#1A1A1A] outline-none focus:border-[#1B7A5A] focus:ring-2 focus:ring-[#1B7A5A]/20" value={question.explanation || ''} onChange={event => update({ explanation: event.target.value })} /></div>{question.issues.length > 0 && <div className="border-t border-[#E2EDE9] pt-4"><p className="mb-2 text-xs font-semibold text-[#1A1A1A]">Validation</p><div className="space-y-2">{question.issues.map(item => <ImportNotice key={item.code} tone={item.severity} message={item.message} />)}</div></div>}</div>;
}

export default CreateTestWizard;
