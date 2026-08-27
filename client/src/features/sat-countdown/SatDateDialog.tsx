import { useId } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Check, Clock3 } from 'lucide-react';
import { Modal } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { atSatTime, upcomingSatDates } from './sat-dates';

interface SatDateDialogProps {
  open: boolean;
  effectiveDate: Date;
  officialDate: string;
  customDate: string;
  saving: boolean;
  now: number;
  onOfficialDateChange: (value: string) => void;
  onCustomDateChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function SatDateDialog({
  open,
  effectiveDate,
  officialDate,
  customDate,
  saving,
  now,
  onOfficialDateChange,
  onCustomDateChange,
  onClose,
  onSave,
}: SatDateDialogProps) {
  const options = upcomingSatDates(now);
  const upcomingDatesId = useId();
  const customDateId = useId();

  return <Modal
    open={open}
    onClose={onClose}
    closeOnBackdrop={!saving}
    presentation="content-dialog"
    title="Choose your SAT date"
    subtitle={`Your countdown is currently set for ${format(effectiveDate, 'MMMM d, yyyy')}.`}
    className="!max-w-2xl"
    footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save date'}</Button></>}
  >
    <div className="max-h-[min(36rem,65vh)] space-y-6 overflow-y-auto pr-1">
      <section className="space-y-3" aria-labelledby={upcomingDatesId}>
        <div>
          <h3 id={upcomingDatesId} className="text-sm font-medium text-foreground">Upcoming SAT weekends</h3>
          <p className="mt-1 text-xs text-muted-foreground">Select a scheduled weekend administration.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map(option => {
            const optionDate = atSatTime(option.date);
            const selected = !customDate && officialDate === option.date;
            return <Button
              key={option.date}
              type="button"
              variant="outline"
              aria-pressed={selected}
              onClick={() => onOfficialDateChange(option.date)}
              className={selected ? 'h-auto justify-between border-foreground bg-muted p-3 text-left' : 'h-auto justify-between p-3 text-left font-normal'}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{format(optionDate, 'EEEE, MMM d')}</span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">{option.anticipated ? 'Anticipated date' : 'Confirmed date'}</span>
              </span>
              {selected ? <Check className="size-4 text-foreground" aria-hidden="true" /> : <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />}
            </Button>;
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby={customDateId}>
        <div>
          <h3 id={customDateId} className="text-sm font-medium text-foreground">Custom test date</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Use another date for SAT School Day or a different administration.</p>
        </div>
        <DateTimePicker mode="date" minDate={new Date(now + 86_400_000)} value={customDate} onChange={onCustomDateChange} placeholder="Choose a custom SAT date" ariaLabel="Custom SAT test date" className="w-full" />
      </section>

      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />The countdown starts from 7:45 AM on your selected date. Anticipated dates may change.</p>
    </div>
  </Modal>;
}
