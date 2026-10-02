import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, CirclePlay, ClipboardCheck, ExternalLink, FileText, FileUp, ListChecks, Link2, MoreHorizontal, Plus, Target, Trash2, UploadCloud, Video, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '@/lib/axios';
import { AssignmentComposer, AssignTestsComposer, type ActivityStudent, type LessonPhase } from '@/features/classroom/activity-composer/ActivityComposers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataSurface, DataTableViewport } from '@/components/ui/data-surface';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Badge, Modal, PageHeader } from '@/components/ui/AppUI';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardBack } from '@/features/navigation/DashboardBackContext';
import { cn } from '@/lib/utils';
import { LessonResourceViewer, type ViewerBlock } from './LessonResourceViewer';

type BlockKind = 'TEXT' | 'RESOURCE' | 'ACTIVITY';
type ResourceKind = 'FILE' | 'VIDEO' | 'LINK' | 'EMBED';
type StudentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

interface ResourceProgress { completedAt: string | null; positionSeconds: number }
interface LessonResource { id: string; name: string; url: string; kind: ResourceKind; provider: string | null; mimeType: string | null; durationSeconds: number | null; fileAssetId: string | null; progress: ResourceProgress | null }
interface LessonActivity {
  id: string;
  type: 'TEST' | 'QUIZ' | 'HOMEWORK' | 'VOCABULARY' | 'RESOURCE';
  title: string;
  instructions: string | null;
  availableAt: string | null;
  dueAt: string | null;
  homework: { assignmentId: string } | null;
  test: { testDeliveryId: string; testId: number; title: string; subject: 'RW' | 'MATH'; mode: 'PRACTICE' | 'EXAM'; duration: number; questionCount: number } | null;
  vocabularySetId: string | null;
  assignee: { status: string; bestScore: number | null; attemptCount: number } | null;
}
interface LessonBlock {
  id: string;
  kind: BlockKind;
  phase: LessonPhase;
  order: number;
  title: string | null;
  body: string | null;
  isRequired: boolean;
  state: { visible: boolean; started: boolean; completed: boolean; lastActiveAt: string | null } | null;
  resource: LessonResource | null;
  activity: LessonActivity | null;
}
interface StudentMonitorRow extends ActivityStudent {
  requiredBlocks: number;
  completedBlocks: number;
  percent: number;
  status: StudentStatus;
  lastActiveAt: string | null;
  nextBlockId: string | null;
  missingCount: number;
  attendanceStatus: AttendanceStatus | null;
}
interface Workspace {
  canManage: boolean;
  lesson: { id: string; title: string; summary: string | null; durationMinutes: number | null; scheduledAt: string | null; week: { id: string; title: string; class: { id: string; name: string } } };
  blocks: LessonBlock[];
  progress: { requiredBlocks: number; completedBlocks: number; percent: number; status: StudentStatus; nextBlockId: string | null } | null;
  monitor: null | {
    summary: { assigned: number; started: number; completed: number; needsAttention: number };
    students: StudentMonitorRow[];
    blocks: Array<{ id: string; title: string; kind: BlockKind; isRequired: boolean; assigned: number; started: number; completed: number }>;
  };
}
interface AttendanceEntry { studentId: number; status: AttendanceStatus }

type ComposerState = { kind: 'ASSIGNMENT' | 'TEST'; phase: LessonPhase } | null;
type TextEditorState = { block: LessonBlock | null; phase: LessonPhase } | null;
type ResourceEditorState = { phase: LessonPhase; kind: Exclude<ResourceKind, 'EMBED'> } | null;

const PHASES: Array<{ value: LessonPhase; title: string; description: string }> = [
  { value: 'BEFORE_CLASS', title: 'Before class', description: 'Preparation, reading, or materials students should review in advance.' },
  { value: 'DURING_CLASS', title: 'During class', description: 'Teaching notes, live activities, and resources used in the session.' },
  { value: 'AFTER_CLASS', title: 'After class', description: 'Follow-up materials, assignments, and practice after the session.' },
];

const ATTENDANCE_OPTIONS: Array<{ value: AttendanceStatus; label: string; dotClass: string }> = [
  { value: 'PRESENT', label: 'Present', dotClass: 'bg-success' },
  { value: 'LATE', label: 'Late', dotClass: 'bg-warning' },
  { value: 'ABSENT', label: 'Absent', dotClass: 'bg-danger' },
  { value: 'EXCUSED', label: 'Excused', dotClass: 'bg-info' },
];

const ATTENDANCE_STATUS_CLASS: Record<AttendanceStatus, string> = {
  PRESENT: 'border-success/30 bg-success-soft text-success hover:bg-success-soft',
  LATE: 'border-warning/30 bg-warning-soft text-warning hover:bg-warning-soft',
  ABSENT: 'border-danger/30 bg-danger-soft text-danger hover:bg-danger-soft',
  EXCUSED: 'border-info/30 bg-info-soft text-info hover:bg-info-soft',
};

const attendanceStatusClass = (status: AttendanceStatus) => ATTENDANCE_STATUS_CLASS[status];
const MAX_RESOURCE_FILE_BYTES = 20 * 1024 * 1024;
const RESOURCE_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp';
const RESOURCE_FILE_MIME_TYPES: Record<string, string> = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain', csv: 'text/csv', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

const errorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return data?.error || data?.message || fallback;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const mimeTypeForFile = (file: File) => file.type || RESOURCE_FILE_MIME_TYPES[file.name.split('.').at(-1)?.toLowerCase() || ''] || '';
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const resourceFileError = (file: File) => {
  if (file.size <= 0 || file.size > MAX_RESOURCE_FILE_BYTES) return 'Choose a file that is 20 MB or smaller.';
  if (!mimeTypeForFile(file) || !Object.values(RESOURCE_FILE_MIME_TYPES).includes(mimeTypeForFile(file))) return 'This file type is not supported.';
  return null;
};

const isSupportedVideoUrl = (value: string) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'vimeo.com' || hostname.endsWith('.vimeo.com') || hostname === 'loom.com' || hostname.endsWith('.loom.com');
  } catch {
    return false;
  }
};

const uploadToSignedUrl = (url: string, file: File, headers: Record<string, string>, onProgress: (value: number) => void) => {
  const request = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    request.open('PUT', url);
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Upload failed with status ${request.status}.`));
    request.onerror = () => reject(new Error('The upload connection failed.'));
    request.onabort = () => reject(new DOMException('Upload canceled.', 'AbortError'));
    request.send(file);
  });
  return { promise, abort: () => request.abort() };
};

export default function LessonWorkspace() {
  const { classId, lessonId } = useParams();
  const navigate = useNavigate();
  useDashboardBack(() => navigate(`/dashboard/class/${classId}?tab=lessons`), Boolean(classId));
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [textEditor, setTextEditor] = useState<TextEditorState>(null);
  const [textViewer, setTextViewer] = useState<LessonBlock | null>(null);
  const [textForm, setTextForm] = useState({ title: '', body: '', isRequired: true });
  const [resourceEditor, setResourceEditor] = useState<ResourceEditorState>(null);
  const [resourceForm, setResourceForm] = useState({ name: '', url: '', kind: 'LINK' as ResourceKind, isRequired: false });
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadCancelRef = useRef<(() => void) | null>(null);
  const [resourceViewer, setResourceViewer] = useState<LessonBlock | null>(null);
  const [composer, setComposer] = useState<ComposerState>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceDirty, setAttendanceDirty] = useState(false);
  const [attendanceRecordedAt, setAttendanceRecordedAt] = useState<string | null>(null);

  const loadWorkspace = useCallback(async (showLoader = true) => {
    if (!lessonId) return;
    if (showLoader) setLoading(true);
    try {
      const response = await axiosClient.get<{ success: boolean; data: Workspace }>(`/api/progress/lessons/${lessonId}/workspace`);
      setWorkspace(response.data);
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to load this lesson.'));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  const students = useMemo<ActivityStudent[]>(() => workspace?.monitor?.students.map(({ id, name, email }) => ({ id, name, email })) || [], [workspace]);

  const loadAttendance = useCallback(async () => {
    if (!lessonId || !workspace?.canManage) return;
    setAttendanceLoading(true);
    try {
      const response = await axiosClient.get<{ success: boolean; data: { recordedAt: string | null; records: Array<{ studentId: number; status: AttendanceStatus }> } }>(`/api/progress/lessons/${lessonId}/attendance`);
      const existing = new Map(response.data.records.map(record => [record.studentId, record]));
      setAttendance(students.map(student => ({ studentId: student.id, status: existing.get(student.id)?.status || 'PRESENT' })));
      setAttendanceRecordedAt(response.data.recordedAt);
      setAttendanceDirty(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to load attendance.'));
    } finally {
      setAttendanceLoading(false);
    }
  }, [lessonId, students, workspace?.canManage]);

  useEffect(() => { void loadAttendance(); }, [loadAttendance]);

  const groupedBlocks = useMemo(() => new Map(PHASES.map(phase => [phase.value, workspace?.blocks.filter(block => block.phase === phase.value) || []])), [workspace]);
  const viewerBlock = useMemo<ViewerBlock | null>(() => resourceViewer?.resource ? { id: resourceViewer.id, resource: resourceViewer.resource, completed: Boolean(resourceViewer.state?.completed) } : null, [resourceViewer]);

  const openTextEditor = (phase: LessonPhase, block?: LessonBlock) => {
    setTextEditor({ phase, block: block || null });
    setTextForm(block ? { title: block.title || '', body: block.body || '', isRequired: block.isRequired } : { title: '', body: '', isRequired: true });
  };

  const openResourceEditor = (phase: LessonPhase, kind: Exclude<ResourceKind, 'EMBED'>) => {
    setResourceEditor({ phase, kind });
    setResourceForm({ name: '', url: '', kind, isRequired: false });
    setResourceFile(null);
    setUploadProgress(0);
  };

  const closeResourceEditor = () => {
    uploadCancelRef.current?.();
    uploadCancelRef.current = null;
    setResourceEditor(null);
    setResourceFile(null);
    setUploadProgress(0);
  };

  const saveText = async () => {
    if (!lessonId || !textEditor) return;
    setWorking(true);
    try {
      const payload = { ...textForm, phase: textEditor.phase };
      if (!textEditor.block) await axiosClient.post(`/api/progress/lessons/${lessonId}/blocks`, payload);
      else await axiosClient.patch(`/api/progress/lessons/${lessonId}/blocks/${textEditor.block.id}`, payload);
      toast.success(textEditor.block ? 'Content updated.' : 'Content added.');
      setTextEditor(null);
      await loadWorkspace(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to save this content.'));
    } finally {
      setWorking(false);
    }
  };

  const addResource = async () => {
    if (!lessonId || !resourceEditor) return;
    setWorking(true);
    try {
      if (resourceEditor.kind === 'VIDEO' && !isSupportedVideoUrl(resourceForm.url.trim())) throw new Error('Use a valid YouTube, Vimeo, or Loom URL.');
      let fileAssetId: string | null = null;
      if (resourceFile) {
        const validationError = resourceFileError(resourceFile);
        if (validationError) throw new Error(validationError);
        const mimeType = mimeTypeForFile(resourceFile);
        const prepared = await axiosClient.post<{ success: boolean; data: { asset: { id: string }; uploadUrl: string; headers: Record<string, string> } }>('/api/files/uploads', {
          lessonId,
          originalName: resourceFile.name,
          mimeType,
          sizeBytes: resourceFile.size,
        });
        const upload = uploadToSignedUrl(prepared.data.uploadUrl, resourceFile, prepared.data.headers, setUploadProgress);
        uploadCancelRef.current = upload.abort;
        await upload.promise;
        uploadCancelRef.current = null;
        await axiosClient.post(`/api/files/${prepared.data.asset.id}/complete`);
        fileAssetId = prepared.data.asset.id;
      }
      await axiosClient.post(`/api/progress/lessons/${lessonId}/files`, {
        phase: resourceEditor.phase,
        files: [{ ...resourceForm, kind: resourceEditor.kind, url: fileAssetId ? null : resourceForm.url.trim(), fileAssetId, mimeType: resourceFile ? mimeTypeForFile(resourceFile) : null }],
      });
      toast.success('Learning material added.');
      closeResourceEditor();
      setResourceForm({ name: '', url: '', kind: 'LINK', isRequired: false });
      await loadWorkspace(false);
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') toast.error(errorMessage(error, error instanceof Error ? error.message : 'Unable to add this material.'));
    } finally {
      uploadCancelRef.current = null;
      setWorking(false);
    }
  };

  const orderedBlocks = (phase: LessonPhase, blocks: LessonBlock[]) => PHASES.flatMap(item => item.value === phase ? blocks : groupedBlocks.get(item.value) || []);

  const moveBlock = async (phase: LessonPhase, index: number, direction: -1 | 1) => {
    if (!lessonId || !workspace) return;
    const phaseBlocks = [...(groupedBlocks.get(phase) || [])];
    const target = index + direction;
    if (target < 0 || target >= phaseBlocks.length) return;
    [phaseBlocks[index], phaseBlocks[target]] = [phaseBlocks[target], phaseBlocks[index]];
    const next = orderedBlocks(phase, phaseBlocks);
    setWorkspace(current => current ? { ...current, blocks: next } : current);
    try {
      await axiosClient.put(`/api/progress/lessons/${lessonId}/blocks/reorder`, { orderedIds: next.map(block => block.id) });
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to reorder lesson content.'));
      await loadWorkspace(false);
    }
  };

  const updateBlock = async (block: LessonBlock, patch: { isRequired?: boolean; phase?: LessonPhase }) => {
    if (!lessonId) return;
    try {
      await axiosClient.patch(`/api/progress/lessons/${lessonId}/blocks/${block.id}`, {
        title: block.title,
        body: block.body,
        isRequired: patch.isRequired ?? block.isRequired,
        phase: patch.phase ?? block.phase,
      });
      await loadWorkspace(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to update this content.'));
    }
  };

  const deleteBlock = async (block: LessonBlock) => {
    if (!lessonId) return;
    setWorking(true);
    try {
      if (block.kind === 'TEXT') await axiosClient.delete(`/api/progress/lessons/${lessonId}/blocks/${block.id}`);
      else if (block.resource) await axiosClient.delete(`/api/progress/files/${block.resource.id}`);
      else return;
      toast.success('Content removed.');
      await loadWorkspace(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to remove this content.'));
    } finally {
      setWorking(false);
    }
  };

  const updateProgress = useCallback(async (blockId: string, completed: boolean) => {
    if (!lessonId) return;
    try {
      await axiosClient.put(`/api/progress/lessons/${lessonId}/blocks/${blockId}/progress`, { completed });
      await loadWorkspace(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to update lesson progress.'));
    }
  }, [lessonId, loadWorkspace]);

  const openActivity = (block: LessonBlock) => {
    const activity = block.activity;
    if (!activity || !workspace) return;
    if (activity.homework) return navigate(`/dashboard/class/${workspace.lesson.week.class.id}/assignment/${activity.homework.assignmentId}`);
    if (activity.test) {
      if (workspace.canManage) return navigate(`/dashboard/class/${workspace.lesson.week.class.id}?tab=performance&deliveryId=${activity.test.testDeliveryId}`);
      localStorage.setItem('current_exam_info', JSON.stringify({ id: activity.test.testId, title: activity.title, duration: activity.test.duration }));
      return navigate(`/test/${activity.test.testId}?deliveryId=${activity.test.testDeliveryId}`);
    }
    if (activity.vocabularySetId) navigate(`/dashboard/vocabulary?activity=${activity.id}`);
  };

  const openBlock = (block: LessonBlock) => {
    if (block.kind === 'TEXT') {
      if (workspace?.canManage) openTextEditor(block.phase, block);
      else setTextViewer(block);
      return;
    }
    if (block.kind === 'RESOURCE') {
      setResourceViewer(block);
      return;
    }
    openActivity(block);
  };

  const completeTextViewer = () => {
    const block = textViewer;
    setTextViewer(null);
    if (block && !block.state?.completed) void updateProgress(block.id, true);
  };

  const saveAttendance = async () => {
    if (!lessonId) return;
    setAttendanceSaving(true);
    try {
      await axiosClient.put(`/api/progress/lessons/${lessonId}/attendance`, { records: attendance });
      toast.success('Attendance saved.');
      await loadAttendance();
      await loadWorkspace(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to save attendance.'));
    } finally {
      setAttendanceSaving(false);
    }
  };

  const updateAttendance = (studentId: number, patch: Partial<AttendanceEntry>) => {
    setAttendance(current => current.map(entry => entry.studentId === studentId ? { ...entry, ...patch } : entry));
    setAttendanceDirty(true);
  };

  const scrollToNext = () => {
    const target = workspace?.progress?.nextBlockId;
    if (target) document.getElementById(`lesson-block-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (loading) return <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden bg-background"><main className="mx-auto w-full max-w-screen-2xl space-y-4 p-4 md:p-6"><Skeleton className="h-24" /><div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]"><Skeleton className="h-96 min-w-0" /><Skeleton className="h-96 min-w-0" /></div></main></div>;
  if (!workspace) return <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden bg-background"><main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6"><Card className="p-8 text-center"><p className="text-body text-muted-foreground">This lesson could not be loaded.</p><Button className="mt-4" onClick={() => navigate(`/dashboard/class/${classId}`)}>Back to class</Button></Card></main></div>;

  const { lesson } = workspace;
  return <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden bg-background"><main className="mx-auto w-full max-w-screen-2xl space-y-5 p-4 pb-10 md:p-6 md:pb-10">
    <PageHeader title={lesson.title} description="Learning workspace for this session." />

    {!workspace.canManage && workspace.progress && <Card className="p-4 shadow-none"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="text-body font-semibold">Lesson progress</p><span className="text-caption font-medium text-muted-foreground">{workspace.progress.completedBlocks}/{workspace.progress.requiredBlocks} required</span></div><Progress value={workspace.progress.percent} className="mt-2" /><p className="mt-2 text-caption text-muted-foreground">{workspace.progress.status === 'COMPLETED' ? 'Lesson complete. Nice work.' : `${workspace.progress.percent}% complete`}</p></div>{workspace.progress.status !== 'COMPLETED' && workspace.progress.nextBlockId && <Button onClick={scrollToNext}>Continue <ChevronRight size={15} /></Button>}</div></Card>}

    <div className={workspace.canManage ? 'grid min-w-0 max-w-full gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] xl:items-start' : 'min-w-0'}>
      <section className="min-w-0 overflow-hidden rounded-card border border-ui-border bg-surface" aria-label="Lesson content by class stage">
        {PHASES.map((phase, phaseIndex) => <PhaseSection
          key={phase.value}
          phase={phase}
          blocks={groupedBlocks.get(phase.value) || []}
          canManage={workspace.canManage}
          working={working}
          last={phaseIndex === PHASES.length - 1}
          onAddText={() => openTextEditor(phase.value)}
          onAddFile={() => openResourceEditor(phase.value, 'FILE')}
          onAddVideo={() => openResourceEditor(phase.value, 'VIDEO')}
          onAddLink={() => openResourceEditor(phase.value, 'LINK')}
          onAddAssignment={() => setComposer({ kind: 'ASSIGNMENT', phase: phase.value })}
          onAddQuiz={() => navigate(`/dashboard/class/${lesson.week.class.id}/lesson/${lesson.id}/quiz/new?phase=${phase.value}`)}
          onAddTest={() => setComposer({ kind: 'TEST', phase: phase.value })}
          onMove={(index, direction) => void moveBlock(phase.value, index, direction)}
          onRequired={(block, value) => void updateBlock(block, { isRequired: value })}
          onPhase={(block, nextPhase) => void updateBlock(block, { phase: nextPhase })}
          onDelete={block => void deleteBlock(block)}
          onOpen={openBlock}
        />)}
      </section>

      {workspace.canManage && <AttendancePanel students={students} entries={attendance} loading={attendanceLoading} saving={attendanceSaving} dirty={attendanceDirty} recordedAt={attendanceRecordedAt} onChange={updateAttendance} onSave={() => void saveAttendance()} />}
    </div>

    <TextBlockDialog open={Boolean(textEditor)} form={textForm} setForm={setTextForm} saving={working} editing={Boolean(textEditor?.block)} onClose={() => setTextEditor(null)} onSave={saveText} />
    <TextViewerDialog block={textViewer} onClose={() => setTextViewer(null)} onDone={completeTextViewer} />
    <LessonResourceViewer block={viewerBlock} canManage={workspace.canManage} onClose={() => setResourceViewer(null)} onProgress={updateProgress} />
    <ResourceDialog open={Boolean(resourceEditor)} kind={resourceEditor?.kind || 'LINK'} form={resourceForm} setForm={setResourceForm} file={resourceFile} setFile={setResourceFile} uploadProgress={uploadProgress} saving={working} onClose={closeResourceEditor} onSave={addResource} />
    <AssignmentComposer open={composer?.kind === 'ASSIGNMENT'} classId={lesson.week.class.id} students={students} initialLessonId={lesson.id} initialLessonPhase={composer?.phase} onClose={() => setComposer(null)} onCreated={() => loadWorkspace(false)} />
    <AssignTestsComposer open={composer?.kind === 'TEST'} classId={lesson.week.class.id} students={students} initialLessonId={lesson.id} initialLessonPhase={composer?.phase} onClose={() => setComposer(null)} onCreated={() => loadWorkspace(false)} />
  </main></div>;
}

function PhaseSection({ phase, blocks, canManage, working, last, onAddText, onAddFile, onAddVideo, onAddLink, onAddAssignment, onAddQuiz, onAddTest, onMove, onRequired, onPhase, onDelete, onOpen }: {
  phase: { value: LessonPhase; title: string; description: string };
  blocks: LessonBlock[];
  canManage: boolean;
  working: boolean;
  last: boolean;
  onAddText: () => void;
  onAddFile: () => void;
  onAddVideo: () => void;
  onAddLink: () => void;
  onAddAssignment: () => void;
  onAddQuiz: () => void;
  onAddTest: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRequired: (block: LessonBlock, value: boolean) => void;
  onPhase: (block: LessonBlock, phase: LessonPhase) => void;
  onDelete: (block: LessonBlock) => void;
  onOpen: (block: LessonBlock) => void;
}) {
  return <section className={last ? undefined : 'border-b border-ui-border'} aria-labelledby={`lesson-phase-${phase.value}`}>
    <header className="flex flex-col gap-3 bg-section-header px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5">
      <div className="min-w-0"><h2 id={`lesson-phase-${phase.value}`} className="text-title font-semibold text-foreground">{phase.title}</h2><p className="mt-0.5 text-caption leading-5 text-muted-foreground">{phase.description}</p></div>
      {canManage && <AddContentMenu onText={onAddText} onFile={onAddFile} onVideo={onAddVideo} onLink={onAddLink} onAssignment={onAddAssignment} onQuiz={onAddQuiz} onTest={onAddTest} />}
    </header>
    <div className="divide-y divide-ui-border/70">
      {blocks.length === 0 ? <p className="px-5 py-5 text-body text-muted-foreground">{canManage ? `No ${phase.title.toLowerCase()} content yet.` : 'No content for this stage.'}</p> : blocks.map((block, index) => <LessonBlockRow key={block.id} block={block} index={index} count={blocks.length} canManage={canManage} working={working} onMove={onMove} onRequired={onRequired} onPhase={onPhase} onDelete={onDelete} onOpen={onOpen} />)}
    </div>
  </section>;
}

function AddContentMenu({ onText, onFile, onVideo, onLink, onAssignment, onQuiz, onTest }: { onText: () => void; onFile: () => void; onVideo: () => void; onLink: () => void; onAssignment: () => void; onQuiz: () => void; onTest: () => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline"><Plus size={14} />Add content</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64"><DropdownMenuLabel>Learning material</DropdownMenuLabel><DropdownMenuItem onSelect={onText}><FileText />Add note</DropdownMenuItem><DropdownMenuItem onSelect={onFile}><FileUp />Upload file</DropdownMenuItem><DropdownMenuItem onSelect={onVideo}><Video />Add video</DropdownMenuItem><DropdownMenuItem onSelect={onLink}><Link2 />Add link</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuLabel>Student work</DropdownMenuLabel><DropdownMenuItem onSelect={onAssignment}><ClipboardCheck />Assignment</DropdownMenuItem><DropdownMenuItem onSelect={onQuiz}><ListChecks />Create quiz from Question Bank</DropdownMenuItem><DropdownMenuItem onSelect={onTest}><CirclePlay />Assign existing test</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function LessonBlockRow({ block, index, count, canManage, working, onMove, onRequired, onPhase, onDelete, onOpen }: {
  block: LessonBlock;
  index: number;
  count: number;
  canManage: boolean;
  working: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onRequired: (block: LessonBlock, value: boolean) => void;
  onPhase: (block: LessonBlock, phase: LessonPhase) => void;
  onDelete: (block: LessonBlock) => void;
  onOpen: (block: LessonBlock) => void;
}) {
  const icon = block.kind === 'TEXT' ? <FileText size={16} /> : block.kind === 'RESOURCE' ? block.resource?.kind === 'VIDEO' ? <Video size={16} /> : <Link2 size={16} /> : block.activity?.type === 'TEST' ? <CirclePlay size={16} /> : block.activity?.type === 'QUIZ' ? <ListChecks size={16} /> : <ClipboardCheck size={16} />;
  const title = block.title || block.resource?.name || block.activity?.title || 'Untitled content';
  const type = block.kind === 'TEXT' ? 'Note' : block.kind === 'RESOURCE' ? block.resource?.kind === 'VIDEO' ? 'Video' : block.resource?.kind === 'FILE' ? 'File' : block.resource?.kind === 'EMBED' ? 'Embedded activity' : 'Link' : block.activity?.type === 'TEST' ? 'Test' : block.activity?.type === 'QUIZ' ? 'Quiz' : 'Assignment';
  const metadata = block.activity?.dueAt ? `Due ${formatDate(block.activity.dueAt)}` : block.activity?.test ? `${block.activity.test.questionCount} questions · ${block.activity.test.duration} min` : block.resource?.provider ? block.resource.provider.replaceAll('_', ' ') : null;
  const external = block.kind === 'RESOURCE';
  return <article id={`lesson-block-${block.id}`} className="flex min-w-0 items-center gap-1 px-2 transition-colors hover:bg-muted/40 focus-within:bg-muted/40 sm:px-3">
    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-control px-2 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onOpen(block)} aria-label={`${canManage && block.kind === 'TEXT' ? 'Edit' : 'Open'} ${type.toLowerCase()} ${title}`}>
      <span className={block.state?.completed ? 'shrink-0 text-success' : 'shrink-0 text-muted-foreground'} aria-hidden="true">{block.state?.completed ? <Check size={16} /> : icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body"><span className="min-w-0 truncate text-foreground"><span className="font-medium text-muted-foreground">{type}:</span> <span className="font-semibold">{title}</span></span>{block.isRequired && <Badge tone="neutral">Required</Badge>}{block.state?.completed && <Badge tone="success">Complete</Badge>}</span>
        {metadata && <span className="mt-0.5 block truncate text-caption text-muted-foreground">{metadata}</span>}
      </span>
      {external ? <ExternalLink size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" /> : <ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
    </button>
    {canManage && <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-8 shrink-0" disabled={working} aria-label={`${title} actions`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuItem disabled={index === 0} onSelect={() => onMove(index, -1)}><ArrowUp />Move up</DropdownMenuItem><DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(index, 1)}><ArrowDown />Move down</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => onRequired(block, !block.isRequired)}>{block.isRequired ? <Check /> : <Target />}{block.isRequired ? 'Make optional' : 'Make required'}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuLabel>Move to stage</DropdownMenuLabel>{PHASES.filter(phase => phase.value !== block.phase).map(phase => <DropdownMenuItem key={phase.value} onSelect={() => onPhase(block, phase.value)}>{phase.title}</DropdownMenuItem>)}{block.kind !== 'ACTIVITY' && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => onDelete(block)}><Trash2 />Delete</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>}
  </article>;
}

function TextViewerDialog({ block, onClose, onDone }: { block: LessonBlock | null; onClose: () => void; onDone: () => void }) {
  return <Modal open={Boolean(block)} closeOnBackdrop presentation="content-dialog" onClose={onClose} title={block?.title || 'Lesson note'} footer={<Button onClick={block?.state?.completed ? onClose : onDone}>{block?.state?.completed ? 'Close' : 'Mark as done'}</Button>}>
    <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-body leading-7 text-foreground">{block?.body}</div>
  </Modal>;
}

function AttendancePanel({ students, entries, loading, saving, dirty, recordedAt, onChange, onSave }: {
  students: ActivityStudent[];
  entries: AttendanceEntry[];
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  recordedAt: string | null;
  onChange: (studentId: number, patch: Partial<AttendanceEntry>) => void;
  onSave: () => void;
}) {
  const byStudent = new Map(entries.map(entry => [entry.studentId, entry]));
  return <DataSurface className="min-w-0 max-w-full overflow-hidden xl:sticky xl:top-4" aria-labelledby="attendance-heading">
    <div className="flex items-start justify-between gap-3 border-b border-ui-border px-4 py-3">
      <div className="min-w-0"><h2 id="attendance-heading" className="text-title font-semibold text-foreground">Class attendance</h2><p className="mt-0.5 text-caption text-muted-foreground">{recordedAt ? `Last saved ${formatDate(recordedAt)}` : 'Record one status for each student.'}</p></div>
      <Button size="sm" disabled={loading || saving || !dirty || students.length === 0 || entries.length !== students.length} onClick={onSave}>{saving ? <LoadingSpinner /> : <Check size={14} />}{saving ? 'Saving…' : 'Save'}</Button>
    </div>
    <DataTableViewport>
      <Table className="w-full table-fixed">
        <TableHeader><TableRow><TableHead>Student</TableHead><TableHead className="w-36">Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {loading ? <TableRow><TableCell colSpan={2} className="h-32 text-center text-muted-foreground">Loading attendance…</TableCell></TableRow> : students.length === 0 ? <TableRow><TableCell colSpan={2} className="h-32 whitespace-normal text-center text-muted-foreground">Add students to this class before taking attendance.</TableCell></TableRow> : students.map(student => {
            const entry = byStudent.get(student.id) || { studentId: student.id, status: 'PRESENT' as const };
            return <TableRow key={student.id}><TableCell className="min-w-0"><p className="truncate font-medium text-foreground">{student.name || student.email}</p><p className="truncate text-caption text-muted-foreground">{student.email}</p></TableCell><TableCell><Select value={entry.status} onValueChange={value => onChange(student.id, { status: value as AttendanceStatus })}><SelectTrigger className={cn('w-full font-medium', attendanceStatusClass(entry.status))} aria-label={`Attendance status for ${student.name || student.email}`}><SelectValue /></SelectTrigger><SelectContent>{ATTENDANCE_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}><span className={cn('size-2 rounded-full', option.dotClass)} aria-hidden="true" />{option.label}</SelectItem>)}</SelectContent></Select></TableCell></TableRow>;
          })}
        </TableBody>
      </Table>
    </DataTableViewport>
  </DataSurface>;
}

function LabeledField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <Field><FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>{children}</Field>;
}

function TextBlockDialog({ open, form, setForm, saving, editing, onClose, onSave }: { open: boolean; form: { title: string; body: string; isRequired: boolean }; setForm: React.Dispatch<React.SetStateAction<{ title: string; body: string; isRequired: boolean }>>; saving: boolean; editing: boolean; onClose: () => void; onSave: () => void }) {
  return <Modal open={open} closeOnBackdrop presentation="content-dialog" onClose={onClose} title={editing ? 'Edit lesson content' : 'Add lesson content'} subtitle="Add instructions, context, or study notes to this stage." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving || !form.title.trim() || !form.body.trim()} onClick={onSave}>{saving ? <LoadingSpinner /> : null}Save</Button></>}>
    <div className="space-y-4">
      <LabeledField label="Title" htmlFor="block-title"><Input id="block-title" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="What students should know" /></LabeledField>
      <LabeledField label="Content" htmlFor="block-content"><Textarea id="block-content" className="min-h-48" value={form.body} onChange={event => setForm(current => ({ ...current, body: event.target.value }))} placeholder="Write lesson instructions or study notes…" /></LabeledField>
      <label className="flex items-center gap-2 text-body"><Checkbox checked={form.isRequired} onCheckedChange={value => setForm(current => ({ ...current, isRequired: value === true }))} />Required for lesson completion</label>
    </div>
  </Modal>;
}

function ResourceDialog({ open, kind, form, setForm, file, setFile, uploadProgress, saving, onClose, onSave }: { open: boolean; kind: Exclude<ResourceKind, 'EMBED'>; form: { name: string; url: string; kind: ResourceKind; isRequired: boolean }; setForm: React.Dispatch<React.SetStateAction<{ name: string; url: string; kind: ResourceKind; isRequired: boolean }>>; file: File | null; setFile: (file: File | null) => void; uploadProgress: number; saving: boolean; onClose: () => void; onSave: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileMode = kind === 'FILE';
  const title = fileMode ? 'Upload file' : kind === 'VIDEO' ? 'Add video' : 'Add link';
  const subtitle = fileMode ? 'Upload a private document or image for this class.' : kind === 'VIDEO' ? 'Paste a YouTube, Vimeo, or Loom link to play it inside the workspace.' : 'Add a trusted external resource for students.';
  const actionLabel = fileMode ? 'Upload file' : kind === 'VIDEO' ? 'Add video' : 'Add link';
  const disabled = saving || !form.name.trim() || (fileMode ? !file : !form.url.trim());

  const selectFile = (next: File | null) => {
    if (!next) return;
    const validationError = resourceFileError(next);
    if (validationError) {
      toast.error(validationError);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setFile(next);
    if (!form.name.trim()) setForm(current => ({ ...current, name: next.name }));
  };

  return <Modal open={open} closeOnBackdrop={!saving} presentation="content-dialog" onClose={onClose} title={title} subtitle={subtitle} footer={<><Button variant="outline" onClick={onClose}>{saving ? 'Cancel upload' : 'Cancel'}</Button><Button disabled={disabled} onClick={onSave}>{saving ? <LoadingSpinner /> : null}{saving && fileMode ? `Uploading ${uploadProgress}%` : actionLabel}</Button></>}>
    <div className="space-y-4">
      {fileMode && <div>
        <input ref={inputRef} id="resource-file" type="file" className="sr-only" accept={RESOURCE_FILE_ACCEPT} disabled={saving} onChange={event => selectFile(event.target.files?.[0] || null)} />
        {!file ? <div
          role="button"
          tabIndex={0}
          aria-label="Choose a file to upload"
          className={cn('flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-control border border-dashed px-5 py-6 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring', dragActive ? 'border-primary bg-primary-soft/60' : 'border-ui-border-strong bg-muted/20 hover:border-primary/50 hover:bg-muted/40')}
          onClick={() => inputRef.current?.click()}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current?.click(); } }}
          onDragEnter={event => { event.preventDefault(); setDragActive(true); }}
          onDragOver={event => event.preventDefault()}
          onDragLeave={event => { if (event.currentTarget === event.target) setDragActive(false); }}
          onDrop={event => { event.preventDefault(); setDragActive(false); selectFile(event.dataTransfer.files?.[0] || null); }}
        ><UploadCloud className="size-8 text-primary" aria-hidden="true" /><p className="mt-3 text-body font-semibold text-foreground">Drop a file here or choose from your device</p><p className="mt-1 text-caption text-muted-foreground">PDF, Office documents, text, CSV, and images up to 20 MB</p></div>
          : <div className="rounded-control border border-ui-border bg-muted/25 p-3"><div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary"><FileText size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-body font-medium text-foreground">{file.name}</p><p className="text-caption text-muted-foreground">{formatBytes(file.size)} · {mimeTypeForFile(file)}</p></div><Button type="button" variant="ghost" size="icon-sm" disabled={saving} onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ''; }} aria-label={`Remove ${file.name}`}><X /></Button></div>{saving && <div className="mt-3"><Progress value={uploadProgress} /><p className="mt-1 text-right text-caption tabular-nums text-muted-foreground">{uploadProgress}%</p></div>}</div>}
      </div>}
      <LabeledField label="Display name" htmlFor="resource-name"><Input id="resource-name" autoFocus={!fileMode} value={form.name} disabled={saving} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder={fileMode ? 'Resource name' : kind === 'VIDEO' ? 'Video title' : 'Link title'} /></LabeledField>
      {!fileMode && <LabeledField label={kind === 'VIDEO' ? 'YouTube, Vimeo, or Loom URL' : 'Resource URL'} htmlFor="resource-url"><Input id="resource-url" type="url" value={form.url} disabled={saving} onChange={event => setForm(current => ({ ...current, url: event.target.value }))} placeholder="https://…" /></LabeledField>}
      <label className="flex items-center gap-2 text-body"><Checkbox checked={form.isRequired} disabled={saving} onCheckedChange={value => setForm(current => ({ ...current, isRequired: value === true }))} />Required for lesson completion</label>
    </div>
  </Modal>;
}
