import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, GraduationCap, MoreVertical, Palette, Pencil, Plus, Trash2, UserRound, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import axiosClient from '../../lib/axios';
import { AppHeader, Button, Card, Input, Modal } from '../../components/ui/AppUI';
import { ui } from '../../components/ui/styles';
import { capitalizeFirstLetter } from '../../utils/text';
import { ClassroomTodoPanel } from '../../features/classroom/ClassroomTodoPanel';
import { SatCountdown } from '../../features/sat-countdown/SatCountdown';

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

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await axiosClient.get<ClassSummary[], ClassSummary[]>('/api/classes');
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
        rightContent={canCreate ? <Button size="sm" onClick={() => setEditor({ mode: 'create' })}><Plus size={15} />Create class</Button> : <SatCountdown />}
      />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={ui.content}>
          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0" aria-label="Classes">
          {loading ? <ClassGridSkeleton /> : loadError ? (
            <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-medium text-[#1A1A1A]">Classes could not be loaded</p>
              <p className="mt-1 text-xs text-[#6B7280]">{loadError}</p>
              <Button className="mt-4" variant="outline" onClick={() => void fetchClasses()}>Try again</Button>
            </Card>
          ) : classes.length === 0 ? (
            <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8F5EF] text-[#145F47]"><GraduationCap size={24} /></span>
              <h2 className="mt-4 text-base font-semibold text-[#1A1A1A]">No classes yet</h2>
              <p className="mt-1 max-w-sm text-sm leading-6 text-[#6B7280]">{canCreate ? 'Create your first class to organize students, assignments, and progress.' : 'Classes will appear here after a teacher adds you.'}</p>
              {canCreate && <Button className="mt-5" onClick={() => setEditor({ mode: 'create' })}><Plus size={16} />Create class</Button>}
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-3">
              {classes.map(classroom => (
                <article
                  key={classroom.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/dashboard/class/${classroom.id}`)}
                  onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); navigate(`/dashboard/class/${classroom.id}`); } }}
                  className="group relative min-h-[238px] cursor-pointer overflow-hidden rounded-xl border border-[#C9D8D2] bg-white shadow-[0_3px_10px_rgba(15,77,56,0.10)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-[#8FB9A9] hover:shadow-[0_6px_16px_rgba(15,77,56,0.14)] focus:outline-none focus:ring-2 focus:ring-[#1B7A5A]/30"
                >
                  <div className="relative h-24 border-b border-black/10 px-5 py-4 text-white" style={{ backgroundColor: classroom.color || CLASS_COLORS[0] }}>
                    <div className="pr-10">
                      <h2 className="line-clamp-2 text-lg font-semibold leading-6">{classroom.name}</h2>
                      <p className="mt-1 truncate text-xs text-white/85">{classroom.teacher?.name || 'Teacher'}</p>
                    </div>
                    {classroom.canManage && (
                      <div className="absolute right-3 top-3" data-class-menu>
                        <button
                          type="button"
                          aria-label={`Actions for ${classroom.name}`}
                          aria-expanded={activeMenuId === classroom.id}
                          onClick={event => { event.stopPropagation(); setActiveMenuId(current => current === classroom.id ? null : classroom.id); }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-black/20 focus:bg-black/20"
                        >
                          <MoreVertical size={19} />
                        </button>
                        {activeMenuId === classroom.id && (
                          <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-lg border border-[#C9D8D2] bg-white py-1 text-[#1A1A1A] shadow-lg">
                            <button type="button" onClick={event => { event.stopPropagation(); setActiveMenuId(null); setEditor({ mode: 'edit', classroom }); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-[#E8F5EF]"><Pencil size={15} className="text-[#1B7A5A]" />Edit class</button>
                            <button type="button" onClick={event => { event.stopPropagation(); setActiveMenuId(null); setDeleteTarget(classroom); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"><Trash2 size={15} />Delete class</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="flex items-center gap-2.5 text-sm text-[#374151]"><Users size={16} className="text-[#1B7A5A]" /><span>{classroom.studentCount} {classroom.studentCount === 1 ? 'student' : 'students'}</span></div>
                    <div className="flex items-center gap-2.5 text-sm text-[#374151]"><UserRound size={16} className="text-[#1B7A5A]" /><span className="truncate">{classroom.teacher?.email || 'No teacher email'}</span></div>
                    <div className="flex items-center gap-2.5 text-xs text-[#6B7280]"><CalendarDays size={15} /><span>Created {format(new Date(classroom.createdAt), 'MMM d, yyyy')}</span></div>
                  </div>
                </article>
              ))}
            </div>
          )}
          </section>
          <ClassroomTodoPanel />
          </div>
        </div>
      </main>

      <ClassEditorModal state={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await fetchClasses(); }} />
      <DeleteClassModal target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={classId => { setClasses(current => current.filter(item => item.id !== classId)); setDeleteTarget(null); }} />
    </div>
  );
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
      <label className="block"><span className="mb-2 block text-sm font-medium text-[#1A1A1A]">Class name</span><Input autoFocus className="w-full" maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. SAT Math 12A1" /></label>
      <fieldset><legend className="mb-2 flex items-center gap-2 text-sm font-medium text-[#1A1A1A]"><Palette size={16} className="text-[#1B7A5A]" />Class color</legend><div className="flex flex-wrap gap-2.5">{CLASS_COLORS.map(item => <button key={item} type="button" aria-label={`Use color ${item}`} aria-pressed={color === item} onClick={() => setColor(item)} className={`h-9 w-9 rounded-lg border-2 transition-transform hover:scale-105 ${color === item ? 'border-[#1A1A1A] ring-2 ring-[#1A1A1A]/15' : 'border-white ring-1 ring-[#C9D8D2]'}`} style={{ backgroundColor: item }} />)}</div></fieldset>
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
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">Assignments, student submissions, assigned tests, weeks, and lessons in <strong className="font-semibold">{target?.name}</strong> will be deleted. Original tests in Practice Center will remain.</div>
    <label className="mt-5 block"><span className="mb-2 block text-sm font-medium text-[#1A1A1A]">Type <strong>{target?.name}</strong> to confirm</span><Input autoFocus className="w-full" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
  </Modal>;
}

function ClassGridSkeleton() {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-3" aria-label="Loading classes">{Array.from({ length: 6 }, (_, index) => <Card key={index} className="h-[238px] animate-pulse overflow-hidden p-0"><div className="h-24 bg-[#D8E7E1]" /><div className="space-y-3 p-5"><div className="h-4 w-2/3 rounded bg-[#E7EFEC]" /><div className="h-4 w-1/2 rounded bg-[#E7EFEC]" /><div className="h-3 w-1/3 rounded bg-[#E7EFEC]" /></div></Card>)}</div>;
}
