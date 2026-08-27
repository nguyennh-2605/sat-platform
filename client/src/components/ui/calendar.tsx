import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

// Adapted from the MIT-licensed shadcn/ui calendar used by the pinned Studio Admin reference.
export function Calendar({ className, classNames, showOutsideDays = true, ...props }: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('relative w-full p-3', className)}
      classNames={{
        months: 'flex flex-col',
        month: 'space-y-4',
        month_caption: 'relative flex h-7 items-center justify-center',
        caption_label: 'text-sm font-medium',
        nav: 'absolute inset-x-3 top-3 z-10 flex items-center justify-between',
        button_previous: cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' })),
        button_next: cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' })),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-full text-center text-[0.7rem] font-normal text-muted-foreground',
        week: 'mt-1.5 flex w-full',
        day: 'relative flex aspect-square w-full items-center justify-center p-0 text-center text-sm',
        day_button: cn(buttonVariants({ variant: 'ghost' }), 'size-8 rounded-lg p-0 font-normal aria-selected:opacity-100'),
        selected: 'rounded-lg bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
        today: 'rounded-lg bg-muted font-medium text-foreground',
        outside: 'text-muted-foreground/45 aria-selected:text-muted-foreground/60',
        disabled: 'text-muted-foreground/35 opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => orientation === 'left'
          ? <ChevronLeft className="size-4" aria-hidden="true" />
          : <ChevronRight className="size-4" aria-hidden="true" />,
      }}
      {...props}
    />
  );
}
