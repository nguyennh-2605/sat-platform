import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Bell, CalendarDays, GitBranch, GraduationCap, MoreVertical, Palette, Pencil, Plus, Trash2, UserRound, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import axiosClient from '../../lib/axios';
import { AppHeader, Button, Card, Input, Modal } from '../../components/ui/AppUI';
import { ui } from '../../components/ui/styles';
import { capitalizeFirstLetter } from '../../utils/text';
import { ClassroomTodoPanel } from '../../features/classroom/ClassroomTodoPanel';
import { SatCountdown } from '../../features/sat-countdown/SatCountdown';
import { cachedGet, invalidateQueryCache } from '../../lib/queryCache';

const CLASS_COLORS = ['#1B7A5A', '#0F4D38', '#2563EB', '#A16207', '#B45309', '#8B3A62', '#475569'] as const;

interface ClassSummary {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  teacher: { id: number; name: string; email: string };
  studentCount: number;
  canManage: boolean;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const response = (error as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error || fallback;
};

export default function ClassroomList() {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole') || 'STUDENT';
  const canCreate = userRole === 'TEACHER' || userRole === 'ADMIN';
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; classroom?: ClassSummary } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassSummary | null>(null);

  const fetchClasses = useCallback(async (force = false) => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await cachedGet<ClassSummary[]>('/api/classes', { ttlMs: 60_000, force });
      setClasses(result.map(classroom => ({ ...classroom, name: capitalizeFirstLetter(classroom.name) })));
    } catch (error) {
      console.error(error);
      setLoadError(getErrorMessage(error, 'Unable to load your classes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchClasses(); }, [fetchClasses]);

  useEffect(() => {
    if (!activeMenuId) return;
    const closeMenu = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-class-menu]')) setActiveMenuId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setActiveMenuId(null); };
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeMenuId]);

  return (
    <div className={ui.page}>
      <AppHeader
        title="Classroom"
        subtitle={canCreate ? 'Manage your classes and learning spaces' : 'Classes you are enrolled in'}
        centerContent={<SatCountdown />}
        rightContent={canCreate ? <Button size="sm" onClick={() => setEditor({ mode: 'create' })}><Plus size={15} aria-hidden="true" /><span className="hidden sm:inline">Create class</span></Button> : undefined}
      />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={ui.content}>
          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0" aria-label="Classes">
          {loading ? <ClassGridSkeleton /> : loadError ? (
            <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <p className="text-body font-medium text-foreground">Classes could not be loaded</p>
              <p className="mt-1 text-caption text-muted-foreground">{loadError}</p>
              <Button className="mt-4" variant="outline" onClick={() => void fetchClasses()}>Try again</Button>
            </Card>
          ) : classes.length === 0 ? (
            <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-card bg-primary-soft text-primary-hover"><GraduationCap size={24} aria-hidden="true" /></span>
              <h2 className="mt-4 text-title font-semibold text-foreground">No classes yet</h2>
              <p className="mt-1 max-w-sm text-body leading-6 text-muted-foreground">{canCreate ? 'Create your first class to organize students, assignments, and progress.' : 'Classes will appear here after a teacher adds you.'}</p>
              {canCreate && <Button className="mt-5" onClick={() => setEditor({ mode: 'create' })}><Plus size={16} />Create class</Button>}
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-3">
              {classes.map(classroom => (
                <article
                  key={classroom.id}
                  className="group relative flex min-h-[218px] transform-gpu flex-col overflow-visible rounded-card border border-ui-border bg-surface shadow-card transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-elevated"
                >
                  <div className="relative h-20 rounded-t-[11px] border-b border-black/10 px-5 py-3.5 text-white" style={{ backgroundColor: classroom.color || CLASS_COLORS[0] }}>
                    <div className="pr-10">
                      <h2 className="line-clamp-2 text-heading font-semibold leading-6"><button type="button" onClick={() => navigate(`/dashboard/class/${classroom.id}?tab=notifications`)} className="rounded text-left underline-offset-4 hover:underline">{classroom.name}</button></h2>
                      <p className="mt-1 truncate text-xs text-white/85">{classroom.teacher?.name || 'Teacher'}</p>
                    </div>
                    {classroom.canManage && (
                      <div className="absolute right-3 top-3" data-class-menu>
                        <button
                          type="button"
                          aria-label={`Actions for ${classroom.name}`}
                          aria-expanded={activeMenuId === classroom.id}
                          onClick={event => { event.stopPropagation(); setActiveMenuId(current => current === classroom.id ? null : classroom.id); }}
                          className="flex h-10 w-10 items-center justify-center rounded-control text-white transition-colors hover:bg-black/20 focus:bg-black/20"
                        >
                          <MoreVertical size={19} />
                        </button>
                        {activeMenuId === classroom.id && (
                          <div role="menu" className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-control border border-ui-border bg-surface py-1 text-foreground shadow-elevated">
                            <button type="button" role="menuitem" onClick={event => { event.stopPropagation(); setActiveMenuId(null); setEditor({ mode: 'edit', classroom }); }} className="flex min-h-10 w-full items-center gap-2.5 px-3 py-2 text-left text-body hover:bg-primary-soft"><Pencil size={15} className="text-primary" aria-hidden="true" />Edit class</button>
                            <button type="button" role="menuitem" onClick={event => { event.stopPropagation(); setActiveMenuId(null); setDeleteTarget(classroom); }} className="flex min-h-10 w-full items-center gap-2.5 px-3 py-2 text-left text-body text-danger hover:bg-danger-soft"><Trash2 size={15} aria-hidden="true" />Delete class</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2.5 px-5 pb-2.5 pt-4">
                    <div className="flex items-center gap-2.5 text-body text-subtle-foreground"><Users size={16} className="text-primary" aria-hidden="true" /><span>{classroom.studentCount} {classroom.studentCount === 1 ? 'student' : 'students'}</span></div>
                    <div className="flex items-center gap-2.5 text-body text-subtle-foreground"><UserRound size={16} className="text-primary" aria-hidden="true" /><span className="truncate">{classroom.teacher?.email || 'No teacher email'}</span></div>
                    <div className="flex items-center gap-2.5 text-caption text-muted-foreground"><CalendarDays size={15} aria-hidden="true" /><span>Created {format(new Date(classroom.createdAt), 'MMM d, yyyy')}</span></div>
                  </div>
                  <ClassCardTabs classroomId={classroom.id} showPerformance={canCreate} />
                </article>
              ))}
            </div>
          )}
          </section>
          <ClassroomTodoPanel />
          </div>
        </div>
      </main>

      <ClassEditorModal state={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); invalidateQueryCache('/api/classes', '/api/tests/classes'); await fetchClasses(true); }} />
      <DeleteClassModal target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={classId => {
        setClasses(current => current.filter(item => item.id !== classId));
        invalidateQueryCache('/api/classes', '/api/tests/classes', '/api/tests?');
        setDeleteTarget(null);
      }} />
    </div>
  );
}

function ClassCardTabs({ classroomId, showPerformance }: { classroomId: string; showPerformance: boolean }) {
  const navigate = useNavigate();
  const tabs = [
    { id: 'notifications', label: 'Notification', icon: Bell },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'progress', label: 'Progress', icon: GitBranch },
    ...(showPerformance ? [{ id: 'performance', label: 'Performance', icon: BarChart3 }] : []),
  ];

  return <div className={`grid rounded-b-card border-t border-ui-border bg-background ${showPerformance ? 'grid-cols-4' : 'grid-cols-3'}`}>
    {tabs.map(({ id, label, icon: Icon }) => <button
      key={id}
      type="button"
      aria-label={label}
      onClick={event => {
        event.stopPropagation();
        navigate(`/dashboard/class/${classroomId}?tab=${id}`);
      }}
      className="group/tab relative flex h-10 min-w-0 items-center justify-center border-r border-ui-border text-muted-foreground transition-colors first:rounded-bl-card last:rounded-br-card last:border-r-0 hover:bg-primary-soft hover:text-primary focus-visible:z-10 focus-visible:bg-primary-soft focus-visible:text-primary"
    >
      <Icon size={17} />
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-control bg-sidebar px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/tab:opacity-100 group-focus-visible/tab:opacity-100">
        {label}
      </span>
    </button>)}
  </div>;
}

function ClassEditorModal({ state, onClose, onSaved }: { state: { mode: 'create' | 'edit'; classroom?: ClassSummary } | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(CLASS_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(state?.classroom?.name || '');
    setColor(state?.classroom?.color || CLASS_COLORS[0]);
  }, [state]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!state || !name.trim()) return;
    setSaving(true);
    try {
      if (state.mode === 'create') await axiosClient.post('/api/classes', { name: name.trim(), color });
      else await axiosClient.patch(`/api/classes/${state.classroom?.id}`, { name: name.trim(), color });
      toast.success(state.mode === 'create' ? 'Class created' : 'Class updated');
      await onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error, state.mode === 'create' ? 'Unable to create class.' : 'Unable to update class.'));
    } finally {
      setSaving(false);
    }
  };

  return <Modal open={Boolean(state)} onClose={onClose} closeOnBackdrop title={state?.mode === 'edit' ? 'Edit class' : 'Create class'} subtitle={state?.mode === 'edit' ? 'Update the class name and card color.' : 'Create a new learning space.'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving || !name.trim()} onClick={save}>{saving ? 'Saving…' : state?.mode === 'edit' ? 'Save changes' : 'Create class'}</Button></>}>
    <form onSubmit={save} className="space-y-5">
      <label className="block"><span className="mb-2 block text-body font-medium text-foreground">Class name</span><Input autoFocus className="w-full" maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. SAT Math 12A1" /></label>
      <fieldset><legend className="mb-2 flex items-center gap-2 text-body font-medium text-foreground"><Palette size={16} className="text-primary" aria-hidden="true" />Class color</legend><div className="flex flex-wrap gap-2.5">{CLASS_COLORS.map(item => <button key={item} type="button" aria-label={`Use color ${item}`} aria-pressed={color === item} onClick={() => setColor(item)} className={`h-10 w-10 rounded-control border-2 transition-transform hover:scale-105 ${color === item ? 'border-foreground ring-2 ring-foreground/15' : 'border-white ring-1 ring-ui-border'}`} style={{ backgroundColor: item }} />)}</div></fieldset>
    </form>
  </Modal>;
}

function DeleteClassModal({ target, onClose, onDeleted }: { target: ClassSummary | null; onClose: () => void; onDeleted: (classId: string) => void }) {
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { setConfirmation(''); }, [target]);

  const remove = async () => {
    if (!target || confirmation.trim() !== target.name) return;
    setDeleting(true);
    try {
      await axiosClient.delete(`/api/classes/${target.id}`);
      toast.success('Class deleted');
      onDeleted(target.id);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete class.'));
    } finally {
      setDeleting(false);
    }
  };

  return <Modal open={Boolean(target)} onClose={onClose} closeOnBackdrop title="Delete class" subtitle="This action permanently removes the class and its classroom data." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="destructive" disabled={deleting || confirmation.trim() !== target?.name} onClick={() => void remove()}>{deleting ? 'Deleting…' : 'Delete class'}</Button></>}>
    <div className="rounded-control border border-danger/20 bg-danger-soft p-4 text-body leading-6 text-danger">Assignments, student submissions, assigned tests, weeks, and lessons in <strong className="font-semibold">{target?.name}</strong> will be deleted. Original tests in Practice Center will remain.</div>
    <label className="mt-5 block"><span className="mb-2 block text-body font-medium text-foreground">Type <strong>{target?.name}</strong> to confirm</span><Input autoFocus className="w-full" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
  </Modal>;
}

function ClassGridSkeleton() {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-3" aria-label="Loading classes">{Array.from({ length: 6 }, (_, index) => <Card key={index} className="h-[218px] animate-pulse overflow-hidden p-0"><div className="h-20 bg-muted" /><div className="space-y-2.5 px-5 pb-2.5 pt-4"><div className="h-4 w-2/3 rounded bg-muted" /><div className="h-4 w-1/2 rounded bg-muted" /><div className="h-3 w-1/3 rounded bg-muted" /></div><div className="mt-auto h-10 border-t border-ui-border bg-surface-subtle" /></Card>)}</div>;
}
