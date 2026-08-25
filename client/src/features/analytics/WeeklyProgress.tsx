import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, Check, ChevronDown, ChevronRight, CirclePlay, ClipboardCheck, Clock3, ExternalLink, FileText, Link2, MoreHorizontal, Pencil, Plus, Rocket, Trash2, Video } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import TestAssignmentManager from '../assignment/TestAssignmentManager';
import { ClassroomTodoPanel } from '../classroom/ClassroomTodoPanel';
import { Badge, Button, Card, EmptyState, Input, Modal, Select } from '../../components/ui/AppUI';
import axiosClient from '../../lib/axios';

type ContentStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
type ResourceKind = 'FILE' | 'VIDEO' | 'LINK' | 'EMBED';

interface ResourceProgress { completedAt?: string | null }
interface Resource { id: string; name: string; url: string; kind: ResourceKind; provider?: string | null; isRequired: boolean; progress: ResourceProgress[] }
interface Assignment { id: string; lessonAssignmentId?: string; title: string; content?: string | null; dueDate?: string | null; testIds?: number[]; assignment?: { submissions?: Array<{ status: string; submittedAt: string; score?: number | null }> } }
interface Delivery { id: string; title: string; status: string; dueAt?: string | null; test: { id: number; title: string; mode: 'EXAM' | 'PRACTICE'; duration: number; subject: string; folderId: number | null; sections?: Array<{ _count: { questions: number } }> } }
interface Activity { id: string; type: 'VOCABULARY' | 'RESOURCE'; title: string; dueAt?: string | null; assignees?: Array<{ status: string }> }
interface LessonProgress { status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'; progress: number }
interface Lesson { id: string; title: string; summary?: string | null; status: ContentStatus; scheduledAt?: string | null; durationMinutes?: number | null; files: Resource[]; assignments: Assignment[]; deliveries: Delivery[]; activities: Activity[]; studentProgress?: LessonProgress | null; progressSummary?: { completed: number; started: number } | null }
interface Week { id: string; title: string; description?: string | null; status: ContentStatus; availableAt?: string | null; lessons: Lesson[] }

interface CourseForm { title: string; description: string; summary: string; status: ContentStatus; scheduledAt: string; durationMinutes: string }
const EMPTY_FORM: CourseForm = { title: '', description: '', summary: '', status: 'DRAFT', scheduledAt: '', durationMinutes: '' };

const WeeklyProgress = ({ canManage = true }: { canManage?: boolean }) => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [editor, setEditor] = useState<{ kind: 'week' | 'lesson'; weekId?: string; item?: Week | Lesson } | null>(null);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [resourceLesson, setResourceLesson] = useState<{ weekId: string; lessonId: string } | null>(null);
  const [resourceForm, setResourceForm] = useState({ name: '', url: '', kind: 'FILE' as ResourceKind, isRequired: false });
  const [homeworkLesson, setHomeworkLesson] = useState<{ weekId: string; lesson: Lesson } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'week' | 'lesson' | 'resource'; id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCourse = useCallback(async () => {
    if (!classId) return;
    try {
      setLoading(true);
      const response = await axiosClient.get(`/api/progress/class/${classId}/weeks`);
      const items = normalizeWeeks(response.data);
      setWeeks(items);
      setExpanded(current => current.size ? current : new Set(items.slice(0, 1).map(week => week.id)));
    } catch (error) {
      console.error(error);
      toast.error('Unable to load the course curriculum.');
    } finally { setLoading(false); }
  }, [classId]);

  useEffect(() => { void loadCourse(); }, [loadCourse]);

  const metrics = useMemo(() => {
    const lessons = weeks.flatMap(week => week.lessons);
    return { weeks: weeks.length, lessons: lessons.length, resources: lessons.reduce((sum, lesson) => sum + lesson.files.length, 0), published: lessons.filter(lesson => lesson.status === 'PUBLISHED').length };
  }, [weeks]);

  const toggleWeek = (weekId: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(weekId)) next.delete(weekId); else next.add(weekId);
    return next;
  });

  const openEditor = (kind: 'week' | 'lesson', item?: Week | Lesson, weekId?: string) => {
    setEditor({ kind, item, weekId });
    setForm({ title: item?.title || '', description: kind === 'week' ? ((item as Week | undefined)?.description || '') : '', summary: kind === 'lesson' ? ((item as Lesson | undefined)?.summary || '') : '', status: item?.status || 'DRAFT', scheduledAt: kind === 'lesson' && (item as Lesson | undefined)?.scheduledAt ? toLocalDateTime((item as Lesson).scheduledAt as string) : '', durationMinutes: kind === 'lesson' ? String((item as Lesson | undefined)?.durationMinutes || '') : '' });
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
      toast.success(editor.item ? 'Curriculum updated.' : `${editor.kind === 'week' ? 'Week' : 'Lesson'} created.`);
      setEditor(null);
      await loadCourse();
    } catch (error) { console.error(error); toast.error('Unable to save this curriculum item.'); }
    finally { setSaving(false); }
  };

  const publishItem = async (kind: 'week' | 'lesson', item: Week | Lesson) => {
    try {
      await axiosClient.put(`/api/progress/${kind === 'week' ? 'weeks' : 'lessons'}/${item.id}`, { status: item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' });
      toast.success(item.status === 'PUBLISHED' ? 'Moved back to draft.' : 'Published to students.');
      await loadCourse();
    } catch (error) { console.error(error); toast.error('Unable to update publication status.'); }
  };

  const addResource = async () => {
    if (!resourceLesson || !resourceForm.name.trim() || !resourceForm.url.trim()) return;
    setSaving(true);
    try {
      await axiosClient.post(`/api/progress/lessons/${resourceLesson.lessonId}/files`, { files: [{ ...resourceForm, name: resourceForm.name.trim(), url: resourceForm.url.trim() }] });
      toast.success('Resource added.');
      setResourceLesson(null);
      setResourceForm({ name: '', url: '', kind: 'FILE', isRequired: false });
      await loadCourse();
    } catch (error) { console.error(error); toast.error('Unable to add this resource. Check the URL.'); }
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
      await loadCourse();
    } catch (error) { console.error(error); toast.error('Unable to remove this item.'); }
    finally { setSaving(false); }
  };

  const openResource = async (resource: Resource) => {
    if (!canManage) {
      try { await axiosClient.put(`/api/progress/files/${resource.id}/progress`, { completed: resource.kind !== 'VIDEO' }); } catch (error) { console.error(error); }
    }
    window.open(resource.url, '_blank', 'noopener,noreferrer');
    if (!canManage) await loadCourse();
  };

  const completeLesson = async (lesson: Lesson) => {
    try {
      await axiosClient.put(`/api/progress/lessons/${lesson.id}/progress`, { completed: lesson.studentProgress?.status !== 'COMPLETED' });
      toast.success(lesson.studentProgress?.status === 'COMPLETED' ? 'Lesson marked in progress.' : 'Lesson completed.');
      await loadCourse();
    } catch (error) { console.error(error); toast.error('Unable to update your progress.'); }
  };

  const saveHomework = async (data: { title: string; content: string; deadline: string | null; testIds: number[] }) => {
    if (!homeworkLesson) return;
    try {
      await axiosClient.post(`/api/progress/lessons/${homeworkLesson.lesson.id}/assignment`, { title: data.title, content: data.content, dueDate: data.deadline, testIds: data.testIds });
      toast.success('Homework published and added to student To Do lists.');
      setHomeworkLesson(null);
      window.dispatchEvent(new Event('classroom-todos:refresh'));
      await loadCourse();
    } catch (error) { console.error(error); toast.error('Unable to publish homework.'); }
  };

  const startDelivery = (delivery: Delivery) => {
    localStorage.setItem('current_exam_info', JSON.stringify({ id: delivery.test.id, title: delivery.title, duration: delivery.test.duration }));
    navigate(`/test/${delivery.test.id}?deliveryId=${delivery.id}`);
  };

  if (loading) return <CourseSkeleton />;

  return <div className="space-y-6">
    <CourseHero canManage={canManage} metrics={metrics} onAddWeek={() => openEditor('week')} />
    <div className={`grid min-w-0 items-start gap-6 ${canManage ? '' : 'xl:grid-cols-[minmax(0,1fr)_320px]'}`}>
      <section className="min-w-0 space-y-4" aria-label="Course curriculum">
        {weeks.length === 0 ? <EmptyState icon={<BookOpen size={20} />} title="Build your course roadmap" description={canManage ? 'Create the first week, then add lessons, resources, quizzes and end-of-session homework.' : 'Your teacher has not published the course roadmap yet.'} action={canManage ? <Button onClick={() => openEditor('week')}><Plus size={15} />Create first week</Button> : undefined} /> : weeks.map((week, weekIndex) => <WeekCard key={week.id} week={week} index={weekIndex} open={expanded.has(week.id)} canManage={canManage} onToggle={() => toggleWeek(week.id)} onAddLesson={() => openEditor('lesson', undefined, week.id)} onEdit={() => openEditor('week', week)} onPublish={() => void publishItem('week', week)} onDelete={() => setDeleteTarget({ kind: 'week', id: week.id, name: week.title })}>
          {week.lessons.length === 0 ? <EmptyState surface={false} compact title="No sessions in this week" description={canManage ? 'Add a session to begin structuring this week.' : 'More sessions are coming soon.'} action={canManage ? <Button size="sm" variant="outline" onClick={() => openEditor('lesson', undefined, week.id)}><Plus size={14} />Add session</Button> : undefined} /> : <div className="space-y-3 p-4 sm:p-5">{week.lessons.map((lesson, lessonIndex) => <LessonCard key={lesson.id} lesson={lesson} number={lessonIndex + 1} canManage={canManage} onEdit={() => openEditor('lesson', lesson, week.id)} onPublish={() => void publishItem('lesson', lesson)} onDelete={() => setDeleteTarget({ kind: 'lesson', id: lesson.id, name: lesson.title })} onAddResource={() => setResourceLesson({ weekId: week.id, lessonId: lesson.id })} onHomework={() => setHomeworkLesson({ weekId: week.id, lesson })} onResource={resource => void openResource(resource)} onDeleteResource={resource => setDeleteTarget({ kind: 'resource', id: resource.id, name: resource.name })} onAssignment={assignment => navigate(`/dashboard/class/${classId}/assignment/${assignment.id}`)} onDelivery={startDelivery} onActivity={activity => navigate(`/dashboard/vocabulary?activity=${activity.id}`)} onComplete={() => void completeLesson(lesson)} />)}</div>}
        </WeekCard>)}
      </section>
      {!canManage && <ClassroomTodoPanel />}
    </div>

    <CurriculumEditor editor={editor} form={form} setForm={setForm} saving={saving} onClose={() => setEditor(null)} onSave={() => void saveEditor()} />
    <ResourceEditor open={Boolean(resourceLesson)} form={resourceForm} setForm={setResourceForm} saving={saving} onClose={() => setResourceLesson(null)} onSave={() => void addResource()} />
    <Modal open={Boolean(deleteTarget)} closeOnBackdrop onClose={() => setDeleteTarget(null)} title={`Delete ${deleteTarget?.kind || 'item'}?`} subtitle="This action cannot be undone. Student progress and linked course data will also be removed." footer={<><Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={() => void confirmDelete()}>{saving ? 'Deleting…' : 'Delete'}</Button></>}><p className="text-body text-muted-foreground">Remove <strong className="text-foreground">{deleteTarget?.name}</strong> from this course?</p></Modal>
    {homeworkLesson && <TestAssignmentManager onClose={() => setHomeworkLesson(null)} onSubmit={saveHomework} initialData={homeworkLesson.lesson.assignments[0] ? { title: homeworkLesson.lesson.assignments[0].title, content: homeworkLesson.lesson.assignments[0].content || '', deadline: homeworkLesson.lesson.assignments[0].dueDate || undefined, selectedTests: homeworkLesson.lesson.deliveries.filter(delivery => homeworkLesson.lesson.assignments[0].testIds?.includes(delivery.test.id)).map(delivery => ({ id: delivery.test.id, title: delivery.test.title, subject: delivery.test.subject, mode: delivery.test.mode, duration: delivery.test.duration, folderId: delivery.test.folderId, questionCount: (delivery.test.sections || []).reduce((sum, section) => sum + section._count.questions, 0), deliveryId: delivery.id })) } : undefined} />}
  </div>;
};

function CourseHero({ canManage, metrics, onAddWeek }: { canManage: boolean; metrics: { weeks: number; lessons: number; resources: number; published: number }; onAddWeek: () => void }) {
  return <Card className="overflow-hidden"><div className="flex flex-col gap-5 bg-gradient-to-r from-primary-soft via-surface to-accent-soft/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><Badge tone="green">COURSE ROADMAP</Badge><h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">{canManage ? 'Design the learning journey' : 'Continue your learning journey'}</h2><p className="mt-1 max-w-2xl text-body leading-6 text-muted-foreground">{canManage ? 'Organize sessions, publish materials, assign quizzes and place homework at the end of every lesson.' : 'Follow each week in order, open the materials, complete classwork and submit the homework.'}</p></div>{canManage && <Button onClick={onAddWeek}><Plus size={16} />Add week</Button>}</div><div className="grid grid-cols-2 divide-x divide-ui-border border-t border-ui-border sm:grid-cols-4">{[['Weeks', metrics.weeks], ['Sessions', metrics.lessons], ['Resources', metrics.resources], ['Published', metrics.published]].map(([label, value]) => <div key={label} className="px-5 py-3"><p className="text-lg font-semibold text-foreground">{value}</p><p className="text-caption text-muted-foreground">{label}</p></div>)}</div></Card>;
}

function WeekCard({ week, index, open, canManage, onToggle, onAddLesson, onEdit, onPublish, onDelete, children }: { week: Week; index: number; open: boolean; canManage: boolean; onToggle: () => void; onAddLesson: () => void; onEdit: () => void; onPublish: () => void; onDelete: () => void; children: React.ReactNode }) {
  return <Card className="overflow-hidden"><div className="flex items-center gap-3 border-b border-ui-border bg-surface p-4 sm:p-5"><button type="button" onClick={onToggle} className="app-icon-button h-8 w-8 shrink-0" aria-label={`${open ? 'Collapse' : 'Expand'} ${week.title}`}>{open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</button><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary-soft text-caption font-bold text-primary">{String(index + 1).padStart(2, '0')}</span><button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left"><span className="flex flex-wrap items-center gap-2"><span className="text-title font-semibold text-foreground">{week.title}</span><StatusBadge status={week.status} /></span><span className="mt-1 block text-caption text-muted-foreground">{week.description || `${week.lessons.length} session${week.lessons.length === 1 ? '' : 's'}`}</span></button>{canManage && <div className="flex items-center gap-1"><Button size="sm" variant="outline" onClick={onAddLesson}><Plus size={14} />Session</Button><ActionMenu onEdit={onEdit} onPublish={onPublish} onDelete={onDelete} published={week.status === 'PUBLISHED'} /></div>}</div>{open && children}</Card>;
}

function LessonCard({ lesson, number, canManage, onEdit, onPublish, onDelete, onAddResource, onHomework, onResource, onDeleteResource, onAssignment, onDelivery, onActivity, onComplete }: { lesson: Lesson; number: number; canManage: boolean; onEdit: () => void; onPublish: () => void; onDelete: () => void; onAddResource: () => void; onHomework: () => void; onResource: (item: Resource) => void; onDeleteResource: (item: Resource) => void; onAssignment: (item: Assignment) => void; onDelivery: (item: Delivery) => void; onActivity: (item: Activity) => void; onComplete: () => void }) {
  const completed = lesson.studentProgress?.status === 'COMPLETED';
  return <article className="overflow-hidden rounded-card border border-ui-border bg-surface shadow-sm"><header className="flex items-start gap-3 border-b border-ui-border p-4"><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${completed ? 'bg-success text-white' : 'bg-surface-subtle text-muted-foreground'}`}>{completed ? <Check size={15} /> : number}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="text-title font-semibold text-foreground">{lesson.title}</h4>{canManage && <StatusBadge status={lesson.status} />}</div>{lesson.summary && <p className="mt-1 text-body leading-5 text-muted-foreground">{lesson.summary}</p>}<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-subtle">{lesson.scheduledAt && <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{format(new Date(lesson.scheduledAt), 'MMM d, h:mm a')}</span>}{lesson.durationMinutes && <span className="inline-flex items-center gap-1"><Clock3 size={13} />{lesson.durationMinutes} min</span>}{canManage && lesson.progressSummary && <span>{lesson.progressSummary.completed} completed · {lesson.progressSummary.started} in progress</span>}</div></div>{canManage ? <ActionMenu onEdit={onEdit} onPublish={onPublish} onDelete={onDelete} published={lesson.status === 'PUBLISHED'} /> : <Button size="sm" variant={completed ? 'outline' : 'primary'} onClick={onComplete}>{completed ? 'Completed' : 'Mark complete'}</Button>}</header>
    <div className="divide-y divide-ui-border">
      <LessonSection title="Materials" icon={<FileText size={15} />} action={canManage ? <button className="text-caption font-semibold text-primary hover:underline" onClick={onAddResource}>+ Add resource</button> : undefined}>{lesson.files.length === 0 ? <SectionEmpty text="No materials added" /> : lesson.files.map(resource => <ResourceRow key={resource.id} resource={resource} canManage={canManage} onOpen={() => onResource(resource)} onDelete={() => onDeleteResource(resource)} />)}</LessonSection>
      {(lesson.deliveries.length > 0 || lesson.activities.length > 0 || canManage) && <LessonSection title="Classwork & quizzes" icon={<CirclePlay size={15} />}>{lesson.deliveries.filter(delivery => delivery.status !== 'CLOSED').map(delivery => <ActivityRow key={delivery.id} title={delivery.title} meta={`${delivery.test.mode === 'EXAM' ? 'Timed test' : 'Practice quiz'} · ${delivery.test.duration} min`} dueAt={delivery.dueAt} onClick={() => onDelivery(delivery)} />)}{lesson.activities.map(activity => <ActivityRow key={activity.id} title={activity.title} meta={activity.type === 'VOCABULARY' ? 'Vocabulary practice' : 'Learning activity'} dueAt={activity.dueAt} onClick={() => onActivity(activity)} />)}{lesson.deliveries.length === 0 && lesson.activities.length === 0 && <SectionEmpty text="No classwork added" />}</LessonSection>}
      <LessonSection title="Session homework" icon={<ClipboardCheck size={15} />} accent action={canManage ? <button className="text-caption font-semibold text-primary hover:underline" onClick={onHomework}>{lesson.assignments.length ? 'Edit homework' : '+ Add homework'}</button> : undefined}>{lesson.assignments.length === 0 ? <SectionEmpty text={canManage ? 'Add the end-of-session assignment' : 'No homework for this session'} /> : lesson.assignments.map(assignment => <button key={assignment.id} type="button" onClick={() => onAssignment(assignment)} className="group flex w-full items-center gap-3 rounded-control border border-accent/50 bg-accent-soft/40 p-3 text-left hover:border-primary/40 hover:bg-primary-soft"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface text-warning"><ClipboardCheck size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-body font-semibold text-foreground group-hover:text-primary">{assignment.title}</span><span className="mt-0.5 block text-caption text-muted-foreground">{assignment.assignment?.submissions?.length ? 'Submitted' : assignment.dueDate ? `Due ${format(new Date(assignment.dueDate), 'MMM d, h:mm a')}` : 'No deadline'}{assignment.testIds?.length ? ` · ${assignment.testIds.length} linked quiz${assignment.testIds.length === 1 ? '' : 'zes'}` : ''}</span></span><ExternalLink size={15} className="text-subtle" /></button>)}</LessonSection>
    </div>
  </article>;
}

function LessonSection({ title, icon, action, accent, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; accent?: boolean; children: React.ReactNode }) { return <section className={accent ? 'bg-accent-soft/20 p-4' : 'p-4'}><div className="mb-3 flex items-center justify-between gap-3"><h5 className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">{icon}{title}</h5>{action}</div><div className="space-y-2">{children}</div></section>; }
function SectionEmpty({ text }: { text: string }) { return <p className="rounded-control border border-dashed border-ui-border px-3 py-2.5 text-caption text-muted-foreground">{text}</p>; }

function ResourceRow({ resource, canManage, onOpen, onDelete }: { resource: Resource; canManage: boolean; onOpen: () => void; onDelete: () => void }) {
  const Icon = resource.kind === 'VIDEO' ? Video : resource.kind === 'LINK' ? Link2 : FileText;
  return <div className="flex items-center gap-3 rounded-control border border-ui-border px-3 py-2.5 hover:bg-surface-subtle"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary"><Icon size={15} /></span><button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left"><span className="flex items-center gap-2"><span className="truncate text-body font-medium text-foreground hover:text-primary hover:underline">{resource.name}</span>{resource.isRequired && <Badge tone="gold">Required</Badge>}</span><span className="text-caption text-muted-foreground">{resource.provider === 'GOOGLE_DRIVE' ? 'Google Drive' : resource.kind.toLowerCase()}{resource.progress?.[0]?.completedAt ? ' · Viewed' : ''}</span></button><ExternalLink size={14} className="text-subtle" />{canManage && <button type="button" className="app-icon-button h-8 w-8 text-muted-foreground hover:text-danger" onClick={onDelete} aria-label={`Delete ${resource.name}`}><Trash2 size={14} /></button>}</div>;
}

function ActivityRow({ title, meta, dueAt, onClick }: { title: string; meta: string; dueAt?: string | null; onClick: () => void }) { return <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 rounded-control border border-ui-border px-3 py-2.5 text-left hover:border-primary/40 hover:bg-primary-soft"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary"><CirclePlay size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-body font-medium text-foreground group-hover:text-primary">{title}</span><span className="text-caption text-muted-foreground">{meta}{dueAt ? ` · Due ${format(new Date(dueAt), 'MMM d')}` : ''}</span></span><ChevronRight size={15} className="text-subtle" /></button>; }

function ActionMenu({ onEdit, onPublish, onDelete, published }: { onEdit: () => void; onPublish: () => void; onDelete: () => void; published: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="relative"><button type="button" className="app-icon-button h-8 w-8" onClick={() => setOpen(value => !value)} aria-label="More actions"><MoreHorizontal size={17} /></button>{open && <div className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-control border border-ui-border bg-surface p-1 shadow-overlay"><MenuButton icon={<Pencil size={14} />} text="Edit details" onClick={() => { setOpen(false); onEdit(); }} /><MenuButton icon={<Rocket size={14} />} text={published ? 'Move to draft' : 'Publish'} onClick={() => { setOpen(false); onPublish(); }} /><MenuButton danger icon={<Trash2 size={14} />} text="Delete" onClick={() => { setOpen(false); onDelete(); }} /></div>}</div>;
}
function MenuButton({ icon, text, onClick, danger }: { icon: React.ReactNode; text: string; onClick: () => void; danger?: boolean }) { return <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-caption font-medium hover:bg-surface-subtle ${danger ? 'text-danger' : 'text-foreground'}`}>{icon}{text}</button>; }
function StatusBadge({ status }: { status?: ContentStatus }) { const safeStatus = status || 'PUBLISHED'; const tone = safeStatus === 'PUBLISHED' ? 'success' : safeStatus === 'SCHEDULED' ? 'gold' : safeStatus === 'ARCHIVED' ? 'neutral' : 'warning'; return <Badge tone={tone}>{safeStatus[0] + safeStatus.slice(1).toLowerCase()}</Badge>; }

function CurriculumEditor({ editor, form, setForm, saving, onClose, onSave }: { editor: { kind: 'week' | 'lesson'; item?: Week | Lesson } | null; form: CourseForm; setForm: React.Dispatch<React.SetStateAction<CourseForm>>; saving: boolean; onClose: () => void; onSave: () => void }) {
  const lesson = editor?.kind === 'lesson';
  return <Modal open={Boolean(editor)} closeOnBackdrop onClose={onClose} title={`${editor?.item ? 'Edit' : 'Add'} ${lesson ? 'session' : 'week'}`} subtitle={lesson ? 'Set the session overview, timing and visibility.' : 'Create a clear module in the course roadmap.'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving || !form.title.trim()} onClick={onSave}>{saving ? 'Saving…' : 'Save'}</Button></>}><div className="space-y-4"><Field label="Title"><Input autoFocus className="w-full" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder={lesson ? 'Session 1: Reading foundations' : 'Week 1: Foundations'} /></Field><Field label={lesson ? 'Session overview' : 'Week description'}><textarea className="min-h-24 w-full rounded-control border border-ui-border bg-surface p-3 text-body outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={lesson ? form.summary : form.description} onChange={event => setForm(current => ({ ...current, [lesson ? 'summary' : 'description']: event.target.value }))} placeholder="What will students learn?" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Visibility"><Select className="w-full" value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as ContentStatus }))}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option>{lesson && <option value="SCHEDULED">Scheduled</option>}<option value="ARCHIVED">Archived</option></Select></Field>{lesson && <Field label="Duration (minutes)"><Input type="number" min="1" className="w-full" value={form.durationMinutes} onChange={event => setForm(current => ({ ...current, durationMinutes: event.target.value }))} /></Field>}</div>{lesson && <Field label="Session date & time"><Input type="datetime-local" className="w-full" value={form.scheduledAt} onChange={event => setForm(current => ({ ...current, scheduledAt: event.target.value }))} /></Field>}<p className="rounded-control bg-primary-soft px-3 py-2 text-caption leading-5 text-primary">Publishing makes this item visible to enrolled students and sends a notification.</p></div></Modal>;
}

function ResourceEditor({ open, form, setForm, saving, onClose, onSave }: { open: boolean; form: { name: string; url: string; kind: ResourceKind; isRequired: boolean }; setForm: React.Dispatch<React.SetStateAction<{ name: string; url: string; kind: ResourceKind; isRequired: boolean }>>; saving: boolean; onClose: () => void; onSave: () => void }) { return <Modal open={open} closeOnBackdrop onClose={onClose} title="Add learning resource" subtitle="Attach a document, video, website or embeddable activity. Google Drive files must already be shared with the class." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving || !form.name.trim() || !form.url.trim()} onClick={onSave}>{saving ? 'Adding…' : 'Add resource'}</Button></>}><div className="space-y-4"><Field label="Resource type"><Select className="w-full" value={form.kind} onChange={event => setForm(current => ({ ...current, kind: event.target.value as ResourceKind }))}><option value="FILE">Document / file</option><option value="VIDEO">Video</option><option value="LINK">Website link</option><option value="EMBED">Embedded activity</option></Select></Field><Field label="Display name"><Input autoFocus className="w-full" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="SAT Reading strategy guide" /></Field><Field label="Secure URL"><Input type="url" className="w-full" value={form.url} onChange={event => setForm(current => ({ ...current, url: event.target.value }))} placeholder="https://…" /></Field><label className="flex items-center gap-2 text-body text-foreground"><input type="checkbox" checked={form.isRequired} onChange={event => setForm(current => ({ ...current, isRequired: event.target.checked }))} className="h-4 w-4 accent-primary" />Required material</label><p className="rounded-control border border-ui-border bg-surface-subtle p-3 text-caption leading-5 text-muted-foreground">For privacy, the app no longer changes Drive permissions automatically. Share the file only with the class or organization before adding its URL.</p></div></Modal>; }

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-caption font-semibold text-foreground">{label}</span>{children}</label>; }
function CourseSkeleton() { return <div className="space-y-4" aria-label="Loading course"><div className="h-44 animate-pulse rounded-card bg-muted" />{[1, 2].map(item => <div key={item} className="h-32 animate-pulse rounded-card bg-surface-subtle" />)}</div>; }
function toLocalDateTime(value: string) { const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }

function normalizeWeeks(value: unknown): Week[] {
  if (!Array.isArray(value)) return [];
  return value.map(rawWeek => {
    const week = rawWeek as Partial<Week>;
    const lessons = Array.isArray(week.lessons) ? week.lessons.map(rawLesson => {
      const lesson = rawLesson as Partial<Lesson>;
      const files = Array.isArray(lesson.files) ? lesson.files.map(rawResource => {
        const resource = rawResource as Partial<Resource>;
        return {
          ...resource,
          id: String(resource.id || ''),
          name: String(resource.name || 'Untitled resource'),
          url: String(resource.url || ''),
          kind: resource.kind || 'FILE',
          isRequired: Boolean(resource.isRequired),
          progress: Array.isArray(resource.progress) ? resource.progress : [],
        } as Resource;
      }) : [];
      return {
        ...lesson,
        id: String(lesson.id || ''),
        title: String(lesson.title || 'Untitled session'),
        status: lesson.status || 'PUBLISHED',
        files,
        assignments: Array.isArray(lesson.assignments) ? lesson.assignments : [],
        deliveries: Array.isArray(lesson.deliveries) ? lesson.deliveries : [],
        activities: Array.isArray(lesson.activities) ? lesson.activities : [],
      } as Lesson;
    }) : [];
    return {
      ...week,
      id: String(week.id || ''),
      title: String(week.title || 'Untitled week'),
      status: week.status || 'PUBLISHED',
      lessons,
    } as Week;
  });
}

export default WeeklyProgress;
