import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VocabularyQuestion } from './VocabularyQuestion';
import { DictionaryDefinitionCredit } from '@/features/dictionary/DictionaryDefinitionCredit';
import { useDashboardBack } from '@/features/navigation/DashboardBackContext';
import axiosClient from '@/lib/axios';
import { ui } from '@/components/ui/styles';
import { vocabularyError, type DailySession } from './practice.types';

export function DailyPracticeWorkspace({ initialSession, onBack }: { initialSession: DailySession; onBack: () => void }) {
  const [session, setSession] = useState(initialSession);
  const [index, setIndex] = useState(() => { const next = initialSession.questions.findIndex(question => !question.selectedMeaning); return next < 0 ? initialSession.questions.length : next; });
  const [revealed, setRevealed] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const nextButton = useRef<HTMLButtonElement>(null);
  const question = session.questions[index];
  const answered = Boolean(question?.selectedMeaning);
  const recall = question?.options.length === 0;
  useEffect(() => { if (answered && !saving) nextButton.current?.focus({ preventScroll: true }); }, [answered, saving]);
  useDashboardBack(() => { if (!inFlight.current) onBack(); }, true, 6);
  const answer = async (selectedMeaning: string) => {
    if (!question || answered || inFlight.current) return;
    inFlight.current = true; setSaving(true); setError('');
    try { setSession(await axiosClient.post<DailySession>(`/api/vocabulary/sessions/${session.id}/questions/${question.id}/answer`, recall ? { mastery: selectedMeaning } : { selectedMeaning }, { timeout: 15000 })); }
    catch (failure) {
      // An answer may have reached the server even if its response was lost.
      // Recover the persisted state before allowing another submission.
      try {
        const recovered = await axiosClient.get<DailySession>(`/api/vocabulary/sessions/${session.id}`, { timeout: 10000 });
        setSession(recovered);
        if (!recovered.questions.find(item => item.id === question.id)?.selectedMeaning) setError(vocabularyError(failure, 'Your answer was not saved. Please try again.'));
      } catch { setError('Unable to confirm your answer. Reopen practice to recover your saved progress.'); }
    } finally { inFlight.current = false; setSaving(false); }
  };
  const next = () => { if (!answered || inFlight.current) return; setIndex(value => value + 1); setRevealed(false); setSelectedAnswer(''); setError(''); };
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || inFlight.current || !question || (event.target as HTMLElement)?.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if (answered && event.key === 'Enter') { event.preventDefault(); next(); }
      else if (recall && !answered && event.code === 'Space') { event.preventDefault(); setRevealed(true); }
      else if (!answered && recall && revealed && ['1', '2'].includes(event.key)) { event.preventDefault(); void answer(event.key === '1' ? 'LEARNING' : 'KNOW'); }
      else if (!answered && !recall && selectedAnswer && event.key === 'Enter') { event.preventDefault(); void answer(selectedAnswer); }
      else if (!answered && !recall && /^[1-4]$/.test(event.key)) { event.preventDefault(); const option = question.options[Number(event.key) - 1]; if (option) setSelectedAnswer(option); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  });
  return <div className={ui.page}><main className="min-h-0 flex-1 overflow-y-auto"><div className={`${ui.content} !max-w-[980px] !pt-5`}>
    <div className="flex min-h-9 items-center justify-center"><h1 className="text-title font-semibold text-foreground">Daily practice</h1></div>
    {!question ? <Card><CardContent className="py-8 text-center sm:py-12"><CheckCircle2 className="mx-auto mb-4 size-10 text-success" /><h1 className="text-2xl font-semibold tracking-tight">Practice complete</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">You practised {session.answeredCount} words. {session.correctCount} remembered, {session.answeredCount - session.correctCount} to revisit. Your next reviews are scheduled.</p><div className="mt-6"><Button onClick={onBack}>Back to vocabulary<ArrowRight /></Button></div></CardContent></Card> : <>
      <VocabularyQuestion question={question} index={index} totalItems={session.totalItems} selectedAnswer={selectedAnswer} saving={saving} error={error} onSelect={setSelectedAnswer} onSubmit={() => void answer(selectedAnswer)} onNext={next} nextButtonRef={nextButton} nextLabel={index + 1 === session.totalItems ? 'Finish practice' : 'Next word'} recallContent={<div>
        {revealed || answered ? <div className="space-y-3"><p className="text-lg leading-7">{question.meaning}</p>{question.translation && !answered && <p className="text-sm text-muted-foreground">{question.translation}</p>}{question.dictionaryDefinition && <DictionaryDefinitionCredit word={question.prompt} />}</div> : <div className="rounded-lg border border-dashed p-6 text-center"><p className="mb-4 text-sm text-muted-foreground">Say the meaning to yourself, then check.</p><Button variant="outline" onClick={() => setRevealed(true)}>Reveal meaning<span className="hidden text-xs text-muted-foreground sm:inline">Space</span></Button></div>}
        {revealed && !answered && <div className="mt-6 grid grid-cols-2 gap-3"><Button variant="outline" disabled={saving} onClick={() => void answer('LEARNING')}><RotateCcw />Forgot<span className="hidden text-xs sm:inline">1</span></Button><Button disabled={saving} onClick={() => void answer('KNOW')}><Check />Remembered<span className="hidden text-xs sm:inline">2</span></Button></div>}
      </div>} />
      <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">You can leave and resume later. Reviews adapt to your answers.</p>
    </>}
  </div></main></div>;
}
