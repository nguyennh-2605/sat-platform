import { useId, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Clock3, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DateTimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'datetime';
  minDate?: string | Date;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  ariaLabel?: string;
}

const localDateValue = (date: Date) => format(date, 'yyyy-MM-dd');
const parseValue = (value: string, mode: DateTimePickerProps['mode']) => {
  if (!value) return undefined;
  const date = mode === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};
const parseMinimum = (value?: string | Date) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(0, 0, 0, 0);
  return date;
};

export function DateTimePicker({ value = '', onChange, mode = 'datetime', minDate, placeholder = mode === 'date' ? 'Choose a date' : 'Choose date and time', disabled = false, clearable = true, className, ariaLabel }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const timeInputId = useId();
  const selected = parseValue(value, mode);
  const minimum = parseMinimum(minDate);
  const displayValue = selected ? format(selected, mode === 'date' ? 'PPP' : 'PPP · HH:mm') : placeholder;

  const selectDate = (date?: Date) => {
    if (!date) return;
    if (mode === 'date') {
      onChange(localDateValue(date));
      setOpen(false);
      return;
    }
    const next = new Date(date);
    next.setHours(selected?.getHours() ?? 9, selected?.getMinutes() ?? 0, 0, 0);
    onChange(next.toISOString());
  };
  const changeTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const next = selected ? new Date(selected) : new Date();
    next.setHours(hours, minutes, 0, 0);
    onChange(next.toISOString());
  };

  return <div className={cn('flex min-w-0 items-center gap-1', className)}>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} aria-label={ariaLabel || placeholder} className={cn('min-w-0 flex-1 justify-start px-2.5 text-left font-normal', !selected && 'text-muted-foreground')}>
          <CalendarDays className="text-muted-foreground" />
          <span className="truncate">{displayValue}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="single" selected={selected} defaultMonth={selected || minimum} disabled={minimum ? { before: minimum } : undefined} onSelect={selectDate} />
        {mode === 'datetime' && <div className="flex items-center gap-2 border-t p-3">
          <Clock3 className="size-4 text-muted-foreground" />
          <label htmlFor={timeInputId} className="text-sm font-medium">Time</label>
          <Input id={timeInputId} type="time" step={300} disabled={!selected} value={selected ? format(selected, 'HH:mm') : '09:00'} onChange={event => changeTime(event.target.value)} className="ml-auto w-28" />
          <Button type="button" size="sm" onClick={() => setOpen(false)}>Done</Button>
        </div>}
      </PopoverContent>
    </Popover>
    {clearable && selected && !disabled && <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange('')} aria-label="Clear selected date"><X /></Button>}
  </div>;
}
