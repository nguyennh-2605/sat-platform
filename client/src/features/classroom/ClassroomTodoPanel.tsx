import { useCallback, useEffect, useState } from 'react';
import { BarChart3, BookA, ClipboardList, FileText, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../lib/axios';
import { Button, Modal } from '../../components/ui/AppUI';
import { capitalizeFirstLetter } from '../../utils/text';

export interface ClassroomTodoItem {
  key: string;
  type: 'TEST_RESULT' | 'ANNOUNCEMENT' | 'ASSIGNMENT' | 'TEST' | 'VOCABULARY';
  classId: string;
  className: string;
  title: string;
  description: string;
  createdAt: string;
  dueAt?: string | null;
  priority: 'NORMAL' | 'DUE_SOON' | 'OVERDUE';
  assignmentId?: string;
  deliveryId?: string;
  testId?: number;
  activityId?: string;
  setId?: string;
  submissionId?: number;
  testMode?: 'EXAM' | 'PRACTICE';
  attemptStatus?: 'NOT_STARTED' | 'DOING';
  durationMinutes?: number;
  durationMs?: number | null;
  score?: number | null;
  totalQuestions?: number;
  bestScore?: number | null;
  attemptCount?: number;
  maxAttempts?: number;
}

const relativeTime = (value: string) => {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const duration = (milliseconds?: number | null) => {
  if (!milliseconds) return null;
  const totalSeconds = Math.max(1, Math.round(milliseconds / 1_000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
};

const itemSummary = (item: ClassroomTodoItem) => {
  if (item.type === 'TEST_RESULT') {
    const parts = [Number.isFinite(item.score) ? `${item.score}/${item.totalQuestions} correct` : null, duration(item.durationMs)];
    return parts.filter(Boolean).join(' · ');
  }
  return item.description || capitalizeFirstLetter(item.className);
};

const itemTrailingMeta = (item: ClassroomTodoItem) => {
  if (item.dueAt) {
    const due = new Date(item.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return item.priority === 'OVERDUE' ? `Overdue ${due}` : `Due ${due}`;
  }
  return relativeTime(item.createdAt);
};

const iconFor = (type: ClassroomTodoItem['type']) => {
  if (type === 'TEST_RESULT') return BarChart3;
  if (type === 'ANNOUNCEMENT') return Megaphone;
  if (type === 'ASSIGNMENT') return ClipboardList;
  if (type === 'VOCABULARY') return BookA;
  return FileText;
};

export function ClassroomTodoPanel() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ClassroomTodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTest, setSelectedTest] = useState<ClassroomTodoItem | null>(null);

  const loadTodos = useCallback(async () => {
    setError('');
    try {
      const response = await axiosClient.get<{ items: ClassroomTodoItem[] }, { items: ClassroomTodoItem[] }>('/api/classes/todos');
      setItems(Array.isArray(response.items) ? response.items : []);
    } catch (requestError) {
      console.error(requestError);
      setError('Unable to load To Do items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTodos(); }, [loadTodos]);
  useEffect(() => {
    const refresh = () => void loadTodos();
    const intervalId = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('classroom-todos:refresh', refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('classroom-todos:refresh', refresh);
    };
  }, [loadTodos]);

  const acknowledge = async (item: ClassroomTodoItem) => {
    setItems(current => current.filter(todo => todo.key !== item.key));
    try {
      await axiosClient.post('/api/classes/todos/acknowledge', { itemKey: item.key });
    } catch (requestError) {
      console.error(requestError);
      void loadTodos();
    }
  };

  const openItem = (item: ClassroomTodoItem) => {
    if (item.type === 'VOCABULARY' && item.activityId) {
      navigate(`/dashboard/vocabulary?activity=${item.activityId}`);
      return;
    }
    if (item.type === 'TEST') {
      setSelectedTest(item);
      return;
    }
    if (item.type === 'TEST_RESULT' && item.deliveryId) {
      void acknowledge(item);
      navigate(`/dashboard/class/${item.classId}?tab=performance&deliveryId=${item.deliveryId}`);
      return;
    }
    if (item.assignmentId) {
      if (item.type === 'ANNOUNCEMENT') void acknowledge(item);
      navigate(`/dashboard/class/${item.classId}/assignment/${item.assignmentId}`);
    }
  };

  return (
    <>
      <aside className="min-w-0 overflow-hidden rounded-card border border-ui-border bg-surface shadow-card xl:sticky xl:top-6" aria-label="To Do">
        <h2 className="mx-5 border-b border-ui-border pb-3 pt-5 text-title font-semibold text-foreground">To Do</h2>
        <div className="max-h-[620px] overflow-y-auto px-5 pb-2">
          {loading ? <TodoSkeleton /> : error ? (
            <div className="py-6 text-body text-muted-foreground"><p>{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => { setLoading(true); void loadTodos(); }}>Try again</Button></div>
          ) : items.length === 0 ? (
            <p className="py-7 text-body text-muted-foreground">Nothing for now</p>
          ) : items.map(item => {
            const Icon = iconFor(item.type);
            return <button key={item.key} type="button" onClick={() => openItem(item)} className="group flex w-full gap-3 border-b border-ui-border px-1 py-4 text-left transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control ${item.priority === 'OVERDUE' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary'}`}><Icon size={16} aria-hidden="true" /></span>
              <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-3">
                <span className="line-clamp-2 text-body font-semibold leading-5 text-foreground underline decoration-primary/40 underline-offset-4 group-hover:text-primary-hover">{capitalizeFirstLetter(item.title)}</span>
                <span className={`whitespace-nowrap pt-0.5 text-caption font-medium ${item.priority === 'OVERDUE' ? 'text-danger' : 'text-muted-foreground'}`}>{itemTrailingMeta(item)}</span>
                <span className="mt-1 block min-w-0 truncate text-caption leading-5 text-subtle-foreground">{itemSummary(item)}</span>
              </span>
            </button>;
          })}
        </div>
      </aside>
      <TestStartDialog item={selectedTest} onClose={() => setSelectedTest(null)} />
    </>
  );
}

function TodoSkeleton() {
  return <div className="space-y-1 py-2" aria-label="Loading To Do items">{[1, 2, 3].map(item => <div key={item} className="flex animate-pulse gap-3 border-b border-ui-border py-4"><div className="h-8 w-8 rounded-control bg-muted" /><div className="flex-1"><div className="h-4 w-4/5 rounded bg-muted" /><div className="mt-2 h-3 w-3/5 rounded bg-surface-subtle" /></div></div>)}</div>;
}

function TestStartDialog({ item, onClose }: { item: ClassroomTodoItem | null; onClose: () => void }) {
  const navigate = useNavigate();
  const start = () => {
    if (!item?.testId || !item.deliveryId) return;
    localStorage.setItem('current_exam_info', JSON.stringify({
      id: item.testId,
      title: capitalizeFirstLetter(item.title),
      duration: item.durationMinutes,
    }));
    navigate(`/test/${item.testId}?deliveryId=${item.deliveryId}`);
  };
  return <Modal
    open={Boolean(item)}
    onClose={onClose}
    closeOnBackdrop
    presentation="content-dialog"
    title={capitalizeFirstLetter(item?.title)}
    subtitle={item ? `${capitalizeFirstLetter(item.className)} · ${item.testMode === 'EXAM' ? 'Test mode' : 'Practice mode'}` : undefined}
    className="!max-w-lg"
    footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={start}>{item?.attemptStatus === 'DOING' ? 'Continue' : 'Start test'}</Button></>}
  >
    <div className="grid grid-cols-2 gap-3 text-sm">
      <TestFact label="Questions" value={String(item?.totalQuestions || '—')} />
      <TestFact label="Duration" value={item?.durationMinutes ? `${item.durationMinutes} minutes` : '—'} />
      <TestFact label="Status" value={item?.attemptStatus === 'DOING' ? 'In progress' : 'Not started'} />
      <TestFact label="Due" value={item?.dueAt ? new Date(item.dueAt).toLocaleString() : 'No deadline'} />
    </div>
  </Modal>;
}

function TestFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-control border border-ui-border bg-surface-subtle p-3"><p className="text-caption text-muted-foreground">{label}</p><p className="mt-1 font-medium text-foreground">{value}</p></div>;
}
