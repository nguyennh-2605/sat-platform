import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Copy, GraduationCap, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const CLASS_COLOR_OPTIONS = [
  { value: '#1B7A5A', label: 'Emerald' },
  { value: '#0F4D38', label: 'Forest' },
  { value: '#2563EB', label: 'Blue' },
  { value: '#7C3AED', label: 'Violet' },
  { value: '#0E7490', label: 'Cyan' },
  { value: '#A16207', label: 'Gold' },
  { value: '#B45309', label: 'Amber' },
  { value: '#BE123C', label: 'Rose' },
  { value: '#8B3A62', label: 'Berry' },
  { value: '#475569', label: 'Slate' },
] as const;

interface ClassSummary {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  teacher: { id: number; name: string; email: string };
  studentCount: number;
  canManage: boolean;
  dueInNext7DaysCount: number;
  nextActivity: { id: string; type: 'TEST' | 'QUIZ' | 'VOCABULARY' | 'HOMEWORK' | 'RESOURCE'; title: string; dueAt: string } | null;
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
        />

        <section className="min-w-0 space-y-4" aria-label="Classes">
          {!loading && !loadError && classes.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative block w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search classrooms…" aria-label="Search classrooms" className="w-full pl-9" />
              </label>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Select value={sort} onValueChange={value => setSort(value as ClassSort)}>
                  <SelectTrigger className="min-w-0 flex-1 sm:w-36" aria-label="Sort classrooms"><SelectValue /></SelectTrigger>
                  <SelectContent align="end"><SelectItem value="NEWEST">Newest</SelectItem><SelectItem value="NAME">Name</SelectItem><SelectItem value="STUDENTS">Student count</SelectItem></SelectContent>
                </Select>
                {canCreate && <Button className="shrink-0" onClick={() => setEditor({ mode: 'create' })}><Plus aria-hidden="true" />Create class</Button>}
              </div>
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
  const copyClassCode = async () => {
    try {
      await navigator.clipboard.writeText(classroom.id);
      toast.success('Class code copied');
    } catch {
      toast.error('Unable to copy the class code.');
    }
  };

  const updatedAt = classroom.lastContentUpdateAt || classroom.createdAt;

  return (
    <Card
      size="sm"
      interactive
      className="group/class relative cursor-pointer gap-0 overflow-hidden py-0 outline-none transition-shadow hover:shadow-md focus-within:ring-3 focus-within:ring-ring/50"
    >
      <button type="button" onClick={onOpen} className="absolute inset-0 z-1 rounded-[inherit] outline-none" aria-label={`Open ${classroom.name}`} />
      <div
        className="pointer-events-none relative aspect-[16/7] min-h-36 overflow-hidden"
        style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${classroom.color} 52%, white) 0%, ${classroom.color} 48%, color-mix(in srgb, ${classroom.color} 42%, black) 100%)` }}
        aria-hidden="true"
      >
        <div className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/12 to-transparent" />
      </div>

      {classroom.canManage && (
        <div className="absolute right-3 top-3 z-10" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="secondary" size="icon" className="border border-white/25 bg-black/20 text-white shadow-sm backdrop-blur-sm hover:bg-black/35 hover:text-white" aria-label={`Actions for ${classroom.name}`}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void copyClassCode()}><Copy aria-hidden="true" />Copy class code</DropdownMenuItem>
                <DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden="true" />Edit class</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 aria-hidden="true" />Delete class</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )}

      <CardHeader className="pointer-events-none gap-3 px-4 py-4 sm:px-5">
        <CardTitle className="line-clamp-2 text-base font-semibold text-foreground transition-colors group-hover/class:text-primary">{classroom.name}</CardTitle>
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 px-0 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Users className="size-3.5" aria-hidden="true" />{classroom.studentCount} {classroom.studentCount === 1 ? 'student' : 'students'}</span>
          <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />Updated {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}</span>
          {showTeacher && <span className="w-full truncate">Teacher: {classroom.teacher?.name || 'Unassigned'}</span>}
        </CardContent>
      </CardHeader>
    </Card>
  );
}

function ClassEditorModal({ state, onClose, onSaved }: { state: { mode: 'create' | 'edit'; classroom?: ClassSummary } | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(CLASS_COLOR_OPTIONS[0].value);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(state?.classroom?.name || '');
    setColor(state?.classroom?.color || CLASS_COLOR_OPTIONS[0].value);
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
    } finally { setSaving(false); }
  };

  return <Modal open={Boolean(state)} onClose={onClose} closeOnBackdrop title={state?.mode === 'edit' ? 'Edit class' : 'Create class'} subtitle={state?.mode === 'edit' ? 'Update the class name and cover color.' : 'Create a learning space for lessons, activities, and students.'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving || !name.trim()} onClick={save}>{saving ? 'Saving…' : state?.mode === 'edit' ? 'Save changes' : 'Create class'}</Button></>}>
    <form onSubmit={save} className="space-y-5">
      <label className="block text-sm font-medium">Class name<Input autoFocus className="mt-2" maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. SAT Math 12A1" /></label>
      <fieldset><legend className="text-sm font-medium text-foreground">Cover color</legend><div className="mt-3 grid grid-cols-5 gap-3">{CLASS_COLOR_OPTIONS.map(option => {
        const selected = color === option.value;
        return <button key={option.value} type="button" aria-label={option.label} aria-pressed={selected} title={option.label} onClick={() => setColor(option.value)} className="relative aspect-square rounded-xl border border-white/20 shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${option.value} 52%, white), ${option.value} 48%, color-mix(in srgb, ${option.value} 42%, black))` }}>{selected && <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/10 text-white"><Check className="size-5" strokeWidth={2.5} /></span>}</button>;
      })}</div></fieldset>
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
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading classes">{Array.from({ length: 6 }, (_, index) => <Card key={index} size="sm" className="gap-0 overflow-hidden py-0"><Skeleton className="aspect-[16/7] min-h-36 w-full rounded-none" /><CardHeader className="gap-3 px-5 py-4"><Skeleton className="h-5 w-2/3" /><CardContent className="flex gap-4 px-0"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3.5 w-32" /></CardContent></CardHeader></Card>)}</div>;
}
