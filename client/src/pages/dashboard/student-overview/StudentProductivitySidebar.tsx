import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Check, Edit3, Goal, TimerReset } from 'lucide-react';
import toast from 'react-hot-toast';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SatDateDialog } from '@/features/sat-countdown/SatDateDialog';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/AppUI';
import { Progress } from '@/components/ui/progress';
import { atSatTime, fallbackSatDate, SAT_DATE_OPTIONS } from '@/features/sat-countdown/sat-dates';
import axiosClient from '@/lib/axios';
import { invalidateQueryCache } from '@/lib/queryCache';
import type { StudentOverviewResponse, StudentTasksResponse } from './student-overview.types';

const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');

export function StudentCalendarPanel({ markers, selectedDate, onSelectDate, satDate }: {
  markers: StudentTasksResponse['calendar']; selectedDate?: Date; onSelectDate: (date?: Date) => void; satDate?: Date;
}) {
  const incompleteDates = useMemo(() => markers.filter(item => item.incomplete > 0).map(item => parseISO(item.date)), [markers]);
  const completedDates = useMemo(() => markers.filter(item => item.total > 0 && item.incomplete === 0).map(item => parseISO(item.date)), [markers]);
  return <Card size="sm">
    <CardHeader><CardTitle>Calendar</CardTitle><CardDescription>Select a day to filter your tasks.</CardDescription></CardHeader>
    <CardContent className="px-0">
      <Calendar mode="single" selected={selectedDate} onSelect={onSelectDate} fixedWeeks modifiers={{ incomplete: incompleteDates, complete: completedDates, sat: satDate ? [satDate] : [] }} modifiersClassNames={{ incomplete: 'after:absolute after:bottom-0.5 after:size-1 after:rounded-full after:bg-primary', complete: 'after:absolute after:bottom-0.5 after:size-1 after:rounded-full after:bg-emerald-500', sat: 'ring-1 ring-primary/40' }} />
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t px-4 pt-3 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary" />To do</span><span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" />Done</span>{satDate && <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm ring-1 ring-primary/50" />SAT</span>}</div>
    </CardContent>
  </Card>;
}

export function NextSatCard({ value, onSaved }: { value: string | null; onSaved: (value: string) => void }) {
  const [now] = useState(() => Date.now());
  const savedDate = value && new Date(value).getTime() > now ? new Date(value) : null;
  const effective = savedDate || fallbackSatDate(now);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(dateKey(effective));
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);
  const days = savedDate ? Math.max(0, Math.ceil((savedDate.getTime() - now) / 86_400_000)) : null;
  const openEditor = () => {
    const currentDate = dateKey(effective);
    const isOfficialDate = SAT_DATE_OPTIONS.some(option => option.date === currentDate);
    setDraft(isOfficialDate ? currentDate : dateKey(fallbackSatDate(now)));
    setCustomDate(isOfficialDate ? '' : currentDate);
    setOpen(true);
  };
  const save = async () => {
    const target = atSatTime(customDate || draft);
    if (Number.isNaN(target.getTime()) || target.getTime() <= now) return toast.error('Choose a future SAT date.');
    setSaving(true);
    try {
      const response = await axiosClient.put<{ satTestDate: string }, { satTestDate: string }>('/api/user-preferences/sat-test-date', { satTestDate: target.toISOString() });
      invalidateQueryCache('/api/student/overview');
      onSaved(response.satTestDate); setOpen(false); toast.success('SAT date updated.');
    } catch (error) { toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Unable to update SAT date.'); }
    finally { setSaving(false); }
  };
  return <>
    <Card className="h-full shadow-xs"><CardHeader><CardTitle><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="grid size-7 place-items-center rounded-lg border bg-muted"><CalendarDays className="size-4" /></span>Next SAT</div></CardTitle><CardAction>{savedDate && <Button variant="ghost" size="icon-xs" onClick={openEditor} aria-label="Change SAT date"><Edit3 /></Button>}</CardAction></CardHeader><CardContent>{savedDate ? <div className="flex items-end justify-between gap-4"><div><p className="text-2xl leading-none font-medium tabular-nums">{days}</p><p className="mt-2 text-xs text-muted-foreground">days remaining</p></div><p className="text-right text-sm font-medium">{format(savedDate, 'MMM d, yyyy')}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">7:45 AM</span></p></div> : <div><p className="text-sm text-muted-foreground">Choose your test date to start a personal countdown.</p><Button variant="outline" size="sm" className="mt-3" onClick={openEditor}><CalendarDays />Set test date</Button></div>}</CardContent></Card>
    <SatDateDialog
      open={open}
      effectiveDate={effective}
      officialDate={draft}
      customDate={customDate}
      saving={saving}
      now={now}
      hasSavedDate={Boolean(savedDate)}
      onOfficialDateChange={date => { setDraft(date); setCustomDate(''); }}
      onCustomDateChange={setCustomDate}
      onClose={() => !saving && setOpen(false)}
      onSave={() => void save()}
    />
  </>;
}

export function ScoreGoalCard({ currentScore, targetScore, onSaved }: { currentScore: number | null; targetScore: number | null; onSaved: (value: Pick<StudentOverviewResponse['preferences'], 'currentScore' | 'targetScore'>) => void }) {
  const [open, setOpen] = useState(false); const [current, setCurrent] = useState(currentScore?.toString() || ''); const [target, setTarget] = useState(targetScore?.toString() || ''); const [saving, setSaving] = useState(false);
  const progress = currentScore && targetScore && targetScore > 400 ? Math.min(100, Math.max(0, ((currentScore - 400) / (targetScore - 400)) * 100)) : 0;
  const save = async () => {
    setSaving(true);
    try {
      const response = await axiosClient.put<{ currentScore: number | null; targetScore: number | null }, { currentScore: number | null; targetScore: number | null }>('/api/user-preferences/sat-score-goal', { currentScore: current ? Number(current) : null, targetScore: target ? Number(target) : null });
      invalidateQueryCache('/api/student/overview');
      onSaved(response); setOpen(false); toast.success('Score goal updated.');
    } catch (error) { toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Unable to update score goal.'); }
    finally { setSaving(false); }
  };
  const openEditor = () => { setCurrent(currentScore?.toString() || ''); setTarget(targetScore?.toString() || ''); setOpen(true); };
  const hasScores = currentScore !== null || targetScore !== null;
  const goalReached = currentScore !== null && targetScore !== null && currentScore >= targetScore;
  return <>
    <Card className="h-full shadow-xs"><CardHeader><CardTitle><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="grid size-7 place-items-center rounded-lg border bg-muted"><Goal className="size-4" /></span>Score Goal</div></CardTitle><CardAction>{hasScores && <Button variant="ghost" size="icon-xs" onClick={openEditor} aria-label="Edit score goal"><Edit3 /></Button>}</CardAction></CardHeader><CardContent>{hasScores ? <><div className="flex items-end justify-between"><div><p className="text-xs text-muted-foreground">Current</p><p className="text-2xl leading-none font-medium tabular-nums">{currentScore ?? '—'}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Target</p><p className="text-2xl leading-none font-medium tabular-nums">{targetScore ?? '—'}</p></div></div>{currentScore !== null && targetScore !== null && <Progress value={goalReached ? 100 : progress} className="mt-3" />}<p className="mt-2 text-[11px] text-muted-foreground">{goalReached ? 'Goal reached · choose a new target when ready' : 'Self-reported SAT total score'}</p></> : <div><p className="text-sm text-muted-foreground">Add your latest score and the result you are working toward.</p><Button variant="outline" size="sm" className="mt-3" onClick={openEditor}><TimerReset />Set score goal</Button></div>}</CardContent></Card>
    <Modal open={open} onClose={() => !saving && setOpen(false)} closeOnBackdrop={!saving} presentation="content-dialog" title="Set your score goal" subtitle="Use your latest SAT score and the score you want to reach." footer={<><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save scores'}</Button></>}><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Current score<Input type="number" min={400} max={1600} step={10} value={current} onChange={event => setCurrent(event.target.value)} placeholder="e.g. 1180" /></label><label className="space-y-2 text-sm font-medium">Target score<Input type="number" min={400} max={1600} step={10} value={target} onChange={event => setTarget(event.target.value)} placeholder="e.g. 1450" /></label></div><p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Check className="mt-0.5 size-3.5 shrink-0" />Scores must be between 400 and 1600, in increments of 10.</p></Modal>
  </>;
}
