import { useId, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';

import { Modal } from '@/components/ui/AppUI';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import BlockRenderer from '../../components/content/BlockRenderer';
import FormattedTextRenderer from '../../components/content/TextRenderer';
import { isChoiceVisualPlaceholder, splitChoiceVisuals } from '../../components/content/choiceVisuals';
import InteractiveText from '../../features/quiz/InteractiveText';
import { DictionaryLookup } from '../../features/dictionary/DictionaryLookup';
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
  const [explanationOpen, setExplanationOpen] = useState(false);
  const explanationId = useId();
  if (!data) return null;
  const classification = [data.domain?.name, data.skill?.name].filter(Boolean).join(' · ') || 'Unclassified';
  const status = data.isCorrect ? 'Correct' : data.isOmitted ? 'Omitted' : 'Incorrect';
  const { promptBlocks, choiceBlocks } = splitChoiceVisuals(data.blocks);

  return (
    <Modal
      open
      onClose={onClose}
      presentation="content-dialog"
      title={`Question ${data.questionNumber}`}
      subtitle={`${examTitle} · ${data.module.name || `Module ${data.module.order}`} · ${classification}`}
      className={`h-[calc(100dvh-2rem)] ${explanationOpen ? 'max-w-6xl!' : 'max-w-3xl!'}`}
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
      <DictionaryLookup enabled={examSubject === 'RW'} contentKey={data.questionNumber}>
      <div className={`grid h-full min-h-0 gap-4 overflow-y-auto ${explanationOpen ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]' : 'grid-cols-1'}`}>
        <section className="space-y-5 rounded-card border border-ui-border bg-surface p-4 sm:p-5" aria-label="Question and answers">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{examSubject === 'RW' ? 'Reading & Writing' : 'Math'}</Badge>
              <Badge variant="outline" className={data.isCorrect ? 'border-success/30 bg-success-soft text-success' : data.isOmitted ? 'border-warning/30 bg-warning-soft text-warning' : 'border-danger/30 bg-danger-soft text-danger'}>{status}</Badge>
              <span className="text-caption text-muted-foreground">{formatQuestionDuration(data.activeDurationMs)}</span>
            </div>
            <Button variant="outline" size="sm" aria-expanded={explanationOpen} aria-controls={explanationId} onClick={() => setExplanationOpen(value => !value)}>{explanationOpen ? 'Hide explanation' : 'Show explanation'}</Button>
          </div>

          {promptBlocks.length > 0 && <BlockRenderer blocks={promptBlocks} subject={examSubject} readOnly variant="exam" appearance="theme" />}
          <div className="exam-content font-medium text-foreground">
            <QuestionText text={data.questionText} subject={examSubject} />
          </div>

          {data.type === 'MCQ' && data.choices.length > 0 && (
            <div className="space-y-2" aria-label="Answer choices">
              {data.choices.map((choice, index) => {
                const label = String.fromCharCode(65 + index);
                const correct = data.correctAnswer != null && [label, choice.id, choice.text].includes(data.correctAnswer);
                const selected = data.userAnswer != null && [label, choice.id, choice.text].includes(data.userAnswer);
                const visuals = choiceBlocks[choice.id] || choiceBlocks[label] || [];
                const showText = !visuals.length || !isChoiceVisualPlaceholder(choice.text, choice.id || label);
                return (
                  <div key={`${choice.id}-${index}`} role="group" aria-label={`Choice ${label}${selected ? ', your answer' : ''}${correct ? ', correct answer' : ''}`} className={`flex gap-3 rounded-control border p-3 ${correct ? 'border-success/40 bg-success-soft' : selected ? 'border-danger/40 bg-danger-soft' : 'border-ui-border bg-surface'}`}>
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-semibold ${correct ? 'border-success text-success' : selected ? 'border-danger text-danger' : 'border-ui-border text-muted-foreground'}`}>{label}</span>
                    <div className="min-w-0 flex-1 exam-content text-foreground">{showText && <QuestionText text={choice.text} subject={examSubject} />}{visuals.length > 0 && <BlockRenderer blocks={visuals} subject={examSubject} readOnly variant="exam" appearance="theme" />}</div>
                    {correct ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Correct answer" /> : selected ? <XCircle className="size-5 shrink-0 text-danger" aria-label="Your answer" /> : null}
                  </div>
                );
              })}
            </div>
          )}

          {data.type === 'SPR' && <div className="flex flex-wrap items-center gap-2" aria-label="Answer review">
            <ResponseBadge label="Your answer" value={data.isOmitted ? 'Omitted' : data.userAnswer || '—'} tone={data.isOmitted ? 'warning' : data.isCorrect ? 'success' : 'danger'} />
            {!data.isCorrect && <ResponseBadge label="Correct answer" value={data.correctAnswer ?? '—'} tone="success" />}
          </div>}
        </section>

        {explanationOpen && <section id={explanationId} className="rounded-card border border-ui-border bg-muted/20 p-4 sm:p-5" aria-label="Explanation">
          <h3 className="text-title font-semibold text-foreground">Explanation</h3>
          {data.explanation ? (
            <div className="mt-4 exam-content text-foreground">
              <QuestionText text={data.explanation} subject={examSubject} />
            </div>
          ) : (
            <p className="mt-3 text-body text-muted-foreground">No explanation was provided for this question.</p>
          )}
        </section>}
      </div>
      </DictionaryLookup>
    </Modal>
  );
}

function QuestionText({ text, subject }: { text: string; subject: 'RW' | 'MATH' }) {
  return subject === 'MATH'
    ? <FormattedTextRenderer text={text} latexOnly />
    : <InteractiveText content={text} readOnly inheritTypography />;
}

function ResponseBadge({ label, value, tone }: { label: string; value: string; tone: 'success' | 'danger' | 'warning' }) {
  const toneClass = tone === 'success' ? 'border-success/30 bg-success-soft text-success' : tone === 'warning' ? 'border-warning/30 bg-warning-soft text-warning' : 'border-danger/30 bg-danger-soft text-danger';
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? MinusCircle : XCircle;
  return <Badge variant="outline" className={`h-auto max-w-full whitespace-normal break-all px-3 py-2 text-body ${toneClass}`} aria-label={`${label}: ${value}`}><Icon aria-hidden="true" />{value}</Badge>;
}

function formatQuestionDuration(milliseconds: number | null) {
  if (milliseconds === null || !Number.isFinite(milliseconds)) return 'Timing unavailable';
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes ? `${minutes}m ` : ''}${seconds % 60}s`;
}
