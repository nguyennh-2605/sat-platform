import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { endOfWeek, format, isPast, startOfWeek } from 'date-fns';
import { ArrowUpDown, BookOpenCheck, ClipboardList, Ellipsis, FileText, Plus, X } from 'lucide-react';
import {
  DataSurface,
  DataToolbar,
  DataToolbarActions,
  DataToolbarGroup,
  DataToolbarSearch,
} from '@/components/ui/data-surface';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/AppUI';
import axiosClient from '@/lib/axios';
import { AssignmentComposer, AssignTestsComposer, type ActivityStudent } from './activity-composer/ActivityComposers';

type ActivityType = 'TEST' | 'HOMEWORK';
type ActivityTypeFilter = 'ALL' | ActivityType;
type ActivityStatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'CLOSED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
type ActivityDateFilter = 'ALL' | 'THIS_WEEK' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM';
type ActivitySort = 'ASSIGNED_DESC' | 'ASSIGNED_ASC' | 'DUE_ASC' | 'DUE_DESC';
type StudentActivityStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'EXCUSED';

interface ActivityAssignee {
  studentId: number;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSING' | 'EXCUSED';
  assignedAt: string;
  bestScore: number | null;
  attemptCount: number;
  excusedAt: string | null;
}

interface ClassActivity {
  id: string;
  type: ActivityType;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  title: string;
  instructions?: string | null;
  availableAt?: string | null;
  dueAt?: string | null;
  assignedAt: string | null;
  maxAttempts: number;
  scorePolicy: 'FIRST' | 'BEST' | 'LATEST';
  createdAt: string;
  assignees: ActivityAssignee[];
  lesson?: { id: string; title: string; order: number; week: { id: string; title: string; order: number } } | null;
  test?: { testDeliveryId: string; testDelivery: { testId: number; test: { title: string; subject: 'RW' | 'MATH'; mode: 'PRACTICE' | 'EXAM'; duration: number; sections: Array<{ _count: { questions: number } }> } } } | null;
  homework?: { assignmentId: string } | null;
}

interface Choice<T extends string> {
  value: T;
  label: string;
  count?: number;
}

const TYPE_LABELS: Record<ActivityTypeFilter, string> = { ALL: 'All types', HOMEWORK: 'Assignments', TEST: 'Tests' };
const SORT_LABELS: Record<ActivitySort, string> = {
  ASSIGNED_DESC: 'Newest assigned',
  ASSIGNED_ASC: 'Oldest assigned',
  DUE_ASC: 'Due soon',
  DUE_DESC: 'Recently due',
};
const DATE_LABELS: Record<ActivityDateFilter, string> = {
  ALL: 'Any time',
  THIS_WEEK: 'This week',
  LAST_7_DAYS: 'Last 7 days',
  LAST_30_DAYS: 'Last 30 days',
  CUSTOM: 'Custom range',
};

export default function ClassroomActivities({ classId, students, canManage, onOpenPerformance }: { classId: string; students: ActivityStudent[]; canManage: boolean; onOpenPerformance: (deliveryId: string) => void }) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ClassActivity[]>([]);
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<ActivityStatusFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<ActivityDateFilter>('ALL');
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({ from: '', to: '' });
  const [customDateDraft, setCustomDateDraft] = useState({ from: '', to: '' });
  const [sort, setSort] = useState<ActivitySort>('ASSIGNED_DESC');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [composer, setComposer] = useState<'ASSIGNMENT' | 'TEST' | null>(null);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setActivities(await axiosClient.get<ClassActivity[], ClassActivity[]>(`/api/class-activities/class/${classId}`));
    } catch (requestError) {
      console.error(requestError);
      setError('Class activities could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { void loadActivities(); }, [loadActivities]);
  useEffect(() => { setStatusFilter('ALL'); }, [canManage]);

  const counts = useMemo(() => ({
    ALL: activities.length,
    TEST: activities.filter(item => item.type === 'TEST').length,
    HOMEWORK: activities.filter(item => item.type === 'HOMEWORK').length,
  }), [activities]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const matches = activities.filter(activity => {
      if (typeFilter !== 'ALL' && activity.type !== typeFilter) return false;
      if (query && !activity.title.toLocaleLowerCase().includes(query)) return false;
      if (statusFilter !== 'ALL') {
        const effectiveStatus = canManage ? activity.status : studentStatus(activity);
        if (effectiveStatus !== statusFilter) return false;
      }
      if (dateFilter !== 'ALL') {
        const assignedTime = activity.assignedAt ? new Date(activity.assignedAt).getTime() : 0;
        if (!assignedTime) return false;
        if (dateFilter === 'THIS_WEEK') {
          const weekStart = startOfWeek(now, { weekStartsOn: 1 }).getTime();
          const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).getTime();
          if (assignedTime < weekStart || assignedTime > weekEnd) return false;
        }
        if (dateFilter === 'LAST_7_DAYS' && assignedTime < now - (7 * day)) return false;
        if (dateFilter === 'LAST_30_DAYS' && assignedTime < now - (30 * day)) return false;
        if (dateFilter === 'CUSTOM') {
          const rangeStart = new Date(`${customDateRange.from}T00:00:00`).getTime();
          const rangeEnd = new Date(`${customDateRange.to}T23:59:59.999`).getTime();
          if (!rangeStart || !rangeEnd || assignedTime < rangeStart || assignedTime > rangeEnd) return false;
        }
      }
      return true;
    });

    return matches.sort((left, right) => compareActivities(left, right, sort));
  }, [activities, canManage, customDateRange, dateFilter, search, sort, statusFilter, typeFilter]);

  const selectDateFilter = (value: ActivityDateFilter) => {
    if (value !== 'CUSTOM') {
      setDateFilter(value);
      return;
    }
    setCustomDateDraft(customDateRange);
    setCustomDateOpen(true);
  };

  const applyCustomDateRange = () => {
    if (!customDateDraft.from || !customDateDraft.to || customDateDraft.from > customDateDraft.to) return;
    setCustomDateRange(customDateDraft);
    setDateFilter('CUSTOM');
    setCustomDateOpen(false);
  };

  const openActivity = (activity: ClassActivity) => {
    if (activity.type === 'TEST' && activity.test) {
      if (canManage) onOpenPerformance(activity.test.testDeliveryId);
      else navigate(`/test/${activity.test.testDelivery.testId}?deliveryId=${activity.test.testDeliveryId}`);
    } else if (activity.homework) {
      navigate(`/dashboard/class/${classId}/assignment/${activity.homework.assignmentId}${canManage ? '?view=student-work' : ''}`);
    }
  };

  const typeChoices: Array<Choice<ActivityTypeFilter>> = (['ALL', 'HOMEWORK', 'TEST'] as ActivityTypeFilter[]).map(value => ({ value, label: TYPE_LABELS[value], count: counts[value] }));
  const statusChoices: Array<Choice<ActivityStatusFilter>> = canManage
    ? [
      { value: 'ALL', label: 'All status' },
      { value: 'PUBLISHED', label: 'Active' },
      { value: 'DRAFT', label: 'Draft' },
      { value: 'CLOSED', label: 'Closed' },
    ]
    : [
      { value: 'ALL', label: 'All status' },
      { value: 'NOT_STARTED', label: 'Not started' },
      { value: 'IN_PROGRESS', label: 'In progress' },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'OVERDUE', label: 'Overdue' },
    ];
  const assignedDateLabel = dateFilter === 'CUSTOM' && customDateRange.from && customDateRange.to
    ? formatCustomRange(customDateRange.from, customDateRange.to)
    : DATE_LABELS[dateFilter];
  const hasActiveFilters = Boolean(search || typeFilter !== 'ALL' || statusFilter !== 'ALL' || dateFilter !== 'ALL');
  const clearFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setDateFilter('ALL');
    setCustomDateRange({ from: '', to: '' });
  };

  return <div className="space-y-4 py-2">
    <DataSurface>
      <DataToolbar>
        <DataToolbarGroup>
          <DataToolbarSearch value={search} onChange={event => setSearch(event.target.value)} placeholder="Search activities…" label="Search activities" />
          <ChoiceMenu label="Filter by activity type" value={typeFilter} choices={typeChoices} onChange={setTypeFilter} />
          <ChoiceMenu label="Filter by status" value={statusFilter} choices={statusChoices} onChange={setStatusFilter} />
          <ChoiceMenu label="Assigned date" triggerLabel={`Assigned: ${assignedDateLabel}`} value={dateFilter} choices={(Object.keys(DATE_LABELS) as ActivityDateFilter[]).map(value => ({ value, label: DATE_LABELS[value] }))} onChange={selectDateFilter} />
          {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X size={14} />Reset</Button>}
        </DataToolbarGroup>
        <DataToolbarActions>
          <ChoiceMenu label="Sort activities" triggerLabel={`Sort: ${SORT_LABELS[sort]}`} leadingIcon={<ArrowUpDown size={14} aria-hidden="true" />} value={sort} choices={(Object.keys(SORT_LABELS) as ActivitySort[]).map(value => ({ value, label: SORT_LABELS[value] }))} onChange={setSort} />
          {canManage && <AddActivityMenu onSelect={setComposer} />}
        </DataToolbarActions>
      </DataToolbar>

      {loading
        ? <ActivitySkeleton canManage={canManage} />
        : error
          ? <EmptyState surface={false} icon={<ClipboardList size={22} />} title="Unable to load activities" description={error} action={<Button variant="outline" onClick={() => void loadActivities()}>Try again</Button>} />
          : filtered.length === 0
            ? <EmptyState
              surface={false}
              icon={<ClipboardList size={22} />}
              title={activities.length ? 'No matching activities' : 'No activities yet'}
              description={activities.length ? 'Try changing or clearing your filters.' : canManage ? 'Add an assignment or test for this class.' : 'Your teacher has not published any activities yet.'}
              action={activities.length
                ? <Button variant="outline" onClick={clearFilters}><X size={16} />Clear filters</Button>
                : canManage ? <Button onClick={() => setComposer('ASSIGNMENT')}><Plus size={16} />Add activity</Button> : undefined}
            />
            : <ActivityTable activities={filtered} canManage={canManage} onOpen={openActivity} />}
    </DataSurface>

    <AssignmentComposer open={composer === 'ASSIGNMENT'} onClose={() => setComposer(null)} classId={classId} students={students} onCreated={loadActivities} />
    <AssignTestsComposer open={composer === 'TEST'} onClose={() => setComposer(null)} classId={classId} students={students} onCreated={loadActivities} />
    <CustomDateRangeModal open={customDateOpen} value={customDateDraft} onChange={setCustomDateDraft} onClose={() => setCustomDateOpen(false)} onApply={applyCustomDateRange} />
  </div>;
}

function ChoiceMenu<T extends string>({ label, triggerLabel, leadingIcon, value, choices, onChange }: { label: string; triggerLabel?: string; leadingIcon?: ReactNode; value: T; choices: Array<Choice<T>>; onChange: (value: T) => void }) {
  const selected = choices.find(choice => choice.value === value) || choices[0];
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="outline" size="sm">{leadingIcon}{triggerLabel || selected.label}</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-52">
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup value={value} onValueChange={nextValue => onChange(nextValue as T)}>
        {choices.map(choice => <DropdownMenuRadioItem key={choice.value} value={choice.value} className="py-2">
          <span className="flex-1">{choice.label}</span>
          {choice.count !== undefined && <span className="text-caption text-muted-foreground">{choice.count}</span>}
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function CustomDateRangeModal({ open, value, onChange, onClose, onApply }: { open: boolean; value: { from: string; to: string }; onChange: (value: { from: string; to: string }) => void; onClose: () => void; onApply: () => void }) {
  const invalid = !value.from || !value.to || value.from > value.to;
  return <Modal
    open={open}
    onClose={onClose}
    closeOnBackdrop
    presentation="content-dialog"
    title="Assigned date range"
    subtitle="Show activities assigned during this period."
    footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={invalid} onClick={onApply}>Apply range</Button></>}
  >
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block"><span className="mb-2 block text-body font-medium text-foreground">From</span><Input type="date" className="w-full" value={value.from} max={value.to || undefined} onChange={event => onChange({ ...value, from: event.target.value })} /></label>
      <label className="block"><span className="mb-2 block text-body font-medium text-foreground">To</span><Input type="date" className="w-full" value={value.to} min={value.from || undefined} onChange={event => onChange({ ...value, to: event.target.value })} /></label>
    </div>
  </Modal>;
}

function AddActivityMenu({ onSelect }: { onSelect: (value: 'ASSIGNMENT' | 'TEST') => void }) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button size="sm"><Plus size={16} />Add activity</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-72">
      <DropdownMenuLabel>What should students do?</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="items-start gap-3 py-3" onSelect={() => onSelect('ASSIGNMENT')}>
        <FileText className="mt-0.5" />
        <span><span className="block font-medium">Assignment</span><span className="block text-caption text-muted-foreground">Instructions, resources, and submissions</span></span>
      </DropdownMenuItem>
      <DropdownMenuItem className="items-start gap-3 py-3" onSelect={() => onSelect('TEST')}>
        <BookOpenCheck className="mt-0.5" />
        <span><span className="block font-medium">Test</span><span className="block text-caption text-muted-foreground">Assign one or more published SAT tests</span></span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function ActivityTable({ activities, canManage, onOpen }: { activities: ClassActivity[]; canManage: boolean; onOpen: (activity: ClassActivity) => void }) {
  return <Table className={canManage ? 'min-w-[900px] table-fixed' : 'min-w-[760px] table-fixed'}>
        <colgroup>
          <col className={canManage ? 'w-[56%]' : 'w-[58%]'} />
          <col className={canManage ? 'w-[12%]' : 'w-[13%]'} />
          <col className={canManage ? 'w-[15%]' : 'w-[16%]'} />
          <col className={canManage ? 'w-[12%]' : 'w-[13%]'} />
          {canManage && <col className="w-[5%]" />}
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-background">
            <TableHead>Activity</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>{canManage ? 'Completion' : 'Status'}</TableHead>
            {canManage && <TableHead><span className="sr-only">Actions</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>{activities.map(activity => <ActivityRow key={activity.id} activity={activity} canManage={canManage} onOpen={() => onOpen(activity)} />)}</TableBody>
  </Table>;
}

function ActivityRow({ activity, canManage, onOpen }: { activity: ClassActivity; canManage: boolean; onOpen: () => void }) {
  const activeAssignees = activity.assignees.filter(item => !item.excusedAt);
  const completed = activeAssignees.filter(item => item.status === 'COMPLETED').length;
  const notAvailable = Boolean(!canManage && activity.availableAt && new Date(activity.availableAt) > new Date());
  const personalStatus = studentStatus(activity);
  const secondaryCompletion = completionDetail(activity, activeAssignees);
  const overdue = Boolean(activity.dueAt && isPast(new Date(activity.dueAt)) && (canManage ? completed < activeAssignees.length : personalStatus === 'OVERDUE'));
  const handleOpen = () => { if (!notAvailable) onOpen(); };

  return <TableRow className={notAvailable ? '' : 'group cursor-pointer hover:bg-muted/30'} onClick={handleOpen}>
    <TableCell className="pr-8">
      <button
        type="button"
        disabled={notAvailable}
        onClick={event => { event.stopPropagation(); handleOpen(); }}
        className="block w-full min-w-0 text-left outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed"
      >
        <span className="block line-clamp-1 font-medium text-foreground group-hover:underline">{activity.title}</span>
        <span className="mt-1 block line-clamp-1 text-caption text-muted-foreground">{activityMetadata(activity)}</span>
        {notAvailable && <span className="mt-1 block text-caption text-subtle">Available {formatDateTime(activity.availableAt as string)}</span>}
      </button>
    </TableCell>
    <TableCell className="whitespace-nowrap text-subtle"><time dateTime={activity.assignedAt || undefined}>{formatAssignedDate(activity.assignedAt)}</time></TableCell>
    <TableCell className="whitespace-nowrap">{activity.dueAt ? <div><time dateTime={activity.dueAt} className={overdue ? 'text-danger' : 'text-subtle'}>{formatDateTime(activity.dueAt)}</time>{overdue && <p className="mt-1 text-caption font-medium text-danger">Overdue</p>}</div> : <span className="text-muted-foreground">No deadline</span>}</TableCell>
    <TableCell>
      {canManage
        ? <div><p className="font-medium tabular-nums text-foreground">{completed} / {activeAssignees.length}</p>{secondaryCompletion && <p className="mt-1 text-caption text-muted-foreground">{secondaryCompletion}</p>}</div>
        : <StudentStatusBadge status={personalStatus} />}
    </TableCell>
    {canManage && <TableCell onClick={event => event.stopPropagation()} className="text-right">
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="ml-auto size-9 shadow-none" aria-label={`Actions for ${activity.title}`}><Ellipsis size={16} /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onOpen}>{activity.type === 'TEST' ? 'View results' : canManage ? 'Review submissions' : 'Open assignment'}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>}
  </TableRow>;
}

function StudentStatusBadge({ status }: { status: StudentActivityStatus }) {
  const content: Record<StudentActivityStatus, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }> = {
    NOT_STARTED: { label: 'Not started', tone: 'neutral' },
    IN_PROGRESS: { label: 'In progress', tone: 'warning' },
    COMPLETED: { label: 'Completed', tone: 'success' },
    OVERDUE: { label: 'Overdue', tone: 'danger' },
    EXCUSED: { label: 'Excused', tone: 'neutral' },
  };
  return <Badge tone={content[status].tone}>{content[status].label}</Badge>;
}

function studentStatus(activity: ClassActivity): StudentActivityStatus {
  const assignee = activity.assignees[0];
  if (assignee?.excusedAt || assignee?.status === 'EXCUSED') return 'EXCUSED';
  if (assignee?.status === 'COMPLETED') return 'COMPLETED';
  if (assignee?.status === 'MISSING' || (activity.dueAt && isPast(new Date(activity.dueAt)))) return 'OVERDUE';
  if (assignee?.status === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

function completionDetail(activity: ClassActivity, assignees: ActivityAssignee[]) {
  const inProgress = assignees.filter(item => item.status === 'IN_PROGRESS').length;
  const overdue = assignees.filter(item => item.status === 'MISSING' || (activity.dueAt && isPast(new Date(activity.dueAt)) && item.status !== 'COMPLETED')).length;
  if (overdue) return `${overdue} overdue`;
  if (inProgress) return `${inProgress} in progress`;
  return '';
}

function activityMetadata(activity: ClassActivity) {
  const type = activity.type === 'TEST' ? 'Test' : 'Assignment';
  if (!activity.lesson) return `${type} · No week · No session`;
  const weekNumber = String(activity.lesson.week.order + 1).padStart(2, '0');
  const sessionNumber = String(activity.lesson.order + 1).padStart(2, '0');
  return `${type} · Week ${weekNumber} · Session ${sessionNumber}`;
}

function compareActivities(left: ClassActivity, right: ClassActivity, sort: ActivitySort) {
  const leftAssigned = dateValue(left.assignedAt);
  const rightAssigned = dateValue(right.assignedAt);
  const assignedTieBreak = rightAssigned - leftAssigned;
  if (sort === 'ASSIGNED_DESC') return assignedTieBreak;
  if (sort === 'ASSIGNED_ASC') return leftAssigned - rightAssigned;
  const leftDue = left.dueAt ? dateValue(left.dueAt) : Number.POSITIVE_INFINITY;
  const rightDue = right.dueAt ? dateValue(right.dueAt) : Number.POSITIVE_INFINITY;
  if (sort === 'DUE_ASC') return (leftDue - rightDue) || assignedTieBreak;
  const leftRecentDue = left.dueAt ? dateValue(left.dueAt) : Number.NEGATIVE_INFINITY;
  const rightRecentDue = right.dueAt ? dateValue(right.dueAt) : Number.NEGATIVE_INFINITY;
  return (rightRecentDue - leftRecentDue) || assignedTieBreak;
}

function formatAssignedDate(value: string | null) {
  if (!value) return 'Not assigned';
  const date = new Date(value);
  return format(date, date.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return format(date, date.getFullYear() === new Date().getFullYear() ? 'MMM d, HH:mm' : 'MMM d, yyyy, HH:mm');
}

function formatCustomRange(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  if (fromDate.getFullYear() !== toDate.getFullYear()) return `${format(fromDate, 'MMM d, yyyy')} – ${format(toDate, 'MMM d, yyyy')}`;
  if (fromDate.getMonth() !== toDate.getMonth()) return `${format(fromDate, 'MMM d')} – ${format(toDate, 'MMM d, yyyy')}`;
  return `${format(fromDate, 'MMM d')}–${format(toDate, 'd, yyyy')}`;
}

function dateValue(value: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function ActivitySkeleton({ canManage }: { canManage: boolean }) {
  return <div className="animate-pulse overflow-hidden">
      <div className="h-11 border-b border-ui-border-strong bg-muted/20" />
      {[1, 2, 3, 4].map(item => <div key={item} className="flex h-16 items-center gap-8 border-b border-ui-border/60 px-4 last:border-0">
        <div className="min-w-0 flex-1 space-y-2"><div className="h-4 w-2/5 rounded-sm bg-muted" /><div className="h-3 w-3/5 rounded-sm bg-muted" /></div>
        <div className="h-4 w-20 rounded-sm bg-muted" />
        <div className="h-4 w-28 rounded-sm bg-muted" />
        <div className="h-5 w-20 rounded-full bg-muted" />
        {canManage && <div className="size-8 rounded-control bg-muted" />}
      </div>)}
  </div>;
}
