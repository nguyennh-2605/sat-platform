import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Paperclip, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/ui/AppUI';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataSurface, DataToolbar } from '@/components/ui/data-surface';
import { LoadingSpinner } from '@/components/ui/loading';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import axiosClient from '@/lib/axios';
import { feedbackError, feedbackLevels, feedbackStatuses, type FeedbackLevel, type FeedbackPage, type FeedbackReport, type FeedbackStatus } from '@/features/feedback/feedback.types';
import { FeedbackDetails } from './FeedbackDetails';

export default function FeedbackInbox() {
  const [status, setStatus] = useState<FeedbackStatus | 'ALL'>('NEW');
  const [level, setLevel] = useState<FeedbackLevel | 'ALL'>('ALL');
  const [data, setData] = useState<FeedbackPage>({ items: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<FeedbackReport | null>(null);
  const generation = useRef(0);
  const load = useCallback(async (cursor?: string) => {
    const current = ++generation.current;
    setLoading(true); setError('');
    if (!cursor) setData({ items: [], nextCursor: null });
    try {
      const result = await axiosClient.get<FeedbackPage>('/api/admin/feedback', { params: { status, level, cursor } });
      if (current !== generation.current) return;
      setData(previous => ({ items: cursor ? [...previous.items, ...result.items].filter((item, index, items) => items.findIndex(row => row.id === item.id) === index) : result.items, nextCursor: result.nextCursor }));
    } catch (failure) { if (current === generation.current) setError(feedbackError(failure, 'Unable to load feedback.')); }
    finally { if (current === generation.current) setLoading(false); }
  }, [status, level]);
  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);

  return <div className="h-full overflow-y-auto bg-background">
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <header><h1 className="text-3xl font-semibold tracking-tight">Feedback inbox</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Review reports and suggestions from platform users. Newest feedback appears first.</p></header>
      <DataSurface aria-label="User feedback">
        <DataToolbar className="flex-row flex-wrap justify-between">
          <div className="flex flex-wrap gap-2">
            <Select value={status} disabled={loading} onValueChange={value => setStatus(value as FeedbackStatus | 'ALL')}><SelectTrigger aria-label="Feedback status" className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem>{Object.entries(feedbackStatuses).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Select value={level} disabled={loading} onValueChange={value => setLevel(value as FeedbackLevel | 'ALL')}><SelectTrigger aria-label="Feedback level" className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All levels</SelectItem>{Object.entries(feedbackLevels).map(([value, details]) => <SelectItem key={value} value={value}>{details.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <Button variant="outline" disabled={loading} onClick={() => void load()}>{loading ? <LoadingSpinner /> : <RefreshCw aria-hidden="true" />}Refresh</Button>
        </DataToolbar>
        {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><p className="text-sm text-danger">{error}</p><Button variant="outline" disabled={loading} onClick={() => void load()}>Try again</Button></div>}
        {loading && !data.items.length ? <div aria-label="Loading feedback" className="space-y-3 p-4">{[0, 1, 2].map(index => <Skeleton key={index} className="h-24 w-full" />)}</div> : !error && !data.items.length ? <EmptyState icon={<MessageSquare />} title="No feedback found" description="Reports matching these filters will appear here when users send feedback." className="min-h-64" /> : data.items.length > 0 && <Table className="table-fixed">
          <TableHeader><TableRow><TableHead>Feedback</TableHead><TableHead className="hidden w-40 md:table-cell">Submitted</TableHead><TableHead className="w-24 text-right">Details</TableHead></TableRow></TableHeader>
          <TableBody>{data.items.map(report => <TableRow key={report.id}>
            <TableCell className="whitespace-normal align-top"><div className="mb-2 flex flex-wrap gap-2"><Badge variant={report.level === 'CRITICAL' ? 'destructive' : 'outline'}>{feedbackLevels[report.level].label}</Badge><Badge variant="secondary">{feedbackStatuses[report.status]}</Badge></div><p className="break-words font-medium">{report.user.name || 'User'}</p><p className="mt-1 break-all text-xs text-muted-foreground">{report.user.email}</p><p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6">{report.message}</p>{report.attachments.length > 0 && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="size-3" aria-hidden="true" />{report.attachments.length} {report.attachments.length === 1 ? 'image' : 'images'}</p>}<p className="mt-2 text-xs text-muted-foreground md:hidden">{new Date(report.createdAt).toLocaleDateString('en-US')}</p></TableCell>
            <TableCell className="hidden align-top md:table-cell">{new Date(report.createdAt).toLocaleDateString('en-US')}</TableCell>
            <TableCell className="text-right align-top"><Button variant="outline" size="sm" aria-label={`View feedback from ${report.user.name || report.user.email}`} onClick={() => setSelected(report)}>View</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table>}
        {data.nextCursor && <div className="flex justify-center border-t border-border p-4"><Button variant="outline" disabled={loading} onClick={() => void load(data.nextCursor || undefined)}>{loading && <LoadingSpinner />}Load more feedback</Button></div>}
      </DataSurface>
      {selected && <FeedbackDetails key={selected.id} report={selected} onClose={() => setSelected(null)} onUpdated={report => { setSelected(report); void load(); }} />}
    </main>
  </div>;
}
