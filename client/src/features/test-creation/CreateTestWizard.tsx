import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Eye,
  ImagePlus,
  LoaderCircle,
  Save,
  UploadCloud,
} from 'lucide-react';
import toast from 'react-hot-toast';
import katex from 'katex';
import axiosClient from '../../lib/axios';
import BlockRenderer from '../../components/content/BlockRenderer';
import FormattedTextRenderer from '../../components/content/TextRenderer';
import { Badge, Card, Input, Modal } from '../../components/ui/AppUI';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Field, FieldLabel } from '../../components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ui } from '../../components/ui/styles';
import { useDashboardBack } from '../navigation/DashboardBackContext';
import { createTestDetailsSchema } from './create-test.schema';
import type { EditTestPayload, ExtractedDocument, ImportIssue, ImportPreview, ImportQuestion, IssueSeverity, Subject, TaxonomyDomain, TestDetailsValues, TestStatus } from './create-test.types';
import { TestDetailsStep } from './TestDetailsStep';

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
  const userRole = localStorage.getItem('userRole') || 'TEACHER';
  const isAdmin = userRole === 'ADMIN';
  const detailsForm = useForm<TestDetailsValues>({
    resolver: zodResolver(createTestDetailsSchema(isAdmin)),
    mode: 'onBlur',
    defaultValues: {
    title: '',
    subject: 'RW',
    duration: 64,
    moduleCount: 2,
    mode: 'PRACTICE',
    category: 'PRACTICE',
    testDate: '',
    },
  });
  const details = useWatch({ control: detailsForm.control });
  const subject = details.subject ?? 'RW';
  const moduleCount = details.moduleCount ?? 2;
  const [stage, setStage] = useState<'BUILD' | 'REVIEW'>('BUILD');
  const [buildTab, setBuildTab] = useState<'DETAILS' | 'IMPORT'>(editTestId ? 'IMPORT' : 'DETAILS');
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
  const [testStatus, setTestStatus] = useState<TestStatus>('DRAFT');
  const [importError, setImportError] = useState('');
  const [mobileReviewPane, setMobileReviewPane] = useState<'PREVIEW' | 'EDIT'>('PREVIEW');
  const [contentDirty, setContentDirty] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const allowNavigationRef = useRef(false);
  const folderIdParam = searchParams.get('folderId');
  const folderId = folderIdParam ? Number(folderIdParam) : undefined;

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const response = await axiosClient.get<TaxonomyDomain[], TaxonomyDomain[]>(`/api/tests/taxonomy?subject=${subject}`);
        setTaxonomy(response);
      } catch (error) {
        console.error(error);
        toast.error('Unable to load the SAT content taxonomy');
      }
    };
    void loadTaxonomy();
  }, [subject]);

  useEffect(() => {
    if (taxonomy.length > 0) setPreview(current => current.modules.length ? reviewPreview(current, taxonomy, subject) : current);
  }, [subject, taxonomy]);

  const questions = useMemo(() => preview.modules.flatMap(module => module.questions), [preview]);
  const selectedQuestion = questions.find(question => question.clientId === selectedQuestionId) || questions[0] || null;
  const selectedDomain = taxonomy.find(domain => domain.code === selectedQuestion?.domainCode);
  const blockingErrors = preview.summary.errorCount > 0 || preview.summary.questionCount === 0;
  const activeImportTemplate = subject === 'MATH' ? mathImportTemplate : importTemplate;

  useEffect(() => {
    if (selectedQuestion && selectedQuestion.clientId !== selectedQuestionId) setSelectedQuestionId(selectedQuestion.clientId);
  }, [selectedQuestion, selectedQuestionId]);

  const applyPreview = (nextPreview: ImportPreview) => {
    const reviewed = reviewPreview(nextPreview, taxonomy, subject);
    setPreview(reviewed);
    setContentDirty(true);
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
    }, taxonomy, subject));
    setContentDirty(true);
  };

  const previewText = async (text = rawText) => {
    if (!text.trim()) return toast.error('Enter or upload test content before previewing it');
    setIsParsing(true);
    setImportError('');
    try {
      const response = await axiosClient.post<ImportPreview, ImportPreview>('/api/test-imports/preview-text', {
        text,
        subject,
        moduleCount,
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
        detailsForm.reset({
          title: detail.title,
          subject: detail.subject,
          duration: detail.duration,
          moduleCount: Math.max(1, detail.moduleCount),
          mode: detail.mode,
          category: detail.category,
          testDate: detail.testDate || '',
        });
        setEditFolderId(detail.folderId ?? null);
        setTestStatus(detail.status);
        setEditLocked(detail.hasAttempts);
        setRawText(detail.structuredText);
        const parsed = await axiosClient.post<ImportPreview, ImportPreview>('/api/test-imports/preview-text', {
          text: detail.structuredText,
          subject: detail.subject,
          moduleCount: detail.moduleCount,
        });
        setPreview(parsed);
        setSelectedQuestionId(parsed.modules[0]?.questions[0]?.clientId || '');
        setContentDirty(false);
        setBuildTab('IMPORT');
        setStage('BUILD');
      } catch (error: unknown) {
        toast.error(requestErrorMessage(error, 'Unable to load this test for editing'));
        navigate('/dashboard/practice-test');
      } finally {
        setIsLoadingEdit(false);
      }
    };
    void loadExam();
  }, [detailsForm, editTestId, navigate]);

  const parseFile = async (file: File) => {
    setIsParsing(true);
    setImportError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const extracted = await axiosClient.post<ExtractedDocument, ExtractedDocument>('/api/test-imports/extract', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setRawText(extracted.text);
      setContentDirty(true);
      if (!detailsForm.getValues('title').trim()) detailsForm.setValue('title', fileTitle(extracted.fileName), { shouldDirty: true });
      const response = await axiosClient.post<ImportPreview, ImportPreview>('/api/test-imports/preview-text', {
        text: extracted.text,
        subject,
        moduleCount,
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
    setContentDirty(true);
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

  const saveTest = async (nextStatus: Exclude<TestStatus, 'ARCHIVED'>) => {
    if (editLocked) return toast.error('This test cannot be edited because a student has already started it');
    if (blockingErrors) return toast.error('Resolve all errors before saving the test');
    setIsSaving(true);
    try {
      const values = detailsForm.getValues();
      const moduleDuration = Math.max(1, Math.floor(values.duration / Math.max(1, preview.modules.length)));
      const payload = {
        title: values.title.trim(),
        subject: values.subject,
        duration: Number(values.duration),
        mode: values.mode,
        status: nextStatus,
        category: isAdmin ? values.category : 'CLASS',
        testDate: isAdmin && values.category === 'REAL' ? values.testDate || undefined : undefined,
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
      setTestStatus(nextStatus);
      allowNavigationRef.current = true;
      setContentDirty(false);
      detailsForm.reset(values);
      toast.success(nextStatus === 'PUBLISHED' ? 'Test published. It is now available in Classroom.' : editTestId ? 'Draft changes saved' : 'Draft test created');
      navigate('/dashboard/practice-test');
    } catch (error: unknown) {
      console.error(error);
      toast.error(requestErrorMessage(error, 'Unable to save the test'));
    } finally {
      setIsSaving(false);
    }
  };

  const selectedIndex = questions.findIndex(question => question.clientId === selectedQuestion?.clientId);
  const moveQuestion = (direction: -1 | 1) => {
    const next = questions[selectedIndex + direction];
    if (next) setSelectedQuestionId(next.clientId);
  };

  const hasUnsavedChanges = detailsForm.formState.isDirty || contentDirty;
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges || allowNavigationRef.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const leaveWizard = () => {
    if (hasUnsavedChanges && !allowNavigationRef.current) setConfirmLeaveOpen(true);
    else navigate('/dashboard/practice-test');
  };

  const confirmLeave = () => {
    allowNavigationRef.current = true;
    setConfirmLeaveOpen(false);
    navigate('/dashboard/practice-test');
  };

  useDashboardBack(leaveWizard);

  const continueToReview = detailsForm.handleSubmit(() => {
    if (preview.summary.questionCount === 0) {
      setBuildTab('IMPORT');
      toast.error('Import questions and update the preview before continuing');
      return;
    }
    setStage('REVIEW');
  });

  return (
    <div className={ui.page}>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={`${ui.content} flex min-h-full flex-col gap-6`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-3xl font-medium leading-none tracking-tight text-foreground">{editTestId ? 'Edit Test' : 'Create New Test'}</h1>
              <p className="text-sm text-muted-foreground">{stage === 'BUILD' ? 'Add test details, import questions, and review the live preview.' : 'Resolve validation issues before saving or publishing this test.'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {stage === 'BUILD' ? (
                <Button disabled={isLoadingEdit || isParsing} onClick={() => void continueToReview()}>Continue to review <ArrowRight data-icon="inline-end" /></Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => { setStage('BUILD'); setBuildTab('IMPORT'); }}><ArrowLeft data-icon="inline-start" />Replace import</Button>
                  <Button variant="outline" disabled={blockingErrors || isSaving || editLocked} onClick={() => void saveTest('DRAFT')}><Save data-icon="inline-start" />{isSaving ? 'Saving…' : testStatus === 'DRAFT' ? 'Save draft' : 'Move to draft'}</Button>
                  <Button disabled={blockingErrors || isSaving || editLocked} onClick={() => void saveTest('PUBLISHED')}><CheckCircle2 data-icon="inline-start" />Publish test</Button>
                </>
              )}
            </div>
          </div>
          {isLoadingEdit && <Card className="flex min-h-[360px] items-center justify-center gap-3 p-8 text-sm text-muted-foreground"><LoaderCircle size={20} className="animate-spin text-primary" />Loading test content…</Card>}
          {!isLoadingEdit && stage === 'BUILD' && (
            <div className="wizard-step-enter flex min-h-0 flex-1 flex-col gap-4">
              {editLocked && <ImportNotice tone="warning" message="This test is read-only because a student has already started it. Duplicate it from Test Library to make structural changes." />}
              <form className="grid min-h-0 gap-5 xl:grid-cols-2" noValidate onSubmit={event => event.preventDefault()}>
                <div className="flex min-h-[620px] min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4">
                  <Tabs value={buildTab} onValueChange={value => setBuildTab(value as 'DETAILS' | 'IMPORT')} className="min-h-0 flex-1">
                    <TabsList className="w-full">
                      <TabsTrigger value="DETAILS">Details</TabsTrigger>
                      <TabsTrigger value="IMPORT">Import questions</TabsTrigger>
                    </TabsList>
                    <TabsContent value="DETAILS" className="min-h-0 flex-1 pt-2">
                      <TestDetailsStep form={detailsForm} isAdmin={isAdmin} />
                    </TabsContent>
                    <TabsContent value="IMPORT" className="min-h-0 flex-1 pt-2">
                      <div className="flex h-full min-h-[520px] flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-border pb-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Structured text</span><span>{rawText.length.toLocaleString()} characters</span></div>
                        {/* The structured editor needs direct cursor-selection APIs so image blocks can be inserted at the caret. */}
                        <textarea aria-label="Structured test content" ref={editorRef} value={rawText} onChange={event => { setRawText(event.target.value); setContentDirty(true); }} readOnly={editLocked} spellCheck={false} className="min-h-80 flex-1 resize-none rounded-lg border border-input bg-transparent p-3 font-mono text-xs leading-6 text-foreground outline-none placeholder:text-muted-foreground read-only:cursor-not-allowed read-only:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" placeholder={activeImportTemplate} />
                        {importError && <ImportNotice tone="error" message={importError} />}
                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                          {/* Native file inputs are required because the shared text Input does not expose the browser file-picker contract. */}
                          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void parseFile(file); }} />
                          <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} />
                          <Button type="button" variant="ghost" size="sm" onClick={() => setGuideOpen(true)}><CircleHelp data-icon="inline-start" />Formatting guide</Button>
                          <Button type="button" variant="outline" size="sm" disabled={isParsing || editLocked} onClick={() => fileInputRef.current?.click()}>{isParsing ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <UploadCloud data-icon="inline-start" />}Upload file</Button>
                          <Button type="button" variant="outline" size="sm" disabled={isUploadingImage || editLocked} onClick={() => imageInputRef.current?.click()}>{isUploadingImage ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <ImagePlus data-icon="inline-start" />}Upload image</Button>
                          <Button type="button" size="sm" disabled={isParsing || !rawText.trim() || editLocked} onClick={() => void previewText()}>{isParsing ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Eye data-icon="inline-start" />}Update preview</Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                <section className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                    <div><h2 className="text-sm font-medium text-foreground">Test preview</h2><p className="mt-0.5 text-xs text-muted-foreground">Live output from the imported content.</p></div>
                    {selectedQuestion && <div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQuestion(-1)} disabled={selectedIndex <= 0} aria-label="Previous question"><ChevronLeft size={15} /></Button><span className="min-w-16 text-center text-xs font-medium text-muted-foreground">{selectedIndex + 1} / {questions.length}</span><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQuestion(1)} disabled={selectedIndex >= questions.length - 1} aria-label="Next question"><ChevronRight size={15} /></Button></div>}
                  </div>
                  {preview.summary.questionCount > 0 && <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground"><span>{preview.summary.questionCount} questions</span><span>{preview.summary.classifiedCount} classified</span><span className={preview.summary.errorCount ? 'font-medium text-destructive' : 'text-success'}>{preview.summary.errorCount} errors</span></div>}
                  <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    {selectedQuestion ? <QuestionPreview question={selectedQuestion} subject={subject} /> : <div className="flex h-full min-h-80 flex-col items-center justify-center text-center"><span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Eye size={19} /></span><p className="mt-3 text-sm font-medium text-foreground">No preview yet</p><p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Open Import questions, add structured content, then select Update preview.</p></div>}
                  </div>
                </section>
              </form>
            </div>
          )}

          {!isLoadingEdit && stage === 'REVIEW' && (
            <div className="wizard-step-enter flex min-h-0 flex-1 flex-col gap-4">
              <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">{preview.fileName || 'Pasted content'}</span><span>{preview.summary.questionCount} questions</span><span>{preview.summary.classifiedCount} classified</span><span className={preview.summary.errorCount ? 'font-semibold text-danger' : 'text-success'}>{preview.summary.errorCount} errors</span><span className={preview.summary.warningCount ? 'font-medium text-warning' : ''}>{preview.summary.warningCount} warnings</span></Card>
              {preview.issues.map((item, index) => <ImportNotice key={`${item.code}-${index}`} tone={item.severity} message={item.message} />)}
              <Tabs value={mobileReviewPane} onValueChange={value => setMobileReviewPane(value as 'PREVIEW' | 'EDIT')} className="contents">
              <div className="lg:hidden"><TabsList className="w-full"><TabsTrigger value="PREVIEW" className="flex-1">Question preview</TabsTrigger><TabsTrigger value="EDIT" className="flex-1">Classification & answer</TabsTrigger></TabsList></div>
              <div className="grid min-h-[620px] grid-cols-1 overflow-hidden rounded-card border border-ui-border bg-surface lg:h-[640px] lg:min-h-0 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
                <aside className="flex min-h-0 flex-col border-b border-ui-border bg-muted/30 p-3 lg:border-b-0 lg:border-r"><p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Questions</p><div className="flex max-h-44 min-h-0 gap-1 overflow-x-auto lg:max-h-none lg:flex-1 lg:flex-col lg:overflow-y-auto">{preview.modules.map(module => <div key={module.order} className="flex gap-1 lg:block"><p className="mb-1 mt-2 hidden px-2 text-[10px] font-medium text-muted-foreground lg:block">{module.name}</p>{module.questions.map(question => <Button key={question.clientId} variant="ghost" size="sm" onClick={() => setSelectedQuestionId(question.clientId)} className={`h-8 shrink-0 justify-start gap-2 px-2.5 text-xs ${selectedQuestion?.clientId === question.clientId ? 'bg-primary-soft font-semibold text-primary' : 'text-muted-foreground'}`}><StatusIcon issues={question.issues} /><span className="whitespace-nowrap">Q{question.order}</span><span className="hidden truncate lg:block">{question.domainCode ? 'Classified' : 'Needs review'}</span></Button>)}</div>)}</div></aside>
                <TabsContent value="PREVIEW" forceMount asChild><section className={`${mobileReviewPane === 'PREVIEW' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col border-b border-ui-border lg:flex lg:border-b-0 lg:border-r`}><div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">{selectedQuestion ? <QuestionPreview question={selectedQuestion} subject={subject} /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select a question to review.</div>}</div>{selectedQuestion && <div className="flex items-center justify-between gap-3 border-t border-ui-border px-5 py-3 lg:px-6"><Button variant="ghost" size="sm" onClick={() => moveQuestion(-1)} disabled={selectedIndex <= 0}><ChevronLeft data-icon="inline-start" />Previous</Button><span className="text-xs font-medium text-muted-foreground">Question {selectedIndex + 1} of {questions.length}</span><Button variant="ghost" size="sm" onClick={() => moveQuestion(1)} disabled={selectedIndex < 0 || selectedIndex >= questions.length - 1}>Next<ChevronRight data-icon="inline-end" /></Button></div>}</section></TabsContent>
                <TabsContent value="EDIT" forceMount asChild><aside className={`${mobileReviewPane === 'EDIT' ? 'block' : 'hidden'} min-h-0 min-w-0 overflow-y-auto bg-muted/30 p-5 lg:block`}>{selectedQuestion ? <QuestionEditor question={selectedQuestion} domain={selectedDomain} taxonomy={taxonomy} onChange={updateQuestion} /> : null}</aside></TabsContent>
              </div>
              </Tabs>
              {blockingErrors && <p className="text-right text-xs text-destructive">Resolve {preview.summary.errorCount || 'all'} validation {preview.summary.errorCount === 1 ? 'error' : 'errors'} before saving.</p>}
            </div>
          )}
        </div>
      </main>
      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} closeOnBackdrop presentation="content-dialog" title="Test formatting guide" subtitle="Use the same structure for pasted text and uploaded documents." className="max-w-6xl! shadow-none!">
        <FormattingGuide subject={subject} template={activeImportTemplate} />
      </Modal>
      <Modal open={confirmLeaveOpen} onClose={() => setConfirmLeaveOpen(false)} closeOnBackdrop presentation="content-dialog" title="Leave test creation?" subtitle="Your unsaved test details and imported content will be lost." className="max-w-md!">
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmLeaveOpen(false)}>Keep editing</Button><Button variant="destructive" onClick={confirmLeave}>Leave without saving</Button></div>
      </Modal>
    </div>
  );
};

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
  return <div className="space-y-5"><div><h2 className="text-sm font-semibold text-foreground">Classification</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Required for SAT performance analytics.</p></div><Field><FieldLabel htmlFor="question-domain">Content domain</FieldLabel><Select value={question.domainCode || undefined} onValueChange={value => update({ domainCode: value, skillCode: '' })}><SelectTrigger id="question-domain" className="w-full"><SelectValue placeholder="Choose domain" /></SelectTrigger><SelectContent position="popper" align="start">{taxonomy.map(item => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}</SelectContent></Select></Field><Field><FieldLabel htmlFor="question-skill">Skill</FieldLabel><Select value={question.skillCode || undefined} disabled={!domain} onValueChange={value => update({ skillCode: value })}><SelectTrigger id="question-skill" className="w-full"><SelectValue placeholder="Choose skill" /></SelectTrigger><SelectContent position="popper" align="start">{domain?.skills.map(item => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}</SelectContent></Select></Field><div className="space-y-4 border-t border-ui-border pt-5"><h2 className="text-sm font-semibold text-foreground">Question details</h2><Field><FieldLabel htmlFor="question-answer">Correct answer</FieldLabel><Input id="question-answer" className="w-full" value={question.correctAnswer} onChange={event => update({ correctAnswer: event.target.value.toUpperCase() })} placeholder={question.type === 'MCQ' ? 'A' : 'Answer'} /></Field><Field><FieldLabel htmlFor="question-explanation">Explanation <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Textarea id="question-explanation" className="min-h-24" value={question.explanation || ''} onChange={event => update({ explanation: event.target.value })} /></Field></div>{question.issues.length > 0 && <div className="border-t border-ui-border pt-4"><p className="mb-2 text-xs font-semibold text-foreground">Validation</p><div className="space-y-2">{question.issues.map(item => <ImportNotice key={item.code} tone={item.severity} message={item.message} />)}</div></div>}</div>;
}

export default CreateTestWizard;
