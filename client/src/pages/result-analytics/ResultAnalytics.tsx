import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/ui/AppUI';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cachedGet } from '@/lib/queryCache';
import { cn } from '@/lib/utils';
import {
  AccuracyTrend,
  AnalyticsEmpty,
  AnalyticsLoadError,
  AnalyticsLoading,
  Attempts,
  FocusAreas,
  MistakeReview,
  PacingAnalytics,
  PerformanceSnapshot,
  SkillPerformance,
} from './AnalyticsSections';
import type { AnalyticsRange, AnalyticsResponse, AnalyticsSubject } from './analytics.types';
import { StudyConsistency } from './StudyConsistency';

const sectionLinks = [
  { id: 'overview', label: 'Overview' },
  { id: 'consistency', label: 'Study' },
  { id: 'skills', label: 'Skills' },
  { id: 'mistakes', label: 'Mistakes' },
  { id: 'pacing', label: 'Pacing' },
  { id: 'attempts', label: 'Attempts' },
] as const;

const readRange = (value: string | null): AnalyticsRange => value === '30' || value === 'all' ? value : '90';
const readSubject = (value: string | null): AnalyticsSubject => value === 'RW' || value === 'MATH' ? value : 'ALL';

export default function ResultAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = readRange(searchParams.get('range'));
  const subject = readSubject(searchParams.get('subject'));
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ key: string; data: AnalyticsResponse | null; error: boolean }>({ key: '', data: null, error: false });
  const [activeSection, setActiveSection] = useState<(typeof sectionLinks)[number]['id']>('overview');
  const [focusedDomain, setFocusedDomain] = useState<string | null>(null);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ range, subject });
    return `/api/results-analytics?${params.toString()}`;
  }, [range, subject]);
  const requestKey = `${requestUrl}:${reload}`;
  const requestPending = result.key !== requestKey;
  const data = requestPending ? null : result.data;
  const error = !requestPending && result.error;
  const hasLearningData = Boolean(data && (data.snapshot.completedTests > 0 || data.mistakeReview.saved > 0));
  const navigationLinks = useMemo(() => data && hasLearningData
    ? sectionLinks
    : sectionLinks.filter(item => item.id === 'consistency'), [data, hasLearningData]);

  useEffect(() => {
    let active = true;
    void cachedGet<AnalyticsResponse>(requestUrl, { ttlMs: 60_000, force: reload > 0 })
      .then(response => {
        if (active) setResult({ key: requestKey, data: response, error: false });
      })
      .catch(() => {
        if (active) setResult({ key: requestKey, data: null, error: true });
      });
    return () => { active = false; };
  }, [reload, requestKey, requestUrl]);

  useEffect(() => {
    const sections = navigationLinks
      .map(item => document.getElementById(item.id))
      .filter((item): item is HTMLElement => Boolean(item));
    if (!sections.length) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)[0];
      if (visible) setActiveSection(visible.target.id as (typeof sectionLinks)[number]['id']);
    }, { rootMargin: '-120px 0px -65% 0px', threshold: [0, 0.1] });
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [navigationLinks]);

  const updateFilter = (key: 'range' | 'subject', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'range' && value === '90') next.delete('range');
    else if (key === 'subject' && value === 'ALL') next.delete('subject');
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const viewBreakdown = (domainCode: string) => {
    setFocusedDomain(domainCode);
    setActiveSection('skills');
    document.getElementById('skills')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  return <div className="h-full overflow-y-auto">
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6">
      <PageHeader title="Analytics" description="Understand your performance, weak skills, and study patterns." />

      <div className="sticky top-0 z-20 -mx-1 rounded-xl border border-ui-border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onValueChange={value => updateFilter('range', value)}>
              <SelectTrigger aria-label="Analytics time period"><SelectValue /></SelectTrigger>
              <SelectContent position="popper" align="start"><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem><SelectItem value="all">All time</SelectItem></SelectContent>
            </Select>
            <Select value={subject} onValueChange={value => updateFilter('subject', value)}>
              <SelectTrigger aria-label="Analytics subject"><SelectValue /></SelectTrigger>
              <SelectContent position="popper" align="start"><SelectItem value="ALL">All subjects</SelectItem><SelectItem value="RW">Reading & Writing</SelectItem><SelectItem value="MATH">Math</SelectItem></SelectContent>
            </Select>
          </div>
          <nav aria-label="Analytics sections" className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1">
            {navigationLinks.map(item => <a key={item.id} href={`#${item.id}`} aria-current={activeSection === item.id ? 'location' : undefined} onClick={() => setActiveSection(item.id)} className={cn('shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', activeSection === item.id && 'bg-muted text-foreground')}>{item.label}</a>)}
          </nav>
        </div>
      </div>

      {requestPending ? <AnalyticsLoading /> : error ? <AnalyticsLoadError onRetry={() => setReload(value => value + 1)} /> : !data ? null : !hasLearningData ? <AnalyticsEmpty /> : <>
        <FocusAreas items={data.focusAreas} onViewBreakdown={viewBreakdown} />
        <PerformanceSnapshot data={data.snapshot} />
      </>}

      <StudyConsistency range={range} />

      {data && hasLearningData && <>
        <AccuracyTrend data={data.accuracyTrend} />
        {data.meta.classificationCoverage.unclassified > 0 && <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /><span>{data.meta.classificationCoverage.unclassified} answered question{data.meta.classificationCoverage.unclassified === 1 ? '' : 's'} could not be included in skill rankings because classification is missing.</span></div>}
        <SkillPerformance domains={data.skillPerformance} focusedDomain={focusedDomain} />
        <MistakeReview data={data.mistakeReview} />
        <PacingAnalytics data={data.pacing} />
        <Attempts range={range} subject={subject} />
      </>}
    </main>
  </div>;
}
