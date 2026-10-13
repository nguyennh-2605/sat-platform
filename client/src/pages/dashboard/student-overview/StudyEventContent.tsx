import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { studyEventTime, studyEventTitle } from './task-planning';
import type { StudentTaskItem } from './student-overview.types';

export function StudyEventCompletionLine({ completed }: { completed: boolean }) {
  return completed ? <span aria-hidden="true" data-event-completion-line className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px bg-foreground/50" /> : null;
}

export function StudyEventContent({ task, timed = false, hideTime = false, inline = false, showCompletion = true }: { task: StudentTaskItem; timed?: boolean; hideTime?: boolean; inline?: boolean; showCompletion?: boolean }) {
  return <>
    {showCompletion && <StudyEventCompletionLine completed={task.completed} />}
    <span className={cn('flex min-w-0 items-start gap-1 text-foreground', inline ? 'flex-1' : 'w-full')} data-event-title>
      {showCompletion && task.completed && <Check className="size-3 shrink-0" />}
      <span className={cn('min-w-0 font-semibold', timed ? 'line-clamp-2' : 'truncate')}>{studyEventTitle(task.title)}</span>
    </span>
    {!hideTime && <span data-event-time className={cn('font-normal text-subtle', inline ? 'shrink-0 whitespace-nowrap text-right tabular-nums' : 'w-full truncate text-left')}>{studyEventTime(task)}</span>}
  </>;
}
