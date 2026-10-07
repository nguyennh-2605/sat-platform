import { useId, type ReactNode, type Ref } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DictionaryDefinitionCredit } from '@/features/dictionary/DictionaryDefinitionCredit';
import { formatNextReview, type PracticeQuestion } from './practice.types';

interface VocabularyQuestionProps {
  question: PracticeQuestion & { exampleSentence?: string | null };
  index: number;
  totalItems: number;
  selectedAnswer: string;
  saving: boolean;
  error?: string;
  onSelect: (answer: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextButtonRef?: Ref<HTMLButtonElement>;
  recallContent?: ReactNode;
}

export function VocabularyQuestion({ question, index, totalItems, selectedAnswer, saving, error, onSelect, onSubmit, onNext, nextLabel = 'Next question', nextButtonRef, recallContent }: VocabularyQuestionProps) {
  const headingId = useId();
  const answered = Boolean(question.selectedMeaning);
  const recall = question.options.length === 0;
  return <section aria-labelledby={headingId} className="mt-6">
    <div className="flex items-center justify-between gap-4"><p className="text-caption font-semibold uppercase tracking-wide text-primary">Question {index + 1} of {totalItems}</p><p className="text-caption text-muted-foreground">{recall ? 'Recall the meaning' : 'Choose one answer'}</p></div>
    <Progress className="mt-3 h-1.5" value={(index + 1) / totalItems * 100} aria-label={`Question ${index + 1} of ${totalItems}`} />
    <Card className="mt-7 gap-0 overflow-hidden p-0">
      <div className="border-b border-ui-border bg-muted/40 px-6 py-5 text-center"><p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Target word</p><h2 id={headingId} className="mt-4 break-words text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-tight text-foreground">{question.prompt}</h2>{question.translation && answered && <p className="mt-3 text-title font-medium text-foreground">{question.translation}</p>}</div>
      <CardContent className="p-5 sm:p-7">
        {recall ? recallContent : <><p className="text-title font-semibold text-foreground">Which meaning best matches this word?</p><div className="mt-5 grid gap-3">{question.options.map((option, optionIndex) => {
          const selected = (answered ? question.selectedMeaning : selectedAnswer) === option;
          const correct = answered && option === question.meaning;
          const incorrect = answered && selected && !question.isCorrect;
          return <Button key={option} variant="outline" aria-pressed={selected} disabled={answered || saving} onClick={() => onSelect(option)} className={`h-auto min-h-16 justify-start gap-4 whitespace-normal px-4 py-3 text-left ${answered ? 'disabled:opacity-100' : ''} ${correct ? 'border-success bg-success-soft text-success dark:border-success dark:bg-success-soft' : incorrect ? 'border-danger bg-danger-soft text-danger dark:border-danger dark:bg-danger-soft' : selected ? 'border-primary bg-primary-soft dark:border-primary dark:bg-primary-soft ring-1 ring-primary/20' : ''}`}><span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${correct ? 'bg-success text-white' : incorrect ? 'bg-danger text-white' : selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{String.fromCharCode(65 + optionIndex)}</span><span className="min-w-0 flex-1 break-words text-body font-medium">{option}</span>{correct && <Check size={19} />}{incorrect && <X size={19} />}</Button>;
        })}</div></>}
        {saving && <p role="status" className="mt-4 text-sm text-muted-foreground">Saving your answer…</p>}
        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        {answered && <div aria-live="polite" className={`mt-5 rounded-control border p-4 ${question.isCorrect ? 'border-success/25 bg-success-soft' : 'border-danger/20 bg-danger-soft'}`}><p className="font-semibold text-foreground">{recall ? question.isCorrect ? 'Remembered. Nicely done.' : 'We’ll bring this word back soon.' : question.isCorrect ? 'Correct — well done.' : 'Not quite — review the correct meaning.'}</p>{!recall && question.dictionaryDefinition && <DictionaryDefinitionCredit word={question.prompt} />}{question.nextDueAt && <p className="mt-2 text-xs text-muted-foreground">Next review: {formatNextReview(question.nextDueAt)}</p>}{question.exampleSentence && <p className="mt-1 text-caption italic text-muted-foreground">“{question.exampleSentence}”</p>}</div>}
      </CardContent>
    </Card>
    {(!recall || answered) && <div className="mt-5 flex justify-end"><Button ref={nextButtonRef} size="lg" className="min-w-40" disabled={saving || (!answered && !selectedAnswer)} onClick={answered ? onNext : onSubmit}>{answered ? nextLabel : 'Check answer'}<ChevronRight size={18} /></Button></div>}
  </section>;
}
