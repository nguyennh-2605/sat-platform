import { useCallback, useEffect, useState } from 'react';
import { BookA, Calendar, CheckCircle2, Clock3, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../lib/axios';
import { Badge, Button, Card, EmptyState, Modal } from '../../components/ui/AppUI';
import { ui } from '../../components/ui/styles';

interface ActivityAssignee {
  studentId: number;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXCUSED';
  bestScore: number | null;
}

interface VocabularyActivity {
  id: string;
  title: string;
  instructions: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  dueAt: string | null;
  passingScore: number | null;
  maxAttempts: number;
  vocabulary: {
    vocabularySet: { id: string; title: string };
    _count: { items: number };
  } | null;
  assignees: ActivityAssignee[];
  lesson: { id: string; title: string; week: { title: string } } | null;
}

interface ActivityPerformance {
  activity: { id: string; title: string; dueAt: string | null; passingScore: number | null };
  stats: { assigned: number; completed: number; inProgress: number; missing: number; completionRate: number; averageScore: number | null };
  students: Array<{ id: number; name: string; email: string; status: ActivityAssignee['status']; bestScore: number | null; attemptCount: number; completedAt: string | null }>;
  mostMissed: Array<{ word: string; incorrect: number }>;
}

const errorMessage = (error: unknown) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Unable to load coursework.';

export default function ClassroomVocabularyPanel({ classId, canManage }: { classId: string; canManage: boolean }) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<VocabularyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [performance, setPerformance] = useState<ActivityPerformance | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await axiosClient.get<VocabularyActivity[], VocabularyActivity[]>(`/api/vocabulary/activities/class/${classId}`);
      setActivities(Array.isArray(result) ? result : []);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { void load(); }, [load]);

  const openActivity = async (activity: VocabularyActivity) => {
    if (!canManage) {
      navigate(`/dashboard/vocabulary?activity=${activity.id}`);
      return;
    }
    setPerformanceLoading(true);
    try {
      setPerformance(await axiosClient.get<ActivityPerformance, ActivityPerformance>(`/api/vocabulary/activities/${activity.id}/performance`));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setPerformanceLoading(false);
    }
  };

  if (loading) return <div className="grid gap-4 md:grid-cols-2">{[1, 2, 3].map(item => <div key={item} className="h-40 animate-pulse rounded-card border border-ui-border bg-surface" />)}</div>;

  return <section aria-labelledby="coursework-heading" className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 id="coursework-heading" className="text-xl font-semibold text-foreground">Coursework</h2>
        <p className="mt-1 text-sm text-subtle">Vocabulary lessons assigned to this class.</p>
      </div>
      {canManage && <Button size="sm" onClick={() => navigate(`/dashboard/vocabulary?assignTo=${classId}`)}><Plus size={15} />Assign vocabulary</Button>}
    </div>

    {error ? <Card className="p-5"><p className="text-sm text-danger">{error}</p><Button size="sm" variant="outline" className="mt-3" onClick={() => void load()}>Try again</Button></Card>
      : activities.length === 0 ? <EmptyState icon={<BookA size={19} />} title="No coursework yet" description={canManage ? 'Choose a vocabulary set and assign it to this class.' : 'New vocabulary lessons from your teacher will appear here.'} action={canManage ? <Button size="sm" onClick={() => navigate(`/dashboard/vocabulary?assignTo=${classId}`)}>Browse vocabulary</Button> : undefined} />
        : <div className="grid gap-4 md:grid-cols-2">{activities.map(activity => {
          const completed = activity.assignees.filter(item => item.status === 'COMPLETED').length;
          const myStatus = activity.assignees[0]?.status;
          const overdue = Boolean(activity.dueAt && new Date(activity.dueAt) < new Date() && myStatus !== 'COMPLETED');
          return <button key={activity.id} type="button" disabled={performanceLoading} onClick={() => void openActivity(activity)} className={`group min-h-40 rounded-card border border-ui-border bg-surface p-5 text-left shadow-card disabled:cursor-wait ${ui.cardInteractive}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-soft text-primary"><BookA size={19} /></span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${overdue ? 'bg-danger-soft text-danger' : myStatus === 'COMPLETED' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>
                {canManage ? activity.status.toLowerCase() : myStatus === 'COMPLETED' ? 'Completed' : overdue ? 'Overdue' : myStatus === 'IN_PROGRESS' ? 'In progress' : 'Assigned'}
              </span>
            </div>
            <h3 className="mt-4 line-clamp-2 font-semibold text-foreground group-hover:text-primary">{activity.title}</h3>
            <p className="mt-1 line-clamp-1 text-sm text-subtle">{activity.vocabulary?._count.items || 0} words{activity.lesson ? ` · ${activity.lesson.week.title} / ${activity.lesson.title}` : ''}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ui-border pt-3 text-xs text-subtle">
              {activity.dueAt ? <span className="inline-flex items-center gap-1.5"><Calendar size={13} />Due {new Date(activity.dueAt).toLocaleDateString()}</span> : <span className="inline-flex items-center gap-1.5"><Clock3 size={13} />No deadline</span>}
              {canManage && <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} />{completed}/{activity.assignees.length} completed</span>}
            </div>
          </button>;
        })}</div>}
    <PerformanceDialog performance={performance} onClose={() => setPerformance(null)} onOpenSet={() => {
      const setId = activities.find(item => item.id === performance?.activity.id)?.vocabulary?.vocabularySet.id;
      if (setId) navigate(`/dashboard/vocabulary?set=${setId}`);
    }} />
  </section>;
}

function PerformanceDialog({ performance, onClose, onOpenSet }: { performance: ActivityPerformance | null; onClose: () => void; onOpenSet: () => void }) {
  return <Modal open={Boolean(performance)} onClose={onClose} presentation="content-dialog" title={performance?.activity.title} subtitle="Vocabulary performance" className="!max-w-4xl" footer={<><Button variant="outline" onClick={onOpenSet}>Open vocabulary set</Button><Button onClick={onClose}>Done</Button></>}>
    {performance && <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Completion" value={`${performance.stats.completionRate}%`} />
        <Metric label="Completed" value={`${performance.stats.completed}/${performance.stats.assigned}`} />
        <Metric label="Average score" value={performance.stats.averageScore === null ? '—' : `${performance.stats.averageScore}%`} />
        <Metric label="Missing" value={String(performance.stats.missing)} />
      </div>
      <div className="overflow-x-auto rounded-card border border-ui-border">
        <table className="w-full min-w-[600px] text-left text-body">
          <thead className="border-b border-ui-border bg-background text-caption text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Best score</th><th className="px-4 py-3 font-semibold">Attempts</th></tr></thead>
          <tbody>{performance.students.map(student => <tr key={student.id} className="border-b border-ui-border last:border-b-0"><td className="px-4 py-3"><p className="font-medium text-foreground">{student.name}</p><p className="text-caption text-muted-foreground">{student.email}</p></td><td className="px-4 py-3"><Badge tone={student.status === 'COMPLETED' ? 'success' : student.status === 'IN_PROGRESS' ? 'warning' : 'neutral'}>{student.status.replace('_', ' ').toLowerCase()}</Badge></td><td className="px-4 py-3">{student.bestScore === null ? '—' : `${student.bestScore}%`}</td><td className="px-4 py-3">{student.attemptCount}</td></tr>)}</tbody>
        </table>
      </div>
      {performance.mostMissed.length > 0 && <div><h3 className="font-semibold text-foreground">Most missed words</h3><div className="mt-3 flex flex-wrap gap-2">{performance.mostMissed.map(item => <Badge key={item.word} tone="danger">{item.word} · {item.incorrect}</Badge>)}</div></div>}
    </div>}
  </Modal>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-control border border-ui-border bg-background p-3"><p className="text-caption text-muted-foreground">{label}</p><p className="mt-1 text-heading font-semibold text-foreground">{value}</p></div>;
}
