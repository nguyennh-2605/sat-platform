import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, RefreshCw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cachedGet } from '@/lib/queryCache';
import { TeacherCheckIns } from './TeacherCheckIns';
import { TeacherClassPulse } from './TeacherClassPulse';
import { TeacherLearningInsights } from './TeacherLearningInsights';
import { TeacherNeedsAttention } from './TeacherNeedsAttention';
import { TeacherUpcoming } from './TeacherUpcoming';
import type { TeacherInsightsResponse, TeacherOverviewResponse } from './teacher-overview.types';

const greeting = (hour: number) => hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

export default function TeacherOverview() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedScope = searchParams.get('classId') || 'all';
  const [data, setData] = useState<TeacherOverviewResponse | null>(null);
  const [insights, setInsights] = useState<TeacherInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState(false);
  const [currentGreeting] = useState(() => greeting(new Date().getHours()));
  const firstName = (localStorage.getItem('userName') || 'Teacher').trim().split(/\s+/)[0] || 'Teacher';
  const requestedInsightsClassId = searchParams.get('insightsClassId');
  const requestedInsightsClass = data?.scope.classes.find(item => item.id === requestedInsightsClassId);
  const insightsScope = selectedScope !== 'all' ? selectedScope : requestedInsightsClass?.id || data?.scope.classes[0]?.id || null;

  const loadOverview = useCallback(async (force = false) => {
    setLoading(true);
    setError(false);
    try {
      const response = await cachedGet<TeacherOverviewResponse>(`/api/teacher/overview?classId=${encodeURIComponent(selectedScope)}`, { ttlMs: 30_000, force });
      setData(response);
    } catch (requestError) {
      console.error('Unable to load the teacher overview:', requestError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedScope]);

  const loadInsights = useCallback(async (force = false) => {
    if (!insightsScope) { setInsights(null); setInsightsLoading(false); return; }
    setInsightsLoading(true);
    setInsightsError(false);
    try {
      const response = await cachedGet<TeacherInsightsResponse>(`/api/teacher/overview/insights?classId=${encodeURIComponent(insightsScope)}&range=30d`, { ttlMs: 60_000, force });
      setInsights(response);
    } catch (requestError) {
      console.error('Unable to load teacher insights:', requestError);
      setInsightsError(true);
    } finally {
      setInsightsLoading(false);
    }
  }, [insightsScope]);

  // This route owns its API hydration, and class scope is reflected in the URL.
  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => { void loadInsights(); }, [loadInsights]);

  const changeScope = (classId: string) => {
    const next = new URLSearchParams(searchParams);
    if (classId === 'all') next.delete('classId'); else { next.set('classId', classId); next.delete('insightsClassId'); }
    setSearchParams(next);
  };

  const changeInsightsScope = (classId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('insightsClassId', classId);
    setSearchParams(next);
  };

  if (loading) return <TeacherOverviewSkeleton />;
  if (error || !data) return <div className="h-full overflow-y-auto bg-background p-4 md:p-6"><EmptyState icon={<RefreshCw size={22} />} title="Your overview is unavailable" description="We could not load your classroom workflow. Check the server connection and try again." action={<Button variant="outline" onClick={() => void loadOverview(true)}><RefreshCw />Try again</Button>} className="min-h-96" /></div>;

  const activeClass = data.scope.classes.find(item => item.id === data.scope.selectedClassId);

  return <div className="h-full overflow-y-auto bg-background">
    <main className="mx-auto w-full max-w-screen-2xl space-y-4 p-4 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1"><h1 className="text-3xl tracking-tight text-foreground">Teacher Dashboard</h1><p className="text-sm text-muted-foreground">{currentGreeting}, {firstName}. Here&apos;s a quick overview of today&apos;s activity.</p></div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-fit lg:justify-end">
          {data.scope.classes.length > 1 && <Select value={data.scope.selectedClassId || 'all'} onValueChange={changeScope}><SelectTrigger size="sm" className="w-full sm:w-52" aria-label="Filter overview by class"><SelectValue placeholder="All classes" /></SelectTrigger><SelectContent align="end"><SelectGroup><SelectItem value="all">All classes</SelectItem>{data.scope.classes.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectGroup></SelectContent></Select>}
          <Button size="sm" onClick={() => navigate(activeClass ? `/dashboard/class/${activeClass.id}` : '/dashboard/classes')}><GraduationCap />{activeClass ? 'Open classroom' : 'View classes'}</Button>
        </div>
      </header>

      {data.scope.classes.length === 0 ? <EmptyState icon={<GraduationCap size={24} />} title="Create your first class" description="Your teaching priorities, schedule, and learning signals will appear here once you have a class." action={<Button onClick={() => navigate('/dashboard/classes')}><GraduationCap />Go to classes</Button>} className="min-h-112" /> : <>
        <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12" aria-label="Teacher priorities"><div className="min-w-0 xl:col-span-8"><TeacherNeedsAttention items={data.needsAttention} /></div><div className="min-w-0 xl:col-span-4"><TeacherUpcoming items={data.upcoming} /></div></section>
        <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12" aria-label="Class learning signals"><div className="min-w-0 xl:col-span-8"><TeacherLearningInsights data={insights} loading={insightsLoading} error={insightsError} classes={selectedScope === 'all' ? data.scope.classes : activeClass ? [activeClass] : []} selectedClassId={insightsScope} onClassChange={changeInsightsScope} onRetry={() => void loadInsights(true)} /></div><div className="min-w-0 xl:col-span-4"><TeacherCheckIns items={data.checkIns} /></div></section>
        <TeacherClassPulse items={data.classes} />
      </>}
    </main>
  </div>;
}

function TeacherOverviewSkeleton() {
  return <div className="h-full overflow-y-auto bg-background"><main className="mx-auto w-full max-w-screen-2xl space-y-4 p-4 md:p-6"><header className="flex items-start justify-between gap-4"><div><Skeleton className="h-9 w-72 max-w-full" /><Skeleton className="mt-2 h-5 w-112 max-w-full" /></div><Skeleton className="h-9 w-56" /></header><div className="grid gap-4 xl:grid-cols-12"><Card className="h-96 p-4 xl:col-span-8"><Skeleton className="h-full w-full" /></Card><Card className="h-96 p-4 xl:col-span-4"><Skeleton className="h-full w-full" /></Card></div><Card className="h-80 p-4"><Skeleton className="h-full w-full" /></Card><div className="grid gap-4 xl:grid-cols-12"><Card className="h-96 p-4 xl:col-span-8"><Skeleton className="h-full w-full" /></Card><Card className="h-96 p-4 xl:col-span-4"><Skeleton className="h-full w-full" /></Card></div></main></div>;
}
