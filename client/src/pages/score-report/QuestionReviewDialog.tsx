import { ArrowLeft, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

import { Modal } from '@/components/ui/AppUI';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import BlockRenderer from '../../components/content/BlockRenderer';
import FormattedTextRenderer from '../../components/content/TextRenderer';
import InteractiveText from '../../features/quiz/InteractiveText';
import type { QuestionResult } from './score-report.types';

interface QuestionReviewDialogProps {
  data: QuestionResult | null;
  examTitle: string;
  examSubject: 'RW' | 'MATH';
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onOpenErrorLog?: () => void;
}

export function QuestionReviewDialog({
  data,
  examTitle,
  examSubject,
  onClose,
  onPrevious,
  onNext,
  onOpenErrorLog,
}: QuestionReviewDialogProps) {
  if (!data) return null;
  const classification = [data.domain?.name, data.skill?.name].filter(Boolean).join(' · ') || 'Unclassified';
  const status = data.isCorrect ? 'Correct' : data.isOmitted ? 'Omitted' : 'Incorrect';

  return (
    <Modal
      open
      onClose={onClose}
      presentation="content-dialog"
      title={`Question ${data.questionNumber}`}
      subtitle={`${examTitle} · ${data.module.name || `Module ${data.module.order}`} · ${classification}`}
      className="h-[calc(100vh-2rem)] max-w-6xl!"
      footer={(
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div>{onOpenErrorLog && <Button variant="outline" onClick={onOpenErrorLog}>Open in Error Log</Button>}</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={!onPrevious} onClick={onPrevious}><ArrowLeft />Previous</Button>
            <Button variant="outline" disabled={!onNext} onClick={onNext}>Next<ArrowRight /></Button>
          </div>
        </div>
      )}
    >
      <div className="grid h-full min-h-0 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <section className="space-y-5 rounded-card border border-ui-border bg-surface p-4 sm:p-5" aria-label="Question and answers">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{examSubject === 'RW' ? 'Reading & Writing' : 'Math'}</Badge>
            <Badge variant="outline" className={data.isCorrect ? 'border-success/30 bg-success-soft text-success' : data.isOmitted ? 'border-warning/30 bg-warning-soft text-warning' : 'border-danger/30 bg-danger-soft text-danger'}>{status}</Badge>
            <span className="text-caption text-muted-foreground">{formatQuestionDuration(data.activeDurationMs)}</span>
          </div>

          {data.blocks.length > 0 && <BlockRenderer blocks={data.blocks} subject={examSubject} readOnly variant="exam" />}
          <div className="exam-content font-medium text-foreground">
            <QuestionText text={data.questionText} subject={examSubject} />
          </div>

          {data.type === 'MCQ' && data.choices.length > 0 && (
            <div className="space-y-2" aria-label="Answer choices">
              {data.choices.map((choice, index) => {
                const label = String.fromCharCode(65 + index);
                const correct = data.correctAnswer != null && [label, choice.id, choice.text].includes(data.correctAnswer);
                const selected = data.userAnswer != null && [label, choice.id, choice.text].includes(data.userAnswer);
                return (
                  <div key={`${choice.id}-${index}`} className={`flex gap-3 rounded-control border p-3 ${correct ? 'border-success/40 bg-success-soft' : selected ? 'border-danger/40 bg-danger-soft' : 'border-ui-border bg-surface'}`}>
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-semibold ${correct ? 'border-success text-success' : selected ? 'border-danger text-danger' : 'border-ui-border text-muted-foreground'}`}>{label}</span>
                    <div className="min-w-0 flex-1 exam-content"><QuestionText text={choice.text} subject={examSubject} /></div>
                    {correct ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Correct answer" /> : selected ? <XCircle className="size-5 shrink-0 text-danger" aria-label="Your answer" /> : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid gap-3 border-t border-ui-border pt-4 sm:grid-cols-2">
            <AnswerSummary label="Your answer" value={data.userAnswer || 'Omitted'} tone={data.isCorrect ? 'success' : 'danger'} />
            <AnswerSummary label="Correct answer" value={data.correctAnswer || '—'} tone="success" />
          </div>
        </section>

        <section className="rounded-card border border-ui-border bg-muted/20 p-4 sm:p-5" aria-label="Explanation">
          <h3 className="text-title font-semibold text-foreground">Explanation</h3>
          {data.explanation ? (
            <div className="mt-4 exam-content text-foreground">
              <QuestionText text={data.explanation} subject={examSubject} />
            </div>
          ) : (
            <p className="mt-3 text-body text-muted-foreground">No explanation was provided for this question.</p>
          )}
        </section>
      </div>
    </Modal>
  );
}

function QuestionText({ text, subject }: { text: string; subject: 'RW' | 'MATH' }) {
  return subject === 'MATH'
    ? <FormattedTextRenderer text={text} latexOnly />
    : <InteractiveText content={text} readOnly inheritTypography />;
}

function AnswerSummary({ label, value, tone }: { label: string; value: string; tone: 'success' | 'danger' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-body text-muted-foreground">{label}</span>
      <span className={`min-w-8 rounded-control border px-2 py-1 text-center text-caption font-semibold ${tone === 'success' ? 'border-success/30 bg-success-soft text-success' : 'border-danger/30 bg-danger-soft text-danger'}`}>{value}</span>
    </div>
  );
}

function formatQuestionDuration(milliseconds: number | null) {
  if (milliseconds === null || !Number.isFinite(milliseconds)) return 'Timing unavailable';
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes ? `${minutes}m ` : ''}${seconds % 60}s`;
}
