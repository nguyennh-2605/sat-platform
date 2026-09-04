import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronDown, CircleDashed, Edit, ExternalLink, FileImage, FileText, Link as LinkIcon, LoaderCircle, MoreHorizontal, Send, Trash2, TriangleAlert } from 'lucide-react';
import toast from 'react-hot-toast';

import { Badge, Button, EmptyState, Input, Modal, PageHeader, Tabs } from '@/components/ui/AppUI';
import { buttonVariants } from '@/components/ui/button';
import { DataSurface, DataToolbar, DataToolbarGroup, DataToolbarSearch } from '@/components/ui/data-surface';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import axiosClient from '@/lib/axios';
import { cn } from '@/lib/utils';
import { capitalizeFirstLetter } from '@/utils/text';
import { AssignmentComposer, type ActivityStudent } from '../classroom/activity-composer/ActivityComposers';
import { useDashboardBack } from '../navigation/DashboardBackContext';

type WorkState = 'NOT_SUBMITTED' | 'NEEDS_REVIEW' | 'REVIEWED' | 'MISSING';
type WorkFilter = 'ALL' | WorkState;
type TeacherView = 'overview' | 'student-work';

interface Submission {
  id: string;
  studentId: number;
  textResponse: string | null;
  fileUrl: string | null;
  score: number | null;
  feedback: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewState?: WorkState;
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
    ? `Assignment · Week ${String(assignment.activity.lesson.week.order + 1).padStart(2, '0')} · Session ${String(assignment.activity.lesson.order + 1).padStart(2, '0')}`
    : 'Assignment · No week · No session';

  return <div className="h-full overflow-y-auto bg-background">
    <main className="mx-auto flex max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title={capitalizeFirstLetter(assignment.title)}
        description={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span>{placement}</span><span>Assigned {formatDate(assignment.createdAt)}</span><span>{deadline ? `Due ${formatDateTime(deadline)}` : 'No deadline'}</span></span>}
        actions={!isStudent ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Assignment actions"><MoreHorizontal size={17} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setEditOpen(true)}><Edit />Edit assignment</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}><Trash2 />Delete assignment</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : undefined}
      />
      {!isStudent && <Tabs
        items={[
          { value: 'overview' as const, label: 'Overview', panelId: 'assignment-overview' },
          { value: 'student-work' as const, label: 'Student work', panelId: 'assignment-student-work' },
        ]}
        value={teacherView}
        onValueChange={view => {
          const params = new URLSearchParams(location.search);
          if (view === 'student-work') params.set('view', 'student-work');
          else params.delete('view');
          navigate({ search: params.toString() }, { replace: true });
        }}
        ariaLabel="Assignment view"
      />}
      {isStudent
        ? <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"><AssignmentContent assignment={assignment} /><StudentSubmissionPanel key={assignment.mySubmission?.submittedAt || 'empty'} assignment={assignment} deadline={deadline} onSubmitted={loadAssignment} /></div>
        : teacherView === 'overview'
          ? <section id="assignment-overview" role="tabpanel"><AssignmentContent assignment={assignment} /></section>
          : <TeacherStudentWork assignmentId={assignmentId} maxPoints={assignment.maxPoints} deadline={deadline} />}
    </main>
    <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} closeOnBackdrop title="Delete assignment?" subtitle="This permanently deletes the assignment and its student submissions." footer={<><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={() => void deleteAssignment()}>Delete permanently</Button></>}><p className="text-sm text-muted-foreground">You are about to delete <span className="font-medium text-foreground">{assignment.title}</span>. This action cannot be undone.</p></Modal>
    <AssignmentComposer open={editOpen} onClose={() => setEditOpen(false)} classId={classId} students={[]} assignment={assignment} onCreated={loadAssignment} />
  </div>;
}

function AssignmentContent({ assignment }: { assignment: AssignmentData }) {
  const hasAttachments = Boolean(assignment.fileUrls.length || assignment.links.length);
  return <div className="min-w-0 space-y-4">
    <DataSurface className="p-5 md:p-6"><h2 className="text-base font-semibold text-foreground">Instructions</h2>{assignment.content ? <div className="prose mt-4 max-w-none text-foreground marker:text-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(assignment.content) }} /> : <p className="mt-3 text-sm text-muted-foreground">No instructions were provided.</p>}</DataSurface>
    {hasAttachments && <DataSurface className="p-5 md:p-6"><h2 className="text-base font-semibold text-foreground">Resources</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{assignment.fileUrls.map((url, index) => <ResourceLink key={`file-${index}`} url={url} title={fileName(url, index)} detail="Shared file" icon={<FileText size={17} />} />)}{assignment.links.map((url, index) => <ResourceLink key={`link-${index}`} url={url} title="External link" detail={url} icon={<LinkIcon size={17} />} />)}</div></DataSurface>}
    {assignment.selectedTests && assignment.selectedTests.length > 0 && <DataSurface className="p-5 md:p-6"><h2 className="text-base font-semibold text-foreground">Legacy attached tests</h2><p className="mt-1 text-xs text-muted-foreground">New tests are assigned as independent Activities.</p><div className="mt-4 space-y-2">{assignment.selectedTests.map(test => <div key={test.id} className="flex items-center justify-between gap-3 rounded-control border border-ui-border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{capitalizeFirstLetter(test.title)}</p><p className="text-xs text-muted-foreground">{test.subject} · {test.questionCount} questions</p></div><Badge tone="neutral">{test.mode === 'EXAM' ? 'Exam' : 'Practice'}</Badge></div>)}</div></DataSurface>}
  </div>;
}

function StudentSubmissionPanel({ assignment, deadline, onSubmitted }: { assignment: AssignmentData; deadline: string | null; onSubmitted: () => Promise<void> | void }) {
  const submission = assignment.mySubmission || null;
  const [editing, setEditing] = useState(!submission);
  const [type, setType] = useState<'TEXT' | 'LINK'>(submission?.fileUrl ? 'LINK' : 'TEXT');
  const [content, setContent] = useState(submission?.fileUrl || submission?.textResponse || '');
  const [saving, setSaving] = useState(false);
  const closed = assignment.activity?.status === 'CLOSED' || Boolean(deadline && new Date(deadline) < new Date());
  const staleReview = Boolean(submission?.reviewedAt && new Date(submission.reviewedAt) < new Date(submission.submittedAt));
  const submit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await axiosClient.put(`/api/assignments/${assignment.id}/submission`, { textResponse: type === 'TEXT' ? content.trim() : null, fileUrl: type === 'LINK' ? content.trim() : null });
      toast.success(submission ? 'Assignment resubmitted' : 'Assignment submitted');
      await onSubmitted();
      setEditing(false);
    } catch (requestError) { toast.error(apiError(requestError, 'Unable to submit the assignment.')); }
    finally { setSaving(false); }
  };
  return <DataSurface className="h-fit lg:sticky lg:top-6"><div className="flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3"><h2 className="text-sm font-semibold">Your work</h2><WorkBadge state={assignment.submissionState || 'NOT_SUBMITTED'} student /></div><div className="space-y-4 p-4">
    {submission && !editing ? <><div><p className="text-xs text-muted-foreground">Submitted {formatDateTime(submission.submittedAt)}</p>{submission.textResponse && <p className="mt-3 whitespace-pre-wrap rounded-control bg-muted/50 p-3 text-sm leading-6 text-foreground">{submission.textResponse}</p>}{submission.fileUrl && <SubmittedResource url={submission.fileUrl} className="mt-3 flex" />}</div>{!closed && <Button variant="outline" className="w-full" onClick={() => setEditing(true)}>Edit submission</Button>}</> : <><Tabs className="grid w-full grid-cols-2" items={[{ value: 'TEXT' as const, label: 'Write response' }, { value: 'LINK' as const, label: 'Share link' }]} value={type} onValueChange={value => { setType(value); setContent(value === 'LINK' ? submission?.fileUrl || '' : submission?.textResponse || ''); }} ariaLabel="Submission type" tabClassName="w-full" />{type === 'TEXT' ? <Textarea rows={7} value={content} onChange={event => setContent(event.target.value)} placeholder="Write your response…" /> : <div className="relative"><LinkIcon className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="w-full pl-9" value={content} onChange={event => setContent(event.target.value)} placeholder="Paste an http(s) link…" /></div>}<div className="flex gap-2">{submission && <Button variant="outline" className="flex-1" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>}<Button className="flex-1" disabled={saving || closed || !content.trim()} onClick={() => void submit()}>{saving ? <><LoaderCircle className="animate-spin" />Submitting…</> : <><Send size={15} />{submission ? 'Resubmit' : 'Submit'}</>}</Button></div></>}
    {closed && <p className="rounded-control border border-ui-border bg-muted/40 p-3 text-xs text-muted-foreground">Submission closed{deadline ? ` on ${formatDateTime(deadline)}` : ''}.</p>}
    {submission?.reviewedAt && <div className="border-t border-ui-border pt-4"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{staleReview ? 'Previous review' : 'Teacher review'}</h3>{!staleReview && <Badge tone="success">Reviewed</Badge>}</div>{assignment.maxPoints && submission.score != null && <p className="mt-3 text-xl font-semibold tabular-nums">{submission.score} <span className="text-sm font-normal text-muted-foreground">/ {assignment.maxPoints}</span></p>}{submission.feedback && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{submission.feedback}</p>}{!submission.feedback && submission.score == null && <p className="mt-2 text-xs text-muted-foreground">Your teacher marked this submission as reviewed.</p>}</div>}
  </div></DataSurface>;
}

function TeacherStudentWork({ assignmentId, maxPoints, deadline }: { assignmentId: string; maxPoints: number | null; deadline: string | null }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<WorkFilter>('ALL');
  const [data, setData] = useState<WorkListData | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<WorkDetailData | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ status: filter, limit: '100' });
      if (search.trim()) params.set('search', search.trim());
      const response = await axiosClient.get<ApiResponse<WorkListData>, ApiResponse<WorkListData>>(`/api/assignments/${assignmentId}/student-work?${params}`);
      setData(response.data);
      if (!response.data.items.length) setDetail(null);
      setSelectedId(current => response.data.items.some(item => item.student.id === current) ? current : response.data.items[0]?.student.id || null);
      return response.data;
    } catch (requestError) { console.error(requestError); toast.error('Unable to load student work.'); }
    finally { setLoadingList(false); }
  }, [assignmentId, filter, search]);
  useEffect(() => { const timer = window.setTimeout(() => void loadList(), 200); return () => window.clearTimeout(timer); }, [loadList]);
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setLoadingDetail(true);
    axiosClient.get<ApiResponse<WorkDetailData>, ApiResponse<WorkDetailData>>(`/api/assignments/${assignmentId}/student-work/${selectedId}`)
      .then(response => { if (active) setDetail(response.data); })
      .catch(requestError => { console.error(requestError); toast.error('Unable to load the submission.'); })
      .finally(() => { if (active) setLoadingDetail(false); });
    return () => { active = false; };
  }, [assignmentId, selectedId]);
  const loadDetail = useCallback(async (studentId: number) => {
    const response = await axiosClient.get<ApiResponse<WorkDetailData>, ApiResponse<WorkDetailData>>(`/api/assignments/${assignmentId}/student-work/${studentId}`);
    setDetail(response.data);
  }, [assignmentId]);
  const afterReview = async (advance: boolean): Promise<'next' | 'complete' | 'same'> => {
    const currentId = selectedId;
    const refreshed = await loadList();
    if (!currentId || !refreshed) return 'same';
    if (advance) {
      const next = refreshed.items.find(item => item.state === 'NEEDS_REVIEW' && item.student.id !== currentId);
      if (next) {
        setSelectedId(next.student.id);
        return 'next';
      }
    }
    await loadDetail(currentId);
    setSelectedId(currentId);
    return advance && refreshed.summary.needsReview === 0 ? 'complete' : 'same';
  };

  return <section id="assignment-student-work" role="tabpanel" className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">Student work</h2>
        <p className="mt-1 text-xs text-muted-foreground">Choose a student, review the submission, then record points or feedback.</p>
      </div>
      {data && <ReviewSummary summary={data.summary} />}
    </div>
    <div className="grid min-h-[620px] items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px]">
      <DataSurface className="flex min-h-0 flex-col lg:sticky lg:top-4">
        <DataToolbar className="lg:flex-col lg:items-stretch">
          <DataToolbarGroup className="w-full lg:flex-col lg:items-stretch">
            <DataToolbarSearch className="lg:w-full" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search students…" label="Search students" />
            <WorkFilterMenu value={filter} onChange={setFilter} />
          </DataToolbarGroup>
        </DataToolbar>
        <div className="max-h-72 min-h-0 overflow-y-auto p-1 lg:max-h-[calc(100dvh-19rem)]">
          {loadingList
            ? <ListSkeleton />
            : !data?.items.length
              ? <EmptyState compact surface={false} title="No students found" description="Try changing the search or status filter." />
              : data.items.map(item => <StudentWorkRow key={item.student.id} item={item} selected={selectedId === item.student.id} onSelect={() => setSelectedId(item.student.id)} />)}
        </div>
      </DataSurface>

      <DataSurface className="min-h-[520px] overflow-hidden">
        {loadingDetail
          ? <DetailSkeleton />
          : detail
            ? <SubmissionViewer key={`${detail.student.id}-${detail.submission?.submittedAt || 'empty'}`} detail={detail} deadline={deadline} />
            : <EmptyState surface={false} icon={<CircleDashed size={22} />} title="Select a student" description="Choose a student to review their latest submission." />}
      </DataSurface>

      <DataSurface className="min-h-[360px] lg:col-start-2 xl:col-start-auto xl:sticky xl:top-4">
        {loadingDetail
          ? <ReviewSkeleton />
          : detail
            ? <ReviewPanel key={`${detail.student.id}-${detail.submission?.submittedAt || 'empty'}`} assignmentId={assignmentId} detail={detail} maxPoints={maxPoints} onSaved={afterReview} />
            : <EmptyState compact surface={false} title="Review" description="Review controls appear after you select a student." />}
      </DataSurface>
    </div>
  </section>;
}

function StudentWorkRow({ item, selected, onSelect }: { item: WorkSummary; selected: boolean; onSelect: () => void }) {
  return <button
    type="button"
    onClick={onSelect}
    className={cn('flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selected && 'bg-muted')}
  >
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{initials(item.student.name || item.student.email)}</span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">{item.student.name || item.student.email}</span>
      {item.submittedAt && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{formatShortDateTime(item.submittedAt)}</span>}
    </span>
    <WorkBadge state={item.state} />
  </button>;
}

function SubmissionViewer({ detail, deadline }: { detail: WorkDetailData; deadline: string | null }) {
  const submission = detail.submission;
  const sources = submission ? [
    ...(submission.textResponse ? [{ value: 'response' as const, label: 'Response' }] : []),
    ...(submission.fileUrl ? [{ value: 'resource' as const, label: resourceTabLabel(submission.fileUrl) }] : []),
  ] : [];
  const [source, setSource] = useState<'response' | 'resource'>(sources[0]?.value || 'response');

  return <div className="flex min-h-[520px] flex-col">
    <div className="border-b border-ui-border px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{detail.student.name || detail.student.email}</h3>
          {submission && <p className="mt-1 text-xs text-muted-foreground">Submitted {formatDateTime(submission.submittedAt)} · {submissionTiming(submission.submittedAt, deadline)}</p>}
        </div>
        <WorkBadge state={detail.state} />
      </div>
      {submission && isStaleReview(submission) && <p className="mt-2 text-xs font-medium text-warning">Resubmitted after the previous review</p>}
    </div>
    {!submission
      ? <EmptyState surface={false} icon={<CircleDashed size={22} />} title="No submission" description="This student has not submitted work for this assignment." />
      : <div className="flex min-h-0 flex-1 flex-col">
        {sources.length > 1 && <div className="border-b border-ui-border px-4 py-2"><Tabs items={sources} value={source} onValueChange={setSource} ariaLabel="Submission content" /></div>}
        <div className="min-h-0 flex-1">
          {source === 'response' && submission.textResponse
            ? <article className="mx-auto max-w-3xl whitespace-pre-wrap px-6 py-7 text-sm leading-7 text-foreground">{submission.textResponse}</article>
            : submission.fileUrl
              ? <SubmissionResourceViewer url={submission.fileUrl} studentName={detail.student.name || detail.student.email} />
              : <EmptyState surface={false} title="No response" description="This submission does not contain a written response." />}
        </div>
      </div>}
  </div>;
}

function SubmissionResourceViewer({ url, studentName }: { url: string; studentName: string }) {
  const kind = resourceKind(url);
  const name = submittedFileName(url);
  return <div className="flex min-h-[520px] flex-col">
    <div className="flex items-center justify-between gap-3 border-b border-ui-border bg-muted/20 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">{kind === 'image' ? <FileImage size={16} className="shrink-0 text-muted-foreground" /> : <FileText size={16} className="shrink-0 text-muted-foreground" />}<span className="truncate">{name}</span></div>
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary hover:underline">Open in new tab<ExternalLink size={13} /></a>
    </div>
    {kind === 'pdf' && <iframe src={url} title={`${studentName} PDF submission`} referrerPolicy="no-referrer" className="h-[640px] w-full bg-muted/20" />}
    {kind === 'image' && <div className="flex min-h-[520px] items-start justify-center overflow-auto bg-muted/20 p-4"><img src={url} alt={`${studentName} submission`} className="max-h-[720px] max-w-full rounded-control object-contain" /></div>}
    {(kind === 'document' || kind === 'link') && <div className="flex min-h-[440px] items-center justify-center p-8"><div className="max-w-sm text-center">{kind === 'document' ? <FileText className="mx-auto size-8 text-muted-foreground" /> : <ExternalLink className="mx-auto size-8 text-muted-foreground" />}<h4 className="mt-3 text-sm font-semibold">{kind === 'document' ? name : 'External submission'}</h4><p className="mt-1 break-all text-xs text-muted-foreground">{kind === 'document' ? `${fileTypeLabel(url)} preview is not available in the browser.` : displayHost(url)}</p><a href={url} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4')}>{kind === 'document' ? 'Open file' : 'Open link'}<ExternalLink size={14} /></a></div></div>}
  </div>;
}

function ReviewPanel({ assignmentId, detail, maxPoints, onSaved }: { assignmentId: string; detail: WorkDetailData; maxPoints: number | null; onSaved: (advance: boolean) => Promise<'next' | 'complete' | 'same'> }) {
  const [score, setScore] = useState(detail.submission?.score?.toString() || '');
  const [feedback, setFeedback] = useState(detail.submission?.feedback || '');
  const [saving, setSaving] = useState(false);
  const numericScore = score === '' ? null : Number(score);
  const invalidScore = numericScore !== null && (!Number.isFinite(numericScore) || numericScore < 0 || !maxPoints || numericScore > maxPoints);
  const save = async () => {
    setSaving(true);
    try {
      const shouldAdvance = detail.state === 'NEEDS_REVIEW';
      await axiosClient.patch(`/api/assignments/${assignmentId}/student-work/${detail.student.id}/review`, { score: numericScore, feedback });
      const outcome = await onSaved(shouldAdvance);
      if (outcome === 'next') toast.success('Review saved. Next submission opened.');
      else if (outcome === 'complete') toast.success('All submitted work has been reviewed.');
      else toast.success('Review saved.');
    } catch (requestError) { toast.error(apiError(requestError, 'Unable to save the review.')); }
    finally { setSaving(false); }
  };

  return <div className="flex min-h-[360px] flex-col">
    <div className="flex items-center justify-between gap-3 border-b border-ui-border px-5 py-4">
      <h3 className="text-sm font-semibold">Review</h3>
      <WorkBadge state={detail.state} />
    </div>
    {!detail.submission
      ? <EmptyState compact surface={false} icon={<CircleDashed size={22} />} title="Nothing to review" description="Review controls become available after this student submits work." />
      : <div className="space-y-4 p-5">
        {isStaleReview(detail.submission) && <p className="rounded-control border border-warning/30 bg-warning/10 p-3 text-xs text-warning">This submission changed after the previous review.</p>}
        {maxPoints && <label className="space-y-2">
          <span className="block text-xs font-medium">Points</span>
          <span className="flex items-center gap-2"><Input type="number" min={0} max={maxPoints} step="any" value={score} onChange={event => setScore(event.target.value)} aria-invalid={invalidScore || undefined} /><span className="shrink-0 text-sm text-muted-foreground">/ {maxPoints}</span></span>
          {invalidScore && <span className="block text-xs text-destructive">Enter a score from 0 to {maxPoints}.</span>}
        </label>}
        <label className="space-y-2">
          <span className="block text-xs font-medium">Feedback <span className="font-normal text-muted-foreground">(optional)</span></span>
          <Textarea rows={8} value={feedback} onChange={event => setFeedback(event.target.value)} placeholder="Share feedback with this student…" />
        </label>
        <Button className="w-full" disabled={saving || invalidScore} onClick={() => void save()}>
          {saving ? <><LoaderCircle className="animate-spin" />Saving…</> : detail.state === 'REVIEWED' ? 'Update review' : 'Mark as reviewed'}
        </Button>
      </div>}
  </div>;
}

function ReviewSummary({ summary }: { summary: WorkListData['summary'] }) {
  return <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
    <span><b className="font-semibold text-foreground">{summary.submitted}/{summary.assigned}</b> submitted</span>
    <span aria-hidden>·</span>
    <span><b className="font-semibold text-foreground">{summary.needsReview}</b> to review</span>
    {summary.pending > 0 && <><span aria-hidden>·</span><span><b className="font-semibold text-foreground">{summary.pending}</b> pending</span></>}
    {summary.missing > 0 && <><span aria-hidden>·</span><span><b className="font-semibold text-foreground">{summary.missing}</b> missing</span></>}
  </div>;
}

function WorkFilterMenu({ value, onChange }: { value: WorkFilter; onChange: (value: WorkFilter) => void }) { const labels: Record<WorkFilter, string> = { ALL: 'All students', NEEDS_REVIEW: 'Needs review', REVIEWED: 'Reviewed', MISSING: 'Missing', NOT_SUBMITTED: 'Not submitted' }; return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="justify-between lg:w-full">{labels[value]}<ChevronDown size={14} /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-52"><DropdownMenuLabel>Student work status</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={value} onValueChange={next => onChange(next as WorkFilter)}>{Object.entries(labels).map(([key, label]) => <DropdownMenuRadioItem key={key} value={key}>{label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>; }
function WorkBadge({ state, student = false }: { state: WorkState; student?: boolean }) { const config: Record<WorkState, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }> = { NOT_SUBMITTED: { label: 'Not submitted', tone: 'neutral' }, NEEDS_REVIEW: { label: student ? 'Submitted' : 'Needs review', tone: 'warning' }, REVIEWED: { label: 'Reviewed', tone: 'success' }, MISSING: { label: 'Missing', tone: 'danger' } }; return <Badge tone={config[state].tone} className="shrink-0">{config[state].label}</Badge>; }
function ResourceLink({ url, title, detail, icon }: { url: string; title: string; detail: string; icon: ReactNode }) { return <a href={url} target="_blank" rel="noreferrer" className="group flex min-w-0 items-center gap-3 rounded-control border border-ui-border p-3 hover:bg-muted/30"><span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-muted text-muted-foreground">{icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium group-hover:underline">{title}</span><span className="block truncate text-xs text-muted-foreground">{detail}</span></span><ExternalLink size={14} className="shrink-0 text-muted-foreground" /></a>; }
function SubmittedResource({ url, className }: { url: string; className?: string }) { const file = isFileUrl(url); return <a href={url} target="_blank" rel="noreferrer" className={cn('items-center gap-2 rounded-control border border-ui-border px-3 py-2 text-sm font-medium text-primary hover:bg-muted/30', className)}>{file ? <FileText size={15} /> : <ExternalLink size={15} />}{file ? 'Open submitted file' : 'Open submitted link'}</a>; }
function AssignmentSkeleton() { return <div className="mx-auto max-w-screen-2xl space-y-4 p-4 md:p-6" aria-label="Loading assignment"><div className="h-20 animate-pulse rounded-card bg-muted" /><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="h-72 animate-pulse rounded-card bg-muted" /><div className="h-72 animate-pulse rounded-card bg-muted" /></div></div>; }
function ListSkeleton() { return <div className="space-y-1 p-1">{Array.from({ length: 6 }, (_, index) => <div key={index} className="flex h-14 animate-pulse items-center gap-3 px-2"><div className="size-8 rounded-full bg-muted" /><div className="flex-1 space-y-2"><div className="h-3 w-2/3 rounded bg-muted" /><div className="h-2.5 w-1/2 rounded bg-muted" /></div></div>)}</div>; }
function DetailSkeleton() { return <div className="space-y-5 p-5"><div className="h-5 w-44 animate-pulse rounded bg-muted" /><div className="h-28 animate-pulse rounded-control bg-muted" /><div className="h-24 animate-pulse rounded-control bg-muted" /></div>; }
function ReviewSkeleton() { return <div className="space-y-5 p-5"><div className="h-5 w-24 animate-pulse rounded bg-muted" /><div className="h-10 animate-pulse rounded-control bg-muted" /><div className="h-40 animate-pulse rounded-control bg-muted" /></div>; }
function formatDate(value: string) { return format(parseISO(value), 'MMM d, yyyy'); }
function formatDateTime(value: string) { return format(parseISO(value), 'MMM d, yyyy · HH:mm'); }
function formatShortDateTime(value: string) { return format(parseISO(value), 'MMM d · HH:mm'); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function fileName(url: string, index: number) { try { const parsed = new URL(url); return decodeURIComponent(parsed.searchParams.get('name') || parsed.pathname.split('/').filter(Boolean).at(-1) || `File ${index + 1}`); } catch { return `File ${index + 1}`; } }
function isFileUrl(url: string) { try { return /\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|png|jpe?g|webp)$/i.test(new URL(url).pathname); } catch { return false; } }
function isStaleReview(submission: Submission) { return Boolean(submission.reviewedAt && new Date(submission.reviewedAt) < new Date(submission.submittedAt)); }
function resourceKind(url: string): 'pdf' | 'image' | 'document' | 'link' { try { const path = new URL(url).pathname.toLowerCase(); if (path.endsWith('.pdf')) return 'pdf'; if (/\.(png|jpe?g|gif|webp|avif)$/.test(path)) return 'image'; return isFileUrl(url) ? 'document' : 'link'; } catch { return 'link'; } }
function resourceTabLabel(url: string) { const kind = resourceKind(url); return kind === 'link' ? 'Link' : submittedFileName(url); }
function submittedFileName(url: string) { return fileName(url, 0); }
function displayHost(url: string) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } }
function fileTypeLabel(url: string) { try { const extension = new URL(url).pathname.split('.').at(-1)?.toUpperCase(); return extension ? `${extension} file` : 'File'; } catch { return 'File'; } }
function submissionTiming(submittedAt: string, deadline: string | null) { if (!deadline) return 'No deadline'; const submitted = new Date(submittedAt).getTime(); const due = new Date(deadline).getTime(); if (!Number.isFinite(submitted) || !Number.isFinite(due)) return 'Timing unavailable'; if (submitted <= due) return 'On time'; const lateHours = Math.max(1, Math.ceil((submitted - due) / 3_600_000)); if (lateHours < 24) return `${lateHours}h late`; const lateDays = Math.ceil(lateHours / 24); return `${lateDays} day${lateDays === 1 ? '' : 's'} late`; }
function apiError(error: unknown, fallback: string) { return (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error || (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback; }
function sanitizeHtml(value: string) { if (typeof DOMParser === 'undefined') return ''; const document = new DOMParser().parseFromString(value, 'text/html'); document.querySelectorAll('script,style,iframe,object,embed,form').forEach(node => node.remove()); document.body.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attribute => { if (attribute.name.toLowerCase().startsWith('on') || ((attribute.name === 'href' || attribute.name === 'src') && /^\s*javascript:/i.test(attribute.value))) node.removeAttribute(attribute.name); })); return document.body.innerHTML; }
