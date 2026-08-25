import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, GraduationCap, MoreHorizontal, Palette, Pencil, Plus, Trash2, UserRound, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Modal } from '../../components/ui/AppUI';
import { PageHeader } from '../../components/ui/AppUI';
import { ClassroomTodoPanel } from '../../features/classroom/ClassroomTodoPanel';
import { SatCountdown } from '../../features/sat-countdown/SatCountdown';
import axiosClient from '../../lib/axios';
import { cachedGet, invalidateQueryCache } from '../../lib/queryCache';
import { capitalizeFirstLetter } from '../../utils/text';

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

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
        <PageHeader
          title={<span className="flex items-center gap-2">Classroom{!loading && <Badge variant="secondary">{classes.length}</Badge>}</span>}
          description={canCreate ? 'Manage classes, students, assignments, and learning progress.' : 'Open a class to view assignments and learning activity.'}
          actions={<><SatCountdown />{canCreate && <Button onClick={() => setEditor({ mode: 'create' })}><Plus aria-hidden="true" />Create class</Button>}</>}
        />

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0" aria-label="Classes">
            {loading ? <ClassGridSkeleton /> : loadError ? (
              <EmptyState title="Classes could not be loaded" description={loadError} action={<Button variant="outline" onClick={() => void fetchClasses()}>Try again</Button>} />
            ) : classes.length === 0 ? (
              <EmptyState
                title="No classes yet"
                description={canCreate ? 'Create your first class to organize students, assignments, and progress.' : 'Classes will appear here after a teacher adds you.'}
                action={canCreate ? <Button onClick={() => setEditor({ mode: 'create' })}><Plus aria-hidden="true" />Create class</Button> : undefined}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {classes.map(classroom => (
                  <ClassCard key={classroom.id} classroom={classroom} onOpen={() => navigate(`/dashboard/class/${classroom.id}?tab=notifications`)} onEdit={() => setEditor({ mode: 'edit', classroom })} onDelete={() => setDeleteTarget(classroom)} />
                ))}
              </div>
            )}
          </section>
          <ClassroomTodoPanel />
        </div>
      </div>

      <ClassEditorModal state={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); invalidateQueryCache('/api/classes', '/api/tests/classes'); await fetchClasses(true); }} />
      <DeleteClassModal target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={classId => {
        setClasses(current => current.filter(item => item.id !== classId));
        invalidateQueryCache('/api/classes', '/api/tests/classes', '/api/tests?');
        setDeleteTarget(null);
      }} />
    </main>
  );
}

function ClassCard({ classroom, onOpen, onEdit, onDelete }: { classroom: ClassSummary; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <div className="h-1.5 w-full" style={{ backgroundColor: classroom.color || CLASS_COLORS[0] }} />
      <CardHeader className="flex-row items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="min-w-0 space-y-1">
          <button type="button" onClick={onOpen} className="line-clamp-2 text-left text-base font-semibold tracking-tight hover:underline">{classroom.name}</button>
          <p className="truncate text-sm text-muted-foreground">{classroom.teacher?.name || 'Teacher'}</p>
        </div>
        {classroom.canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="-mr-2 -mt-2 shrink-0" aria-label={`Actions for ${classroom.name}`}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden="true" />Edit class</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 aria-hidden="true" />Delete class</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" aria-hidden="true" /><span>{classroom.studentCount} {classroom.studentCount === 1 ? 'student' : 'students'}</span></div>
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"><UserRound className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{classroom.teacher?.email || 'No teacher email'}</span></div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-4" aria-hidden="true" /><span>Created {format(new Date(classroom.createdAt), 'MMM d, yyyy')}</span></div>
      </CardContent>
      <CardFooter className="border-t bg-muted/30 px-5 py-3"><Button variant="outline" size="sm" className="w-full bg-background" onClick={onOpen}>Open classroom</Button></CardFooter>
    </Card>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <Card className="flex min-h-80 items-center justify-center"><CardContent className="flex max-w-md flex-col items-center px-6 text-center">
    <span className="mb-4 flex size-12 items-center justify-center rounded-xl border bg-muted text-muted-foreground"><GraduationCap className="size-6" aria-hidden="true" /></span>
    <h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}
  </CardContent></Card>;
}

function ClassEditorModal({ state, onClose, onSaved }: { state: { mode: 'create' | 'edit'; classroom?: ClassSummary } | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(CLASS_COLORS[0]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setName(state?.classroom?.name || ''); setColor(state?.classroom?.color || CLASS_COLORS[0]); }, [state]);

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
    } finally { setSaving(false); }
  };

  return <Modal open={Boolean(state)} onClose={onClose} closeOnBackdrop title={state?.mode === 'edit' ? 'Edit class' : 'Create class'} subtitle={state?.mode === 'edit' ? 'Update the class name and visual marker.' : 'Create a new learning space.'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving || !name.trim()} onClick={save}>{saving ? 'Saving…' : state?.mode === 'edit' ? 'Save changes' : 'Create class'}</Button></>}>
    <form onSubmit={save} className="space-y-5">
      <label className="block text-sm font-medium">Class name<Input autoFocus className="mt-2" maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. SAT Math 12A1" /></label>
      <fieldset><legend className="mb-3 flex items-center gap-2 text-sm font-medium"><Palette className="size-4 text-muted-foreground" aria-hidden="true" />Class marker</legend><div className="flex flex-wrap gap-2.5">{CLASS_COLORS.map(item => <button key={item} type="button" aria-label={`Use color ${item}`} aria-pressed={color === item} onClick={() => setColor(item)} className={`size-9 rounded-full border-2 border-background ring-2 transition-transform hover:scale-105 ${color === item ? 'ring-foreground' : 'ring-border'}`} style={{ backgroundColor: item }} />)}</div></fieldset>
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
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to delete class.')); } finally { setDeleting(false); }
  };
  return <Modal open={Boolean(target)} onClose={onClose} closeOnBackdrop title="Delete class" subtitle="This action permanently removes the class and its classroom data." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="destructive" disabled={deleting || confirmation.trim() !== target?.name} onClick={() => void remove()}>{deleting ? 'Deleting…' : 'Delete class'}</Button></>}>
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm leading-6 text-destructive">Assignments, student submissions, assigned tests, weeks, and lessons in <strong>{target?.name}</strong> will be deleted. Original tests in Practice Center will remain.</div>
    <label className="mt-5 block text-sm font-medium">Type <strong>{target?.name}</strong> to confirm<Input autoFocus className="mt-2" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
  </Modal>;
}

function ClassGridSkeleton() {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-label="Loading classes">{Array.from({ length: 6 }, (_, index) => <Card key={index} className="gap-4 p-5"><div className="flex justify-between gap-4"><div className="flex-1 space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/2" /></div><Skeleton className="size-8" /></div><div className="space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-2/3" /></div><Skeleton className="h-8 w-full" /></Card>)}</div>;
}
