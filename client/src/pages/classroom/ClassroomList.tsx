import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, Copy, GraduationCap, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, Modal, PageHeader } from '../../components/ui/AppUI';
import axiosClient from '../../lib/axios';
import { cachedGet, invalidateQueryCache } from '../../lib/queryCache';
import { capitalizeFirstLetter } from '../../utils/text';

type ClassSort = 'NEWEST' | 'NAME' | 'STUDENTS';

interface ClassSummary {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  teacher: { id: number; name: string; email: string };
  studentCount: number;
  canManage: boolean;
  dueInNext7DaysCount: number;
  nextActivity: { id: string; type: 'TEST' | 'VOCABULARY' | 'HOMEWORK' | 'RESOURCE'; title: string; dueAt: string } | null;
  lastContentUpdateAt: string | null;
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
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ClassSort>('NEWEST');
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

  const visibleClasses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = query ? classes.filter(classroom => classroom.name.toLocaleLowerCase().includes(query)) : [...classes];
    return filtered.sort((first, second) => {
      if (sort === 'NAME') return first.name.localeCompare(second.name);
      if (sort === 'STUDENTS') return second.studentCount - first.studentCount || first.name.localeCompare(second.name);
      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });
  }, [classes, search, sort]);

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
        <PageHeader
          title={<span className="flex items-center gap-2">Classrooms{!loading && !loadError && <Badge variant="secondary">{classes.length}</Badge>}</span>}
          description={canCreate ? 'Manage classes, students, assignments, and learning progress.' : 'Open a class to view assignments and learning activity.'}
          actions={canCreate ? <Button size="sm" onClick={() => setEditor({ mode: 'create' })}><Plus aria-hidden="true" />Create class</Button> : undefined}
        />

        <section className="min-w-0 space-y-4" aria-label="Classes">
          {!loading && !loadError && classes.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative block w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search classrooms…" aria-label="Search classrooms" className="w-full pl-9" />
              </label>
              <Select value={sort} onValueChange={value => setSort(value as ClassSort)}>
                <SelectTrigger className="w-full sm:w-36" aria-label="Sort classrooms"><SelectValue /></SelectTrigger>
                <SelectContent align="end"><SelectItem value="NEWEST">Newest</SelectItem><SelectItem value="NAME">Name</SelectItem><SelectItem value="STUDENTS">Student count</SelectItem></SelectContent>
              </Select>
            </div>
          )}
            {loading ? <ClassGridSkeleton /> : loadError ? (
              <EmptyState icon={<GraduationCap className="size-5" />} title="Classes could not be loaded" description={loadError} action={<Button variant="outline" onClick={() => void fetchClasses()}>Try again</Button>} />
            ) : classes.length === 0 ? (
              <EmptyState
                icon={<GraduationCap className="size-5" />}
                title="No classes yet"
                description={canCreate ? 'Create your first class to organize students, assignments, and progress.' : 'Classes will appear here after a teacher adds you.'}
                action={canCreate ? <Button onClick={() => setEditor({ mode: 'create' })}><Plus aria-hidden="true" />Create class</Button> : undefined}
              />
            ) : visibleClasses.length === 0 ? <EmptyState icon={<Search className="size-5" />} title="No matching classrooms" description="Try another class name or clear the search." action={<Button variant="outline" size="sm" onClick={() => setSearch('')}>Clear search</Button>} /> : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleClasses.map(classroom => (
                  <ClassCard key={classroom.id} classroom={classroom} showTeacher={!canCreate} onOpen={() => navigate(`/dashboard/class/${classroom.id}?tab=lessons`)} onEdit={() => setEditor({ mode: 'edit', classroom })} onDelete={() => setDeleteTarget(classroom)} />
                ))}
              </div>
            )}
        </section>
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

function ClassCard({ classroom, showTeacher, onOpen, onEdit, onDelete }: { classroom: ClassSummary; showTeacher: boolean; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const activityType = classroom.nextActivity?.type === 'TEST'
    ? 'Test'
    : classroom.nextActivity?.type === 'VOCABULARY'
      ? 'Vocabulary'
      : classroom.nextActivity?.type === 'HOMEWORK'
        ? 'Assignment'
        : 'Resource';

  const copyClassCode = async () => {
    try {
      await navigator.clipboard.writeText(classroom.id);
      toast.success('Class code copied');
    } catch {
      toast.error('Unable to copy the class code.');
    }
  };

  return (
    <Card size="sm" interactive>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>
            <button type="button" onClick={onOpen} className="line-clamp-2 text-left font-semibold outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring">
              {classroom.name}
            </button>
          </CardTitle>
          <CardDescription className="mt-0.5 truncate">
            {showTeacher ? `Teacher: ${classroom.teacher?.name || 'Unassigned'}` : `${classroom.studentCount} ${classroom.studentCount === 1 ? 'student' : 'students'}`}
          </CardDescription>
        </div>
        {classroom.canManage && (
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1" aria-label={`Actions for ${classroom.name}`}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void copyClassCode()}><Copy aria-hidden="true" />Copy class code</DropdownMenuItem>
                <DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden="true" />Edit class</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 aria-hidden="true" />Delete class</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {showTeacher && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" aria-hidden="true" /><span>{classroom.studentCount} {classroom.studentCount === 1 ? 'student' : 'students'}</span></div>}
        {classroom.nextActivity ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">Next activity</span>
              <Badge variant="outline">{activityType}</Badge>
            </div>
            <p className="truncate text-sm font-semibold">{classroom.nextActivity.title}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="size-3.5" aria-hidden="true" />Due {format(new Date(classroom.nextActivity.dueAt), 'MMM d, h:mm a')}</p>
            {classroom.dueInNext7DaysCount > 1 && <p className="mt-2 text-xs text-muted-foreground">+{classroom.dueInNext7DaysCount - 1} more due in the next 7 days</p>}
          </div>
        ) : (
          <div className="flex min-h-16 items-center justify-center rounded-lg bg-muted/40 px-3 py-3 text-center text-xs text-muted-foreground">No coursework due in the next 7 days</div>
        )}
      </CardContent>
      <CardFooter className="justify-between gap-3 py-2.5">
        <span className="truncate text-xs text-muted-foreground">
          {classroom.lastContentUpdateAt ? `Updated ${formatDistanceToNow(new Date(classroom.lastContentUpdateAt), { addSuffix: true })}` : 'No content published yet'}
        </span>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={onOpen}>Open<ArrowRight aria-hidden="true" /></Button>
      </CardFooter>
    </Card>
  );
}

function ClassEditorModal({ state, onClose, onSaved }: { state: { mode: 'create' | 'edit'; classroom?: ClassSummary } | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setName(state?.classroom?.name || ''); }, [state]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!state || !name.trim()) return;
    setSaving(true);
    try {
      if (state.mode === 'create') await axiosClient.post('/api/classes', { name: name.trim() });
      else await axiosClient.patch(`/api/classes/${state.classroom?.id}`, { name: name.trim() });
      toast.success(state.mode === 'create' ? 'Class created' : 'Class updated');
      await onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error, state.mode === 'create' ? 'Unable to create class.' : 'Unable to update class.'));
    } finally { setSaving(false); }
  };

  return <Modal open={Boolean(state)} onClose={onClose} closeOnBackdrop title={state?.mode === 'edit' ? 'Edit class' : 'Create class'} subtitle={state?.mode === 'edit' ? 'Update the class name.' : 'Create a learning space for lessons, activities, and students.'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving || !name.trim()} onClick={save}>{saving ? 'Saving…' : state?.mode === 'edit' ? 'Save changes' : 'Create class'}</Button></>}>
    <form onSubmit={save}>
      <label className="block text-sm font-medium">Class name<Input autoFocus className="mt-2" maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. SAT Math 12A1" /></label>
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
    <div className="rounded-control border border-destructive/20 bg-destructive/10 p-4 text-sm leading-6 text-destructive">Assignments, student submissions, assigned tests, weeks, and lessons in <strong>{target?.name}</strong> will be deleted. Original tests in Practice Center will remain.</div>
    <label className="mt-5 block text-sm font-medium">Type <strong>{target?.name}</strong> to confirm<Input autoFocus className="mt-2" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
  </Modal>;
}

function ClassGridSkeleton() {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading classes">{Array.from({ length: 6 }, (_, index) => <Card key={index} size="sm"><CardHeader><div className="flex gap-3"><Skeleton className="size-9 shrink-0 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3.5 w-1/2" /></div></div><CardAction><Skeleton className="size-8" /></CardAction></CardHeader><CardContent><Skeleton className="h-24 w-full rounded-lg" /></CardContent><CardFooter className="justify-between py-2.5"><Skeleton className="h-3 w-28" /><Skeleton className="h-8 w-16" /></CardFooter></Card>)}</div>;
}
