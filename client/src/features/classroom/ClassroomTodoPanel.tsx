import { useCallback, useEffect, useState } from 'react';
import { BarChart3, ClipboardList, FileText, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../lib/axios';
import { Button, Modal } from '../../components/ui/AppUI';
import { capitalizeFirstLetter } from '../../utils/text';

export interface ClassroomTodoItem {
  key: string;
  type: 'TEST_RESULT' | 'ANNOUNCEMENT' | 'ASSIGNMENT' | 'TEST';
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
  submissionId?: number;
  testMode?: 'EXAM' | 'PRACTICE';
  attemptStatus?: 'NOT_STARTED' | 'DOING';
  durationMinutes?: number;
  durationMs?: number | null;
  score?: number | null;
  totalQuestions?: number;
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
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  return `${minutes}m`;
};

const itemMeta = (item: ClassroomTodoItem) => {
  if (item.type === 'TEST_RESULT') {
    const parts = [Number.isFinite(item.score) ? `${item.score}/${item.totalQuestions} correct` : null, duration(item.durationMs), capitalizeFirstLetter(item.className)];
    return parts.filter(Boolean).join(' · ');
  }
  if (item.dueAt) {
    const due = new Date(item.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${item.priority === 'OVERDUE' ? 'Overdue' : `Due ${due}`} · ${capitalizeFirstLetter(item.className)}`;
  }
  return `${relativeTime(item.createdAt)} · ${capitalizeFirstLetter(item.className)}`;
};

const iconFor = (type: ClassroomTodoItem['type']) => {
  if (type === 'TEST_RESULT') return BarChart3;
  if (type === 'ANNOUNCEMENT') return Megaphone;
  if (type === 'ASSIGNMENT') return ClipboardList;
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
      <aside className="min-w-0 xl:sticky xl:top-6" aria-label="To Do">
        <h2 className="border-b border-[#C9D8D2] pb-3 text-base font-semibold text-[#1A1A1A]">To Do</h2>
        <div className="max-h-[620px] overflow-y-auto">
          {loading ? <TodoSkeleton /> : error ? (
            <div className="py-6 text-sm text-[#6B7280]"><p>{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => { setLoading(true); void loadTodos(); }}>Try again</Button></div>
          ) : items.length === 0 ? (
            <p className="py-7 text-sm text-[#6B7280]">Nothing for now</p>
          ) : items.map(item => {
            const Icon = iconFor(item.type);
            return <button key={item.key} type="button" onClick={() => openItem(item)} className="group flex w-full gap-3 border-b border-[#D2DED9] px-1 py-4 text-left transition-colors hover:bg-[#E8F5EF] focus-visible:bg-[#E8F5EF]">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.priority === 'OVERDUE' ? 'bg-red-50 text-red-700' : 'bg-[#E8F5EF] text-[#1B7A5A]'}`}><Icon size={16} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-semibold leading-5 text-[#1A1A1A] underline decoration-[#8FB9A9] underline-offset-4 group-hover:text-[#145F47]">{capitalizeFirstLetter(item.title)}</span>
                <span className="mt-1 block line-clamp-2 text-xs leading-5 text-[#5E6B66]">{itemMeta(item)}</span>
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
  return <div className="space-y-1 py-2" aria-label="Loading To Do items">{[1, 2, 3].map(item => <div key={item} className="flex animate-pulse gap-3 border-b border-[#D2DED9] py-4"><div className="h-8 w-8 rounded-lg bg-[#DDE9E4]" /><div className="flex-1"><div className="h-4 w-4/5 rounded bg-[#DDE9E4]" /><div className="mt-2 h-3 w-3/5 rounded bg-[#E7EFEC]" /></div></div>)}</div>;
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
  return <div className="rounded-lg border border-[#C9D8D2] bg-[#F8FBF9] p-3"><p className="text-xs text-[#6B7280]">{label}</p><p className="mt-1 font-medium text-[#1A1A1A]">{value}</p></div>;
}
