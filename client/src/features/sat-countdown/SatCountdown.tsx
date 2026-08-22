import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import { Button, Modal } from '../../components/ui/AppUI';
import { DateTimePicker } from '../../components/ui/DateTimePicker';

type SatDateOption = {
  date: string;
  anticipated?: boolean;
};

// College Board SAT Weekend dates. Dates from Aug 2027 onward are anticipated.
const SAT_DATES: SatDateOption[] = [
  { date: '2026-09-12' },
  { date: '2026-10-03' },
  { date: '2026-11-07' },
  { date: '2026-12-05' },
  { date: '2027-03-06' },
  { date: '2027-05-01' },
  { date: '2027-06-05' },
  { date: '2027-08-28', anticipated: true },
  { date: '2027-09-18', anticipated: true },
  { date: '2027-10-02', anticipated: true },
  { date: '2027-11-06', anticipated: true },
  { date: '2027-12-04', anticipated: true },
  { date: '2028-03-04', anticipated: true },
  { date: '2028-05-06', anticipated: true },
  { date: '2028-06-03', anticipated: true },
];

const atTestTime = (date: string) => new Date(`${date}T07:45:00`);
const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const upcomingDates = () => SAT_DATES.filter(option => atTestTime(option.date).getTime() > Date.now()).slice(0, 10);
const nearestOfficialDate = () => atTestTime(upcomingDates()[0]?.date || SAT_DATES[SAT_DATES.length - 1].date);

const countdown = (target: Date, now: number) => {
  const remainingMinutes = Math.max(0, Math.floor((target.getTime() - now) / 60_000));
  const days = Math.floor(remainingMinutes / 1_440);
  const hours = Math.floor((remainingMinutes % 1_440) / 60);
  const minutes = remainingMinutes % 60;
  return { days, hours, minutes };
};

const formatDate = (date: Date) => date.toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function SatCountdown() {
  const role = localStorage.getItem('userRole') || 'STUDENT';
  const defaultDate = useMemo(nearestOfficialDate, []);
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [draftDate, setDraftDate] = useState(toDateInput(defaultDate));
  const [customDate, setCustomDate] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (role !== 'STUDENT') return;
    let active = true;
    axiosClient.get<{ satTestDate: string | null }, { satTestDate: string | null }>('/api/user-preferences/sat-test-date')
      .then(response => {
        if (!active || !response.satTestDate) return;
        const storedDate = new Date(response.satTestDate);
        if (storedDate.getTime() > Date.now()) {
          setSelectedDate(storedDate);
          setDraftDate(toDateInput(storedDate));
        }
      })
      .catch(error => console.error('Unable to load SAT test date.', error));
    return () => { active = false; };
  }, [role]);

  useEffect(() => {
    if (role !== 'STUDENT') return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, [role]);

  if (role !== 'STUDENT') return null;

  const effectiveDate = selectedDate.getTime() > now ? selectedDate : nearestOfficialDate();
  const time = countdown(effectiveDate, now);
  const options = upcomingDates();

  const openEditor = () => {
    setDraftDate(toDateInput(effectiveDate));
    setCustomDate('');
    setOpen(true);
  };

  const save = async () => {
    const target = atTestTime(customDate || draftDate);
    if (Number.isNaN(target.getTime()) || target.getTime() <= Date.now()) {
      toast.error('Choose a future SAT test date.');
      return;
    }
    setSaving(true);
    try {
      const response = await axiosClient.put<{ satTestDate: string }, { satTestDate: string }>('/api/user-preferences/sat-test-date', {
        satTestDate: target.toISOString(),
      });
      setSelectedDate(new Date(response.satTestDate));
      setOpen(false);
      toast.success('SAT countdown updated.');
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message || 'Unable to update SAT countdown.');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <button
      type="button"
      onClick={openEditor}
      className="group flex h-11 items-center gap-2.5 rounded-lg border border-[#C9D8D2] bg-[#F8FBF9] px-3 text-left transition-colors hover:border-[#8FB9A9] hover:bg-[#E8F5EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A5A]/25"
      aria-label={`Next SAT in ${time.days} days, ${time.hours} hours, and ${time.minutes} minutes. Change test date.`}
    >
      <CalendarDays size={17} className="shrink-0 text-[#1B7A5A]" aria-hidden="true" />
      <span>
        <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-[#5E6B66]">Next SAT</span>
        <span className="mt-0.5 flex items-baseline gap-1 font-semibold tabular-nums text-[#1A1A1A]">
          <span>{time.days}<small className="ml-0.5 text-[9px] font-medium text-[#6B7280]">d</small></span>
          <span className="text-[#8AA299]">:</span>
          <span>{String(time.hours).padStart(2, '0')}<small className="ml-0.5 text-[9px] font-medium text-[#6B7280]">h</small></span>
          <span className="text-[#8AA299]">:</span>
          <span>{String(time.minutes).padStart(2, '0')}<small className="ml-0.5 text-[9px] font-medium text-[#6B7280]">m</small></span>
        </span>
      </span>
    </button>

    <Modal
      open={open}
      onClose={() => setOpen(false)}
      closeOnBackdrop
      presentation="content-dialog"
      title="Choose your SAT date"
      subtitle={`Current countdown: ${formatDate(effectiveDate)}`}
      className="!max-w-2xl"
      footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Save date'}</Button></>}
    >
      <div className="max-h-[min(620px,70vh)] overflow-y-auto pr-1">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#4B5563]">Upcoming SAT weekends</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map(option => {
            const date = atTestTime(option.date);
            const selected = !customDate && draftDate === option.date;
            return <button
              key={option.date}
              type="button"
              onClick={() => { setDraftDate(option.date); setCustomDate(''); }}
              className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${selected ? 'border-[#1B7A5A] bg-[#E8F5EF]' : 'border-[#C9D8D2] bg-white hover:bg-[#F2F8F5]'}`}
            >
              <span>
                <span className="block text-sm font-semibold text-[#1A1A1A]">{formatDate(date)}</span>
                <span className="mt-0.5 block text-xs text-[#6B7280]">{option.anticipated ? 'Anticipated date' : 'Confirmed date'}</span>
              </span>
              {selected && <Check size={17} className="text-[#1B7A5A]" aria-hidden="true" />}
            </button>;
          })}
        </div>

        <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-[#C9D8D2]" /><span className="text-xs font-medium text-[#6B7280]">OR</span><span className="h-px flex-1 bg-[#C9D8D2]" /></div>

        <label className="block">
          <span className="text-sm font-semibold text-[#1A1A1A]">Custom test date</span>
          <span className="mt-1 block text-xs text-[#6B7280]">Choose another upcoming date if you are taking an SAT School Day or a different administration.</span>
          <DateTimePicker
            mode="date"
            minDate={toDateInput(new Date(Date.now() + 86_400_000))}
            value={customDate}
            onChange={setCustomDate}
            placeholder="Choose a custom SAT date"
            ariaLabel="Custom SAT test date"
            className="mt-3 w-full"
          />
        </label>
        <p className="mt-4 text-xs leading-5 text-[#6B7280]">Weekend dates are based on the <a href="https://satsuite.collegeboard.org/sat/dates-deadlines" target="_blank" rel="noreferrer" className="font-medium text-[#1B7A5A] underline underline-offset-2">College Board schedule</a>. Anticipated dates may change.</p>
      </div>
    </Modal>
  </>;
}
