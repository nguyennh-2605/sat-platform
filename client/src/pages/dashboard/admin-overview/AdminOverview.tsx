import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, PageHeader } from '@/components/ui/AppUI';
import { cachedGet } from '@/lib/queryCache';
import { OverviewKpis } from './OverviewKpis';
import { PlatformActivity } from './PlatformActivity';
import { NeedsAttention } from './NeedsAttention';
import { OverviewSnapshots } from './OverviewSnapshots';
import { RecentActivity } from './RecentActivity';
import type { AdminActivityResponse, AdminOverviewResponse, AdminRecentActivityResponse, OverviewRange } from './admin-overview.types';

const overviewRanges = new Set<OverviewRange>(['7d', '30d', '90d']);
const normalizeRange = (value: string | null): OverviewRange => overviewRanges.has(value as OverviewRange) ? value as OverviewRange : '30d';

export default function AdminOverview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = normalizeRange(searchParams.get('range'));
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [activity, setActivity] = useState<AdminActivityResponse | null>(null);
  const [recentActivity, setRecentActivity] = useState<AdminRecentActivityResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [recentActivityLoading, setRecentActivityLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(false);
  const [activityError, setActivityError] = useState(false);
  const [recentActivityError, setRecentActivityError] = useState(false);

  const loadOverview = useCallback(async (force = false) => {
    setOverviewLoading(true);
    setOverviewError(false);
    try {
      const data = await cachedGet<AdminOverviewResponse>(`/api/admin/overview?range=${range}`, { ttlMs: 30_000, force });
      setOverview(data);
    } catch (error) {
      console.error('Unable to load the admin overview:', error);
      setOverviewError(true);
    } finally {
      setOverviewLoading(false);
    }
  }, [range]);

  const loadRecentActivity = useCallback(async (force = false) => {
    setRecentActivityLoading(true);
    setRecentActivityError(false);
    try {
      const data = await cachedGet<AdminRecentActivityResponse>('/api/admin/audit-events?limit=8', { ttlMs: 30_000, force });
      setRecentActivity(data);
    } catch (error) {
      console.error('Unable to load recent activity:', error);
      setRecentActivityError(true);
    } finally {
      setRecentActivityLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async (force = false) => {
    setActivityLoading(true);
    setActivityError(false);
    try {
      const data = await cachedGet<AdminActivityResponse>(`/api/admin/overview/activity?range=${range}`, { ttlMs: 30_000, force });
      setActivity(data);
    } catch (error) {
      console.error('Unable to load platform activity:', error);
      setActivityError(true);
    } finally {
      setActivityLoading(false);
    }
  }, [range]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => { void loadActivity(); }, [loadActivity]);
  useEffect(() => { void loadRecentActivity(); }, [loadRecentActivity]);

  const changeRange = (nextRange: OverviewRange) => {
    const next = new URLSearchParams(searchParams);
    next.set('range', nextRange);
    setSearchParams(next, { replace: true });
  };

  const refresh = () => {
    void loadOverview(true);
    void loadActivity(true);
    void loadRecentActivity(true);
  };

  const refreshing = overviewLoading || activityLoading || recentActivityLoading;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:gap-6 md:p-6">
        <PageHeader
          title="Overview"
          description="Monitor platform activity, content integrity, and classroom reach."
          actions={<div className="flex items-center gap-2">
            <Select value={range} onValueChange={value => changeRange(value as OverviewRange)}>
              <SelectTrigger className="min-w-32" aria-label="Overview range"><SelectValue /></SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" disabled={refreshing} onClick={refresh} aria-label="Refresh overview">
              <RefreshCw className={refreshing ? 'animate-spin' : ''} />
            </Button>
          </div>}
        />

        {overviewError && !overview ? (
          <EmptyState
            icon={<RefreshCw size={22} />}
            title="Admin Overview is unavailable"
            description="The platform summary could not be loaded. Check the server connection and try again."
            action={<Button variant="outline" onClick={() => void loadOverview(true)}><RefreshCw />Try again</Button>}
            className="min-h-96"
          />
        ) : (
          <>
            <OverviewKpis data={overview} range={range} loading={overviewLoading} />
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-12" aria-label="Activity and attention">
              <div className="xl:col-span-8">
                <PlatformActivity data={activity} loading={activityLoading} error={activityError} onRetry={() => void loadActivity(true)} />
              </div>
              <div className="order-first xl:order-none xl:col-span-4">
                <NeedsAttention items={overview?.attention || []} loading={overviewLoading} error={overviewError} onRetry={() => void loadOverview(true)} />
              </div>
            </section>
            <RecentActivity data={recentActivity} loading={recentActivityLoading} error={recentActivityError} onRetry={() => void loadRecentActivity(true)} />
            <OverviewSnapshots data={overview} loading={overviewLoading} range={range} />
          </>
        )}
      </main>
    </div>
  );
}
