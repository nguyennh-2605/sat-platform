import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { LoadingSpinner } from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import axiosClient from '@/lib/axios';
import { appToast } from '@/components/ui/toast';
import { teacherAccessError, type TeacherAccessResponse } from './teacher-access.types';

export function TeacherAccessCard({ onRoleChanged }: { onRoleChanged: () => Promise<void> }) {
  const [data, setData] = useState<TeacherAccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await axiosClient.get<TeacherAccessResponse>('/api/account/teacher-access');
      if (result.role !== localStorage.getItem('userRole')) await onRoleChanged();
      setData(result);
    } catch (requestError) { setError(teacherAccessError(requestError, 'Unable to load teacher access.')); }
    finally { setLoading(false); }
  }, [onRoleChanged]);
  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      setData(await axiosClient.post<TeacherAccessResponse>('/api/account/teacher-access', { reason }));
      setReason('');
      appToast.success('Teacher access requested. An admin will review it.');
    } catch (requestError) { setError(teacherAccessError(requestError, 'Unable to send your request.')); }
    finally { setSubmitting(false); }
  };
  const request = data?.request;
  const active = data?.role === 'TEACHER';

  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="size-4" aria-hidden="true" />Teacher access</CardTitle><CardDescription>Teach classes and create learning materials after an admin approves your access.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {loading && !data ? <Skeleton className="h-28 w-full" /> : data && <>
        {active ? <div className="space-y-3"><Badge variant="secondary">Teacher access active</Badge><p className="text-sm text-muted-foreground">Your account can use the teaching workspace.</p><Button asChild><Link to="/dashboard">Open teaching workspace<ArrowRight aria-hidden="true" /></Link></Button></div> : <>
          {request && <div role="status" className="space-y-2 rounded-control border border-border bg-muted/40 p-4">
            <Badge variant="outline">{request.status === 'PENDING' ? 'Pending admin review' : request.status === 'REJECTED' ? 'Request declined' : 'Request approved'}</Badge>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{request.reason}</p>
            {request.status === 'PENDING' && <p className="text-sm text-muted-foreground">You can keep studying while your request is reviewed.</p>}
            {request.reviewNote && <p className="whitespace-pre-wrap break-words text-sm leading-6"><span className="font-medium">Admin note: </span>{request.reviewNote}</p>}
            {request.status === 'REJECTED' && <p className="text-sm text-muted-foreground">You can update your explanation and send a new request.</p>}
          </div>}
          {(!request || request.status === 'REJECTED') && <form onSubmit={event => void submit(event)} className="space-y-4">
            <Field><FieldLabel htmlFor="teacher-access-reason">Why do you need teacher access?</FieldLabel><Textarea id="teacher-access-reason" required maxLength={1000} disabled={submitting} rows={4} value={reason} onChange={event => setReason(event.target.value)} placeholder="Tell us about your teaching role and how you plan to use Sonder SAT." /><FieldDescription>Your explanation is visible to platform admins. Maximum 1,000 characters.</FieldDescription></Field>
            <Button type="submit" disabled={submitting || !reason.trim()}>{submitting && <LoadingSpinner />}{submitting ? 'Sending request…' : 'Request teacher access'}</Button>
          </form>}
        </>}
      </>}
      <Button variant="outline" disabled={loading || submitting} onClick={() => void load()}>{loading ? <LoadingSpinner /> : <RefreshCw aria-hidden="true" />}Check status</Button>
    </CardContent>
  </Card>;
}
