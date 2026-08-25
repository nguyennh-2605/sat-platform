import { CalendarDays, X } from 'lucide-react';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/flatpickr.css';
import './date-time-picker.css';

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

const localDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const pickerValue = (value: string, mode: DateTimePickerProps['mode']) => {
  if (!value) return undefined;
  const parsed = mode === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export function DateTimePicker({
  value = '',
  onChange,
  mode = 'datetime',
  minDate,
  placeholder = mode === 'date' ? 'Choose a date' : 'Choose date and time',
  disabled = false,
  clearable = true,
  className = '',
  ariaLabel,
}: DateTimePickerProps) {
  const enableTime = mode === 'datetime';

  return <div className={`app-date-time-picker relative min-w-0 ${className}`}>
    <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-primary" aria-hidden="true" />
    <Flatpickr
      value={pickerValue(value, mode)}
      onChange={dates => {
        const date = dates[0];
        if (!date) return onChange('');
        onChange(enableTime ? date.toISOString() : localDateValue(date));
      }}
      options={{
        enableTime,
        time_24hr: true,
        minuteIncrement: 5,
        dateFormat: enableTime ? 'M j, Y · H:i' : 'M j, Y',
        minDate,
        disableMobile: true,
        allowInput: false,
        onReady: (_dates, _dateString, instance) => instance.calendarContainer.classList.add('sat-calendar'),
      }}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      className="h-10 w-full cursor-pointer rounded-control border border-ui-border-strong bg-surface py-2 pl-10 pr-10 text-body font-medium text-foreground outline-hidden transition-colors placeholder:font-normal placeholder:text-muted-foreground hover:border-primary/55 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
    />
    {clearable && value && !disabled && <button
      type="button"
      onClick={() => onChange('')}
      aria-label="Clear selected date"
      className="absolute right-1 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary-hover"
    >
      <X size={14} aria-hidden="true" />
    </button>}
  </div>;
}
