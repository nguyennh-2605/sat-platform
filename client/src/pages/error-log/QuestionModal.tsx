import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/AppUI';
import BlockRenderer from '../../components/content/BlockRenderer';
import InteractiveText from '../../features/quiz/InteractiveText';
import axiosClient from '../../lib/axios';
import type { ErrorEntry, ErrorQuestion } from './types';

export function QuestionModal({ entry, onClose }: { entry: ErrorEntry | null; onClose: () => void }) {
  const [question, setQuestion] = useState<ErrorQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!entry?.questionId) return;
    const controller = new AbortController();
    axiosClient.get<{ question: ErrorQuestion | null }>(`/api/error-logs/${entry.id}/question`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setQuestion(data.question); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [entry?.id, entry?.questionId, retry]);
  return <Modal open={Boolean(entry)} onClose={onClose} presentation="content-dialog" title="Question context" subtitle={entry?.source || undefined} className="h-[calc(100vh-2rem)] max-w-5xl!">
      <div className="h-full min-h-0 overflow-y-auto">
        {!entry?.questionId ? <p className="text-muted-foreground">No linked question is available for this manual entry.</p> : loading ? <Loader2 className="animate-spin" aria-label="Loading question" /> : error ? <div role="alert">Unable to load the question. <Button variant="outline" onClick={() => { setLoading(true); setError(false); setRetry(value => value + 1); }}>Retry</Button></div> : question && entry ? <>
          <QuestionContext entry={entry} question={question} />
          {question.explanation && <section className="mt-5"><h3 className="mb-2 font-medium">Explanation</h3><InteractiveText content={question.explanation} isMath={question.section.test.subject === 'MATH'} readOnly inheritTypography /></section>}
        </> : <p className="text-muted-foreground">The original question is no longer available.</p>}
      </div>
  </Modal>;
}

function QuestionContext({ entry, question }: { entry: ErrorEntry; question: ErrorQuestion }) {
  const subject = question.section.test.subject;
  return (
    <div className="space-y-5 rounded-card border border-ui-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground"><Badge variant="outline">{subject === 'RW' ? 'Reading & Writing' : 'Math'}</Badge><span>{question.section.name || `Module ${question.section.order}`}</span><span aria-hidden="true">·</span><span>Question {question.order}</span></div>
      {question.blocks?.length > 0 && <BlockRenderer blocks={question.blocks} subject={subject} readOnly variant="exam" />}
      <div className="exam-content font-medium text-foreground"><InteractiveText content={question.questionText} isMath={subject === 'MATH'} readOnly inheritTypography /></div>
      {question.type === 'MCQ' && question.choices?.length > 0 && (
        <div className="space-y-2" aria-label="Answer choices">
          {question.choices.map((choice, index) => {
            const label = String.fromCharCode(65 + index);
            const correct = label === entry.correctAnswer || choice.id === entry.correctAnswer || choice.text === entry.correctAnswer;
            const selected = label === entry.userAnswer || choice.id === entry.userAnswer || choice.text === entry.userAnswer;
            return <div key={`${label}-${index}`} className={`flex gap-3 rounded-control border p-3 ${correct ? 'border-success/40 bg-success-soft' : selected ? 'border-danger/40 bg-danger-soft' : 'border-ui-border bg-surface'}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-semibold ${correct ? 'border-success text-success' : selected ? 'border-danger text-danger' : 'border-ui-border text-muted-foreground'}`}>{label}</span><div className="min-w-0 flex-1 exam-content"><InteractiveText content={choice.text} isMath={subject === 'MATH'} readOnly inheritTypography /></div>{correct ? <CheckCircle2 className="shrink-0 text-success" aria-label="Correct answer" /> : selected ? <XCircle className="shrink-0 text-danger" aria-label="Your answer" /> : null}</div>;
          })}
        </div>
      )}
      <div className="grid gap-3 border-t border-ui-border pt-4 sm:grid-cols-2"><AnswerSummary label="Your answer" value={entry.userAnswer || 'Omitted'} correct={false} /><AnswerSummary label="Correct answer" value={entry.correctAnswer || '—'} correct /></div>
    </div>
  );
}

function AnswerMark({ value, correct }: { value: string; correct: boolean }) {
  return <span className={`mx-auto flex min-h-7 min-w-7 max-w-20 items-center justify-center truncate rounded-control border px-2 text-caption font-semibold ${correct ? 'border-success/30 bg-success-soft text-success' : 'border-danger/30 bg-danger-soft text-danger'}`} title={value}>{value}</span>;
}

function AnswerSummary({ label, value, correct }: { label: string; value: string; correct: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-body text-muted-foreground">{label}</span><AnswerMark value={value} correct={correct} /></div>;
}
