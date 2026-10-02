import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import BlockRenderer from '@/components/content/BlockRenderer';
import FormattedTextRenderer from '@/components/content/TextRenderer';
import { isChoiceVisualPlaceholder, splitChoiceVisuals } from '@/components/content/choiceVisuals';
import { Badge, Modal } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import InteractiveText from '@/features/quiz/InteractiveText';
import type { BankQuestion, BankQuestionDifficulty, BankSubject } from './question-bank.types';
import { questionIdLabel } from './question-bank.utils';

export function QuestionDifficultyBadge({ difficulty }: { difficulty: BankQuestionDifficulty }) {
  const tone = difficulty === 'HARD' ? 'danger' : difficulty === 'MEDIUM' ? 'warning' : 'success';
  return <Badge tone={tone}>{difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}</Badge>;
}

export function QuestionPreviewModal({ question, questions, onQuestionChange, onClose }: { question: BankQuestion | null; questions: BankQuestion[]; onQuestionChange: (question: BankQuestion) => void; onClose: () => void }) {
  if (!question) return null;
  const questionIndex = questions.findIndex(item => item.id === question.id);
  const previousQuestion = questionIndex > 0 ? questions[questionIndex - 1] : null;
  const nextQuestion = questionIndex >= 0 && questionIndex < questions.length - 1 ? questions[questionIndex + 1] : null;
  const { promptBlocks, choiceBlocks } = splitChoiceVisuals(question.blocks);
  return <Modal
    open
    onClose={onClose}
    closeOnBackdrop
    presentation="content-dialog"
    title={`Question ${questionIdLabel(question.id)}`}
    subtitle={`${question.subject === 'RW' ? 'Reading & Writing' : 'Math'} · ${question.domain.name} · ${question.skill.name}`}
    className="h-[calc(100vh-2rem)] max-w-6xl!"
    footer={<div className="flex w-full flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Button variant="outline" disabled={!previousQuestion} onClick={() => previousQuestion && onQuestionChange(previousQuestion)}><ArrowLeft />Previous</Button><Button variant="outline" disabled={!nextQuestion} onClick={() => nextQuestion && onQuestionChange(nextQuestion)}>Next<ArrowRight /></Button></div><Button variant="outline" onClick={onClose}>Close</Button></div>}
  >
    <div key={question.id} className="grid h-full min-h-0 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
      <section className="space-y-5 rounded-card border border-ui-border bg-surface p-4 sm:p-5" aria-label="Question and answers">
        <div className="flex flex-wrap items-center gap-2"><Badge tone="neutral">{question.type === 'MCQ' ? 'Multiple choice' : 'Student-produced response'}</Badge><QuestionDifficultyBadge difficulty={question.difficulty} /><Badge tone={question.status === 'PUBLISHED' ? 'success' : question.status === 'ARCHIVED' ? 'neutral' : 'warning'}>{question.status.toLowerCase()}</Badge></div>
        {promptBlocks.length > 0 && <BlockRenderer blocks={promptBlocks} subject={question.subject} readOnly variant="exam" />}
        <div className="exam-content font-medium text-foreground"><QuestionContent text={question.questionText} subject={question.subject} /></div>
        {question.type === 'MCQ' && question.choices.length > 0 && <div className="space-y-2" aria-label="Answer choices">{question.choices.map(choice => {
          const correct = choice.id === question.correctAnswer;
          const visuals = choiceBlocks[choice.id] || [];
          const showText = !visuals.length || !isChoiceVisualPlaceholder(choice.text, choice.id);
          return <div key={choice.id} className={`flex gap-3 rounded-control border p-3 ${correct ? 'border-success/40 bg-success-soft' : 'border-ui-border bg-surface'}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-semibold ${correct ? 'border-success text-success' : 'border-ui-border text-muted-foreground'}`}>{choice.id}</span><div className="min-w-0 flex-1 exam-content">{showText && <QuestionContent text={choice.text} subject={question.subject} />}{visuals.length > 0 && <BlockRenderer blocks={visuals} subject={question.subject} readOnly variant="exam" />}</div>{correct && <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Correct answer" />}</div>;
        })}</div>}
        {question.type === 'SPR' && <div className="flex items-center justify-between gap-3 rounded-control border border-success/30 bg-success-soft p-3"><span className="text-body text-muted-foreground">Correct answer</span><span className="font-semibold text-success">{question.correctAnswer || '—'}</span></div>}
      </section>
      <section className="rounded-card border border-ui-border bg-muted/20 p-4 sm:p-5" aria-label="Explanation"><h3 className="text-title font-semibold text-foreground">Explanation</h3>{question.explanation ? <div className="mt-4 exam-content text-foreground"><QuestionContent text={question.explanation} subject={question.subject} /></div> : <p className="mt-3 text-body text-muted-foreground">No explanation was provided for this question.</p>}</section>
    </div>
  </Modal>;
}

function QuestionContent({ text, subject }: { text: string; subject: BankSubject }) {
  return subject === 'MATH' ? <FormattedTextRenderer text={text} latexOnly /> : <InteractiveText content={text} readOnly inheritTypography />;
}
