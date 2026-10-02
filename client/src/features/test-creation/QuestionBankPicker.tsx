import { useEffect, useMemo, useState } from 'react';
import { BookCopy } from 'lucide-react';
import axiosClient from '@/lib/axios';
import { Badge, EmptyState } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataSurface, DataToolbar, DataToolbarActions, DataToolbarSearch } from '@/components/ui/data-surface';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { BankQuestion, BankQuestionPage } from '@/features/question-bank/question-bank.types';
import type { ImportPreview, Subject } from './create-test.types';

const toPreview = (selected: BankQuestion[], moduleCount: number): ImportPreview => {
  const modules = Array.from({ length: moduleCount }, (_, index) => ({ order: index + 1, name: `Module ${index + 1}`, questions: [] as ImportPreview['modules'][number]['questions'] }));
  selected.forEach((question, index) => {
    const moduleIndex = Math.min(moduleCount - 1, Math.floor(index * moduleCount / selected.length));
    const module = modules[moduleIndex];
    module.questions.push({
      clientId: `bank-${question.id}`,
      module: module.order,
      order: module.questions.length + 1,
      type: question.type,
      blocks: question.blocks,
      questionText: question.questionText,
      choices: question.choices,
      correctAnswer: question.correctAnswer || '',
      explanation: question.explanation || undefined,
      domainCode: question.domain.code,
      skillCode: question.skill.code,
      sourceBankQuestionId: question.id,
      sourceBankVersionId: question.versionId,
      issues: [],
    });
  });
  return {
    fileName: 'Question Bank selection', modules,
    summary: { questionCount: selected.length, classifiedCount: selected.length, errorCount: 0, warningCount: 0 },
    issues: [],
  };
};

export function QuestionBankPicker({ subject, moduleCount, disabled, onUse }: { subject: Subject; moduleCount: number; disabled?: boolean; onUse: (preview: ImportPreview) => void }) {
  const role = localStorage.getItem('userRole') || 'TEACHER';
  const [source, setSource] = useState<'MINE' | 'SYSTEM'>(role === 'ADMIN' ? 'SYSTEM' : 'MINE');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<BankQuestion[]>([]);
  const [selectedById, setSelectedById] = useState<Record<string, BankQuestion>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const params = new URLSearchParams({ source, subject, status: 'PUBLISHED', limit: '100' });
        if (search.trim()) params.set('search', search.trim());
        const response = await axiosClient.get<BankQuestionPage, BankQuestionPage>(`/api/question-bank?${params}`);
        setItems(response.items);
      } catch { setError('Unable to load questions from the bank.'); }
      finally { setLoading(false); }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search, source, subject]);
  useEffect(() => { setSelectedById({}); }, [source, subject]);
  const selected = useMemo(() => Object.values(selectedById), [selectedById]);
  return <div className="flex h-full min-h-[520px] flex-col gap-4">
    <div><h2 className="text-title font-semibold text-foreground">Select reusable questions</h2><p className="mt-1 text-caption text-muted-foreground">The server copies the selected versions into an independent test snapshot.</p></div>
    <DataSurface className="min-h-0 flex-1">
      <DataToolbar><DataToolbarSearch value={search} onChange={event => setSearch(event.target.value)} placeholder="Search questions..." />{role !== 'ADMIN' && <Select value={source} onValueChange={value => setSource(value as 'MINE' | 'SYSTEM')}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MINE">My questions</SelectItem><SelectItem value="SYSTEM">System questions</SelectItem></SelectContent></Select>}<DataToolbarActions><Badge tone="neutral">{selected.length} selected</Badge></DataToolbarActions></DataToolbar>
      <div className="max-h-[390px] overflow-y-auto">{loading ? <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div> : error ? <EmptyState title="Question Bank unavailable" description={error} /> : items.length === 0 ? <EmptyState icon={<BookCopy aria-hidden="true" />} title="No published questions" description="Publish matching questions in Question Bank first." /> : <div className="divide-y divide-ui-border">{items.map(question => <label key={question.id} className="flex cursor-pointer items-start gap-3 p-4 hover:bg-muted/30"><Checkbox checked={Boolean(selectedById[question.id])} onCheckedChange={checked => setSelectedById(current => { const next = { ...current }; if (checked) next[question.id] = question; else delete next[question.id]; return next; })} /><span className="min-w-0 flex-1"><span className="line-clamp-2 text-body font-medium text-foreground">{question.questionText}</span><span className="mt-1 block text-caption text-muted-foreground">{question.domain.name} · {question.skill.name} · {question.difficulty.toLowerCase()}</span></span></label>)}</div>}</div>
    </DataSurface>
    <div className="flex justify-end"><Button disabled={disabled || selected.length === 0 || selected.length < moduleCount} onClick={() => onUse(toPreview(selected, moduleCount))}>Use {selected.length || ''} selected question{selected.length === 1 ? '' : 's'}</Button></div>
  </div>;
}
