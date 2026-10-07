import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, Clock3, MoreHorizontal, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import axiosClient from '@/lib/axios';
import { formatNextReview, vocabularyError, type DailySession, type PracticeFocus, type PracticeOverview } from './practice.types';

export function PracticePanel({ onStart }: { onStart: (session: DailySession) => void }) {
  const [overview, setOverview] = useState<PracticeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const inFlight = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setOverview(await axiosClient.get<PracticeOverview>(`/api/vocabulary/practice?timezone=${encodeURIComponent(timezone)}`, { signal: controller.signal }));
        setError('');
      } catch (failure) { if (!controller.signal.aborted) setError(vocabularyError(failure, 'Unable to load your review schedule.')); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void refresh();
    const changed = () => { void refresh(); };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(visible, 60000);
    window.addEventListener('vocabulary:changed', changed);
    document.addEventListener('visibilitychange', visible);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('vocabulary:changed', changed); document.removeEventListener('visibilitychange', visible); };
  }, [revision]);
  const start = async (focus: PracticeFocus) => {
    if (inFlight.current) return;
    inFlight.current = true; setStarting(true); setError('');
    try { onStart(await axiosClient.post<DailySession>('/api/vocabulary/practice/sessions', { focus }, { timeout: 15000 })); }
    catch (failure) { setError(vocabularyError(failure, 'Unable to start practice. Please try again.')); }
    finally { inFlight.current = false; setStarting(false); }
  };
  const available = Boolean(overview && (overview.activeSession || overview.dueCount || overview.newCount));
  return <Card className="@container relative mt-6 gap-0 overflow-hidden bg-linear-to-br from-muted/70 via-card to-card p-0">
    <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-48 size-96 rounded-full border-[40px] border-foreground/[0.035]" />
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-64 right-8 size-96 rounded-full border-[40px] border-foreground/[0.025]" />
    <CardContent className="relative p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-semibold"><RotateCcw className="size-4" />Today's practice</p><Badge variant="outline" className="bg-card/70 font-normal text-muted-foreground">Spaced repetition</Badge></div>
      {loading && !overview ? <div className="mt-4 space-y-4" aria-label="Loading practice"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-20 w-full" /></div> : overview && <>
        <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{overview.activeSession ? 'Pick up where you left off.' : overview.dueCount ? 'Keep familiar words fresh.' : overview.newCount ? 'Make room for a few new words.' : 'You’re caught up.'}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{available ? `A short session: up to ${overview.dailyReviewLimit} due words and ${overview.dailyNewLimit} new ones, with your next reviews planned for you.` : overview.nextDueAt ? `Your next review is ${formatNextReview(overview.nextDueAt)}. Practise a collection below while you wait.` : 'Explore a collection below to start learning.'}</p>
        <div className="mt-5 grid items-center gap-4 @[640px]:grid-cols-[minmax(0,1fr)_14rem] @[640px]:gap-6">
          <dl className="grid grid-cols-3 divide-x rounded-lg border bg-card/70 py-3">
            {[{ label: 'Due now', value: overview.dueCount, icon: Clock3 }, { label: 'New words', value: overview.newCount, icon: BookOpen }, { label: 'Practised today', value: overview.studiedToday, icon: Check }].map(({ label, value, icon: Icon }) => <div key={label} className="flex min-w-0 flex-col px-3 @[480px]:px-4"><dt className="flex min-h-8 items-start gap-1.5 text-xs text-muted-foreground"><Icon className="mt-0.5 hidden size-3.5 shrink-0 @[480px]:block" /><span>{label}</span></dt><dd className="mt-auto pt-1 text-2xl font-semibold leading-none tabular-nums">{value.toLocaleString()}</dd></div>)}
          </dl>
          <div className="space-y-2"><div className="flex items-center gap-1"><Button className="min-h-10 flex-1" disabled={!available || starting} onClick={() => void start('MIXED')}>{starting ? 'Opening practice…' : overview.activeSession ? 'Resume practice' : 'Start daily practice'}<ArrowRight /></Button>{!overview.activeSession && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={starting || !available} aria-label="Practice options"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Practice options</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem disabled={!overview.dueCount} onSelect={() => void start('REVIEW')}><Clock3 />Review due words only</DropdownMenuItem><DropdownMenuItem disabled={!overview.newCount} onSelect={() => void start('NEW')}><BookOpen />Learn new words only</DropdownMenuItem></DropdownMenuContent></DropdownMenu> }</div><p className="text-xs leading-5 text-muted-foreground">{overview.activeSession ? `${overview.activeSession.answeredCount} of ${overview.activeSession.totalItems} words completed. Your progress is saved.` : available ? 'Your pace. Your progress, saved.' : 'More practice is available in your collections.'}</p></div>
        </div>
      </>}
      {error && <div role="alert" className="mt-4 flex flex-wrap items-center gap-2 text-sm text-danger"><span>{error}</span><Button variant="outline" size="sm" onClick={() => setRevision(value => value + 1)}>Retry</Button></div>}
    </CardContent>
  </Card>;
}
