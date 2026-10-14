import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/AppUI';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import { appToast } from '@/components/ui/toast';
import axiosClient from '@/lib/axios';
import { feedbackError, feedbackLevels, feedbackStatuses, type FeedbackImage, type FeedbackReport, type FeedbackStatus } from '@/features/feedback/feedback.types';

function FeedbackScreenshot({ image }: { image: FeedbackImage }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setError(''); setUrl('');
    try {
      const result = await axiosClient.get<{ url: string }>(`/api/feedback/images/${image.id}`);
      if (current === generation.current) setUrl(result.url);
    } catch (failure) {
      if (current === generation.current) setError(feedbackError(failure, 'Unable to load this image.'));
    } finally { if (current === generation.current) setLoading(false); }
  }, [image.id]);
  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);
  return <figure className="space-y-2 rounded-control border border-border p-3">
    <figcaption className="flex min-w-0 items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate" title={image.name}>{image.name}</span>{url && !error && <Button variant="ghost" size="icon-sm" asChild><a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${image.name} in a new tab`}><ExternalLink aria-hidden="true" /></a></Button>}</figcaption>
    {loading ? <Skeleton className="h-40 w-full" aria-label={`Loading ${image.name}`} /> : error ? <div className="space-y-2"><p role="alert" className="text-sm text-danger">{error}</p><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw aria-hidden="true" />Retry image</Button></div> : url && <img src={url} alt={`Feedback attachment: ${image.name}`} className="max-h-64 w-full object-contain" onError={() => setError('This image could not be displayed. Refresh its access link to try again.')} />}
  </figure>;
}

export function FeedbackDetails({ report, onClose, onUpdated }: { report: FeedbackReport; onClose: () => void; onUpdated: (report: FeedbackReport) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const close = () => { if (!inFlight.current) onClose(); };
  const update = async (status: FeedbackStatus) => {
    if (inFlight.current || status === report.status) return;
    inFlight.current = true; setSaving(true); setError('');
    try {
      const result = await axiosClient.patch<FeedbackReport>(`/api/admin/feedback/${report.id}`, { status, expectedStatus: report.status });
      onUpdated(result);
      appToast.success(`Feedback marked ${feedbackStatuses[status].toLowerCase()}.`);
    } catch (failure) { setError(feedbackError(failure, 'Unable to update feedback. Please try again.')); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <Modal open presentation="content-dialog" title="Feedback details" onClose={close} footer={<><Button variant="outline" disabled={saving} onClick={close}>Close</Button>{report.status !== 'NEW' && <Button variant="outline" disabled={saving} onClick={() => void update('NEW')}>Reopen</Button>}{report.status === 'NEW' && <Button variant="outline" disabled={saving} onClick={() => void update('IN_PROGRESS')}>Start review</Button>}{report.status !== 'RESOLVED' && <Button disabled={saving} onClick={() => void update('RESOLVED')}>{saving && <LoadingSpinner />}Mark resolved</Button>}</>}>
    <div className="space-y-5">
      <div className="space-y-2"><div className="flex flex-wrap gap-2"><Badge variant={report.level === 'CRITICAL' ? 'destructive' : 'outline'}>{feedbackLevels[report.level].label}</Badge><Badge variant="secondary">{feedbackStatuses[report.status]}</Badge></div><p className="break-words font-medium">{report.user.name || 'User'}</p><p className="break-all text-sm text-muted-foreground">{report.user.email} · {report.user.role.toLowerCase()}</p><p className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString('en-US')}{report.pagePath && <> · <span className="break-all">{report.pagePath}</span></>}</p></div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6">{report.message}</p>
      {report.attachments.length > 0 && <section aria-label="Feedback images" className="space-y-3">{report.attachments.map(image => <FeedbackScreenshot key={image.id} image={image} />)}</section>}
      {saving && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoadingSpinner />Updating feedback…</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  </Modal>;
}
