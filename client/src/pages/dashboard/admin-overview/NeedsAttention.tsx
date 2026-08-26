import { ArrowRight, CircleCheck, CircleAlert, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminOverviewResponse } from './admin-overview.types';

export function NeedsAttention({ items, loading, error, onRetry }: {
  items: AdminOverviewResponse['attention'];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Needs Attention</CardTitle>
        <CardDescription>Actionable test integrity issues.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-72 flex-col">
        {loading ? <div className="space-y-3">{[1, 2, 3].map(item => <Skeleton key={item} className="h-16 w-full" />)}</div>
          : error ? <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center"><CircleAlert className="size-8 text-muted-foreground" /><div><p className="font-medium">Attention checks are unavailable</p><p className="mt-1 text-sm text-muted-foreground">Retry the overview request.</p></div><Button variant="outline" size="sm" onClick={onRetry}><RefreshCw />Retry</Button></div>
            : items.length === 0 ? <div className="flex flex-1 flex-col items-center justify-center text-center"><span className="mb-3 flex size-10 items-center justify-center rounded-full border border-success/30 bg-success-soft text-success"><CircleCheck className="size-5" /></span><p className="font-medium">Everything looks good</p><p className="mt-1 max-w-56 text-sm text-muted-foreground">No published system tests require attention.</p></div>
              : <div className="space-y-2">{items.map(item => <Link key={item.code} to={item.href} className="group flex items-center gap-3 rounded-control border border-ui-border p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><span className={item.severity === 'critical' ? 'flex size-8 shrink-0 items-center justify-center rounded-control bg-danger-soft text-danger' : 'flex size-8 shrink-0 items-center justify-center rounded-control bg-warning-soft text-warning'}><CircleAlert className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground">{item.count.toLocaleString('en-US')} {item.title.toLowerCase()}</span><span className="mt-0.5 block text-xs text-muted-foreground">Review affected system tests</span></span><ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link>)}</div>}
      </CardContent>
    </Card>
  );
}
