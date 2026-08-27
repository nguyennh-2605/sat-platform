import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/AppUI';
import { fallbackSatDate } from '@/features/sat-countdown/sat-dates';
import { cachedGet } from '@/lib/queryCache';
import { StudentPracticePicks } from './StudentPracticePicks';
import { StudentCalendarPanel, NextSatCard, ScoreGoalCard } from './StudentProductivitySidebar';
import { StudentProgress } from './StudentProgress';
import { StudentRecentResults } from './StudentRecentResults';
import { StudentSummaryCards } from './StudentSummaryCards';
import { StudentTasksSection } from './StudentTasksSection';
import type { StudentFocus, StudentOverviewResponse, StudentPracticePick, StudentTaskItem, StudentTasksResponse } from './student-overview.types';

const emptyTasks: StudentTasksResponse = { items: [], summary: { todayRemaining: 0, weekCompleted: 0, weekTotal: 0, weekPercentage: 0 }, calendar: [] };

export default function StudentOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState<StudentOverviewResponse | null>(null);
  const [tasks, setTasks] = useState<StudentTasksResponse>(emptyTasks);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tasksError, setTasksError] = useState(false);
  const [now] = useState(() => Date.now());
  const firstName = (localStorage.getItem('userName') || 'Student').trim().split(/\s+/)[0] || 'Student';

  const loadTasks = useCallback(async (force = false) => {
    try {
      const response = await cachedGet<StudentTasksResponse>('/api/student/tasks', { ttlMs: 15_000, force });
      setTasks(response); setTasksError(false);
    } catch (requestError) { console.error('Unable to load student tasks:', requestError); setTasksError(true); }
  }, []);
  const loadOverview = useCallback(async (force = false) => {
    setLoading(true); setError(false);
    const [overviewResult] = await Promise.allSettled([
      cachedGet<StudentOverviewResponse>('/api/student/overview', { ttlMs: 30_000, force }),
      loadTasks(force),
    ]);
    if (overviewResult.status === 'fulfilled') setData(overviewResult.value);
    else { console.error('Unable to load the student overview:', overviewResult.reason); setError(true); }
    setLoading(false);
  }, [loadTasks]);
  // Initial API hydration is intentionally owned by this route component.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadOverview(); }, [loadOverview]);

  const openTest = useCallback((test: { id: number; title: string; duration?: number | null }, href: string) => {
    localStorage.setItem('current_exam_info', JSON.stringify({ id: test.id, title: test.title, duration: test.duration || undefined }));
    navigate(href);
  }, [navigate]);
  const openFocus = (focus: StudentFocus) => focus.testId
    ? openTest({ id: focus.testId, title: focus.title.replace(/^Continue |^Ready for /, '').replace(/\?$/, ''), duration: focus.durationMinutes }, focus.href)
    : navigate(focus.href);
  const openPractice = (item: StudentPracticePick) => openTest({ id: item.id, title: item.title, duration: item.duration }, `/test/${item.id}`);
  const openTask = (item: StudentTaskItem) => {
    if (item.type === 'TEST' && item.testId) return openTest({ id: item.testId, title: item.title, duration: item.durationMinutes }, item.href);
    if (item.href) navigate(item.href);
  };
  const satDate = data?.preferences.satTestDate && new Date(data.preferences.satTestDate).getTime() > now ? new Date(data.preferences.satTestDate) : fallbackSatDate(now);

  if (error && !data) return <div className="h-full overflow-y-auto bg-background p-4 md:p-6"><EmptyState icon={<RefreshCw size={22} />} title="Your overview is unavailable" description="We could not load your learning progress. Check the server connection and try again." action={<Button variant="outline" onClick={() => void loadOverview(true)}><RefreshCw />Try again</Button>} className="min-h-96" /></div>;
  if (loading && !data) return <StudentOverviewSkeleton />;
  if (!data) return null;

  return <div className="h-full overflow-y-auto bg-background">
    <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="flex min-w-0 flex-col gap-6 lg:col-span-9">
          <header className="flex items-start justify-between gap-4"><div><h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Welcome back, {firstName}</h1><p className="mt-1 text-base text-muted-foreground">Plan today, complete your coursework, and keep your SAT progress moving.</p></div><Button variant="outline" size="icon" disabled={loading} onClick={() => void loadOverview(true)} aria-label="Refresh overview"><RefreshCw className={loading ? 'animate-spin' : ''} /></Button></header>
          <StudentSummaryCards summary={tasks.summary} focus={data.focus} onOpenFocus={openFocus} />
          {tasksError && tasks.items.length === 0 ? <Card className="p-6"><EmptyState icon={<RefreshCw />} title="Tasks could not be loaded" description="Your progress and practice are still available." action={<Button variant="outline" onClick={() => void loadTasks(true)}><RefreshCw />Try again</Button>} /></Card> : <StudentTasksSection data={tasks} selectedDate={selectedDate} onClearDate={() => setSelectedDate(undefined)} onOpen={openTask} onReload={() => loadTasks(true)} />}
          <section className="grid min-w-0 gap-6 xl:grid-cols-12" aria-label="Progress and practice"><div className="min-w-0 xl:col-span-7"><StudentProgress progress={data.progress} /></div><div className="min-w-0 xl:col-span-5"><StudentPracticePicks items={data.practice} onOpen={openPractice} /></div></section>
        </section>
        <aside className="flex min-w-0 flex-col gap-6 lg:col-span-3">
          <StudentCalendarPanel markers={tasks.calendar} selectedDate={selectedDate} onSelectDate={setSelectedDate} satDate={satDate} />
          <NextSatCard value={data.preferences.satTestDate} onSaved={value => setData(current => current ? { ...current, preferences: { ...current.preferences, satTestDate: value } } : current)} />
          <ScoreGoalCard currentScore={data.preferences.currentScore} targetScore={data.preferences.targetScore} onSaved={value => setData(current => current ? { ...current, preferences: { ...current.preferences, ...value } } : current)} />
          <StudentRecentResults items={data.recentResults} onOpenResult={submissionId => navigate('/dashboard/score-report', { state: { resultId: submissionId } })} />
        </aside>
      </div>
    </main>
  </div>;
}

function StudentOverviewSkeleton() {
  return <div className="h-full overflow-y-auto bg-background"><main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6"><div className="grid gap-6 lg:grid-cols-12"><section className="space-y-6 lg:col-span-9"><div><Skeleton className="h-9 w-72" /><Skeleton className="mt-2 h-5 w-112 max-w-full" /></div><div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map(item => <Card key={item} className="h-28 p-4"><Skeleton className="h-full w-full" /></Card>)}</div><Card className="h-96 p-4"><Skeleton className="h-full w-full" /></Card><div className="grid gap-6 xl:grid-cols-2"><Card className="h-96 p-4"><Skeleton className="h-full w-full" /></Card><Card className="h-96 p-4"><Skeleton className="h-full w-full" /></Card></div></section><aside className="space-y-6 lg:col-span-3">{[260, 130, 150, 220].map((height, index) => <Card key={index} style={{ height }} className="p-3"><Skeleton className="h-full w-full" /></Card>)}</aside></div></main></div>;
}
