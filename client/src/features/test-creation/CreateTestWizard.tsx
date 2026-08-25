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
import katex from 'katex';
import axiosClient from '../../lib/axios';
import BlockRenderer from '../../components/content/BlockRenderer';
import FormattedTextRenderer from '../../components/content/TextRenderer';
import { Badge, Button, Card, Input, Modal, PageHeader, Select } from '../../components/ui/AppUI';
import { DateTimePicker } from '../../components/ui/DateTimePicker';
import { Textarea } from '../../components/ui/textarea';
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
interface EditTestPayload {
  id: number;
  title: string;
  duration: number;
  subject: Subject;
  mode: TestMode;
  category: string;
  testDate?: string | null;
  folderId?: number | null;
  moduleCount: number;
  hasAttempts: boolean;
  structuredText: string;
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

const mathImportTemplate = `=== MODULE 1 ===

QUESTION 1
Domain: Algebra
Skill: Linear Equations in One Variable

\\text{If } 3x+5=20, \\text{ what is the value of } x?
A. 3
B. 5
C. \\frac{20}{3}
D. 15
Answer: B
Explanation: \\text{Subtract }5\\text{ from both sides, then divide by }3.

QUESTION 2
Domain: Problem-Solving and Data Analysis
Skill: Ratios, Rates, and Units

[TABLE]
\\text{Quantity}\t\\text{Value}
x\t12
y\t18

\\text{What is the value of }\\frac{y}{x}?
Answer: 1.5`;

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

const mathLatexValues = (question: ImportQuestion) => {
  const values = [question.questionText, ...question.choices.map(choice => choice.text), question.explanation || ''];
  question.blocks.forEach(block => {
    if (block.type === 'text') values.push(block.content);
    if (block.type === 'table') values.push(block.title || '', ...block.headers, ...block.rows.flat(), block.note || '');
    if (block.type === 'poem') values.push(block.title || '', ...block.lines, block.author || '');
    if (block.type === 'note') values.push(...block.lines);
    if (block.type === 'image') values.push(block.caption || '');
  });
  return values.filter(value => value.trim());
};

const hasInvalidStrictLatex = (question: ImportQuestion) => mathLatexValues(question).some(value => {
  if (value.includes('$')) return true;
  try {
    katex.renderToString(value, { throwOnError: true, strict: false, trust: false });
    return false;
  } catch {
    return true;
  }
});

const reviewIssues = (question: ImportQuestion, taxonomy: TaxonomyDomain[], subject: Subject): ImportIssue[] => {
  const issues = question.issues.filter(item => ![
    'MISSING_QUESTION_TEXT', 'MISSING_ANSWER', 'MISSING_DOMAIN', 'MISSING_SKILL', 'MISSING_CHOICES', 'ANSWER_NOT_IN_CHOICES', 'INVALID_LATEX',
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
  if (subject === 'MATH' && hasInvalidStrictLatex(question)) {
    issues.push({ severity: 'error', code: 'INVALID_LATEX', message: 'Math content must be valid raw LaTeX without $ delimiters. Put prose inside \\text{...}.' });
  }
  return issues;
};

const reviewPreview = (preview: ImportPreview, taxonomy: TaxonomyDomain[], subject: Subject): ImportPreview => {
  const modules = preview.modules.map(module => ({
    ...module,
    questions: module.questions.map(question => ({ ...question, issues: reviewIssues(question, taxonomy, subject) })),
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
  const editParam = searchParams.get('edit');
  const editTestId = editParam && /^\d+$/.test(editParam) ? Number(editParam) : null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const loadedEditIdRef = useRef<number | null>(null);
  const [step, setStep] = useState<Step>(editTestId ? 'IMPORT' : 'SETUP');
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
  const [isLoadingEdit, setIsLoadingEdit] = useState(Boolean(editTestId));
  const [editFolderId, setEditFolderId] = useState<number | null>(null);
  const [editLocked, setEditLocked] = useState(false);
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
    if (taxonomy.length > 0) setPreview(current => current.modules.length ? reviewPreview(current, taxonomy, form.subject) : current);
  }, [form.subject, taxonomy]);

  const questions = useMemo(() => preview.modules.flatMap(module => module.questions), [preview]);
  const selectedQuestion = questions.find(question => question.clientId === selectedQuestionId) || questions[0] || null;
  const selectedDomain = taxonomy.find(domain => domain.code === selectedQuestion?.domainCode);
  const blockingErrors = preview.summary.errorCount > 0 || preview.summary.questionCount === 0;
  const activeImportTemplate = form.subject === 'MATH' ? mathImportTemplate : importTemplate;

  useEffect(() => {
    if (selectedQuestion && selectedQuestion.clientId !== selectedQuestionId) setSelectedQuestionId(selectedQuestion.clientId);
  }, [selectedQuestion, selectedQuestionId]);

  const applyPreview = (nextPreview: ImportPreview) => {
    const reviewed = reviewPreview(nextPreview, taxonomy, form.subject);
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
    }, taxonomy, form.subject));
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

  useEffect(() => {
    if (!editTestId || loadedEditIdRef.current === editTestId) return;
    loadedEditIdRef.current = editTestId;
    const loadExam = async () => {
      setIsLoadingEdit(true);
      try {
        const detail = await axiosClient.get<EditTestPayload, EditTestPayload>(`/api/tests/${editTestId}/edit`);
        setForm({
          title: detail.title,
          subject: detail.subject,
          duration: detail.duration,
          moduleCount: Math.max(1, detail.moduleCount),
          mode: detail.mode,
          category: detail.category,
          testDate: detail.testDate || '',
        });
        setEditFolderId(detail.folderId ?? null);
        setEditLocked(detail.hasAttempts);
        setRawText(detail.structuredText);
        const parsed = await axiosClient.post<ImportPreview, ImportPreview>('/api/test-imports/preview-text', {
          text: detail.structuredText,
          subject: detail.subject,
          moduleCount: detail.moduleCount,
        });
        setPreview(parsed);
        setSelectedQuestionId(parsed.modules[0]?.questions[0]?.clientId || '');
        setStep('IMPORT');
      } catch (error: unknown) {
        toast.error(requestErrorMessage(error, 'Unable to load this exam for editing'));
        navigate('/dashboard/practice-test');
      } finally {
        setIsLoadingEdit(false);
      }
    };
    void loadExam();
  }, [editTestId, navigate]);

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
    if (editLocked) return toast.error('This exam cannot be edited because a student has already started it');
    if (blockingErrors) return toast.error('Resolve all errors before creating the exam');
    setIsSaving(true);
    try {
      const moduleDuration = Math.max(1, Math.floor(form.duration / Math.max(1, preview.modules.length)));
      const payload = {
        title: form.title.trim(),
        subject: form.subject,
        duration: Number(form.duration),
        mode: form.mode,
        category: userRole === 'ADMIN' ? form.category : 'CLASS',
        testDate: userRole === 'ADMIN' && form.category === 'REAL' ? form.testDate || undefined : undefined,
        folderId: folderId ?? editFolderId ?? undefined,
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
      };
      if (editTestId) await axiosClient.put(`/api/tests/${editTestId}`, payload);
      else await axiosClient.post('/api/tests/create', payload);
      toast.success(editTestId ? 'Exam updated' : 'Exam created. Assign it from Practice Center when you are ready.');
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
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={`${ui.content} flex min-h-full flex-col gap-6`}>
          <PageHeader
            title={editTestId ? 'Edit Exam' : 'Create Exam'}
            description={editTestId ? 'Update the structured content and review your changes.' : 'Import, review, and organize SAT questions.'}
            actions={step === 'IMPORT'
              ? <Button variant="outline" size="sm" onClick={() => setGuideOpen(true)}><CircleHelp size={15} />Formatting guide</Button>
              : step === 'REVIEW'
                ? <Button size="sm" disabled={blockingErrors || isSaving || editLocked} onClick={saveTest}><Save size={15} />{isSaving ? 'Saving…' : editTestId ? 'Save changes' : 'Create exam'}</Button>
                : undefined}
          />
          <WizardStepper step={step} />
          {isLoadingEdit && <Card className="flex min-h-[360px] items-center justify-center gap-3 p-8 text-sm text-muted-foreground"><LoaderCircle size={20} className="animate-spin text-primary" />Loading exam content…</Card>}
          {!isLoadingEdit && step === 'SETUP' && (
            <Card className="wizard-step-enter mx-auto w-full max-w-3xl p-6 lg:p-8">
              <div className="mb-6"><h2 className="text-lg font-semibold text-foreground">Test details</h2><p className="mt-1 text-sm text-muted-foreground">Set up the exam before importing its questions.</p></div>
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

          {!isLoadingEdit && step === 'IMPORT' && (
            <div className="wizard-step-enter flex min-h-0 flex-1 flex-col gap-4">
              {editLocked && <ImportNotice tone="warning" message="This exam is read-only because a student has already started it. Delete it and create a new version if the question structure must change." />}
              <Card className="flex min-h-[620px] flex-1 flex-col overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-4 py-3">
                  <div><h2 className="text-sm font-semibold text-foreground">Import workspace</h2><p className="mt-0.5 text-xs text-muted-foreground">Edit structured text and check the parsed result side by side.</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void parseFile(file); }} />
                    <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} />
                    <Button variant="outline" size="sm" disabled={isParsing || editLocked} onClick={() => fileInputRef.current?.click()}>{isParsing ? <LoaderCircle size={15} className="animate-spin" /> : <UploadCloud size={15} />}Upload file</Button>
                    <Button variant="outline" size="sm" disabled={isUploadingImage || editLocked} onClick={() => imageInputRef.current?.click()}>{isUploadingImage ? <LoaderCircle size={15} className="animate-spin" /> : <ImagePlus size={15} />}Upload image</Button>
                    <Button size="sm" disabled={isParsing || !rawText.trim() || editLocked} onClick={() => void previewText()}>{isParsing ? <LoaderCircle size={15} className="animate-spin" /> : <Eye size={15} />}Update preview</Button>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
                  <section className="flex min-h-[520px] min-w-0 flex-col border-b border-ui-border lg:border-b-0 lg:border-r">
                    <div className="flex h-11 shrink-0 items-center justify-between border-b border-ui-border bg-muted px-4"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground">Structured text</span><span className="text-[11px] text-muted-foreground">{rawText.length.toLocaleString()} characters</span></div>
                    <textarea ref={editorRef} value={rawText} onChange={event => setRawText(event.target.value)} readOnly={editLocked} spellCheck={false} className="min-h-0 flex-1 resize-none bg-surface p-4 font-mono text-xs leading-6 text-foreground outline-hidden placeholder:text-muted-foreground read-only:cursor-not-allowed read-only:bg-muted focus:bg-background" placeholder={activeImportTemplate} />
                  </section>

                  <section className="flex min-h-[520px] min-w-0 flex-col bg-muted/30">
                    <div className="flex h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-ui-border bg-muted px-4">
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground"><span className="font-semibold uppercase tracking-[0.08em] text-foreground">Preview</span>{preview.summary.questionCount > 0 && <><span>{preview.summary.questionCount} questions</span><span className={preview.summary.errorCount ? 'font-semibold text-danger' : 'text-success'}>{preview.summary.errorCount} errors</span></>}</div>
                      {selectedQuestion && <div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQuestion(-1)} disabled={selectedIndex <= 0} aria-label="Previous question"><ChevronLeft size={15} /></Button><span className="min-w-16 text-center text-[11px] font-medium text-muted-foreground">{selectedIndex + 1} / {questions.length}</span><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQuestion(1)} disabled={selectedIndex >= questions.length - 1} aria-label="Next question"><ChevronRight size={15} /></Button></div>}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-5">
                      {selectedQuestion ? <QuestionPreview question={selectedQuestion} subject={form.subject} /> : <div className="flex h-full min-h-72 flex-col items-center justify-center text-center"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary"><Eye size={19} /></span><p className="mt-3 text-sm font-medium text-foreground">No preview yet</p><p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Enter structured text or upload a document, then select Update preview.</p></div>}
                    </div>
                  </section>
                </div>
              </Card>
              {importError && <ImportNotice tone="error" message={importError} />}
              <div className="flex items-center justify-between"><Button variant="ghost" onClick={() => setStep('SETUP')}><ArrowLeft size={16} />Back</Button><Button disabled={preview.summary.questionCount === 0} onClick={() => setStep('REVIEW')}>Continue to review<ArrowRight size={16} /></Button></div>
            </div>
          )}

          {!isLoadingEdit && step === 'REVIEW' && (
            <div className="wizard-step-enter flex min-h-0 flex-1 flex-col gap-4">
              <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">{preview.fileName || 'Pasted content'}</span><span>{preview.summary.questionCount} questions</span><span>{preview.summary.classifiedCount} classified</span><span className={preview.summary.errorCount ? 'font-semibold text-danger' : 'text-success'}>{preview.summary.errorCount} errors</span><span className={preview.summary.warningCount ? 'font-medium text-warning' : ''}>{preview.summary.warningCount} warnings</span></Card>
              {preview.issues.map((item, index) => <ImportNotice key={`${item.code}-${index}`} tone={item.severity} message={item.message} />)}
              <div className="grid min-h-[620px] grid-cols-1 overflow-hidden rounded-card border border-ui-border bg-surface lg:grid-cols-[220px_minmax(0,1fr)_280px]">
                <aside className="border-b border-ui-border bg-muted/30 p-3 lg:border-b-0 lg:border-r"><p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Questions</p><div className="flex max-h-44 gap-1 overflow-x-auto lg:max-h-none lg:flex-col lg:overflow-y-auto">{preview.modules.map(module => <div key={module.order}><p className="mb-1 mt-2 px-2 text-[10px] font-medium text-muted-foreground">{module.name}</p>{module.questions.map(question => <button key={question.clientId} onClick={() => setSelectedQuestionId(question.clientId)} className={`flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-left text-xs transition-colors ${selectedQuestion?.clientId === question.clientId ? 'bg-primary-soft font-medium text-primary' : 'text-muted-foreground hover:bg-muted'}`}><StatusIcon issues={question.issues} /><span className="whitespace-nowrap">Q{question.order}</span><span className="hidden truncate lg:block">{question.domainCode ? 'Classified' : 'Needs review'}</span></button>)}</div>)}</div></aside>
                <section className="min-w-0 border-b border-ui-border p-5 lg:border-b-0 lg:border-r lg:p-6">{selectedQuestion ? <QuestionPreview question={selectedQuestion} subject={form.subject} /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select a question to review.</div>}</section>
                <aside className="min-w-0 bg-muted/30 p-5">{selectedQuestion ? <QuestionEditor question={selectedQuestion} domain={selectedDomain} taxonomy={taxonomy} onChange={updateQuestion} /> : null}</aside>
              </div>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => moveQuestion(-1)} disabled={selectedIndex <= 0}><ChevronLeft size={16} />Previous</Button><Button variant="ghost" size="sm" onClick={() => moveQuestion(1)} disabled={selectedIndex < 0 || selectedIndex >= questions.length - 1}>Next<ChevronRight size={16} /></Button></div><div className="flex items-center justify-end gap-2"><Button variant="outline" onClick={() => setStep('IMPORT')}>Replace import</Button><Button disabled={blockingErrors || isSaving || editLocked} onClick={saveTest}><Save size={16} />{isSaving ? 'Saving…' : editTestId ? 'Save changes' : 'Create exam'}</Button></div></Card>
            </div>
          )}
        </div>
      </main>
      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} closeOnBackdrop title="Test formatting guide" subtitle="Use the same structure for pasted text and uploaded documents." className="max-w-6xl! shadow-none!">
        <FormattingGuide subject={form.subject} template={activeImportTemplate} />
      </Modal>
    </div>
  );
};

function WizardStepper({ step }: { step: Step }) {
  const activeIndex = steps.findIndex(item => item.key === step);
  return <div className="flex items-center gap-1.5" aria-label="Create exam progress">{steps.map((item, index) => {
    const active = item.key === step;
    const complete = activeIndex > index;
    return <div key={item.key} className="flex items-center gap-1.5"><span className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-semibold transition-colors duration-200 ${active || complete ? 'border-primary bg-primary-soft text-primary' : 'border-ui-border bg-surface text-muted-foreground'}`}>{complete ? <CheckCircle2 size={14} /> : index + 1}</span><span className={`hidden text-xs font-medium transition-colors duration-200 sm:inline ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>{index < steps.length - 1 && <span className={`h-px w-5 transition-colors duration-200 lg:w-8 ${complete ? 'bg-primary' : 'bg-border'}`} />}</div>;
  })}</div>;
}

function FormattingGuide({ subject, template }: { subject: Subject; template: string }) {
  return <div className="grid max-h-[65vh] gap-6 overflow-y-auto pr-1 md:grid-cols-[0.85fr_1.15fr]">
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground">Required structure</h3>
      <ol className="mt-3 space-y-2.5 text-xs leading-5 text-muted-foreground">
        <li><strong className="font-semibold text-foreground">1. Modules:</strong> start with <code className="rounded-sm bg-primary-soft px-1 py-0.5 text-primary">=== MODULE 1 ===</code>.</li>
        <li><strong className="font-semibold text-foreground">2. Questions:</strong> start each one with <code className="rounded-sm bg-primary-soft px-1 py-0.5 text-primary">QUESTION 1</code>.</li>
        <li><strong className="font-semibold text-foreground">3. Classification:</strong> add one <code className="rounded-sm bg-primary-soft px-1 py-0.5 text-primary">Domain:</code> and <code className="rounded-sm bg-primary-soft px-1 py-0.5 text-primary">Skill:</code> line.</li>
        <li><strong className="font-semibold text-foreground">4. Answers:</strong> use choices A–D for multiple choice, then add <code className="rounded-sm bg-primary-soft px-1 py-0.5 text-primary">Answer: B</code>. For student-produced responses, omit choices and enter the value.</li>
      </ol>
      {subject === 'MATH' && <div className="mt-4 rounded-lg border border-ui-border bg-muted px-3 py-2.5 text-xs leading-5 text-foreground"><strong className="font-semibold text-primary">Math uses strict LaTeX:</strong> write every question, choice, table cell and explanation as raw LaTeX without <code className="rounded-sm bg-surface px-1 py-0.5">$</code> delimiters. Use <code className="rounded-sm bg-surface px-1 py-0.5">\\text{'{'}...{'}'}</code> for words. Module markers, Domain, Skill and Answer lines remain plain structured metadata.</div>}
      <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-foreground">Optional content blocks</h3>
      <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
        <p><code className="rounded-sm bg-primary-soft px-1 py-0.5 font-semibold text-primary">[TEXT]</code> A passage or stimulus. Plain untagged passage text is also accepted.</p>
        <p><code className="rounded-sm bg-primary-soft px-1 py-0.5 font-semibold text-primary">[TABLE]</code> Put each row on a new line, separate cells with the <strong className="font-semibold text-foreground">Tab key</strong>, and use the first row as the header.</p>
        <p><code className="rounded-sm bg-primary-soft px-1 py-0.5 font-semibold text-primary">[POEM]</code> Put each verse line on its own line.</p>
        <p><code className="rounded-sm bg-primary-soft px-1 py-0.5 font-semibold text-primary">[NOTE]</code> Put each supporting fact on a new line, optionally beginning with <code>-</code> or <code>•</code>.</p>
        <p><code className="rounded-sm bg-primary-soft px-1 py-0.5 font-semibold text-primary">[IMG]</code> Put a publicly accessible image URL on the following line. The Upload image button inserts this block automatically.</p>
      </div>
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900"><strong className="font-semibold">Uploaded documents:</strong> use selectable text in PDF, DOCX, or TXT format. Scanned image-only PDFs cannot be read.</div>
    </div>
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground">Example template</h3><Button variant="ghost" size="sm" onClick={() => void navigator.clipboard.writeText(template).then(() => toast.success('Template copied'))}>Copy template</Button></div>
      <pre className="max-h-[56vh] overflow-auto whitespace-pre-wrap rounded-lg border border-ui-border bg-muted p-4 font-mono text-[11px] leading-5 text-foreground">{template}</pre>
    </div>
  </div>;
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-medium text-foreground">{label}</span>{children}</label>;
}

function ModeButton({ active, icon, title, text, onClick }: { active: boolean; icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-h-20 items-start gap-2 rounded-control border p-3 text-left transition-colors ${active ? 'border-primary bg-primary-soft text-primary' : 'border-ui-border bg-surface text-muted-foreground hover:bg-muted'}`}><span className="mt-0.5">{icon}</span><span><span className="block text-xs font-semibold">{title}</span><span className="mt-1 block text-[11px] leading-4">{text}</span></span></button>;
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
  return <CheckCircle2 size={14} className="shrink-0 text-success" aria-label="Ready" />;
}

function QuestionPreview({ question, subject }: { question: ImportQuestion; subject: Subject }) {
  const usableBlocks = question.blocks.filter(block => block.type !== 'image' || block.src);
  return <div className="font-sans text-[15px] leading-6"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">Module {question.module} · Question {question.order}</p><h2 className="mt-1 text-lg font-semibold text-foreground">Question preview</h2></div><Badge tone={question.type === 'SPR' ? 'gold' : 'green'}>{question.type === 'SPR' ? 'Student-produced response' : 'Multiple choice'}</Badge></div>{usableBlocks.length > 0 && <div className="mb-5"><BlockRenderer blocks={usableBlocks} subject={subject} readOnly variant="preview" /></div>}{subject === 'MATH' ? <FormattedTextRenderer text={question.questionText || '\\text{Question text is missing.}'} inheritTypography latexOnly /> : <p className="whitespace-pre-wrap text-[15px] leading-6 text-foreground">{question.questionText || 'Question text is missing.'}</p>}{question.type === 'MCQ' && <div className="mt-6 space-y-2">{question.choices.map(choice => <div key={choice.id} className="flex gap-3 rounded-control border border-ui-border bg-surface px-3 py-2.5 text-[15px] leading-6 text-foreground"><span className="font-semibold text-primary">{choice.id}</span><span className="min-w-0">{subject === 'MATH' ? <FormattedTextRenderer text={choice.text} inheritTypography latexOnly /> : <span className="whitespace-pre-wrap">{choice.text}</span>}</span></div>)}</div>}{question.type === 'SPR' && <div className="mt-6 rounded-control border border-dashed border-ui-border bg-muted p-3 text-[15px] leading-6 text-muted-foreground">Student-produced response</div>}</div>;
}

function QuestionEditor({ question, domain, taxonomy, onChange }: { question: ImportQuestion; domain?: TaxonomyDomain; taxonomy: TaxonomyDomain[]; onChange: (id: string, updater: (question: ImportQuestion) => ImportQuestion) => void }) {
  const update = (patch: Partial<ImportQuestion>) => onChange(question.clientId, current => ({ ...current, ...patch }));
  return <div className="space-y-5"><div><h2 className="text-sm font-semibold text-foreground">Classification</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Required for SAT performance analytics.</p></div><Field label="Content domain"><Select className="w-full" value={question.domainCode} onChange={event => update({ domainCode: event.target.value, skillCode: '' })}><option value="">Choose domain</option>{taxonomy.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</Select></Field><Field label="Skill"><Select className="w-full" value={question.skillCode} disabled={!domain} onChange={event => update({ skillCode: event.target.value })}><option value="">Choose skill</option>{domain?.skills.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</Select></Field><div className="border-t border-ui-border pt-5"><h2 className="text-sm font-semibold text-foreground">Question details</h2><label className="mt-3 block text-xs font-medium text-foreground">Correct answer</label><Input className="mt-1 w-full" value={question.correctAnswer} onChange={event => update({ correctAnswer: event.target.value.toUpperCase() })} placeholder={question.type === 'MCQ' ? 'A' : 'Answer'} /><label className="mt-4 block text-xs font-medium text-foreground">Explanation <span className="font-normal text-muted-foreground">(optional)</span></label><Textarea className="mt-1 min-h-24" value={question.explanation || ''} onChange={event => update({ explanation: event.target.value })} /></div>{question.issues.length > 0 && <div className="border-t border-ui-border pt-4"><p className="mb-2 text-xs font-semibold text-foreground">Validation</p><div className="space-y-2">{question.issues.map(item => <ImportNotice key={item.code} tone={item.severity} message={item.message} />)}</div></div>}</div>;
}

export default CreateTestWizard;
