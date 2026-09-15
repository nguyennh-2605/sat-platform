import { useState } from 'react';
import { Clock3, LoaderCircle, Pause, Play, RotateCcw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { appToast } from '@/components/ui/toast';
import { useFocusTimer } from './focus-timer-context';
import type { StudyActivityType } from './focus-timer.types';

const activityLabels: Record<StudyActivityType, string> = {
  PRACTICE: 'SAT practice',
  VOCABULARY: 'Vocabulary',
  ERROR_LOG: 'Error Log',
  HOMEWORK: 'Homework',
  OTHER: 'Other study',
};

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export function FocusClock() {
  const { session, remainingMs, elapsedMs, loading, pendingAction, error, suggestion, start, pause, resume, finish, cancel } = useFocusTimer();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(25);
  const [activityType, setActivityType] = useState<StudyActivityType>(suggestion.activityType);

  const busy = Boolean(pendingAction);
  const startSession = async () => {
    const safeMinutes = Math.min(240, Math.max(5, Math.round(Number(minutes) || 25)));
    setMinutes(safeMinutes);
    const matchesSuggestion = activityType === suggestion.activityType;
    const started = await start({
      plannedDurationMs: safeMinutes * 60 * 1000,
      activityType,
      label: matchesSuggestion ? suggestion.label : activityLabels[activityType],
      ...(matchesSuggestion && suggestion.resourceType && suggestion.resourceId
        ? { resourceType: suggestion.resourceType, resourceId: suggestion.resourceId }
        : {}),
    });
    if (started) appToast.success('Focus session started.');
  };

  const finishSession = async () => {
    if (await finish()) {
      appToast.success('Focus session saved.');
      setOpen(false);
    }
  };

  const cancelSession = async () => {
    if (await cancel()) {
      appToast.success('Focus session cancelled.');
      setOpen(false);
    }
  };

  const display = session ? formatDuration(remainingMs) : `${minutes}:00`;
  const progress = session ? Math.min(100, (elapsedMs / session.plannedDurationMs) * 100) : 0;

  return (
    <Popover open={open} onOpenChange={nextOpen => {
      if (nextOpen && !session) setActivityType(suggestion.activityType);
      setOpen(nextOpen);
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-w-20 gap-1.5 font-mono tabular-nums sm:min-w-30"
          aria-label={session ? `Focus timer: ${display} remaining, ${session.status.toLowerCase()}` : 'Open focus timer'}
        >
          {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : session?.status === 'RUNNING' ? <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
          <span>{display}</span>
          <span className="hidden font-sans sm:inline">{session?.status === 'PAUSED' ? 'Paused' : 'Focus'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="grid gap-4">
          <div>
            <p className="text-sm font-semibold">Focus clock</p>
            <p className="mt-0.5 text-xs text-muted-foreground">One study session, synchronized across your tabs.</p>
          </div>

          {session ? (
            <>
              <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{session.label || activityLabels[session.activityType]}</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums" role="timer" aria-live="off">{formatDuration(remainingMs)}</p>
                  </div>
                  <span className="rounded-full bg-background px-2 py-1 text-xs font-medium capitalize ring-1 ring-border">{session.status.toLowerCase()}</span>
                </div>
                <Progress value={progress} aria-label={`${Math.round(progress)} percent complete`} />
              </div>
              <div className="flex flex-wrap gap-2">
                {session.status === 'RUNNING' ? (
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => void pause()}><Pause aria-hidden="true" />Pause</Button>
                ) : (
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => void resume()}><Play aria-hidden="true" />Resume</Button>
                )}
                <Button size="sm" disabled={busy} onClick={() => void finishSession()}><Square aria-hidden="true" />Finish</Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void cancelSession()}><RotateCcw aria-hidden="true" />Cancel</Button>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <span className="text-xs font-medium">Duration</span>
                <div className="grid grid-cols-3 gap-2">
                  {[25, 50].map(value => <Button key={value} type="button" variant={minutes === value ? 'secondary' : 'outline'} size="sm" onClick={() => setMinutes(value)}>{value} min</Button>)}
                  <label className="relative">
                    <span className="sr-only">Custom duration in minutes</span>
                    <Input type="number" min={5} max={240} value={minutes} onChange={event => setMinutes(Number(event.target.value))} className="pr-8" />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">min</span>
                  </label>
                </div>
              </div>
              <label className="grid gap-2 text-xs font-medium">
                Working on
                <Select value={activityType} onValueChange={value => setActivityType(value as StudyActivityType)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(activityLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <Button disabled={busy || loading} onClick={() => void startSession()}>
                {pendingAction === 'start' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
                Start focus session
              </Button>
            </>
          )}

          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
