import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, GraduationCap, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataSurface, DataToolbar } from '@/components/ui/data-surface';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/AppUI';
import { Field, FieldLabel } from '@/components/ui/field';
import { LoadingSpinner } from '@/components/ui/loading';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { appToast } from '@/components/ui/toast';
import axiosClient from '@/lib/axios';
import { teacherAccessError, type TeacherAccessRequest, type TeacherAccessStatus } from '@/pages/profile/teacher-access.types';

interface RequestPage { items: TeacherAccessRequest[]; nextCursor: string | null }
const statusLabels: Record<TeacherAccessStatus, string> = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Declined' };

export default function TeacherAccessReview() {
  const [status, setStatus] = useState<TeacherAccessStatus>('PENDING');
  const [data, setData] = useState<RequestPage>({ items: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<TeacherAccessRequest | null>(null);
  const [note, setNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const generation = useRef(0);
  const noteInput = useRef<HTMLTextAreaElement>(null);
  const reviewTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => { if (selected) noteInput.current?.focus(); }, [selected]);

  const load = useCallback(async (cursor?: string) => {
    const requestGeneration = ++generation.current;
    setLoading(true);
    setError('');
    if (!cursor) setData({ items: [], nextCursor: null });
    try {
      const result = await axiosClient.get<RequestPage>('/api/admin/teacher-access', { params: { status, cursor } });
      if (requestGeneration !== generation.current) return;
      setData(previous => ({ items: cursor ? [...previous.items, ...result.items].filter((item, index, items) => items.findIndex(row => row.id === item.id) === index) : result.items, nextCursor: result.nextCursor }));
    } catch (requestError) {
      if (requestGeneration === generation.current) setError(teacherAccessError(requestError, 'Unable to load teacher requests.'));
    } finally { if (requestGeneration === generation.current) setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);

  const review = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selected || reviewing) return;
    setReviewing(true);
    setReviewError('');
    try {
      await axiosClient.patch(`/api/admin/teacher-access/${selected.id}`, { decision, reviewNote: note });
      appToast.success(decision === 'APPROVED' ? 'Teacher access approved.' : 'Teacher access request declined.');
      setSelected(null);
      setNote('');
      void load();
    } catch (requestError) { setReviewError(teacherAccessError(requestError, 'Unable to review this request.')); }
    finally { setReviewing(false); }
  };

  const openRequest = (request: TeacherAccessRequest) => { reviewTrigger.current = document.activeElement as HTMLElement; setSelected(request); setNote(''); setReviewError(''); };
  const closeReview = () => { if (!reviewing) { setSelected(null); setNote(''); setReviewError(''); reviewTrigger.current?.focus(); } };

  return <div className="h-full overflow-y-auto bg-background">
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <header><h1 className="text-3xl font-semibold tracking-tight">Teacher access</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Review student requests before granting access to classes and teaching tools. Existing teachers keep their access.</p></header>
      <DataSurface aria-label="Teacher access requests">
        <DataToolbar className="flex-row flex-wrap justify-between">
          <Select value={status} disabled={loading || reviewing} onValueChange={value => { closeReview(); setStatus(value as TeacherAccessStatus); }}><SelectTrigger aria-label="Request status" className="w-40"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" disabled={loading || reviewing} onClick={() => void load()}>{loading ? <LoadingSpinner /> : <RefreshCw aria-hidden="true" />}Refresh</Button>
        </DataToolbar>
        {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><p className="text-sm text-danger">{error}</p><Button variant="outline" disabled={loading} onClick={() => void load()}>Try again</Button></div>}
        {loading && !data.items.length ? <div aria-label="Loading requests" className="space-y-3 p-4">{[0, 1, 2].map(index => <Skeleton key={index} className="h-20 w-full" />)}</div> : !error && !data.items.length ? <EmptyState icon={<GraduationCap />} title={`No ${statusLabels[status].toLowerCase()} requests`} description={status === 'PENDING' ? 'New teacher access requests will appear here for your review.' : 'Requests with this review outcome will appear here.'} className="min-h-64" /> : data.items.length > 0 && <Table className="table-fixed">
          <TableHeader><TableRow><TableHead>Applicant &amp; explanation</TableHead><TableHead className="hidden w-36 md:table-cell">Submitted</TableHead><TableHead className="w-28 text-right">Review</TableHead></TableRow></TableHeader>
          <TableBody>{data.items.map(request => <TableRow key={request.id}>
            <TableCell className="min-w-44 whitespace-normal align-top"><p className="break-words font-medium">{request.user?.name || 'Student'}</p><p className="mt-1 break-all text-xs text-muted-foreground">{request.user?.email}</p><p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6">{request.reason}</p>{request.reviewNote && <p className="mt-2 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">Admin note: {request.reviewNote}</p>}<p className="mt-2 text-xs text-muted-foreground md:hidden">{new Date(request.createdAt).toLocaleDateString('en-US')}</p></TableCell>
            <TableCell className="hidden align-top md:table-cell">{new Date(request.createdAt).toLocaleDateString('en-US')}</TableCell>
            <TableCell className="text-right align-top">{request.status === 'PENDING' ? <Button variant="outline" onClick={() => openRequest(request)} aria-label={`Review request from ${request.user?.name || request.user?.email || 'student'}`}>Review</Button> : <span className="text-sm">{statusLabels[request.status]}</span>}</TableCell>
          </TableRow>)}</TableBody>
        </Table>}
        {data.nextCursor && <div className="flex justify-center border-t border-border p-4"><Button variant="outline" disabled={loading} onClick={() => void load(data.nextCursor || undefined)}>{loading && <LoadingSpinner />}Load more requests</Button></div>}
      </DataSurface>
      {selected && <Card role="region" aria-labelledby="teacher-review-title">
          <CardHeader><CardTitle id="teacher-review-title">Review teacher access</CardTitle><CardDescription>Approve only if this applicant should manage classrooms and teaching materials.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
          <div className="space-y-2"><p className="break-words font-medium">{selected?.user?.name || 'Student'}</p><p className="break-all text-sm text-muted-foreground">{selected?.user?.email}</p><p className="whitespace-pre-wrap break-words rounded-control border border-border bg-muted/40 p-4 text-sm leading-6">{selected?.reason}</p></div>
          <Field><FieldLabel htmlFor="teacher-review-note">Note to applicant (optional)</FieldLabel><Textarea ref={noteInput} id="teacher-review-note" maxLength={1000} disabled={reviewing} rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Add any context the applicant should know." /></Field>
          {reviewError && <p role="alert" className="text-sm text-danger">{reviewError}</p>}
          </CardContent>
          <CardFooter className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={reviewing} onClick={closeReview}>Cancel</Button><Button variant="outline" disabled={reviewing} onClick={() => void review('REJECTED')}><X aria-hidden="true" />Decline</Button><Button disabled={reviewing} onClick={() => void review('APPROVED')}>{reviewing ? <LoadingSpinner /> : <Check aria-hidden="true" />}Approve</Button></CardFooter>
      </Card>}
    </main>
  </div>;
}
