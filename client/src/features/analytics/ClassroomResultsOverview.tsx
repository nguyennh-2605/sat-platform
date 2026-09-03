import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ClipboardCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, EmptyState } from '@/components/ui/AppUI';
import {
  DataPrimaryCell,
  DataPrimaryText,
  DataSecondaryText,
  DataSurface,
  DataTableViewport,
  DataToolbar,
  DataToolbarGroup,
  DataToolbarSearch,
} from '@/components/ui/data-surface';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import axiosClient from '@/lib/axios';
import { capitalizeFirstLetter } from '@/utils/text';

type ResultType = 'TEST' | 'HOMEWORK';
type ResultTypeFilter = 'ALL' | ResultType;
type AttentionFilter = 'ALL' | 'NEEDS_ATTENTION' | 'COMPLETE';

interface Placement {
  id: string;
  title: string;
  order: number;
}

interface ResultItem {
  id: string;
  type: ResultType;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  title: string;
  assignedAt: string | null;
  dueAt: string | null;
  createdAt: string;
  lesson: (Placement & { week: Placement }) | null;
  testResult?: {
    deliveryId: string;
    assigned: number;
    completed: number;
    inProgress: number;
    missing: number;
    averageScore: number | null;
  };
  assignmentResult?: {
    assignmentId: string | null;
    assigned: number;
    submitted: number;
    missing: number;
  };
}

interface Choice {
  value: string;
  label: string;
}

export default function ClassroomResultsOverview({ classId, onOpenTest }: { classId: string; onOpenTest: (deliveryId: string) => void }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<ResultTypeFilter>('ALL');
  const [weekId, setWeekId] = useState('ALL');
  const [sessionId, setSessionId] = useState('ALL');
  const [attention, setAttention] = useState<AttentionFilter>('ALL');

  useEffect(() => {
    let active = true;
    axiosClient.get<ResultItem[], ResultItem[]>(`/api/class-activities/class/${classId}/results`)
      .then(result => { if (active) setItems(Array.isArray(result) ? result : []); })
      .catch(requestError => {
        console.error(requestError);
        if (active) setError('Class results could not be loaded.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classId]);

  const weekChoices = useMemo<Choice[]>(() => [
    { value: 'ALL', label: 'All weeks' },
    ...uniquePlacements(items.map(item => item.lesson?.week || null)),
  ], [items]);
  const sessionChoices = useMemo<Choice[]>(() => [
    { value: 'ALL', label: 'All sessions' },
    ...uniquePlacements(items
      .filter(item => weekId === 'ALL' || item.lesson?.week.id === weekId)
      .map(item => item.lesson || null)),
  ], [items, weekId]);

  const effectiveSessionId = sessionChoices.some(choice => choice.value === sessionId) ? sessionId : 'ALL';

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return items.filter(item => {
      if (type !== 'ALL' && item.type !== type) return false;
      if (weekId !== 'ALL' && item.lesson?.week.id !== weekId) return false;
      if (effectiveSessionId !== 'ALL' && item.lesson?.id !== effectiveSessionId) return false;
      const state = getAttentionState(item);
      if (attention === 'NEEDS_ATTENTION' && state.priority > 1) return false;
      if (attention === 'COMPLETE' && state.key !== 'COMPLETE') return false;
      return !query || item.title.toLocaleLowerCase().includes(query)
        || item.lesson?.title.toLocaleLowerCase().includes(query)
        || item.lesson?.week.title.toLocaleLowerCase().includes(query);
    }).sort(byAttentionThenAssignedDate);
  }, [attention, effectiveSessionId, items, search, type, weekId]);
  const hasFilters = Boolean(search || type !== 'ALL' || weekId !== 'ALL' || effectiveSessionId !== 'ALL' || attention !== 'ALL');

  const clearFilters = () => {
    setSearch('');
    setType('ALL');
    setWeekId('ALL');
    setSessionId('ALL');
    setAttention('ALL');
  };
  const openResult = (item: ResultItem) => {
    if (item.type === 'TEST' && item.testResult) onOpenTest(item.testResult.deliveryId);
    if (item.type === 'HOMEWORK' && item.assignmentResult?.assignmentId) {
      navigate(`/dashboard/class/${classId}/assignment/${item.assignmentResult.assignmentId}?view=student-work`);
    }
  };
  return <div className="space-y-4 animate-fade-in-up">
    <div>
      <h2 className="text-lg font-semibold text-foreground">Results</h2>
      <p className="mt-1 text-xs text-muted-foreground">Review participation, outcomes, and work that needs attention.</p>
    </div>
    <DataSurface>
      <DataToolbar>
        <DataToolbarGroup className="w-full">
          <DataToolbarSearch className="lg:w-72" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search results…" label="Search results" />
          <FilterMenu label="Filter by type" value={type} choices={[{ value: 'ALL', label: 'All types' }, { value: 'TEST', label: 'Tests' }, { value: 'HOMEWORK', label: 'Assignments' }]} onChange={value => setType(value as ResultTypeFilter)} />
          <FilterMenu label="Filter by week" value={weekId} choices={weekChoices} onChange={setWeekId} />
          <FilterMenu label="Filter by session" value={effectiveSessionId} choices={sessionChoices} onChange={setSessionId} />
          <FilterMenu label="Filter by attention" value={attention} choices={[{ value: 'ALL', label: 'All results' }, { value: 'NEEDS_ATTENTION', label: 'Needs attention' }, { value: 'COMPLETE', label: 'Complete' }]} onChange={value => setAttention(value as AttentionFilter)} />
          {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X size={14} />Reset</Button>}
        </DataToolbarGroup>
      </DataToolbar>

      {loading ? <ResultsSkeleton /> : error ? <EmptyState surface={false} icon={<ClipboardCheck size={22} />} title="Unable to load results" description={error} /> : filtered.length === 0 ? <EmptyState surface={false} icon={<ClipboardCheck size={22} />} title={items.length ? 'No matching results' : 'No results yet'} description={items.length ? 'Try changing or clearing your filters.' : 'Assigned tests and assignments will appear here.'} action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined} /> : <DataTableViewport>
        <Table className="min-w-[920px] table-fixed">
          <TableHeader><TableRow>
            <TableHead className="w-[40%]">Assessment</TableHead>
            <TableHead className="w-[22%]">Participation</TableHead>
            <TableHead className="w-[15%]">Outcome</TableHead>
            <TableHead className="w-[14%]">Attention</TableHead>
            <TableHead className="w-[9%] text-right"><span className="sr-only">Actions</span></TableHead>
          </TableRow></TableHeader>
          <TableBody>{filtered.map(item => <ResultRow key={item.id} item={item} onOpen={() => openResult(item)} />)}</TableBody>
        </Table>
      </DataTableViewport>}
    </DataSurface>
  </div>;
}

function ResultRow({ item, onOpen }: { item: ResultItem; onOpen: () => void }) {
  const result = item.type === 'TEST' ? item.testResult : item.assignmentResult;
  const completed = item.type === 'TEST' ? item.testResult?.completed : item.assignmentResult?.submitted;
  const assigned = result?.assigned || 0;
  const missing = result?.missing || 0;
  const inProgress = item.testResult?.inProgress || 0;
  const attention = getAttentionState(item);
  const placement = item.lesson
    ? `${item.type === 'TEST' ? 'Test' : 'Assignment'} · ${capitalizeFirstLetter(item.lesson.week.title)} · ${capitalizeFirstLetter(item.lesson.title)}`
    : `${item.type === 'TEST' ? 'Test' : 'Assignment'} · No week · No session`;
  const due = item.dueAt ? `Due ${format(new Date(item.dueAt), 'MMM d, yyyy · HH:mm')}` : 'No deadline';
  return <TableRow className="group">
    <TableCell>
      <DataPrimaryCell>
        <button type="button" onClick={onOpen} className="max-w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <DataPrimaryText className="group-hover:text-primary">{capitalizeFirstLetter(item.title)}</DataPrimaryText>
          <DataSecondaryText>{placement}</DataSecondaryText>
        </button>
      </DataPrimaryCell>
    </TableCell>
    <TableCell>
      <p className="text-sm font-medium tabular-nums text-foreground">{completed || 0} / {assigned} {item.type === 'TEST' ? 'completed' : 'submitted'}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{inProgress ? `${inProgress} in progress · ` : ''}{missing} missing</p>
    </TableCell>
    <TableCell>{item.type === 'TEST'
      ? <><p className="text-sm font-medium tabular-nums text-foreground">{item.testResult?.averageScore == null ? '—' : `${item.testResult.averageScore}%`}</p><p className="mt-0.5 text-xs text-muted-foreground">Average score</p></>
      : <><p className="text-sm font-medium text-foreground">Not scored</p><p className="mt-0.5 text-xs text-muted-foreground">Submission tracked</p></>}
    </TableCell>
    <TableCell><Badge tone={attention.tone}>{attention.label}</Badge><p className="mt-1 text-xs text-muted-foreground">{due}</p></TableCell>
    <TableCell className="text-right">
      <Button variant="ghost" size="sm" className="px-2 shadow-none" onClick={onOpen}>{item.type === 'TEST' ? 'Analyze' : 'Review'}</Button>
    </TableCell>
  </TableRow>;
}

function FilterMenu({ label, value, choices, onChange }: { label: string; value: string; choices: Choice[]; onChange: (value: string) => void }) {
  const selected = choices.find(choice => choice.value === value) || choices[0];
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="outline" size="sm">{selected.label}<ChevronDown size={14} /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-52">
      <DropdownMenuLabel>{label}</DropdownMenuLabel><DropdownMenuSeparator />
      <DropdownMenuRadioGroup value={value} onValueChange={onChange}>{choices.map(choice => <DropdownMenuRadioItem key={choice.value} value={choice.value}>{choice.label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function ResultsSkeleton() {
  return <div className="divide-y divide-ui-border" aria-label="Loading results">{Array.from({ length: 5 }, (_, index) => <div key={index} className="grid min-h-16 grid-cols-[2fr_0.7fr_0.8fr_1fr] items-center gap-6 px-4"><div className="space-y-2"><div className="h-4 w-1/2 animate-pulse rounded-sm bg-muted" /><div className="h-3 w-1/3 animate-pulse rounded-sm bg-muted" /></div><div className="h-5 w-16 animate-pulse rounded-full bg-muted" /><div className="h-4 w-20 animate-pulse rounded-sm bg-muted" /><div className="h-4 w-24 animate-pulse rounded-sm bg-muted" /></div>)}</div>;
}

function uniquePlacements(items: Array<Placement | null>): Choice[] {
  return [...new Map(items.filter((item): item is Placement => Boolean(item)).map(item => [item.id, item])).values()]
    .sort((left, right) => left.order - right.order)
    .map(item => ({ value: item.id, label: capitalizeFirstLetter(item.title) }));
}

function byAssignedDate(left: ResultItem, right: ResultItem) {
  return new Date(right.assignedAt || right.createdAt).getTime() - new Date(left.assignedAt || left.createdAt).getTime();
}

function byAttentionThenAssignedDate(left: ResultItem, right: ResultItem) {
  const priorityDifference = getAttentionState(left).priority - getAttentionState(right).priority;
  return priorityDifference || byAssignedDate(left, right);
}

type AttentionState = {
  key: 'OVERDUE' | 'DUE_SOON' | 'IN_PROGRESS' | 'NOT_STARTED' | 'COMPLETE';
  label: string;
  tone: 'danger' | 'warning' | 'neutral' | 'success';
  priority: number;
};

function getAttentionState(item: ResultItem): AttentionState {
  const result = item.type === 'TEST' ? item.testResult : item.assignmentResult;
  const assigned = result?.assigned || 0;
  const completed = item.type === 'TEST' ? item.testResult?.completed || 0 : item.assignmentResult?.submitted || 0;
  const missing = result?.missing || 0;
  const inProgress = item.testResult?.inProgress || 0;
  const dueAt = item.dueAt ? new Date(item.dueAt).getTime() : null;
  const now = Date.now();
  const threeDays = 3 * 24 * 60 * 60 * 1000;

  if (missing > 0 && dueAt !== null && dueAt < now) return { key: 'OVERDUE', label: 'Overdue', tone: 'danger', priority: 0 };
  if (missing > 0 && dueAt !== null && dueAt >= now && dueAt - now <= threeDays) return { key: 'DUE_SOON', label: 'Due soon', tone: 'warning', priority: 1 };
  if (assigned > 0 && completed >= assigned) return { key: 'COMPLETE', label: 'Complete', tone: 'success', priority: 4 };
  if (completed > 0 || inProgress > 0) return { key: 'IN_PROGRESS', label: 'In progress', tone: 'neutral', priority: 2 };
  return { key: 'NOT_STARTED', label: 'Not started', tone: 'neutral', priority: 3 };
}
