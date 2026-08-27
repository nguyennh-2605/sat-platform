import { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import { Button } from '../../components/ui/button';
import { SatDateDialog } from './SatDateDialog';
import { atSatTime, fallbackSatDate } from './sat-dates';

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const countdown = (target: Date, now: number) => {
  const remainingMinutes = Math.max(0, Math.floor((target.getTime() - now) / 60_000));
  const days = Math.floor(remainingMinutes / 1_440);
  const hours = Math.floor((remainingMinutes % 1_440) / 60);
  const minutes = remainingMinutes % 60;
  return { days, hours, minutes };
};

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
  const defaultDate = useMemo(fallbackSatDate, []);
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

  const effectiveDate = selectedDate.getTime() > now ? selectedDate : fallbackSatDate(now);
  const time = countdown(effectiveDate, now);
  const openEditor = () => {
    setDraftDate(toDateInput(effectiveDate));
    setCustomDate('');
    setOpen(true);
  };

  const save = async () => {
    const target = atSatTime(customDate || draftDate);
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
    <Button
      variant="outline"
      onClick={openEditor}
      className="h-9 min-w-[218px] justify-start gap-2.5 bg-card px-3 text-left shadow-xs"
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
    </Button>

    <SatDateDialog
      open={open}
      effectiveDate={effectiveDate}
      officialDate={draftDate}
      customDate={customDate}
      saving={saving}
      now={now}
      onOfficialDateChange={date => { setDraftDate(date); setCustomDate(''); }}
      onCustomDateChange={setCustomDate}
      onClose={() => !saving && setOpen(false)}
      onSave={() => void save()}
    />
  </>;
}
