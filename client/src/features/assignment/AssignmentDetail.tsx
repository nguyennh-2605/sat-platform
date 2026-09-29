import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Check, ChevronDown, CircleDashed, Edit, ExternalLink, FileText, Link as LinkIcon, MoreHorizontal, RotateCcw, Send, Trash2, TriangleAlert, Upload, X } from 'lucide-react';
import { LoadingSpinner, LoadingState } from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import toast from 'react-hot-toast';

import { ResourceIcon } from '@/components/resource-icon';
import { Badge, EmptyState, Input, Modal, PageHeader } from '@/components/ui/AppUI';
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from '@/components/ui/attachment';
import { Button } from '@/components/ui/button';
import { DataSurface, DataToolbar, DataToolbarGroup, DataToolbarSearch } from '@/components/ui/data-surface';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import axiosClient from '@/lib/axios';
import { displayHost, fileNameFromUrl, fileTypeLabel, getLinkPresentation } from '@/lib/resource-presentation';
import { cn } from '@/lib/utils';
import { capitalizeFirstLetter } from '@/utils/text';
import { AssignmentComposer, type ActivityStudent } from '../classroom/activity-composer/ActivityComposers';
import { useDashboardBack } from '../navigation/DashboardBackContext';

type WorkState = 'NOT_SUBMITTED' | 'NEEDS_REVIEW' | 'REVIEWED' | 'MISSING';
type WorkFilter = 'ALL' | WorkState;
type TeacherView = 'overview' | 'student-work';

interface Submission {
  id: string;
  textResponse: string | null;
  fileUrl: string | null;
  score: number | null;
  feedback: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewState?: WorkState;
  submittedContent: SubmissionContent | null;
  draftContent: SubmissionContent | null;
}

interface SubmissionContent {
  id: string;
  slot: 'DRAFT' | 'SUBMITTED';
  textResponse: string | null;
  version: number;
  updatedAt: string;
  items: SubmissionItem[];
}

interface SubmissionItem {
  id: string;
  kind: 'FILE' | 'LINK';
  displayName: string | null;
  externalUrl: string | null;
  fileAsset: { id: string; name: string; mimeType: string; sizeBytes: number; status: 'PENDING_UPLOAD' | 'READY' | 'PENDING_DELETE' } | null;
  order: number;
}

interface AssignmentData {
  id: string;
  title: string;
  content: string | null;
  fileUrls: string[];
  links: string[];
  deadline: string | null;
  maxPoints: number | null;
  createdAt: string;
  selectedTests?: Array<{ id: number; title: string; subject: string; mode: 'PRACTICE' | 'EXAM'; duration: number; questionCount: number; deliveryId?: string | null }>;
  activity: { status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'; availableAt: string | null; dueAt: string | null; lesson: { id: string; title: string; order: number; week: { id: string; title: string; order: number } } | null } | null;
  mySubmission?: Submission | null;
  submissionState?: WorkState;
}

interface WorkSummary {
  student: ActivityStudent;
  state: WorkState;
  submittedAt: string | null;
  reviewedAt: string | null;
  score: number | null;
}

interface WorkListData {
  summary: { assigned: number; submitted: number; needsReview: number; reviewed: number; missing: number; pending: number };
  items: WorkSummary[];
  nextCursor: string | null;
}

interface WorkDetailData {
  student: ActivityStudent;
  submission: Submission | null;
  state: WorkState;
  maxPoints: number | null;
}

interface ApiResponse<T> { success: boolean; data: T }

export default function AssignmentDetail() {
  const { classId = '', assignmentId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isStudent = localStorage.getItem('userRole') === 'STUDENT';
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  useDashboardBack(() => navigate(`/dashboard/class/${classId}?tab=activities`));

  const loadAssignment = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosClient.get<ApiResponse<AssignmentData>, ApiResponse<AssignmentData>>(`/api/assignments/${assignmentId}`);
      setAssignment(response.data);
    } catch (requestError) {
      console.error(requestError);
      setError('This assignment could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => { void loadAssignment(); }, [loadAssignment]);
  const deleteAssignment = async () => {
    try {
      await axiosClient.delete(`/api/assignments/${assignmentId}`);
      toast.success('Assignment deleted');
      navigate(`/dashboard/class/${classId}?tab=activities`);
    } catch (requestError) {
      console.error(requestError);
      toast.error('Unable to delete the assignment.');
    }
  };

  if (loading) return <AssignmentSkeleton />;
  if (!assignment || error) return <div className="mx-auto max-w-screen-2xl p-4 md:p-6"><EmptyState icon={<TriangleAlert size={24} />} title="Assignment unavailable" description={error || 'This assignment may have been deleted.'} action={<Button variant="outline" onClick={() => void loadAssignment()}>Try again</Button>} /></div>;

  const deadline = assignment.activity?.dueAt || assignment.deadline;
  const teacherView: TeacherView = new URLSearchParams(location.search).get('view') === 'student-work' ? 'student-work' : 'overview';
  const placement = assignment.activity?.lesson
    ? `Week ${String(assignment.activity.lesson.week.order + 1).padStart(2, '0')} · Session ${String(assignment.activity.lesson.order + 1).padStart(2, '0')}`
    : null;

  return <div className="h-full overflow-y-auto bg-background">
    <main className={cn('mx-auto flex flex-col gap-4 p-4 md:p-6', isStudent ? 'max-w-7xl' : 'max-w-screen-2xl')}>
      <PageHeader
        size="compact"
        title={capitalizeFirstLetter(assignment.title)}
        description={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-medium text-foreground">{deadline ? `Due ${formatDateTime(deadline)}` : 'No deadline'}</span><span>Assigned {formatDate(assignment.createdAt)}</span>{placement && <span>{placement}</span>}<span>Assignment</span></span>}
        actions={!isStudent ? <div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Edit />Edit assignment</Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="More assignment actions"><MoreHorizontal size={17} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}><Trash2 />Delete assignment</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div> : undefined}
      />
      {isStudent
        ? <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,400px)]"><div className="order-2 min-w-0 xl:order-1"><AssignmentContent assignment={assignment} /></div><div className="order-1 min-w-0 xl:order-2"><StudentSubmissionPanel key={`${assignment.mySubmission?.submittedAt || 'empty'}-${assignment.mySubmission?.draftContent?.version || 0}`} assignment={assignment} deadline={deadline} onSubmitted={loadAssignment} /></div></div>
        : <Tabs value={teacherView} onValueChange={view => {
          const params = new URLSearchParams(location.search);
          if (view === 'student-work') params.set('view', 'student-work');
          else params.delete('view');
          navigate({ search: params.toString() }, { replace: true });
        }} className="gap-4">
          <TabsList aria-label="Assignment view">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="student-work">Student work</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" id="assignment-overview"><div className="max-w-5xl"><AssignmentContent assignment={assignment} /></div></TabsContent>
          <TabsContent value="student-work" id="assignment-student-work"><TeacherStudentWork assignmentId={assignmentId} maxPoints={assignment.maxPoints} deadline={deadline} /></TabsContent>
        </Tabs>}
    </main>
    <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} closeOnBackdrop title="Delete assignment?" subtitle="This permanently deletes the assignment and its student submissions." footer={<><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={() => void deleteAssignment()}>Delete permanently</Button></>}><p className="text-sm text-muted-foreground">You are about to delete <span className="font-medium text-foreground">{assignment.title}</span>. This action cannot be undone.</p></Modal>
    <AssignmentComposer open={editOpen} onClose={() => setEditOpen(false)} classId={classId} students={[]} assignment={assignment} onCreated={loadAssignment} />
  </div>;
}

function AssignmentContent({ assignment }: { assignment: AssignmentData }) {
  const hasAttachments = Boolean(assignment.fileUrls.length || assignment.links.length);
  return <div className="min-w-0 space-y-4">
    <DataSurface className="p-5 md:p-6">
      <h2 className="text-base font-semibold text-foreground">Assignment content</h2>
      {assignment.content
        ? <div className="prose mt-4 max-w-none text-foreground marker:text-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.content) }} />
        : <p className="mt-3 text-sm text-muted-foreground">No instructions were provided.</p>}
      {hasAttachments && <div className="mt-6 border-t border-ui-border pt-5">
        <h3 className="text-sm font-semibold">Resources</h3>
        <div className="mt-3 divide-y divide-ui-border overflow-hidden rounded-control border border-ui-border">
          {assignment.fileUrls.map((url, index) => <ResourceLink key={`file-${index}`} url={url} title={fileNameFromUrl(url, index)} detail="Shared file" fileName={fileNameFromUrl(url, index)} />)}
          {assignment.links.map((url, index) => <ResourceLink key={`link-${index}`} url={url} title={getLinkPresentation(url).label} detail={displayHost(url)} />)}
        </div>
      </div>}
    </DataSurface>
    {assignment.selectedTests && assignment.selectedTests.length > 0 && <DataSurface className="p-5 md:p-6"><h2 className="text-base font-semibold text-foreground">Legacy attached tests</h2><p className="mt-1 text-xs text-muted-foreground">New tests are assigned as independent Activities.</p><div className="mt-4 space-y-2">{assignment.selectedTests.map(test => <div key={test.id} className="flex items-center justify-between gap-3 rounded-control border border-ui-border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{capitalizeFirstLetter(test.title)}</p><p className="text-xs text-muted-foreground">{test.subject} · {test.questionCount} questions</p></div><Badge tone="neutral">{test.mode === 'EXAM' ? 'Exam' : 'Practice'}</Badge></div>)}</div></DataSurface>}
  </div>;
}

function StudentSubmissionPanel({ assignment, deadline, onSubmitted }: { assignment: AssignmentData; deadline: string | null; onSubmitted: () => Promise<void> | void }) {
  const closed = assignment.activity?.status === 'CLOSED' || Boolean(deadline && new Date(deadline) < new Date());
  const initialSubmitted = assignment.mySubmission?.submittedContent || null;
  const [work, setWork] = useState<Submission | null>(assignment.mySubmission || null);
  const [editing, setEditing] = useState(Boolean(!initialSubmitted && !closed));
  const [response, setResponse] = useState(assignment.mySubmission?.draftContent?.textResponse || '');
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [linkOpen, setLinkOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [uploads, setUploads] = useState<Array<{ id: string; file: File; progress: number; error?: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionRef = useRef(assignment.mySubmission?.draftContent?.version);
  const lastSavedRef = useRef(assignment.mySubmission?.draftContent?.textResponse || '');
  const submitted = work?.submittedContent || null;
  const draft = work?.draftContent || null;
  const staleReview = Boolean(work?.reviewedAt && work.submittedAt && new Date(work.reviewedAt) < new Date(work.submittedAt));

  useEffect(() => {
    if (!editing || closed || response === lastSavedRef.current) return;
    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      try {
        const result = await axiosClient.patch<ApiResponse<Submission>, ApiResponse<Submission>>(`/api/assignments/${assignment.id}/my-submission/draft`, { textResponse: response, expectedVersion: versionRef.current });
        setWork(result.data);
        versionRef.current = result.data.draftContent?.version;
        lastSavedRef.current = response;
        setSaveState('saved');
      } catch (requestError) {
        setSaveState('error');
        toast.error(apiError(requestError, 'Your response could not be saved.'));
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [assignment.id, closed, editing, response]);

  const beginEditing = async () => {
    setSaving(true);
    try {
      const result = await axiosClient.post<ApiResponse<Submission>, ApiResponse<Submission>>(`/api/assignments/${assignment.id}/my-submission/edit`);
      setWork(result.data);
      const text = result.data.draftContent?.textResponse || '';
      setResponse(text);
      lastSavedRef.current = text;
      versionRef.current = result.data.draftContent?.version;
      setEditing(true);
    } catch (requestError) { toast.error(apiError(requestError, 'Unable to edit this submission.')); }
    finally { setSaving(false); }
  };

  const cancelEditing = async () => {
    setSaving(true);
    try {
      const result = await axiosClient.delete<ApiResponse<Submission | null>, ApiResponse<Submission | null>>(`/api/assignments/${assignment.id}/my-submission/draft`);
      setWork(result.data);
      setResponse('');
      lastSavedRef.current = '';
      versionRef.current = undefined;
      setSaveState('idle');
      setEditing(Boolean(!result.data?.submittedContent && !closed));
      setDiscardOpen(false);
    } catch (requestError) { toast.error(apiError(requestError, 'Unable to discard your changes.')); }
    finally { setSaving(false); }
  };

  const submit = async () => {
    setSaving(true);
    try {
      if (response !== lastSavedRef.current) {
        const saved = await axiosClient.patch<ApiResponse<Submission>, ApiResponse<Submission>>(`/api/assignments/${assignment.id}/my-submission/draft`, { textResponse: response, expectedVersion: versionRef.current });
        setWork(saved.data);
        versionRef.current = saved.data.draftContent?.version;
        lastSavedRef.current = response;
      }
      const result = await axiosClient.post<ApiResponse<Submission>, ApiResponse<Submission>>(`/api/assignments/${assignment.id}/my-submission/submit`);
      setWork(result.data);
      toast.success(submitted ? 'Assignment resubmitted' : 'Assignment submitted');
      await onSubmitted();
      setEditing(false);
    } catch (requestError) { toast.error(apiError(requestError, 'Unable to submit the assignment.')); }
    finally { setSaving(false); }
  };

  const addLink = async () => {
    setAddingLink(true);
    try {
      const result = await axiosClient.post<ApiResponse<Submission>, ApiResponse<Submission>>(`/api/assignments/${assignment.id}/my-submission/draft/items`, { kind: 'LINK', externalUrl: linkUrl, displayName: linkName });
      setWork(result.data);
      versionRef.current = result.data.draftContent?.version;
      setLinkOpen(false); setLinkUrl(''); setLinkName('');
    } catch (requestError) { toast.error(apiError(requestError, 'Unable to add this link.')); }
    finally { setAddingLink(false); }
  };

  const removeItem = async (itemId: string) => {
    try {
      const result = await axiosClient.delete<ApiResponse<Submission>, ApiResponse<Submission>>(`/api/assignments/${assignment.id}/my-submission/draft/items/${itemId}`);
      setWork(result.data);
      versionRef.current = result.data.draftContent?.version;
    } catch (requestError) { toast.error(apiError(requestError, 'Unable to remove this attachment.')); }
  };

  const uploadFile = async (file: File) => {
    const uploadId = crypto.randomUUID();
    setUploads(current => [...current, { id: uploadId, file, progress: 0 }]);
    try {
      const prepared = await axiosClient.post<ApiResponse<{ asset: { id: string }; uploadUrl: string; headers: Record<string, string> }>, ApiResponse<{ asset: { id: string }; uploadUrl: string; headers: Record<string, string> }>>('/api/files/uploads', { assignmentId: assignment.id, originalName: file.name, mimeType: mimeTypeForFile(file), sizeBytes: file.size });
      await uploadToSignedUrl(prepared.data.uploadUrl, file, prepared.data.headers, progress => setUploads(current => current.map(item => item.id === uploadId ? { ...item, progress } : item)));
      await axiosClient.post(`/api/files/${prepared.data.asset.id}/complete`);
      const attached = await axiosClient.post<ApiResponse<Submission>, ApiResponse<Submission>>(`/api/assignments/${assignment.id}/my-submission/draft/items`, { kind: 'FILE', fileAssetId: prepared.data.asset.id });
      setWork(attached.data);
      versionRef.current = attached.data.draftContent?.version;
      setUploads(current => current.filter(item => item.id !== uploadId));
    } catch (requestError) {
      const message = apiError(requestError, 'Upload failed.');
      setUploads(current => current.map(item => item.id === uploadId ? { ...item, error: message } : item));
    }
  };

  const chooseFiles = (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, Math.max(0, 10 - (draft?.items.length || 0)));
    void (async () => { for (const file of selected) await uploadFile(file); })();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const hasContent = Boolean(response.trim() || draft?.items.length);
  const uploadBusy = uploads.length > 0;
  const editorVisible = editing && !closed;
  const submittedMeta = work?.submittedAt ? `Submitted ${formatDateTime(work.submittedAt)} · ${submissionTiming(work.submittedAt, deadline)}` : null;

  return <><DataSurface className="h-fit xl:sticky xl:top-6">
    <div className="flex items-start justify-between gap-4 border-b border-ui-border bg-muted/20 px-5 py-4">
      <div className="min-w-0"><h2 className="text-base font-semibold">Your work</h2><p className="mt-1 truncate text-xs text-muted-foreground">{submittedMeta || (deadline ? `Due ${formatDateTime(deadline)}` : 'No deadline')}</p></div>
      <WorkBadge state={assignment.submissionState || 'NOT_SUBMITTED'} student />
    </div>
    <div className="space-y-5 p-5">
      {editorVisible ? <>
        <label className="block space-y-2"><span className="flex items-center justify-between gap-2 text-sm font-medium"><span>Response <span className="font-normal text-muted-foreground">(optional)</span></span><SaveState state={saveState} /></span><Textarea rows={6} value={response} onChange={event => setResponse(event.target.value)} placeholder="Write your response…" /></label>
        <section aria-labelledby="student-attachments-heading">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 id="student-attachments-heading" className="text-sm font-medium">Attachments</h3><p className="mt-0.5 text-xs text-muted-foreground">Add files or links to support your response.</p></div><div className="flex gap-2"><input ref={fileInputRef} type="file" multiple className="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp" onChange={event => chooseFiles(event.target.files)} /><Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadBusy}><Upload />Upload files</Button><Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}><LinkIcon />Add link</Button></div></div>
          <div className={cn('mt-3 divide-y divide-ui-border overflow-hidden rounded-control border border-ui-border transition-colors', dragActive && 'border-ring bg-muted/30')} onDragEnter={event => { event.preventDefault(); setDragActive(true); }} onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragActive(true); }} onDrop={event => { event.preventDefault(); setDragActive(false); if (!uploadBusy) chooseFiles(event.dataTransfer.files); }}>
            {draft?.items.length ? <SubmissionItemList items={draft.items} onRemove={removeItem} /> : uploads.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">Drop files here or choose Upload files.</p>}
            {uploads.map(upload => <UploadRow key={upload.id} upload={upload} onRetry={() => { setUploads(current => current.filter(item => item.id !== upload.id)); void uploadFile(upload.file); }} onRemove={() => setUploads(current => current.filter(item => item.id !== upload.id))} />)}
          </div>
        </section>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ui-border pt-4">
          {draft && hasContent && <Button variant="ghost" disabled={saving || uploadBusy} onClick={() => setDiscardOpen(true)}>Discard changes</Button>}
          <Button disabled={saving || uploadBusy || saveState === 'saving' || !hasContent} onClick={() => void submit()}>{saving ? <><LoadingSpinner />Submitting…</> : <><Send />{submitted ? 'Resubmit' : 'Submit assignment'}</>}</Button>
        </div>
      </> : submitted ? <>
        <section aria-labelledby="submitted-response-heading"><h3 id="submitted-response-heading" className="text-sm font-medium">Response</h3>{submitted.textResponse ? <p className="mt-2 whitespace-pre-wrap rounded-control bg-muted/50 p-3 text-sm leading-6 text-foreground">{submitted.textResponse}</p> : <p className="mt-1 text-xs text-muted-foreground">No written response.</p>}</section>
        <section aria-labelledby="submitted-attachments-heading"><h3 id="submitted-attachments-heading" className="text-sm font-medium">Attachments</h3>{submitted.items.length ? <SubmissionItemList items={submitted.items} readOnly /> : <p className="mt-1 text-xs text-muted-foreground">No attachments.</p>}</section>
        {draft && !closed && <div className="rounded-control border border-ui-border bg-muted/30 p-3"><p className="text-sm font-medium">Unsubmitted changes</p><p className="mt-1 text-xs leading-5 text-muted-foreground">You have a saved draft that your teacher cannot see yet.</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => void beginEditing()} disabled={saving}><Edit />Resume editing</Button><Button size="sm" variant="ghost" onClick={() => setDiscardOpen(true)} disabled={saving}>Discard draft</Button></div></div>}
        {!draft && !closed && <div className="flex justify-end"><Button variant="outline" disabled={saving} onClick={() => void beginEditing()}><Edit />Edit submission</Button></div>}
      </> : <div className="py-2"><p className="text-sm font-medium">No submission</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{closed ? 'This assignment closed before you submitted any work.' : 'Add a response or attachment to submit this assignment.'}</p></div>}
      {closed && <p className="rounded-control border border-ui-border bg-muted/40 p-3 text-xs text-muted-foreground">Submission closed{deadline ? ` on ${formatDateTime(deadline)}` : ''}.</p>}
      {work?.reviewedAt && <section className="border-t border-ui-border pt-4" aria-labelledby="teacher-feedback-heading"><h3 id="teacher-feedback-heading" className="text-sm font-semibold">{staleReview ? 'Previous feedback' : 'Teacher feedback'}</h3>{assignment.maxPoints != null && work.score != null && <p className="mt-3 text-xl font-semibold tabular-nums">{work.score} <span className="text-sm font-normal text-muted-foreground">/ {assignment.maxPoints}</span></p>}{work.feedback && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{work.feedback}</p>}{!work.feedback && work.score == null && <p className="mt-2 text-xs text-muted-foreground">Your teacher marked this submission as reviewed.</p>}<p className="mt-3 text-xs text-muted-foreground">{staleReview ? 'Reviewed before your latest submission' : `Reviewed ${formatDateTime(work.reviewedAt)}`}</p></section>}
    </div>
  </DataSurface>
  <Dialog open={linkOpen} onOpenChange={setLinkOpen}><DialogContent><DialogHeader><DialogTitle>Add link</DialogTitle><DialogDescription>Add a webpage or cloud document to your submission.</DialogDescription></DialogHeader><div className="space-y-4"><label className="space-y-2"><span className="text-sm font-medium">URL</span><Input type="url" value={linkUrl} onChange={event => setLinkUrl(event.target.value)} placeholder="https://…" autoFocus /></label><label className="space-y-2"><span className="text-sm font-medium">Display name <span className="font-normal text-muted-foreground">(optional)</span></span><Input value={linkName} onChange={event => setLinkName(event.target.value)} placeholder="Research notes" /></label></div><DialogFooter><Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button><Button disabled={addingLink || !linkUrl.trim()} onClick={() => void addLink()}>{addingLink && <LoadingSpinner />}Add link</Button></DialogFooter></DialogContent></Dialog>
  <Dialog open={discardOpen} onOpenChange={setDiscardOpen}><DialogContent><DialogHeader><DialogTitle>Discard changes?</DialogTitle><DialogDescription>{submitted ? 'Your saved draft and its draft-only attachments will be removed. Your submitted work will not change.' : 'Your saved response and draft attachments will be permanently removed.'}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDiscardOpen(false)}>Keep editing</Button><Button variant="destructive" disabled={saving} onClick={() => void cancelEditing()}>{saving && <LoadingSpinner />}Discard changes</Button></DialogFooter></DialogContent></Dialog></>;
}

function TeacherStudentWork({ assignmentId, maxPoints, deadline }: { assignmentId: string; maxPoints: number | null; deadline: string | null }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<WorkFilter>('ALL');
  const [data, setData] = useState<WorkListData | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<WorkDetailData | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [mobileStudentsOpen, setMobileStudentsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewDraft, setReviewDraft] = useState<{ studentId: number; score: string; feedback: string } | null>(null);
  const [pendingReviewAction, setPendingReviewAction] = useState<{ type: 'close' } | { type: 'select'; studentId: number } | null>(null);
  const detailRequestRef = useRef(0);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);
  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError('');
    try {
      const params = new URLSearchParams({ status: filter, limit: '100' });
      if (search.trim()) params.set('search', search.trim());
      const response = await axiosClient.get<ApiResponse<WorkListData>, ApiResponse<WorkListData>>(`/api/assignments/${assignmentId}/student-work?${params}`);
      setData(response.data);
      if (!response.data.items.length) setDetail(null);
      setSelectedId(current => response.data.items.some(item => item.student.id === current) ? current : response.data.items[0]?.student.id || null);
      return response.data;
    } catch (requestError) {
      console.error(requestError);
      setData(null);
      setDetail(null);
      setListError(apiError(requestError, 'Unable to load student work.'));
    }
    finally { setLoadingList(false); }
  }, [assignmentId, filter, search]);
  useEffect(() => { const timer = window.setTimeout(() => void loadList(), 200); return () => window.clearTimeout(timer); }, [loadList]);
  const loadDetail = useCallback(async (studentId: number) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setLoadingDetail(true);
    setDetailError('');
    try {
      const response = await axiosClient.get<ApiResponse<WorkDetailData>, ApiResponse<WorkDetailData>>(`/api/assignments/${assignmentId}/student-work/${studentId}`);
      if (detailRequestRef.current === requestId) setDetail(response.data);
      return response.data;
    } catch (requestError) {
      console.error(requestError);
      if (detailRequestRef.current === requestId) {
        setDetail(null);
        setDetailError(apiError(requestError, 'Unable to load the submission.'));
      }
      return null;
    } finally {
      if (detailRequestRef.current === requestId) setLoadingDetail(false);
    }
  }, [assignmentId]);
  useEffect(() => {
    if (!selectedId) {
      detailRequestRef.current += 1;
      setDetail(null);
      setDetailError('');
      setLoadingDetail(false);
      return;
    }
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);
  const afterReview = async (advance: boolean): Promise<'next' | 'complete' | 'same'> => {
    const currentId = selectedId;
    const refreshed = await loadList();
    if (!currentId || !refreshed) return 'same';
    if (advance) {
      const next = refreshed.items.find(item => item.state === 'NEEDS_REVIEW' && item.student.id !== currentId);
      if (next) {
        setDetail(null);
        setLoadingDetail(true);
        setSelectedId(next.student.id);
        return 'next';
      }
    }
    const refreshedDetail = await loadDetail(currentId);
    if (!refreshedDetail) return 'same';
    setSelectedId(currentId);
    return advance && refreshed.summary.needsReview === 0 ? 'complete' : 'same';
  };
  const currentReviewDraft = detail
    ? reviewDraft?.studentId === detail.student.id
      ? reviewDraft
      : { studentId: detail.student.id, score: detail.submission?.score?.toString() || '', feedback: detail.submission?.feedback || '' }
    : null;
  const reviewDirty = Boolean(detail && currentReviewDraft && (
    currentReviewDraft.score !== (detail.submission?.score?.toString() || '')
    || currentReviewDraft.feedback !== (detail.submission?.feedback || '')
  ));
  const commitStudentSelection = (studentId: number) => {
    setReviewDraft(null);
    setDetail(null);
    setDetailError('');
    setLoadingDetail(true);
    setSelectedId(studentId);
    setMobileStudentsOpen(false);
  };
  const selectStudent = (studentId: number) => {
    if (reviewSaving) return;
    if (studentId === selectedId) {
      setMobileStudentsOpen(false);
      return;
    }
    if (reviewOpen && reviewDirty) {
      setPendingReviewAction({ type: 'select', studentId });
      setMobileStudentsOpen(false);
      return;
    }
    commitStudentSelection(studentId);
  };
  const requestReviewClose = () => {
    if (reviewSaving) return;
    if (reviewDirty) {
      setReviewOpen(false);
      setPendingReviewAction({ type: 'close' });
      return;
    }
    setReviewOpen(false);
    setReviewDraft(null);
    window.setTimeout(() => reviewTriggerRef.current?.focus(), 0);
  };
  const keepEditingReview = () => {
    if (pendingReviewAction?.type === 'close') setReviewOpen(true);
    setPendingReviewAction(null);
  };
  const discardPendingReview = () => {
    const action = pendingReviewAction;
    setReviewDraft(null);
    setPendingReviewAction(null);
    if (action?.type === 'select') commitStudentSelection(action.studentId);
    else {
      setReviewOpen(false);
      window.setTimeout(() => reviewTriggerRef.current?.focus(), 0);
    }
  };
  const selectedStudent = data?.items.find(item => item.student.id === selectedId)?.student;
  const navigatorProps = { search, onSearchChange: setSearch, filter, onFilterChange: setFilter, data, selectedId, loading: loadingList, error: listError, controlsDisabled: reviewSaving || (reviewOpen && reviewDirty), selectionDisabled: reviewSaving, onRetry: loadList, onSelect: selectStudent };
  const reviewContent = loadingDetail
    ? <ReviewStatePanel loading onClose={requestReviewClose} />
    : detailError
      ? <ReviewStatePanel title="Review unavailable" description="Reload the selected submission to continue." onClose={requestReviewClose} />
      : detail && currentReviewDraft
        ? <ReviewPanel
          key={`${detail.student.id}-${detail.submission?.submittedAt || 'empty'}`}
          assignmentId={assignmentId}
          detail={detail}
          maxPoints={maxPoints}
          score={currentReviewDraft.score}
          feedback={currentReviewDraft.feedback}
          dirty={reviewDirty}
          onScoreChange={score => setReviewDraft({ ...currentReviewDraft, score })}
          onFeedbackChange={feedback => setReviewDraft({ ...currentReviewDraft, feedback })}
          onCommitted={() => setReviewDraft(null)}
          onClose={requestReviewClose}
          onSavingChange={setReviewSaving}
          onSaved={afterReview}
        />
        : <ReviewStatePanel title="Review" description="Review controls appear after you select a student." onClose={requestReviewClose} />;

  return <section className="space-y-4">
    <div className="space-y-2">
      <div>
        <h2 className="text-base font-semibold">Student work</h2>
        <p className="mt-1 text-xs text-muted-foreground">Choose a student, review the submission, then record points or feedback.</p>
      </div>
      {data && <ReviewSummary summary={data.summary} />}
    </div>
    <Sheet open={mobileStudentsOpen} onOpenChange={setMobileStudentsOpen}>
      <SheetTrigger asChild><Button variant="outline" className="w-full justify-between lg:hidden"><span className="truncate">{selectedStudent?.name || selectedStudent?.email || 'Choose a student'}</span><ChevronDown /></Button></SheetTrigger>
      <SheetContent side="left" className="flex w-[min(90vw,340px)] flex-col p-0 sm:max-w-[340px]">
        <SheetHeader className="border-b border-ui-border px-4 py-4"><SheetTitle>Students</SheetTitle><SheetDescription>Select a student submission to review.</SheetDescription></SheetHeader>
        <StudentNavigator {...navigatorProps} />
      </SheetContent>
    </Sheet>
    <DataSurface className="grid min-h-0 items-start overflow-visible p-0 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden min-h-0 self-stretch border-r border-ui-border lg:block">
        <div className="sticky top-4 flex max-h-[calc(100dvh-12rem)] min-h-0 w-full"><StudentNavigator {...navigatorProps} /></div>
      </aside>

      <div className="min-w-0 lg:min-h-[560px]">
        {loadingDetail
          ? <DetailSkeleton />
          : detailError
            ? <EmptyState surface={false} icon={<TriangleAlert size={22} />} title="Submission unavailable" description={detailError} action={selectedId ? <Button variant="outline" size="sm" onClick={() => void loadDetail(selectedId)}>Try again</Button> : undefined} />
          : detail
            ? <SubmissionViewer key={`${detail.student.id}-${detail.submission?.submittedAt || 'empty'}`} detail={detail} deadline={deadline} reviewOpen={reviewOpen} reviewTriggerRef={reviewTriggerRef} onReview={() => setReviewOpen(true)} />
            : <EmptyState surface={false} icon={<CircleDashed size={22} />} title="Select a student" description="Choose a student to review their latest submission." />}
      </div>

    </DataSurface>
    <Sheet open={reviewOpen} onOpenChange={open => open ? setReviewOpen(true) : requestReviewClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[400px]" showCloseButton={false}>
        <SheetHeader className="sr-only"><SheetTitle>Review {detail?.student.name || detail?.student.email || 'student work'}</SheetTitle><SheetDescription>Add points or feedback for the selected submission.</SheetDescription></SheetHeader>
        {reviewContent}
      </SheetContent>
    </Sheet>
    <Dialog open={Boolean(pendingReviewAction)} onOpenChange={open => { if (!open) keepEditingReview(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Discard unsaved review?</DialogTitle><DialogDescription>Your points or feedback have changed and have not been saved.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={keepEditingReview}>Keep editing</Button><Button variant="destructive" onClick={discardPendingReview}>Discard changes</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}

function StudentNavigator({ search, onSearchChange, filter, onFilterChange, data, selectedId, loading, error, controlsDisabled, selectionDisabled, onRetry, onSelect }: { search: string; onSearchChange: (value: string) => void; filter: WorkFilter; onFilterChange: (value: WorkFilter) => void; data: WorkListData | null; selectedId: number | null; loading: boolean; error: string; controlsDisabled: boolean; selectionDisabled: boolean; onRetry: () => Promise<WorkListData | undefined>; onSelect: (studentId: number) => void }) {
  return <div className="flex min-h-0 w-full flex-1 flex-col">
    <DataToolbar className="flex-col items-stretch">
      <DataToolbarGroup className="w-full flex-col items-stretch">
        <DataToolbarSearch className="w-full" value={search} onChange={event => onSearchChange(event.target.value)} placeholder="Search students…" label="Search students" disabled={controlsDisabled} />
        <WorkFilterMenu value={filter} onChange={onFilterChange} disabled={controlsDisabled} />
      </DataToolbarGroup>
    </DataToolbar>
    <div className="min-h-0 flex-1 overflow-y-auto p-1">
      {loading
        ? <ListSkeleton />
        : error
          ? <EmptyState compact surface={false} icon={<TriangleAlert size={20} />} title="Students unavailable" description={error} action={<Button variant="outline" size="sm" onClick={() => void onRetry()}>Try again</Button>} />
          : !data?.items.length
            ? <EmptyState compact surface={false} title="No students found" description="Try changing the search or status filter." />
            : data.items.map(item => <StudentWorkRow key={item.student.id} item={item} selected={selectedId === item.student.id} disabled={selectionDisabled} onSelect={() => onSelect(item.student.id)} />)}
    </div>
  </div>;
}

function StudentWorkRow({ item, selected, disabled, onSelect }: { item: WorkSummary; selected: boolean; disabled: boolean; onSelect: () => void }) {
  return <Button
    variant="ghost"
    onClick={onSelect}
    disabled={disabled}
    aria-pressed={selected}
    className={cn('h-auto w-full justify-start gap-3 whitespace-normal rounded-control px-3 py-2.5 text-left font-normal', selected && 'bg-muted hover:bg-muted')}
  >
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{initials(item.student.name || item.student.email)}</span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">{item.student.name || item.student.email}</span>
      {item.submittedAt && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{formatShortDateTime(item.submittedAt)}</span>}
    </span>
    <WorkBadge state={item.state} />
  </Button>;
}

function SubmissionViewer({ detail, deadline, reviewOpen, reviewTriggerRef, onReview }: { detail: WorkDetailData; deadline: string | null; reviewOpen: boolean; reviewTriggerRef: RefObject<HTMLButtonElement | null>; onReview: () => void }) {
  const submission = detail.submission;
  const content = submission?.submittedContent || null;
  const fileItems = content?.items.filter(item => item.kind === 'FILE') || [];
  const linkItems = content?.items.filter(item => item.kind === 'LINK' && item.externalUrl) || [];
  const defaultSource = fileItems[0] ? `file:${fileItems[0].id}` : content?.textResponse ? 'response' : linkItems.length ? 'links' : 'empty';
  const [source, setSource] = useState(defaultSource);
  const [opening, setOpening] = useState(false);
  const activeItem = source.startsWith('file:') ? fileItems.find(item => `file:${item.id}` === source) || null : null;
  const sourceCount = fileItems.length + (content?.textResponse ? 1 : 0) + linkItems.length;
  const sourceLabel = activeItem ? itemLabel(activeItem) : source === 'response' ? 'Written response' : source === 'links' ? 'Links' : 'Submission content';

  const openActiveFile = async () => {
    if (!activeItem?.fileAsset) return;
    setOpening(true);
    try {
      const result = await axiosClient.get<ApiResponse<{ url: string }>, ApiResponse<{ url: string }>>(`/api/files/${activeItem.fileAsset.id}/access`);
      window.open(result.data.url, '_blank', 'noopener,noreferrer');
    } catch (requestError) { toast.error(apiError(requestError, 'Unable to open this file.')); }
    finally { setOpening(false); }
  };

  return <div className="flex min-h-[360px] flex-col lg:min-h-[560px]">
    <div className="border-b border-ui-border px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{detail.student.name || detail.student.email}</h3>
          {submission?.submittedAt && <p className="mt-1 text-xs text-muted-foreground">Submitted {formatDateTime(submission.submittedAt)} · {submissionTiming(submission.submittedAt, deadline)}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2"><WorkBadge state={detail.state} />{submission && <Button ref={reviewTriggerRef} variant={reviewOpen ? 'secondary' : 'outline'} size="sm" aria-expanded={reviewOpen} onClick={onReview}>{detail.state === 'REVIEWED' ? 'Edit review' : 'Review'}</Button>}</div>
      </div>
      {submission && isStaleReview(submission) && <p className="mt-2 text-xs font-medium text-warning">Resubmitted after the previous review</p>}
    </div>
    {!submission
      ? <EmptyState surface={false} icon={<CircleDashed size={22} />} title="No submission" description="This student has not submitted work for this assignment." />
      : <div className="min-h-0 flex-1">
        {source !== 'empty' && <div className="flex min-w-0 items-center justify-between gap-3 border-b border-ui-border bg-muted/20 px-4 py-2.5">
          <div className="min-w-0">
            <span className="sr-only">View submission content</span>
            {sourceCount > 1
              ? <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="max-w-[min(70vw,360px)] justify-start"><SubmissionSourceIcon source={source} item={activeItem} /><span className="truncate">{sourceLabel}</span><ChevronDown className="ml-auto" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[min(88vw,340px)]">
                  {(fileItems.length > 0 || content?.textResponse) && <><DropdownMenuLabel>Submission</DropdownMenuLabel><DropdownMenuRadioGroup value={source} onValueChange={setSource}>
                    {fileItems.map(item => <DropdownMenuRadioItem key={item.id} value={`file:${item.id}`}><ResourceIcon mimeType={item.fileAsset?.mimeType} fileName={item.fileAsset?.name} /><span className="truncate">{itemLabel(item)}</span></DropdownMenuRadioItem>)}
                    {content?.textResponse && <DropdownMenuRadioItem value="response"><FileText /><span>Written response</span></DropdownMenuRadioItem>}
                  </DropdownMenuRadioGroup></>}
                  {linkItems.length > 0 && <>{(fileItems.length > 0 || content?.textResponse) && <DropdownMenuSeparator />}<DropdownMenuLabel>Links</DropdownMenuLabel>{linkItems.map(item => <DropdownMenuItem key={item.id} onSelect={() => { if (item.externalUrl) window.open(item.externalUrl, '_blank', 'noopener,noreferrer'); }}><ResourceIcon url={item.externalUrl} /><span className="min-w-0 flex-1 truncate">{itemLabel(item)}</span><ExternalLink /></DropdownMenuItem>)}</>}
                </DropdownMenuContent>
              </DropdownMenu>
              : <div className="flex min-w-0 items-center gap-2 text-sm font-medium"><SubmissionSourceIcon source={source} item={activeItem} /><span className="truncate">{sourceLabel}</span></div>}
          </div>
          {activeItem && <Button variant="ghost" size="sm" disabled={opening || !activeItem.fileAsset} onClick={() => void openActiveFile()}>{opening ? <LoadingSpinner /> : null}Open in new tab<ExternalLink /></Button>}
        </div>}
        {source === 'response' && content?.textResponse
          ? <article className="mx-auto max-w-4xl whitespace-pre-wrap px-6 py-8 text-sm leading-7 text-foreground md:px-8">{content.textResponse}</article>
          : activeItem
            ? <SubmissionResourceViewer key={activeItem.id} item={activeItem} studentName={detail.student.name || detail.student.email} />
            : source === 'links'
              ? <SubmissionLinksView items={linkItems} />
              : <EmptyState surface={false} title="No submission content" description="This submission does not contain a response, file, or link." />}
      </div>}
  </div>;
}

function SubmissionSourceIcon({ source, item }: { source: string; item: SubmissionItem | null }) {
  if (item) return <ResourceIcon mimeType={item.fileAsset?.mimeType} fileName={item.fileAsset?.name} />;
  if (source === 'response') return <FileText />;
  return <LinkIcon />;
}

function SubmissionLinksView({ items }: { items: SubmissionItem[] }) {
  return <div className="mx-auto max-w-3xl px-5 py-8 md:px-8"><h4 className="text-sm font-semibold">Submitted links</h4><div className="mt-3 divide-y divide-ui-border overflow-hidden rounded-control border border-ui-border">{items.map(item => item.externalUrl ? <ResourceLink key={item.id} url={item.externalUrl} title={itemLabel(item)} detail={displayHost(item.externalUrl)} /> : null)}</div></div>;
}

function SubmissionResourceViewer({ item, studentName }: { item: SubmissionItem; studentName: string }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(item.kind === 'FILE');
  const url = item.kind === 'LINK' ? item.externalUrl : fileUrl;
  const mimeType = item.fileAsset?.mimeType || '';
  const kind = item.kind === 'LINK' ? 'link' : mimeType === 'application/pdf' ? 'pdf' : mimeType.startsWith('image/') ? 'image' : 'document';
  const name = itemLabel(item);
  useEffect(() => {
    if (item.kind !== 'FILE' || !item.fileAsset) return;
    let active = true;
    axiosClient.get<ApiResponse<{ url: string }>, ApiResponse<{ url: string }>>(`/api/files/${item.fileAsset.id}/access`)
      .then(result => { if (active) setFileUrl(result.data.url); })
      .catch(requestError => { if (active) toast.error(apiError(requestError, 'Unable to open this file.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [item]);

  if (loading) return <LoadingState className="min-h-[320px] lg:min-h-[440px]" label="Loading file…" />;
  if (!url) return <EmptyState surface={false} title="File unavailable" description="A temporary access link could not be created." />;
  return <div className="flex min-h-[360px] flex-col lg:min-h-[560px]">
    {kind === 'pdf' && <iframe src={url} title={`${studentName} PDF submission`} referrerPolicy="no-referrer" className="h-[60dvh] min-h-[360px] w-full bg-muted/20 lg:h-[72dvh] lg:min-h-[560px] lg:max-h-[840px]" />}
    {kind === 'image' && <div className="flex min-h-[360px] items-start justify-center overflow-auto bg-muted/20 p-4 lg:min-h-[560px]"><img src={url} alt={`${studentName} submission`} className="max-h-[840px] max-w-full rounded-control object-contain" /></div>}
    {(kind === 'document' || kind === 'link') && <div className="flex min-h-[360px] items-center justify-center p-8 lg:min-h-[560px]"><div className="max-w-sm text-center">{kind === 'document' ? <ResourceIcon mimeType={mimeType} fileName={name} className="mx-auto size-8 text-muted-foreground" /> : <ResourceIcon url={url} className="mx-auto size-8 text-muted-foreground" />}<h4 className="mt-3 text-sm font-semibold">{name}</h4><p className="mt-1 break-all text-xs text-muted-foreground">{kind === 'document' ? `${fileTypeLabel(mimeType, name)} preview is not available in the browser. Use Open in new tab above to view the file.` : displayHost(url)}</p></div></div>}
  </div>;
}

function ReviewPanel({ assignmentId, detail, maxPoints, score, feedback, dirty, onScoreChange, onFeedbackChange, onCommitted, onClose, onSavingChange, onSaved }: { assignmentId: string; detail: WorkDetailData; maxPoints: number | null; score: string; feedback: string; dirty: boolean; onScoreChange: (value: string) => void; onFeedbackChange: (value: string) => void; onCommitted: () => void; onClose: () => void; onSavingChange: (saving: boolean) => void; onSaved: (advance: boolean) => Promise<'next' | 'complete' | 'same'> }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const numericScore = score === '' ? null : Number(score);
  const invalidScore = numericScore !== null && (!Number.isFinite(numericScore) || numericScore < 0 || maxPoints == null || numericScore > maxPoints);
  const canSave = !saving && !invalidScore && (detail.state !== 'REVIEWED' || dirty);
  const save = async () => {
    setSaving(true);
    onSavingChange(true);
    setSaveError('');
    try {
      const shouldAdvance = detail.state === 'NEEDS_REVIEW';
      await axiosClient.patch(`/api/assignments/${assignmentId}/student-work/${detail.student.id}/review`, { score: numericScore, feedback });
      onCommitted();
      const outcome = await onSaved(shouldAdvance);
      if (outcome === 'next') toast.success('Review saved. Next submission opened.');
      else if (outcome === 'complete') toast.success('All submitted work has been reviewed.');
      else toast.success('Review saved.');
    } catch (requestError) { setSaveError(apiError(requestError, 'Unable to save the review.')); }
    finally { setSaving(false); onSavingChange(false); }
  };

  const staleReview = detail.submission ? isStaleReview(detail.submission) : false;
  const reviewMeta = detail.submission?.reviewedAt && !staleReview
    ? `Last reviewed ${formatDateTime(detail.submission.reviewedAt)}`
    : staleReview ? 'Previous review is out of date' : 'Not reviewed yet';

  return <div className="flex h-full min-h-[360px] flex-col bg-surface">
    <div className="flex items-start justify-between gap-3 border-b border-ui-border px-5 py-4">
      <div className="min-w-0"><h3 className="text-sm font-semibold">Review</h3><p className="mt-1 truncate text-xs font-medium text-foreground">{detail.student.name || detail.student.email}</p>
      <p className="mt-1 text-xs text-muted-foreground">{reviewMeta}</p>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Close review" disabled={saving} onClick={onClose}><X /></Button>
    </div>
    {!detail.submission
      ? <EmptyState compact surface={false} icon={<CircleDashed size={22} />} title="Nothing to review" description="Review controls become available after this student submits work." />
      : <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); if (canSave) void save(); }}><div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {maxPoints != null && <label className="space-y-2">
          <span className="block text-xs font-medium">Points</span>
          <span className="flex items-center gap-2"><Input type="number" min={0} max={maxPoints} step="any" value={score} onChange={event => onScoreChange(event.target.value)} aria-invalid={invalidScore || undefined} /><span className="shrink-0 text-sm text-muted-foreground">/ {maxPoints}</span></span>
          {invalidScore && <span className="block text-xs text-destructive">Enter a score from 0 to {maxPoints}.</span>}
        </label>}
        <label className="space-y-2">
          <span className="block text-xs font-medium">Feedback <span className="font-normal text-muted-foreground">(optional)</span></span>
          <Textarea rows={10} value={feedback} onChange={event => onFeedbackChange(event.target.value)} placeholder="Share feedback with this student…" />
        </label>
        {saveError && <p role="alert" className="rounded-control border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{saveError}</p>}
      </div>
      <div className="border-t border-ui-border bg-surface p-4"><Button type="submit" className="w-full" disabled={!canSave}>{saving ? <><LoadingSpinner />Saving…</> : 'Save review'}</Button>{detail.state === 'REVIEWED' && !dirty && <p className="mt-2 text-center text-xs text-muted-foreground">No changes to save.</p>}</div></form>}
  </div>;
}

function ReviewStatePanel({ loading = false, title = 'Review', description = '', onClose }: { loading?: boolean; title?: string; description?: string; onClose: () => void }) {
  return <div className="flex h-full min-h-[360px] flex-col bg-surface">
    <div className="flex items-center justify-between gap-3 border-b border-ui-border px-5 py-4"><h3 className="text-sm font-semibold">Review</h3><Button variant="ghost" size="icon-sm" aria-label="Close review" onClick={onClose}><X /></Button></div>
    {loading ? <ReviewSkeleton /> : <EmptyState compact surface={false} title={title} description={description} />}
  </div>;
}

function ReviewSummary({ summary }: { summary: WorkListData['summary'] }) {
  return <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
    <span><b className="font-semibold text-foreground">{summary.assigned}</b> students</span>
    <span aria-hidden>·</span>
    <span><b className="font-semibold text-foreground">{summary.submitted}</b> submitted</span>
    <span aria-hidden>·</span>
    <span><b className="font-semibold text-foreground">{summary.needsReview}</b> to review</span>
    <span aria-hidden>·</span>
    <span><b className="font-semibold text-foreground">{summary.reviewed}</b> reviewed</span>
    {summary.pending > 0 && <><span aria-hidden>·</span><span><b className="font-semibold text-foreground">{summary.pending}</b> pending</span></>}
    {summary.missing > 0 && <><span aria-hidden>·</span><span><b className="font-semibold text-foreground">{summary.missing}</b> missing</span></>}
  </div>;
}

function SubmissionItemList({ items, onRemove, readOnly = false }: { items: SubmissionItem[]; onRemove?: (id: string) => void; readOnly?: boolean }) {
  if (!items.length) return null;
  return <div className={cn('divide-y divide-ui-border', readOnly && 'mt-3 rounded-control border border-ui-border')}>
    {items.map(item => <SubmissionItemRow key={item.id} item={item} onRemove={onRemove} />)}
  </div>;
}

function SubmissionItemRow({ item, onRemove }: { item: SubmissionItem; onRemove?: (id: string) => void }) {
  const [opening, setOpening] = useState(false);
  const open = async () => {
    if (item.kind === 'LINK' && item.externalUrl) {
      window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!item.fileAsset) return;
    setOpening(true);
    try {
      const result = await axiosClient.get<ApiResponse<{ url: string }>, ApiResponse<{ url: string }>>(`/api/files/${item.fileAsset.id}/access`);
      window.open(result.data.url, '_blank', 'noopener,noreferrer');
    } catch (requestError) { toast.error(apiError(requestError, 'Unable to open this file.')); }
    finally { setOpening(false); }
  };
  const detail = item.kind === 'FILE' && item.fileAsset
    ? `${fileTypeLabel(item.fileAsset.mimeType, item.fileAsset.name)} · ${formatBytes(item.fileAsset.sizeBytes)}`
    : item.externalUrl ? displayHost(item.externalUrl) : 'External link';
  return <Attachment className="rounded-none border-0 focus-within:ring-0">
    <AttachmentMedia><ResourceIcon url={item.kind === 'LINK' ? item.externalUrl : undefined} mimeType={item.fileAsset?.mimeType} fileName={item.fileAsset?.name} /></AttachmentMedia>
    <Button type="button" variant="ghost" className="h-auto min-w-0 flex-1 justify-start rounded-none p-0 text-left font-normal hover:bg-transparent" onClick={() => void open()}>
      <AttachmentContent><AttachmentTitle className="group-hover/button:underline">{itemLabel(item)}</AttachmentTitle><AttachmentDescription>{detail}</AttachmentDescription></AttachmentContent>
    </Button>
    {opening && <LoadingSpinner className="text-muted-foreground" />}
    {onRemove && <AttachmentActions><Button type="button" size="icon-xs" variant="ghost" aria-label={`Remove ${itemLabel(item)}`} onClick={() => onRemove(item.id)}><X /></Button></AttachmentActions>}
  </Attachment>;
}

function UploadRow({ upload, onRetry, onRemove }: { upload: { file: File; progress: number; error?: string }; onRetry: () => void; onRemove: () => void }) {
  return <Attachment state={upload.error ? 'error' : 'uploading'} className="rounded-none border-0 focus-within:ring-0">
    <AttachmentMedia><ResourceIcon mimeType={upload.file.type} fileName={upload.file.name} /></AttachmentMedia>
    <AttachmentContent><AttachmentTitle>{upload.file.name}</AttachmentTitle>{upload.error ? <AttachmentDescription className="text-destructive">{upload.error}</AttachmentDescription> : <><AttachmentDescription>Uploading {upload.progress}%</AttachmentDescription><Progress className="mt-1.5" value={upload.progress} /></>}</AttachmentContent>
    {upload.error ? <AttachmentActions><Button type="button" size="icon-xs" variant="ghost" aria-label={`Retry ${upload.file.name}`} onClick={onRetry}><RotateCcw /></Button><Button type="button" size="icon-xs" variant="ghost" aria-label={`Remove ${upload.file.name}`} onClick={onRemove}><X /></Button></AttachmentActions> : <LoadingSpinner className="text-muted-foreground" />}
  </Attachment>;
}

function SaveState({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'saving') return <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground"><LoadingSpinner size="xs" />Saving…</span>;
  if (state === 'saved') return <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground"><Check className="size-3" />Saved</span>;
  if (state === 'error') return <span className="text-xs font-normal text-destructive">Couldn’t save</span>;
  return null;
}

function uploadToSignedUrl(url: string, file: File, headers: Record<string, string>, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Upload failed with status ${request.status}.`));
    request.onerror = () => reject(new Error('The upload connection failed.'));
    request.send(file);
  });
}

function WorkFilterMenu({ value, onChange, disabled = false }: { value: WorkFilter; onChange: (value: WorkFilter) => void; disabled?: boolean }) { const labels: Record<WorkFilter, string> = { ALL: 'All students', NEEDS_REVIEW: 'Needs review', REVIEWED: 'Reviewed', MISSING: 'Missing', NOT_SUBMITTED: 'Not submitted' }; return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="justify-between lg:w-full" disabled={disabled}>{labels[value]}<ChevronDown size={14} /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-52"><DropdownMenuLabel>Student work status</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={value} onValueChange={next => onChange(next as WorkFilter)}>{Object.entries(labels).map(([key, label]) => <DropdownMenuRadioItem key={key} value={key}>{label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>; }
function WorkBadge({ state, student = false }: { state: WorkState; student?: boolean }) { const config: Record<WorkState, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }> = { NOT_SUBMITTED: { label: 'Not submitted', tone: 'neutral' }, NEEDS_REVIEW: { label: student ? 'Submitted' : 'Needs review', tone: 'warning' }, REVIEWED: { label: 'Reviewed', tone: 'success' }, MISSING: { label: 'Missing', tone: 'danger' } }; return <Badge tone={config[state].tone} className="shrink-0">{config[state].label}</Badge>; }
function ResourceLink({ url, title, detail, fileName }: { url: string; title: string; detail: string; fileName?: string }) { return <Attachment asChild className="group rounded-none border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><a href={url} target="_blank" rel="noreferrer"><AttachmentMedia><ResourceIcon url={fileName ? undefined : url} fileName={fileName} /></AttachmentMedia><AttachmentContent><AttachmentTitle className="group-hover:underline">{title}</AttachmentTitle><AttachmentDescription>{detail}</AttachmentDescription></AttachmentContent><ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" /></a></Attachment>; }
function AssignmentSkeleton() { return <div className="mx-auto max-w-screen-2xl space-y-4 p-4 md:p-6" aria-label="Loading assignment"><Skeleton className="h-20" /><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,400px)]"><Skeleton className="h-72" /><Skeleton className="h-72" /></div></div>; }
function ListSkeleton() { return <div className="space-y-1 p-1">{Array.from({ length: 6 }, (_, index) => <div key={index} className="flex h-14 items-center gap-3 px-2"><Skeleton className="size-8 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-2.5 w-1/2" /></div></div>)}</div>; }
function DetailSkeleton() { return <div className="space-y-5 p-5"><Skeleton className="h-5 w-44" /><Skeleton className="h-28" /><Skeleton className="h-24" /></div>; }
function ReviewSkeleton() { return <div className="space-y-5 p-5"><Skeleton className="h-5 w-24" /><Skeleton className="h-10" /><Skeleton className="h-40" /></div>; }
function formatDate(value: string) { return format(parseISO(value), 'MMM d, yyyy'); }
function formatDateTime(value: string) { return format(parseISO(value), 'MMM d, yyyy · HH:mm'); }
function formatShortDateTime(value: string) { return format(parseISO(value), 'MMM d · HH:mm'); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function isStaleReview(submission: Submission) { return Boolean(submission.reviewedAt && submission.submittedAt && new Date(submission.reviewedAt) < new Date(submission.submittedAt)); }
function itemLabel(item: SubmissionItem) { return item.displayName || item.fileAsset?.name || (item.externalUrl ? getLinkPresentation(item.externalUrl).label : 'Attachment'); }
function mimeTypeForFile(file: File) { if (file.type) return file.type; const extension = file.name.split('.').at(-1)?.toLowerCase(); const types: Record<string, string> = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain', csv: 'text/csv', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }; return extension ? types[extension] || '' : ''; }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function submissionTiming(submittedAt: string, deadline: string | null) { if (!deadline) return 'No deadline'; const submitted = new Date(submittedAt).getTime(); const due = new Date(deadline).getTime(); if (!Number.isFinite(submitted) || !Number.isFinite(due)) return 'Timing unavailable'; if (submitted <= due) return 'On time'; const lateHours = Math.max(1, Math.ceil((submitted - due) / 3_600_000)); if (lateHours < 24) return `${lateHours}h late`; const lateDays = Math.ceil(lateHours / 24); return `${lateDays} day${lateDays === 1 ? '' : 's'} late`; }
function apiError(error: unknown, fallback: string) { return (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error || (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback; }
function sanitizeHtml(value: string) { if (typeof DOMParser === 'undefined') return ''; const document = new DOMParser().parseFromString(value, 'text/html'); document.querySelectorAll('script,style,iframe,object,embed,form').forEach(node => node.remove()); document.body.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attribute => { if (attribute.name.toLowerCase().startsWith('on') || ((attribute.name === 'href' || attribute.name === 'src') && /^\s*javascript:/i.test(attribute.value))) node.removeAttribute(attribute.name); })); return document.body.innerHTML; }
