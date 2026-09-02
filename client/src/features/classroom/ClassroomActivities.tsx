import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isPast } from 'date-fns';
import { BookOpenCheck, Check, ChevronRight, ClipboardCheck, ClipboardList, FileText, Plus, Search, Users } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge, Button, EmptyState, Input, TableShell } from '@/components/ui/AppUI';
import axiosClient from '@/lib/axios';
import { AssignmentComposer, AssignTestsComposer, type ActivityStudent } from './activity-composer/ActivityComposers';

type ActivityType = 'TEST' | 'HOMEWORK';
type ActivityFilter = 'ALL' | ActivityType;
interface ActivityAssignee { studentId: number; status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSING' | 'EXCUSED'; bestScore: number | null; attemptCount: number; excusedAt: string | null }
interface ClassActivity {
  id: string; type: ActivityType; status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'; title: string; instructions?: string | null;
  availableAt?: string | null; dueAt?: string | null; maxAttempts: number; scorePolicy: 'FIRST' | 'BEST' | 'LATEST'; createdAt: string;
  assignees: ActivityAssignee[]; lesson?: { id: string; title: string; week: { id: string; title: string; order: number } } | null;
  test?: { testDeliveryId: string; testDelivery: { testId: number; test: { title: string; subject: 'RW' | 'MATH'; mode: 'PRACTICE' | 'EXAM'; duration: number; sections: Array<{ _count: { questions: number } }> } } } | null;
  homework?: { assignmentId: string } | null;
}

export default function ClassroomActivities({ classId, students, canManage, onOpenPerformance }: { classId: string; students: ActivityStudent[]; canManage: boolean; onOpenPerformance: (deliveryId: string) => void }) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ClassActivity[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [composer, setComposer] = useState<'ASSIGNMENT' | 'TEST' | null>(null);
  const loadActivities = useCallback(async () => {
    setLoading(true); setError('');
    try { setActivities(await axiosClient.get<ClassActivity[], ClassActivity[]>(`/api/class-activities/class/${classId}`)); }
    catch (requestError) { console.error(requestError); setError('Class activities could not be loaded.'); }
    finally { setLoading(false); }
  }, [classId]);
  useEffect(() => { void loadActivities(); }, [loadActivities]);
  const filtered = useMemo(() => activities.filter(activity => (filter === 'ALL' || activity.type === filter) && (!search.trim() || activity.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))), [activities, filter, search]);
  const counts = useMemo(() => ({ ALL: activities.length, TEST: activities.filter(item => item.type === 'TEST').length, HOMEWORK: activities.filter(item => item.type === 'HOMEWORK').length }), [activities]);
  const openActivity = (activity: ClassActivity) => {
    if (activity.type === 'TEST' && activity.test) {
      if (canManage) onOpenPerformance(activity.test.testDeliveryId);
      else navigate(`/test/${activity.test.testDelivery.testId}?deliveryId=${activity.test.testDeliveryId}`);
    } else if (activity.homework) navigate(`/dashboard/class/${classId}/assignment/${activity.homework.assignmentId}`);
  };
  return <div className="space-y-4 py-2">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-2"><label className="relative min-w-0 flex-1"><Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input controlSize="sm" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search activities…" aria-label="Search activities" className="w-full pl-8" /></label><div className="flex flex-wrap items-center gap-2"><ActivityFilterMenu value={filter} onChange={setFilter} counts={counts} />{canManage && <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm"><Plus size={16} />Add activity</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-72"><DropdownMenuLabel>What should students do?</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem className="items-start gap-3 py-3" onSelect={() => setComposer('ASSIGNMENT')}><FileText className="mt-0.5" /><span><span className="block font-medium">Assignment</span><span className="block text-caption text-muted-foreground">Instructions, resources, and submissions</span></span></DropdownMenuItem><DropdownMenuItem className="items-start gap-3 py-3" onSelect={() => setComposer('TEST')}><BookOpenCheck className="mt-0.5" /><span><span className="block font-medium">Test</span><span className="block text-caption text-muted-foreground">Assign one or more published SAT tests</span></span></DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div></div>
    {loading ? <ActivitySkeleton /> : error ? <EmptyState icon={<ClipboardList size={22} />} title="Unable to load activities" description={error} action={<Button variant="outline" onClick={() => void loadActivities()}>Try again</Button>} /> : filtered.length === 0 ? <EmptyState icon={<ClipboardList size={22} />} title="No activities found" description={activities.length ? 'Adjust the search or activity filter.' : canManage ? 'Add an assignment or test for this class.' : 'Your teacher has not published any activities yet.'} action={canManage && activities.length === 0 ? <Button onClick={() => setComposer('ASSIGNMENT')}><Plus size={16} />Add activity</Button> : undefined} /> : <TableShell className="shadow-none"><div className="divide-y divide-ui-border">{filtered.map(activity => <ActivityRow key={activity.id} activity={activity} canManage={canManage} onOpen={() => openActivity(activity)} />)}</div></TableShell>}
    <AssignmentComposer open={composer === 'ASSIGNMENT'} onClose={() => setComposer(null)} classId={classId} students={students} onCreated={loadActivities} />
    <AssignTestsComposer open={composer === 'TEST'} onClose={() => setComposer(null)} classId={classId} students={students} onCreated={loadActivities} />
  </div>;
}

function ActivityFilterMenu({ value, onChange, counts }: { value: ActivityFilter; onChange: (value: ActivityFilter) => void; counts: Record<ActivityFilter, number> }) {
  const labels: Record<ActivityFilter, string> = { ALL: 'All activities', TEST: 'Tests', HOMEWORK: 'Assignments' };
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><ClipboardList size={15} />{labels[value]}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuLabel>Filter activities</DropdownMenuLabel><DropdownMenuSeparator />{(['ALL', 'HOMEWORK', 'TEST'] as ActivityFilter[]).map(item => <DropdownMenuItem key={item} onSelect={() => onChange(item)}><span className="flex-1">{labels[item]}</span><span className="text-muted-foreground">{counts[item]}</span>{value === item && <Check size={14} />}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}

function ActivityRow({ activity, canManage, onOpen }: { activity: ClassActivity; canManage: boolean; onOpen: () => void }) {
  const active = activity.assignees.filter(item => !item.excusedAt);
  const completed = active.filter(item => item.status === 'COMPLETED').length;
  const inProgress = active.filter(item => item.status === 'IN_PROGRESS').length;
  const duePast = Boolean(activity.dueAt && isPast(new Date(activity.dueAt)));
  const notAvailable = Boolean(!canManage && activity.availableAt && new Date(activity.availableAt) > new Date());
  const placement = activity.lesson ? `${activity.lesson.week.title} · ${activity.lesson.title}` : 'No session';
  const statusText = activity.status === 'CLOSED' ? 'Closed' : activity.status === 'DRAFT' ? 'Draft' : 'Published';
  const Icon = activity.type === 'TEST' ? BookOpenCheck : ClipboardCheck;
  return <div className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center"><span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-ui-border bg-muted text-muted-foreground"><Icon size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-body font-semibold text-foreground">{activity.title}</h3><Badge className="gap-1 px-1.5 text-muted-foreground">{activity.status === 'PUBLISHED' && <Check size={12} />}{statusText}</Badge></div><p className="mt-1 text-caption text-muted-foreground">{activityMetadata(activity)} · {placement}{activity.dueAt ? ` · Due ${format(new Date(activity.dueAt), 'MMM d, yyyy · HH:mm')}` : ' · No deadline'}</p>{notAvailable && <p className="mt-1 text-caption text-subtle">Available {format(new Date(activity.availableAt as string), 'MMM d, yyyy · HH:mm')}</p>}{canManage && <p className="mt-1 text-caption text-subtle">{completed} of {active.length} completed{inProgress ? ` · ${inProgress} in progress` : ''}{duePast && completed < active.length ? ` · ${active.length - completed} missing` : ''}</p>}</div><div className="flex items-center gap-2 self-end sm:self-auto">{canManage && <Badge className="gap-1.5"><Users size={12} />{active.length}</Badge>}<Button variant="outline" size="sm" disabled={notAvailable} onClick={onOpen}>{notAvailable ? 'Not available yet' : canManage && activity.type === 'TEST' ? 'View performance' : 'Open assignment'}{!notAvailable && <ChevronRight size={15} />}</Button></div></div>;
}

function activityMetadata(activity: ClassActivity) {
  if (activity.type !== 'TEST' || !activity.test) return 'Assignment';
  const test = activity.test.testDelivery.test;
  const questions = test.sections.reduce((sum, section) => sum + section._count.questions, 0);
  return `${test.subject === 'MATH' ? 'Math' : 'Reading & Writing'} · ${test.mode === 'EXAM' ? 'Exam' : 'Practice'} · ${questions} questions · ${activity.maxAttempts} attempt${activity.maxAttempts === 1 ? '' : 's'}`;
}
function ActivitySkeleton() { return <TableShell className="animate-pulse shadow-none">{[1, 2, 3, 4].map(item => <div key={item} className="flex h-24 items-center gap-4 border-b border-ui-border px-4 last:border-0"><span className="size-10 rounded-control bg-muted" /><span className="h-4 w-64 rounded-sm bg-muted" /><span className="ml-auto h-8 w-32 rounded-control bg-muted" /></div>)}</TableShell>; }
