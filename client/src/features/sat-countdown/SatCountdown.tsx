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

const SAT_DATE_CACHE_MS = 5 * 60_000;
const satDateRequests = new Map<string, { promise: Promise<string | null>; expiresAt: number }>();

const loadSatDate = (userId: string) => {
  const cachedRequest = satDateRequests.get(userId);
  if (cachedRequest && cachedRequest.expiresAt > Date.now()) return cachedRequest.promise;

  const request = axiosClient
    .get<{ satTestDate: string | null }, { satTestDate: string | null }>('/api/user-preferences/sat-test-date')
    .then(response => response.satTestDate)
    .catch(error => {
      satDateRequests.delete(userId);
      throw error;
    });
  satDateRequests.set(userId, { promise: request, expiresAt: Date.now() + SAT_DATE_CACHE_MS });
  return request;
};

const cachedFutureDate = (storageKey: string, fallback: Date) => {
  const value = localStorage.getItem(storageKey);
  if (!value) return fallback;
  const cached = new Date(value);
  return Number.isNaN(cached.getTime()) || cached.getTime() <= Date.now() ? fallback : cached;
};

export function SatCountdown() {
  const role = localStorage.getItem('userRole') || 'STUDENT';
  const userId = localStorage.getItem('userId') || 'guest';
  const storageKey = `satTestDate:${userId}`;
  const defaultDate = useMemo(nearestOfficialDate, []);
  const initialDate = useMemo(() => cachedFutureDate(storageKey, defaultDate), [defaultDate, storageKey]);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [draftDate, setDraftDate] = useState(toDateInput(initialDate));
  const [customDate, setCustomDate] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (role !== 'STUDENT') return;
    let active = true;
    loadSatDate(userId)
      .then(satTestDate => {
        if (!active) return;
        if (!satTestDate) {
          localStorage.removeItem(storageKey);
          setSelectedDate(defaultDate);
          setDraftDate(toDateInput(defaultDate));
          return;
        }
        const storedDate = new Date(satTestDate);
        if (storedDate.getTime() > Date.now()) {
          setSelectedDate(storedDate);
          setDraftDate(toDateInput(storedDate));
          localStorage.setItem(storageKey, storedDate.toISOString());
        }
      })
      .catch(error => console.error('Unable to load SAT test date.', error));
    return () => { active = false; };
  }, [defaultDate, role, storageKey, userId]);

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
      const savedDate = new Date(response.satTestDate);
      setSelectedDate(savedDate);
      localStorage.setItem(storageKey, savedDate.toISOString());
      satDateRequests.set(userId, {
        promise: Promise.resolve(savedDate.toISOString()),
        expiresAt: Date.now() + SAT_DATE_CACHE_MS,
      });
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
      className="group flex h-9 min-w-[218px] shrink-0 items-center gap-2.5 rounded-lg border bg-card px-3 text-left shadow-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={`Next SAT in ${time.days} days, ${time.hours} hours, and ${time.minutes} minutes. Change test date.`}
    >
      <CalendarDays size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Next SAT</span>
      <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
      <span className="flex flex-1 items-baseline justify-end gap-1 text-sm font-medium leading-none tabular-nums text-foreground">
        <span>{time.days}<small className="ml-0.5 text-[10px] font-normal text-muted-foreground">d</small></span>
        <span className="text-xs text-muted-foreground">:</span>
        <span>{String(time.hours).padStart(2, '0')}<small className="ml-0.5 text-[10px] font-normal text-muted-foreground">h</small></span>
        <span className="text-xs text-muted-foreground">:</span>
        <span>{String(time.minutes).padStart(2, '0')}<small className="ml-0.5 text-[10px] font-normal text-muted-foreground">m</small></span>
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
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Upcoming SAT weekends</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map(option => {
            const date = atTestTime(option.date);
            const selected = !customDate && draftDate === option.date;
            return <button
              key={option.date}
              type="button"
              onClick={() => { setDraftDate(option.date); setCustomDate(''); }}
              className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${selected ? 'border-primary bg-muted' : 'border-border bg-card hover:bg-muted/45'}`}
            >
              <span>
                <span className="block text-sm font-semibold text-foreground">{formatDate(date)}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{option.anticipated ? 'Anticipated date' : 'Confirmed date'}</span>
              </span>
              {selected && <Check size={17} className="text-primary" aria-hidden="true" />}
            </button>;
          })}
        </div>

        <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-border" /><span className="text-xs font-medium text-muted-foreground">OR</span><span className="h-px flex-1 bg-border" /></div>

        <label className="block">
          <span className="text-sm font-semibold text-foreground">Custom test date</span>
          <span className="mt-1 block text-xs text-muted-foreground">Choose another upcoming date if you are taking an SAT School Day or a different administration.</span>
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
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Weekend dates are based on the <a href="https://satsuite.collegeboard.org/sat/dates-deadlines" target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-2">College Board schedule</a>. Anticipated dates may change.</p>
      </div>
    </Modal>
  </>;
}
