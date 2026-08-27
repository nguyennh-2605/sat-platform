import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ArrowUpRight, FileText, GraduationCap, RefreshCw, Send, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableShell } from '@/components/ui/AppUI';
import type { AdminRecentActivityResponse, AuditCategory } from './admin-overview.types';

const categoryDetails: Record<AuditCategory, { label: string; icon: typeof FileText }> = {
  ACCOUNT: { label: 'Account', icon: UserPlus },
  CONTENT: { label: 'Content', icon: FileText },
  CLASSROOM: { label: 'Classroom', icon: GraduationCap },
  DELIVERY: { label: 'Delivery', icon: Send },
};

const roleLabel = (role: AdminRecentActivityResponse['items'][number]['actor']['role']) => role
  ? role.charAt(0) + role.slice(1).toLowerCase()
  : 'System';

function ActivityRows({ items }: { items: AdminRecentActivityResponse['items'] }) {
  return items.map(item => {
    const details = categoryDetails[item.category] || categoryDetails.CONTENT;
    const Icon = details.icon;
    const createdAt = parseISO(item.createdAt);
    const absoluteTime = format(createdAt, "MMM d, yyyy 'at' h:mm a");

    return (
      <TableRow key={item.id}>
        <TableCell className="p-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-control border border-ui-border bg-muted text-muted-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground sm:hidden">
                {item.actor.label} · {roleLabel(item.actor.role)}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell className="hidden p-3 md:table-cell">
          <Badge variant="outline" className="font-normal text-muted-foreground">{details.label}</Badge>
        </TableCell>
        <TableCell className="hidden p-3 sm:table-cell">
          <div className="grid gap-0.5">
            <span className="max-w-44 truncate text-sm text-foreground">{item.actor.label}</span>
            <span className="text-xs text-muted-foreground">{roleLabel(item.actor.role)}</span>
          </div>
        </TableCell>
        <TableCell className="p-3 text-right" title={absoluteTime}>
          <div className="grid gap-0.5">
            <span className="text-sm text-foreground">{formatDistanceToNowStrict(createdAt, { addSuffix: true })}</span>
            <span className="hidden text-xs text-muted-foreground lg:block">{format(createdAt, 'MMM d, h:mm a')}</span>
          </div>
        </TableCell>
        <TableCell className="w-12 p-2 text-right">
          {item.href ? (
            <Button asChild variant="ghost" size="icon" className="size-8">
              <Link to={item.href} aria-label={`Open activity: ${item.detail}`}><ArrowUpRight /></Link>
            </Button>
          ) : null}
        </TableCell>
      </TableRow>
    );
  });
}

export function RecentActivity({ data, loading, error, onRetry }: {
  data: AdminRecentActivityResponse | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Important account, content, classroom, and delivery changes.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" disabled={loading} onClick={onRetry}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <TableShell className="rounded-none border-x-0 shadow-none">
          <Table className="min-w-[520px]">
            <TableHeader className="bg-muted/15">
              <TableRow>
                <TableHead className="h-11 p-3">Activity</TableHead>
                <TableHead className="hidden h-11 p-3 md:table-cell">Category</TableHead>
                <TableHead className="hidden h-11 p-3 sm:table-cell">Actor</TableHead>
                <TableHead className="h-11 p-3 text-right">Time</TableHead>
                <TableHead className="w-12"><span className="sr-only">Open</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [1, 2, 3, 4, 5].map(row => (
                <TableRow key={row}>
                  <TableCell className="p-3"><div className="flex items-center gap-3"><Skeleton className="size-8 shrink-0" /><div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-52" /></div></div></TableCell>
                  <TableCell className="hidden p-3 md:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell className="hidden p-3 sm:table-cell"><Skeleton className="h-8 w-28" /></TableCell>
                  <TableCell className="p-3"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                  <TableCell className="p-2" />
                </TableRow>
              )) : error ? (
                <TableRow><TableCell colSpan={5} className="h-40 text-center"><div className="flex flex-col items-center gap-3"><RefreshCw className="size-8 text-muted-foreground" /><div><p className="font-medium text-foreground">Recent activity could not be loaded</p><p className="mt-1 text-sm text-muted-foreground">The rest of the overview is still available.</p></div><Button variant="outline" size="sm" onClick={onRetry}><RefreshCw />Try again</Button></div></TableCell></TableRow>
              ) : !data?.items.length ? (
                <TableRow><TableCell colSpan={5} className="h-40 text-center"><div className="flex flex-col items-center"><span className="mb-3 flex size-10 items-center justify-center rounded-control border border-ui-border bg-muted text-muted-foreground"><FileText className="size-5" /></span><p className="font-medium text-foreground">No activity recorded yet</p><p className="mt-1 text-sm text-muted-foreground">Important platform changes will appear here.</p></div></TableCell></TableRow>
              ) : <ActivityRows items={data.items} />}
            </TableBody>
          </Table>
        </TableShell>
      </CardContent>
    </Card>
  );
}
