import { Children, useCallback, useEffect, useState } from 'react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, BookA, BookOpen, CalendarDays, Check, ChevronDown, ChevronRight, ChevronsUpDown, CirclePlay, ClipboardCheck, Clock3, ExternalLink, FileText, GripVertical, Link2, ListCollapse, LoaderCircle, MoreHorizontal, MoveDown, MoveUp, Pencil, Plus, RefreshCw, Rocket, Trash2, Video } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { AssignmentComposer, AssignTestsComposer } from '../classroom/activity-composer/ActivityComposers';
import { Badge, Button, Card, EmptyState, Input, Modal, Select } from '../../components/ui/AppUI';
import { DateTimePicker } from '../../components/ui/DateTimePicker';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Separator } from '../../components/ui/separator';
import { Checkbox } from '../../components/ui/checkbox';
import { Textarea } from '../../components/ui/textarea';
import axiosClient from '../../lib/axios';

type ContentStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
type ResourceKind = 'FILE' | 'VIDEO' | 'LINK' | 'EMBED';
type SortableData = { type: 'week' | 'lesson'; weekId: string };

interface ResourceProgress { completedAt?: string | null }
interface Resource { id: string; name: string; url: string; kind: ResourceKind; provider?: string | null; isRequired: boolean; progress: ResourceProgress[] }
interface Assignment { id: string; lessonAssignmentId?: string; title: string; content?: string | null; dueDate?: string | null; testIds?: number[]; assignment?: { submissions?: Array<{ status: string; submittedAt: string; score?: number | null }> } }
interface Delivery { id: string; title: string; status: string; dueAt?: string | null; test: { id: number; title: string; mode: 'EXAM' | 'PRACTICE'; duration: number; subject: string; folderId: number | null; sections?: Array<{ _count: { questions: number } }> } }
interface Activity { id: string; type: 'VOCABULARY' | 'HOMEWORK' | 'RESOURCE'; title: string; dueAt?: string | null; assignees?: Array<{ status: string }>; homework?: { assignmentId: string; assignment?: { submissions?: Array<{ status: string; submittedAt: string }> } } | null }
interface LessonProgress { status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'; progress: number }
interface Lesson { id: string; order: number; title: string; summary?: string | null; status: ContentStatus; scheduledAt?: string | null; durationMinutes?: number | null; files: Resource[]; assignments: Assignment[]; deliveries: Delivery[]; activities: Activity[]; studentProgress?: LessonProgress | null; progressSummary?: { completed: number; started: number } | null }
interface Week { id: string; order: number; title: string; description?: string | null; status: ContentStatus; availableAt?: string | null; lessons: Lesson[] }
interface CourseForm { title: string; description: string; summary: string; status: ContentStatus; scheduledAt: string; durationMinutes: string }

const EMPTY_FORM: CourseForm = { title: '', description: '', summary: '', status: 'DRAFT', scheduledAt: '', durationMinutes: '' };

const WeeklyProgress = ({ canManage = true, students = [] }: { canManage?: boolean; students?: Array<{ id: number; name: string | null; email: string }> }) => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [compact, setCompact] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeWeekId, setActiveWeekId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ kind: 'week' | 'lesson'; weekId?: string; item?: Week | Lesson } | null>(null);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [resourceLesson, setResourceLesson] = useState<{ weekId: string; lessonId: string } | null>(null);
  const [resourceForm, setResourceForm] = useState({ name: '', url: '', kind: 'FILE' as ResourceKind, isRequired: false });
  const [activityComposer, setActivityComposer] = useState<{ kind: 'ASSIGNMENT' | 'TEST'; lessonId: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'week' | 'lesson' | 'resource'; id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const expandedStorageKey = classId ? `classroom-lessons:${classId}:expanded` : '';
  const compactStorageKey = classId ? `classroom-lessons:${classId}:compact` : '';
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadCourse = useCallback(async (showSkeleton = true) => {
    if (!classId) return;
    if (showSkeleton) setLoading(true);
    setLoadError('');
    try {
      const response = await axiosClient.get<{ success: boolean; data: unknown }>(`/api/progress/class/${classId}/weeks`);
      const items = normalizeWeeks(response.data);
      setWeeks(items);
      setExpanded(readExpandedPreference(`classroom-lessons:${classId}:expanded`, items));
    } catch (error) {
      console.error(error);
      setLoadError(requestErrorMessage(error, 'The curriculum could not be loaded.'));
    } finally {
      if (showSkeleton) setLoading(false);
    }
  }, [classId]);

  useEffect(() => { void loadCourse(); }, [loadCourse]);
  useEffect(() => {
    if (!compactStorageKey) return;
    setCompact(localStorage.getItem(compactStorageKey) === 'true');
  }, [compactStorageKey]);
  useEffect(() => {
    if (!expandedStorageKey || loading) return;
    localStorage.setItem(expandedStorageKey, JSON.stringify([...expanded]));
  }, [expanded, expandedStorageKey, loading]);
  useEffect(() => {
    if (weeks.length === 0) {
      setActiveWeekId(null);
      return;
    }

    setActiveWeekId(current => current && weeks.some(week => week.id === current) ? current : weeks[0].id);
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((left, right) => Math.abs(left.boundingClientRect.top - 112) - Math.abs(right.boundingClientRect.top - 112));
      const weekId = visible[0]?.target.getAttribute('data-week-id');
      if (weekId) setActiveWeekId(weekId);
    }, { rootMargin: '-96px 0px -70% 0px', threshold: 0 });

    weeks.forEach(week => {
      const element = document.getElementById(weekAnchorId(week.id));
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [weeks]);

  const toggleWeek = (weekId: string, open?: boolean) => setExpanded(current => {
    const next = new Set(current);
    const shouldOpen = open ?? !next.has(weekId);
    if (shouldOpen) next.add(weekId); else next.delete(weekId);
    return next;
  });

  const toggleCompact = () => setCompact(current => {
    const next = !current;
    if (compactStorageKey) localStorage.setItem(compactStorageKey, String(next));
    return next;
  });

  const toggleAll = () => {
    const allOpen = weeks.length > 0 && weeks.every(week => expanded.has(week.id));
    setExpanded(allOpen ? new Set() : new Set(weeks.map(week => week.id)));
  };

  const navigateToWeek = (weekId: string) => {
    const target = document.getElementById(weekAnchorId(weekId));
    if (!target) return;
    setActiveWeekId(weekId);
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  const openEditor = (kind: 'week' | 'lesson', item?: Week | Lesson, weekId?: string) => {
    setEditor({ kind, item, weekId });
    setForm({ title: item?.title || '', description: kind === 'week' ? ((item as Week | undefined)?.description || '') : '', summary: kind === 'lesson' ? ((item as Lesson | undefined)?.summary || '') : '', status: item?.status || 'DRAFT', scheduledAt: kind === 'lesson' && (item as Lesson | undefined)?.scheduledAt ? String((item as Lesson).scheduledAt) : '', durationMinutes: kind === 'lesson' ? String((item as Lesson | undefined)?.durationMinutes || '') : '' });
  };

  const saveEditor = async () => {
    if (!editor || !form.title.trim() || !classId) return;
    setSaving(true);
    const payload = editor.kind === 'week'
      ? { title: form.title.trim(), description: form.description.trim() || null, status: form.status }
      : { title: form.title.trim(), summary: form.summary.trim() || null, status: form.status, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null, durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null };
    try {
      if (editor.item) await axiosClient.put(`/api/progress/${editor.kind === 'week' ? 'weeks' : 'lessons'}/${editor.item.id}`, payload);
      else if (editor.kind === 'week') await axiosClient.post(`/api/progress/class/${classId}/weeks`, payload);
      else await axiosClient.post(`/api/progress/weeks/${editor.weekId}/lessons`, payload);
      toast.success(editor.item ? 'Curriculum updated.' : `${editor.kind === 'week' ? 'Week' : 'Session'} created.`);
      setEditor(null);
      await loadCourse(false);
    } catch (error) { console.error(error); toast.error(requestErrorMessage(error, 'Unable to save this curriculum item.')); }
    finally { setSaving(false); }
  };

  const publishItem = async (kind: 'week' | 'lesson', item: Week | Lesson) => {
    const key = `${kind}:${item.id}`;
    setBusyItem(key);
    try {
      await axiosClient.put(`/api/progress/${kind === 'week' ? 'weeks' : 'lessons'}/${item.id}`, { status: item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' });
      toast.success(item.status === 'PUBLISHED' ? 'Moved back to draft.' : 'Published to students.');
      await loadCourse(false);
    } catch (error) { console.error(error); toast.error(requestErrorMessage(error, 'Unable to update publication status.')); }
    finally { setBusyItem(null); }
  };

  const addResource = async () => {
    if (!resourceLesson || !resourceForm.name.trim() || !resourceForm.url.trim()) return;
    setSaving(true);
    try {
      await axiosClient.post(`/api/progress/lessons/${resourceLesson.lessonId}/files`, { files: [{ ...resourceForm, name: resourceForm.name.trim(), url: resourceForm.url.trim() }] });
      toast.success('Resource added.');
      setResourceLesson(null);
      setResourceForm({ name: '', url: '', kind: 'FILE', isRequired: false });
      await loadCourse(false);
    } catch (error) { console.error(error); toast.error(requestErrorMessage(error, 'Unable to add this resource. Check the URL.')); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const endpoint = deleteTarget.kind === 'week' ? `/api/progress/weeks/${deleteTarget.id}` : deleteTarget.kind === 'lesson' ? `/api/progress/lessons/${deleteTarget.id}` : `/api/progress/files/${deleteTarget.id}`;
      await axiosClient.delete(endpoint);
      toast.success('Removed from the curriculum.');
      setDeleteTarget(null);
      await loadCourse(false);
    } catch (error) { console.error(error); toast.error(requestErrorMessage(error, 'Unable to remove this item.')); }
    finally { setSaving(false); }
  };

  const openResource = async (resource: Resource) => {
    if (!canManage) {
      try { await axiosClient.put(`/api/progress/files/${resource.id}/progress`, { completed: resource.kind !== 'VIDEO' }); } catch (error) { console.error(error); }
    }
    window.open(resource.url, '_blank', 'noopener,noreferrer');
    if (!canManage) await loadCourse(false);
  };

  const completeLesson = async (lesson: Lesson) => {
    const key = `lesson:${lesson.id}`;
    setBusyItem(key);
    try {
      await axiosClient.put(`/api/progress/lessons/${lesson.id}/progress`, { completed: lesson.studentProgress?.status !== 'COMPLETED' });
      toast.success(lesson.studentProgress?.status === 'COMPLETED' ? 'Session marked in progress.' : 'Session completed.');
      await loadCourse(false);
    } catch (error) { console.error(error); toast.error(requestErrorMessage(error, 'Unable to update your progress.')); }
    finally { setBusyItem(null); }
  };

  const startDelivery = (delivery: Delivery) => {
    localStorage.setItem('current_exam_info', JSON.stringify({ id: delivery.test.id, title: delivery.title, duration: delivery.test.duration }));
    navigate(`/test/${delivery.test.id}?deliveryId=${delivery.id}`);
  };

  const persistWeekOrder = async (fromIndex: number, toIndex: number) => {
    if (!classId || reordering || fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= weeks.length) return;
    const previous = weeks;
    const next = arrayMove(weeks, fromIndex, toIndex);
    setWeeks(next);
    setReordering(true);
    try {
      await axiosClient.put(`/api/progress/class/${classId}/weeks/reorder`, { orderedIds: next.map(week => week.id) });
    } catch (error) {
      setWeeks(previous);
      toast.error(requestErrorMessage(error, 'Unable to save the new week order.'));
    } finally { setReordering(false); }
  };

  const persistLessonOrder = async (weekId: string, fromIndex: number, toIndex: number) => {
    if (reordering || fromIndex === toIndex || fromIndex < 0) return;
    const week = weeks.find(item => item.id === weekId);
    if (!week || toIndex < 0 || toIndex >= week.lessons.length) return;
    const previous = weeks;
    const nextLessons = arrayMove(week.lessons, fromIndex, toIndex);
    const next = weeks.map(item => item.id === weekId ? { ...item, lessons: nextLessons } : item);
    setWeeks(next);
    setReordering(true);
    try {
      await axiosClient.put(`/api/progress/weeks/${weekId}/lessons/reorder`, { orderedIds: nextLessons.map(lesson => lesson.id) });
    } catch (error) {
      setWeeks(previous);
      toast.error(requestErrorMessage(error, 'Unable to save the new session order.'));
    } finally { setReordering(false); }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canManage || !editing || !event.over || event.active.id === event.over.id) return;
    const active = event.active.data.current as SortableData | undefined;
    const over = event.over.data.current as SortableData | undefined;
    if (!active || !over) return;
    if (active.type === 'week') {
      await persistWeekOrder(weeks.findIndex(week => week.id === active.weekId), weeks.findIndex(week => week.id === over.weekId));
      return;
    }
    if (over.type !== 'lesson' || active.weekId !== over.weekId) return;
    const lessonList = weeks.find(week => week.id === active.weekId)?.lessons || [];
    await persistLessonOrder(active.weekId, lessonList.findIndex(lesson => `lesson:${lesson.id}` === event.active.id), lessonList.findIndex(lesson => `lesson:${lesson.id}` === event.over?.id));
  };

  if (loading) return <div className="mx-auto w-full max-w-[1320px]"><CourseSkeleton /></div>;
  const allExpanded = weeks.length > 0 && weeks.every(week => expanded.has(week.id));
  const showOutline = !loadError && weeks.length > 0;

  return <div className="mx-auto w-full max-w-[1320px] space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-heading font-semibold text-foreground">Lessons</h2>
        <p className="mt-1 text-body text-muted-foreground">{canManage ? 'Organize the class curriculum by weeks and sessions.' : 'Follow published sessions, materials, and class activities.'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {weeks.length >= 3 && <Button size="sm" variant="ghost" onClick={toggleAll} title={allExpanded ? 'Collapse all weeks' : 'Expand all weeks'}><ChevronsUpDown size={14} /><span className="hidden sm:inline">{allExpanded ? 'Collapse all' : 'Expand all'}</span></Button>}
        {weeks.length > 0 && <Button size="sm" variant={compact ? 'accent' : 'ghost'} onClick={toggleCompact} aria-pressed={compact} title="Toggle compact curriculum view"><ListCollapse size={14} /><span className="hidden sm:inline">Compact</span></Button>}
        {canManage && <Button size="sm" variant={editing ? 'accent' : 'outline'} onClick={() => setEditing(current => !current)} aria-pressed={editing}>{editing ? <Check size={15} /> : <Pencil size={15} />}{editing ? 'Done' : 'Edit curriculum'}</Button>}
        {canManage && editing && <Button size="sm" onClick={() => openEditor('week')}><Plus size={15} />Add week</Button>}
      </div>
    </div>

    <div className={showOutline ? 'min-[1400px]:grid min-[1400px]:grid-cols-[minmax(0,1fr)_280px] min-[1400px]:items-start min-[1400px]:gap-6' : undefined}>
      {loadError ? <CourseLoadError message={loadError} onRetry={() => void loadCourse()} /> : <section className="min-w-0 space-y-3" aria-label="Course curriculum">
        {weeks.length === 0 ? <EmptyState icon={<BookOpen size={20} />} title={canManage ? 'No weeks yet' : 'No lessons yet'} description={canManage ? editing ? 'Create the first week to start building the class curriculum.' : 'Enter edit mode to start building the class curriculum.' : 'Published weeks and sessions from your teacher will appear here.'} action={canManage && editing ? <Button size="sm" onClick={() => openEditor('week')}><Plus size={15} />Create first week</Button> : undefined} /> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={event => void handleDragEnd(event)}>
          <SortableContext items={weeks.map(week => `week:${week.id}`)} strategy={verticalListSortingStrategy}>
            {weeks.map((week, weekIndex) => <SortableWeekOutline key={week.id} week={week} index={weekIndex} open={expanded.has(week.id)} compact={compact} canManage={canManage} editing={editing} disabled={reordering} onOpenChange={open => toggleWeek(week.id, open)} onAddLesson={() => openEditor('lesson', undefined, week.id)} onEdit={() => openEditor('week', week)} onPublish={() => void publishItem('week', week)} onDelete={() => setDeleteTarget({ kind: 'week', id: week.id, name: week.title })} onMoveUp={() => void persistWeekOrder(weekIndex, weekIndex - 1)} onMoveDown={() => void persistWeekOrder(weekIndex, weekIndex + 1)} canMoveUp={weekIndex > 0} canMoveDown={weekIndex < weeks.length - 1} busy={busyItem === `week:${week.id}` || reordering}>
              {week.lessons.length === 0 ? <div className="flex flex-col items-start justify-between gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5"><div><p className="text-body font-medium text-foreground">No sessions in this week</p><p className="mt-0.5 text-caption text-muted-foreground">{canManage && editing ? 'Add a session to begin structuring this module.' : canManage ? 'Enter edit mode to add the first session.' : 'More sessions are coming soon.'}</p></div>{canManage && editing && <Button size="sm" variant="ghost" onClick={() => openEditor('lesson', undefined, week.id)}><Plus size={14} />Add session</Button>}</div> : <SortableContext items={week.lessons.map(lesson => `lesson:${lesson.id}`)} strategy={verticalListSortingStrategy}>
                {week.lessons.map((lesson, lessonIndex) => <SortableLessonOutline key={lesson.id} weekId={week.id} weekStatus={week.status} lesson={lesson} number={lessonIndex + 1} compact={compact} canManage={canManage} editing={editing} disabled={reordering} busy={busyItem === `lesson:${lesson.id}` || reordering} onEdit={() => openEditor('lesson', lesson, week.id)} onPublish={() => void publishItem('lesson', lesson)} onDelete={() => setDeleteTarget({ kind: 'lesson', id: lesson.id, name: lesson.title })} onMoveUp={() => void persistLessonOrder(week.id, lessonIndex, lessonIndex - 1)} onMoveDown={() => void persistLessonOrder(week.id, lessonIndex, lessonIndex + 1)} canMoveUp={lessonIndex > 0} canMoveDown={lessonIndex < week.lessons.length - 1} onAddResource={() => setResourceLesson({ weekId: week.id, lessonId: lesson.id })} onAddAssignment={() => setActivityComposer({ kind: 'ASSIGNMENT', lessonId: lesson.id })} onAddTest={() => setActivityComposer({ kind: 'TEST', lessonId: lesson.id })} onResource={resource => void openResource(resource)} onDeleteResource={resource => setDeleteTarget({ kind: 'resource', id: resource.id, name: resource.name })} onAssignment={assignment => navigate(`/dashboard/class/${classId}/assignment/${assignment.id}`)} onDelivery={startDelivery} onActivity={activity => activity.type === 'HOMEWORK' && activity.homework ? navigate(`/dashboard/class/${classId}/assignment/${activity.homework.assignmentId}`) : activity.type === 'VOCABULARY' ? navigate(`/dashboard/vocabulary?activity=${activity.id}`) : navigate(`/dashboard/class/${classId}?tab=activities`)} onComplete={() => void completeLesson(lesson)} isLast={lessonIndex === week.lessons.length - 1} />)}
              </SortableContext>}
            </SortableWeekOutline>)}
          </SortableContext>
        </DndContext>}
      </section>}
      {showOutline && <CourseOutline weeks={weeks} activeWeekId={activeWeekId} showStatuses={canManage} onNavigate={navigateToWeek} />}
    </div>

    <CurriculumEditor editor={editor} form={form} setForm={setForm} saving={saving} onClose={() => setEditor(null)} onSave={() => void saveEditor()} />
    <ResourceEditor open={Boolean(resourceLesson)} form={resourceForm} setForm={setResourceForm} saving={saving} onClose={() => setResourceLesson(null)} onSave={() => void addResource()} />
    <Modal open={Boolean(deleteTarget)} closeOnBackdrop presentation="content-dialog" onClose={() => setDeleteTarget(null)} title={`Delete ${deleteTarget?.kind || 'item'}?`} subtitle={deleteTarget?.kind === 'resource' ? 'This action cannot be undone. Its viewing progress will also be removed.' : 'The curriculum item will be removed. Published activities stay available in the Activities tab.'} footer={<><Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={() => void confirmDelete()}>{saving ? 'Deleting…' : 'Delete'}</Button></>}><p className="text-body text-muted-foreground">Remove <strong className="text-foreground">{deleteTarget?.name}</strong> from this course?</p></Modal>
    {classId && <AssignmentComposer open={activityComposer?.kind === 'ASSIGNMENT'} classId={classId} initialLessonId={activityComposer?.lessonId} students={students} onClose={() => setActivityComposer(null)} onCreated={async () => { window.dispatchEvent(new Event('classroom-todos:refresh')); await loadCourse(false); }} />}
    {classId && <AssignTestsComposer open={activityComposer?.kind === 'TEST'} classId={classId} initialLessonId={activityComposer?.lessonId} students={students} onClose={() => setActivityComposer(null)} onCreated={async () => { window.dispatchEvent(new Event('classroom-todos:refresh')); await loadCourse(false); }} />}
  </div>;
};

interface WeekOutlineProps {
  week: Week; index: number; open: boolean; compact: boolean; canManage: boolean; editing: boolean; disabled: boolean; busy: boolean;
  onOpenChange: (open: boolean) => void; onAddLesson: () => void; onEdit: () => void; onPublish: () => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean; children: React.ReactNode;
}

function SortableWeekOutline(props: WeekOutlineProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `week:${props.week.id}`, data: { type: 'week', weekId: props.week.id } satisfies SortableData, disabled: !props.canManage || !props.editing || props.disabled });
  const dragHandle = props.canManage && props.editing ? <Button variant="ghost" size="icon" className="size-8 cursor-grab touch-none opacity-100 active:cursor-grabbing sm:opacity-0 sm:group-hover/week:opacity-100 sm:focus:opacity-100" disabled={props.disabled} aria-label={`Reorder ${props.week.title}`} {...attributes} {...listeners}><GripVertical size={16} /></Button> : undefined;
  return <div id={weekAnchorId(props.week.id)} data-week-id={props.week.id} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`scroll-mt-24 ${isDragging ? 'relative z-10 opacity-70' : ''}`}><WeekOutline {...props} dragHandle={dragHandle} /></div>;
}

function WeekOutline({ week, index, open, compact, canManage, editing, busy, onOpenChange, onAddLesson, onEdit, onPublish, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown, children, dragHandle }: WeekOutlineProps & { dragHandle?: React.ReactNode }) {
  const itemCount = week.lessons.reduce((total, lesson) => total + lessonItemCount(lesson), 0);
  const metadata = `${week.availableAt ? `Available ${formatDate(week.availableAt)} · ` : ''}${week.lessons.length} session${week.lessons.length === 1 ? '' : 's'} · ${itemCount} item${itemCount === 1 ? '' : 's'}`;
  const contentId = `week-${week.id}-content`;
  return <Collapsible open={open} onOpenChange={onOpenChange}><Card className="group/week overflow-hidden shadow-none">
    <div className={`flex items-center gap-1 bg-section-header px-2 sm:px-3 ${compact ? 'min-h-14 py-2' : 'min-h-16 py-3'}`}>
      {dragHandle}
      <CollapsibleTrigger asChild><button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded-control text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-controls={contentId} aria-label={`${open ? 'Collapse' : 'Expand'} ${week.title}`}>
        <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">{open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span>
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-title text-foreground"><span className="shrink-0 font-semibold">Week {String(index + 1).padStart(2, '0')}</span><span className="text-muted-foreground" aria-hidden="true">·</span><span className="truncate font-medium">{week.title}</span></span><span className="mt-0.5 block truncate text-caption text-muted-foreground">{!compact && week.description ? `${week.description} · ${metadata}` : metadata}</span></span>
      </button></CollapsibleTrigger>
      {canManage && (editing || week.status !== 'PUBLISHED') && <div className="flex shrink-0 items-center gap-1"><StatusBadge status={week.status} hidePublished />{editing && <><Button size="sm" variant="ghost" onClick={onAddLesson}><Plus size={14} /><span className="hidden md:inline">Session</span></Button><ActionMenu label={`${week.title} actions`} onEdit={onEdit} onPublish={onPublish} onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} canMoveUp={canMoveUp} canMoveDown={canMoveDown} published={week.status === 'PUBLISHED'} busy={busy} /></>}</div>}
    </div>
    <CollapsibleContent id={contentId} className="border-t border-ui-border">{children}</CollapsibleContent>
  </Card></Collapsible>;
}

interface LessonOutlineProps {
  weekId: string; lesson: Lesson; weekStatus: ContentStatus; number: number; compact: boolean; canManage: boolean; editing: boolean; disabled: boolean; busy: boolean; isLast: boolean;
  onEdit: () => void; onPublish: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean;
  onAddResource: () => void; onAddAssignment: () => void; onAddTest: () => void; onResource: (item: Resource) => void; onDeleteResource: (item: Resource) => void;
  onAssignment: (item: Assignment) => void; onDelivery: (item: Delivery) => void; onActivity: (item: Activity) => void; onComplete: () => void;
}

function SortableLessonOutline(props: LessonOutlineProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `lesson:${props.lesson.id}`, data: { type: 'lesson', weekId: props.weekId } satisfies SortableData, disabled: !props.canManage || !props.editing || props.disabled });
  const dragHandle = props.canManage && props.editing ? <Button variant="ghost" size="icon" className="size-8 cursor-grab touch-none opacity-100 active:cursor-grabbing sm:opacity-0 sm:group-hover/session:opacity-100 sm:focus:opacity-100" disabled={props.disabled} aria-label={`Reorder ${props.lesson.title}`} {...attributes} {...listeners}><GripVertical size={16} /></Button> : undefined;
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'relative z-10 bg-surface opacity-70' : undefined}><LessonOutline {...props} dragHandle={dragHandle} />{!props.isLast && <Separator />}</div>;
}

function LessonOutline({ lesson, weekStatus, number, compact, canManage, editing, busy, onEdit, onPublish, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onAddResource, onAddAssignment, onAddTest, onResource, onDeleteResource, onAssignment, onDelivery, onActivity, onComplete, dragHandle }: LessonOutlineProps & { dragHandle?: React.ReactNode }) {
  const completed = lesson.studentProgress?.status === 'COMPLETED';
  const { deliveries, activities, assignments } = lessonContent(lesson);
  const itemCount = lesson.files.length + deliveries.length + activities.length + assignments.length;
  const hiddenByWeek = canManage && lesson.status === 'PUBLISHED' && weekStatus !== 'PUBLISHED';
  return <article className={`group/session px-3 sm:px-4 ${compact ? 'py-2.5' : 'py-4'}`}>
    <header className="flex items-start gap-1 sm:gap-2">
      {dragHandle}
      <div className="min-w-0 flex-1">
        <h3 className="flex min-w-0 items-center gap-2 text-title text-foreground">{completed && <Check size={15} className="shrink-0 text-success" aria-label="Completed" />}<span className="shrink-0 font-semibold">Session {String(number).padStart(2, '0')}</span><span className="text-muted-foreground" aria-hidden="true">·</span><span className="truncate font-medium">{lesson.title}</span></h3>
        {!compact && lesson.summary && <p className="mt-0.5 line-clamp-1 text-body text-muted-foreground">{lesson.summary}</p>}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">{lesson.scheduledAt && <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />{formatDateTime(lesson.scheduledAt)}</span>}{lesson.durationMinutes && <span className="inline-flex items-center gap-1.5"><Clock3 size={13} />{lesson.durationMinutes} min</span>}{itemCount > 0 && <span>{itemCount} item{itemCount === 1 ? '' : 's'}</span>}</div>
      </div>
      {canManage ? (editing || hiddenByWeek || lesson.status !== 'PUBLISHED') && <div className="flex shrink-0 items-center gap-1">{hiddenByWeek ? <Badge tone="neutral">Hidden by week</Badge> : <StatusBadge status={lesson.status} hidePublished />}{editing && <ActionMenu label={`${lesson.title} actions`} onEdit={onEdit} onPublish={onPublish} onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} canMoveUp={canMoveUp} canMoveDown={canMoveDown} published={lesson.status === 'PUBLISHED'} busy={busy} />}</div> : <Button size="sm" variant={completed ? 'outline' : 'primary'} disabled={busy} onClick={onComplete}>{busy && <LoaderCircle size={14} className="animate-spin" />}{completed ? 'Completed' : 'Mark complete'}</Button>}
    </header>

    <div className={`mt-2 ml-6 ${editing ? 'sm:ml-24' : 'sm:ml-14'}`}>
      <CurriculumTree>
        {lesson.files.map(resource => <ResourceRow key={resource.id} resource={resource} canEdit={canManage && editing} compact={compact} onOpen={() => onResource(resource)} onDelete={() => onDeleteResource(resource)} />)}
        {deliveries.map(delivery => <CurriculumRow key={delivery.id} compact={compact} icon={<CirclePlay size={16} />} typeLabel={delivery.test.mode === 'EXAM' ? 'Test' : 'Quiz'} title={delivery.title} meta={`${delivery.test.duration} min${delivery.dueAt ? ` · Due ${formatDate(delivery.dueAt)}` : ''}`} onOpen={() => onDelivery(delivery)} />)}
        {activities.map(activity => <CurriculumRow key={activity.id} compact={compact} icon={activity.type === 'VOCABULARY' ? <BookA size={16} /> : activity.type === 'HOMEWORK' ? <ClipboardCheck size={16} /> : <Link2 size={16} />} typeLabel={activity.type === 'VOCABULARY' ? 'Vocabulary' : activity.type === 'HOMEWORK' ? 'Assignment' : 'Material'} title={activity.title} meta={activity.dueAt ? `Due ${formatDate(activity.dueAt)}` : undefined} onOpen={() => onActivity(activity)} />)}
        {assignments.map(assignment => <CurriculumRow key={assignment.id} compact={compact} icon={<ClipboardCheck size={16} />} typeLabel="Assignment" title={assignment.title} meta={assignment.assignment?.submissions?.length ? 'Submitted' : assignment.dueDate ? `Due ${formatDateTime(assignment.dueDate)}` : undefined} onOpen={() => onAssignment(assignment)} />)}
        {canManage && editing && <AddContentMenu onAddResource={onAddResource} onAddAssignment={onAddAssignment} onAddTest={onAddTest} />}
        {itemCount === 0 && (!canManage || !editing) && <p className="px-2 py-1 text-caption text-muted-foreground">No materials in this session yet.</p>}
      </CurriculumTree>
    </div>
  </article>;
}

function CurriculumTree({ children }: { children: React.ReactNode }) {
  const branches = Children.toArray(children);
  return <div>{branches.map((branch, index) => <div key={index} className="relative pl-8">
    <span className={`pointer-events-none absolute left-0 top-0 border-l border-ui-border ${index === branches.length - 1 ? 'bottom-1/2' : 'bottom-0'}`} aria-hidden="true" />
    <span className="pointer-events-none absolute left-0 top-1/2 h-4 w-6 -translate-y-full rounded-bl-xl border-b border-l border-ui-border" aria-hidden="true" />
    {branch}
  </div>)}</div>;
}

function CurriculumRow({ icon, typeLabel, title, meta, onOpen, trailing, action, compact }: { icon: React.ReactNode; typeLabel: string; title: string; meta?: string; onOpen: () => void; trailing?: React.ReactNode; action?: React.ReactNode; compact: boolean }) {
  return <div className={`group flex items-center gap-3 rounded-control px-2 transition-colors hover:bg-muted/50 ${compact || !meta ? 'min-h-9 py-0.5' : 'min-h-11 py-1.5'}`}>
    <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
    <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"><span className="block truncate text-body text-foreground"><span className="font-semibold">{typeLabel}:</span> <span className="font-medium">{title}</span></span>{meta && <span className="block truncate text-caption text-muted-foreground">{meta}</span>}</button>
    {trailing}
    {action || <ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
  </div>;
}

function ResourceRow({ resource, canEdit, compact, onOpen, onDelete }: { resource: Resource; canEdit: boolean; compact: boolean; onOpen: () => void; onDelete: () => void }) {
  const Icon = resource.kind === 'VIDEO' ? Video : resource.kind === 'LINK' ? Link2 : FileText;
  const typeLabel = resource.kind === 'VIDEO' ? 'Video' : resource.kind === 'LINK' ? 'Link' : resource.kind === 'EMBED' ? 'Activity' : 'Material';
  const metadata = [resource.provider === 'GOOGLE_DRIVE' ? 'Google Drive' : null, resource.progress?.[0]?.completedAt ? 'Viewed' : null].filter(Boolean).join(' · ') || undefined;
  return <CurriculumRow compact={compact} icon={<Icon size={16} />} typeLabel={typeLabel} title={resource.name} meta={metadata} onOpen={onOpen} trailing={resource.isRequired ? <Badge tone="neutral">Required</Badge> : undefined} action={canEdit ? <ResourceMenu name={resource.name} onDelete={onDelete} /> : <ExternalLink size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />} />;
}

function AddContentMenu({ onAddResource, onAddAssignment, onAddTest }: { onAddResource: () => void; onAddAssignment: () => void; onAddTest: () => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="ghost"><Plus size={14} />Add content</Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-60"><DropdownMenuLabel>Student work</DropdownMenuLabel><DropdownMenuItem onSelect={onAddAssignment}><ClipboardCheck />Assignment</DropdownMenuItem><DropdownMenuItem onSelect={onAddTest}><CirclePlay />Test</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuLabel>Learning material</DropdownMenuLabel><DropdownMenuItem onSelect={onAddResource}><FileText />File, link, or video</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function ResourceMenu({ name, onDelete }: { name: string; onDelete: () => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label={`${name} actions`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />Delete material</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function ActionMenu({ label, onEdit, onPublish, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown, published, busy }: { label: string; onEdit: () => void; onPublish: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean; published: boolean; busy: boolean }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label={label} disabled={busy}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <MoreHorizontal size={17} />}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44"><DropdownMenuItem disabled={!canMoveUp} onSelect={onMoveUp}><MoveUp />Move up</DropdownMenuItem><DropdownMenuItem disabled={!canMoveDown} onSelect={onMoveDown}><MoveDown />Move down</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={onEdit}><Pencil />Edit details</DropdownMenuItem><DropdownMenuItem onSelect={onPublish}><Rocket />{published ? 'Move to draft' : 'Publish'}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function StatusBadge({ status, hidePublished = false }: { status?: ContentStatus; hidePublished?: boolean }) { const safeStatus = status || 'PUBLISHED'; if (hidePublished && safeStatus === 'PUBLISHED') return null; const tone = safeStatus === 'PUBLISHED' ? 'success' : safeStatus === 'SCHEDULED' || safeStatus === 'ARCHIVED' ? 'neutral' : 'warning'; return <Badge tone={tone}>{safeStatus[0] + safeStatus.slice(1).toLowerCase()}</Badge>; }

function CourseOutline({ weeks, activeWeekId, showStatuses, onNavigate }: { weeks: Week[]; activeWeekId: string | null; showStatuses: boolean; onNavigate: (weekId: string) => void }) {
  return <aside className="hidden min-[1400px]:sticky min-[1400px]:top-4 min-[1400px]:block min-[1400px]:self-start" aria-label="Course outline navigation">
    <Card className="p-4 shadow-none">
      <div>
        <h3 className="text-body font-semibold text-foreground">Course outline</h3>
        <p className="mt-0.5 text-caption text-muted-foreground">Jump to any week</p>
      </div>
      <nav className="relative mt-3 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1" aria-label="Weeks">
        <span className="pointer-events-none absolute bottom-4 left-1 top-4 border-l border-ui-border" aria-hidden="true" />
        <div className="space-y-1">
          {weeks.map((week, index) => {
            const active = week.id === activeWeekId;
            return <button key={week.id} type="button" aria-current={active ? 'location' : undefined} onClick={() => onNavigate(week.id)} className={`group/outline relative flex w-full items-start gap-3 rounded-control py-2 pl-5 pr-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}>
              <span className={`absolute left-0 top-3.5 size-2 rounded-full border ${active ? 'border-primary bg-primary' : 'border-ui-border-strong bg-surface group-hover/outline:border-foreground'}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5 text-body"><span className="shrink-0 font-semibold text-foreground">Week {String(index + 1).padStart(2, '0')}</span><span aria-hidden="true">·</span><span className="truncate font-medium">{week.title}</span></span>
                <span className="mt-0.5 block text-caption text-muted-foreground">{week.lessons.length} session{week.lessons.length === 1 ? '' : 's'}</span>
              </span>
              {showStatuses && week.status !== 'PUBLISHED' && <StatusBadge status={week.status} />}
            </button>;
          })}
        </div>
      </nav>
    </Card>
  </aside>;
}

function CurriculumEditor({ editor, form, setForm, saving, onClose, onSave }: { editor: { kind: 'week' | 'lesson'; item?: Week | Lesson } | null; form: CourseForm; setForm: React.Dispatch<React.SetStateAction<CourseForm>>; saving: boolean; onClose: () => void; onSave: () => void }) {
  const lesson = editor?.kind === 'lesson';
  return <Modal open={Boolean(editor)} closeOnBackdrop presentation="content-dialog" onClose={onClose} title={`${editor?.item ? 'Edit' : 'Add'} ${lesson ? 'session' : 'week'}`} subtitle={lesson ? 'Set the session overview, timing and visibility.' : 'Create a clear module in the curriculum.'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving || !form.title.trim()} onClick={onSave}>{saving ? 'Saving…' : 'Save'}</Button></>}><div className="space-y-4"><Field label="Title"><Input autoFocus className="w-full" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder={lesson ? 'Session 1: Reading foundations' : 'Week 1: Foundations'} /></Field><Field label={lesson ? 'Session overview' : 'Week description'}><Textarea className="min-h-24 w-full" value={lesson ? form.summary : form.description} onChange={event => setForm(current => ({ ...current, [lesson ? 'summary' : 'description']: event.target.value }))} placeholder="What will students learn?" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Visibility"><Select className="w-full" value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as ContentStatus }))}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option>{lesson && <option value="SCHEDULED">Scheduled</option>}<option value="ARCHIVED">Archived</option></Select></Field>{lesson && <Field label="Duration (minutes)"><Input type="number" min="1" className="w-full" value={form.durationMinutes} onChange={event => setForm(current => ({ ...current, durationMinutes: event.target.value }))} /></Field>}</div>{lesson && <Field label="Session date & time"><DateTimePicker value={form.scheduledAt} onChange={value => setForm(current => ({ ...current, scheduledAt: value }))} placeholder="Choose date and time" ariaLabel="Session date and time" /></Field>}<p className="rounded-control bg-primary-soft px-3 py-2 text-caption leading-5 text-primary">Publishing makes this item visible to enrolled students and sends a notification.</p></div></Modal>;
}

function ResourceEditor({ open, form, setForm, saving, onClose, onSave }: { open: boolean; form: { name: string; url: string; kind: ResourceKind; isRequired: boolean }; setForm: React.Dispatch<React.SetStateAction<{ name: string; url: string; kind: ResourceKind; isRequired: boolean }>>; saving: boolean; onClose: () => void; onSave: () => void }) { return <Modal open={open} closeOnBackdrop presentation="content-dialog" onClose={onClose} title="Add learning resource" subtitle="Attach a document, video, website or embeddable activity. Google Drive files must already be shared with the class." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving || !form.name.trim() || !form.url.trim()} onClick={onSave}>{saving ? 'Adding…' : 'Add resource'}</Button></>}><div className="space-y-4"><Field label="Resource type"><Select className="w-full" value={form.kind} onChange={event => setForm(current => ({ ...current, kind: event.target.value as ResourceKind }))}><option value="FILE">Document / file</option><option value="VIDEO">Video</option><option value="LINK">Website link</option><option value="EMBED">Embedded activity</option></Select></Field><Field label="Display name"><Input autoFocus className="w-full" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="SAT Reading strategy guide" /></Field><Field label="Secure URL"><Input type="url" className="w-full" value={form.url} onChange={event => setForm(current => ({ ...current, url: event.target.value }))} placeholder="https://…" /></Field><label className="flex items-center gap-2 text-body text-foreground"><Checkbox checked={form.isRequired} onCheckedChange={checked => setForm(current => ({ ...current, isRequired: Boolean(checked) }))} />Required material</label><p className="rounded-control border border-ui-border bg-surface-subtle p-3 text-caption leading-5 text-muted-foreground">For privacy, the app no longer changes Drive permissions automatically. Share the file only with the class or organization before adding its URL.</p></div></Modal>; }

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-caption font-semibold text-foreground">{label}</span>{children}</label>; }
function CourseSkeleton() { return <div className="space-y-4" aria-label="Loading lessons"><div className="flex items-center justify-between"><div className="space-y-2"><span className="block h-5 w-24 animate-pulse rounded-sm bg-muted" /><span className="block h-4 w-72 max-w-full animate-pulse rounded-sm bg-muted" /></div><span className="h-8 w-24 animate-pulse rounded-control bg-muted" /></div>{[1, 2, 3].map(item => <div key={item} className="h-16 animate-pulse rounded-card border border-ui-border bg-surface" />)}</div>; }
function CourseLoadError({ message, onRetry }: { message: string; onRetry: () => void }) { return <Card className="flex items-start gap-3 p-4 shadow-none" role="alert"><span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-danger-soft text-danger"><AlertCircle size={17} /></span><div className="min-w-0 flex-1"><p className="text-body font-semibold text-foreground">Unable to load lessons</p><p className="mt-0.5 text-caption text-muted-foreground">{message}</p></div><Button size="sm" variant="outline" onClick={onRetry}><RefreshCw size={14} />Retry</Button></Card>; }

function lessonContent(lesson: Lesson) {
  const deliveries = lesson.deliveries.filter(delivery => delivery.status !== 'CLOSED');
  const canonicalHomeworkIds = new Set(lesson.activities.flatMap(activity => activity.homework?.assignmentId ? [activity.homework.assignmentId] : []));
  const assignments = lesson.assignments.filter(assignment => !canonicalHomeworkIds.has(assignment.id));
  return { deliveries, activities: lesson.activities, assignments };
}

function lessonItemCount(lesson: Lesson) { const content = lessonContent(lesson); return lesson.files.length + content.deliveries.length + content.activities.length + content.assignments.length; }
function weekAnchorId(weekId: string) { return `curriculum-week-${weekId}`; }
function requestErrorMessage(error: unknown, fallback: string) { const body = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data; return body?.error || body?.message || fallback; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date unavailable' : format(date, 'MMM d'); }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date unavailable' : format(date, 'MMM d, HH:mm'); }

function readExpandedPreference(storageKey: string, weeks: Week[]) {
  const knownIds = new Set(weeks.map(week => week.id));
  const stored = localStorage.getItem(storageKey);
  if (stored !== null) {
    try {
      const ids = JSON.parse(stored);
      if (Array.isArray(ids)) return new Set(ids.map(String).filter(id => knownIds.has(id)));
    } catch { localStorage.removeItem(storageKey); }
  }
  return new Set(weeks.slice(0, 1).map(week => week.id));
}

function normalizeWeeks(value: unknown): Week[] {
  if (!Array.isArray(value)) return [];
  return value.map(rawWeek => {
    const week = rawWeek as Partial<Week>;
    const lessons = Array.isArray(week.lessons) ? week.lessons.map(rawLesson => {
      const lesson = rawLesson as Partial<Lesson>;
      const files = Array.isArray(lesson.files) ? lesson.files.map(rawResource => {
        const resource = rawResource as Partial<Resource>;
        return { ...resource, id: String(resource.id || ''), name: String(resource.name || 'Untitled resource'), url: String(resource.url || ''), kind: resource.kind || 'FILE', isRequired: Boolean(resource.isRequired), progress: Array.isArray(resource.progress) ? resource.progress : [] } as Resource;
      }) : [];
      return { ...lesson, id: String(lesson.id || ''), order: Number(lesson.order) || 0, title: String(lesson.title || 'Untitled session'), status: lesson.status || 'PUBLISHED', files, assignments: Array.isArray(lesson.assignments) ? lesson.assignments : [], deliveries: Array.isArray(lesson.deliveries) ? lesson.deliveries : [], activities: Array.isArray(lesson.activities) ? lesson.activities : [] } as Lesson;
    }) : [];
    return { ...week, id: String(week.id || ''), order: Number(week.order) || 0, title: String(week.title || 'Untitled week'), status: week.status || 'PUBLISHED', lessons } as Week;
  });
}

export default WeeklyProgress;
