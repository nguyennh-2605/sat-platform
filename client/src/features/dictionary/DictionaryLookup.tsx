import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { QuizToolContext } from '@/context/quiz-tool-context';
import axiosClient from '@/lib/axios';
import { DictionaryContext, normalizeSelectedWord } from './dictionary-context';
import { SaveVocabularyWord } from './SaveVocabularyWord';

interface SelectionState { word: string; rect: DOMRect; annotations: boolean; mode: 'action' | 'definition' }
interface DictionarySense { definition: string; examples: string[]; synonyms: string[]; tags: string[] }
interface DictionaryEntry { partOfSpeech: string; pronunciations: string[]; senses: DictionarySense[] }
interface DictionaryResult { word: string; baseWord?: string; found: boolean; entries: DictionaryEntry[]; sourceUrl: string; licenseUrl: string }

export function DictionaryLookup({ enabled = true, contentKey, children }: { enabled?: boolean; contentKey: string | number; children: ReactNode }) {
  return enabled ? <LookupSurface key={contentKey}>{children}</LookupSurface> : <>{children}</>;
}

function LookupSurface({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const lastRange = useRef<Range | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const quizTool = useContext(QuizToolContext);
  // Popper reads the current selection bounds without inserting an anchor into question text.
  const rect = selection?.rect;
  const anchor = useMemo(() => ({ current: { getBoundingClientRect: () => rect ?? new DOMRect() } }), [rect]);

  const readSelection = useCallback(() => {
    const current = window.getSelection();
    if (!current || current.isCollapsed || !current.rangeCount || !root.current?.contains(current.anchorNode) || !root.current.contains(current.focusNode)) return null;
    const element = current.anchorNode instanceof Element ? current.anchorNode : current.anchorNode?.parentElement;
    const region = element?.closest('[data-dictionary-text]');
    const range = current.getRangeAt(0);
    if (!region || !region.contains(range.endContainer) || element?.closest('.katex, input, textarea, [contenteditable="true"]')) return null;
    const word = normalizeSelectedWord(current.toString());
    if (!word) return null;
    return { word, range, rect: range.getBoundingClientRect(), annotations: region.getAttribute('data-dictionary-annotations') === 'true' };
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (document.activeElement?.closest('[data-dictionary-lookup]')) return;
        const next = readSelection();
        if (!next) {
          lastRange.current = null;
          setSelection(value => value?.mode === 'definition' ? value : null);
          return;
        }
        if (lastRange.current && next.range.compareBoundaryPoints(Range.START_TO_START, lastRange.current) === 0 && next.range.compareBoundaryPoints(Range.END_TO_END, lastRange.current) === 0) return;
        lastRange.current = next.range.cloneRange();
        setSelection({ word: next.word, rect: next.rect, annotations: next.annotations, mode: 'action' });
      });
    };
    const dismissOnMove = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-dictionary-lookup]')) return;
      setSelection(null);
    };
    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', dismissOnMove, true);
    window.addEventListener('resize', dismissOnMove);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('scroll', dismissOnMove, true);
      window.removeEventListener('resize', dismissOnMove);
    };
  }, [readSelection]);

  const lookUp = () => {
    const current = readSelection();
    if (current) setSelection({ word: current.word, rect: current.rect, annotations: current.annotations, mode: 'definition' });
    else setSelection(value => value ? { ...value, mode: 'definition' } : null);
  };
  const open = Boolean(selection && (selection.mode === 'definition' || !selection.annotations || !quizTool?.isHighlightMode));
  return <DictionaryContext.Provider value={{ selectedWord: selection?.word ?? null, lookUp }}>
    <div ref={root} className="contents" data-dictionary-surface>
      {children}
      <Popover open={open} onOpenChange={value => { if (!value) setSelection(null); }}>
        <PopoverAnchor virtualRef={anchor} />
        {selection && <PopoverContent
          data-dictionary-lookup
          aria-label={selection.mode === 'definition' ? `Definition of ${selection.word}` : 'Selected word actions'}
          side="top" collisionPadding={12}
          className={selection.mode === 'action' ? 'w-auto p-1' : 'w-80 max-w-[calc(100vw-1.5rem)] p-0'}
          onOpenAutoFocus={event => event.preventDefault()}
          onCloseAutoFocus={event => event.preventDefault()}
        >
          {selection.mode === 'action' ? <Button variant="ghost" size="sm" onPointerDown={event => event.preventDefault()} onClick={lookUp}><Search aria-hidden="true" />Look up</Button> : <Definition key={selection.word} word={selection.word} onClose={() => setSelection(null)} />}
        </PopoverContent>}
      </Popover>
    </div>
  </DictionaryContext.Provider>;
}

function Definition({ word, onClose }: { word: string; onClose: () => void }) {
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
    const controller = new AbortController();
    axiosClient.get<{ data: DictionaryResult }>(`/api/dictionary/en/${encodeURIComponent(word)}`, { signal: controller.signal, timeout: 12000 })
      .then(response => { if (!controller.signal.aborted) setResult(response.data); })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        const code = (failure as { response?: { data?: { code?: string }; status?: number } }).response;
        setError(code?.status === 429 || code?.data?.code === 'DICTIONARY_RATE_LIMITED' ? 'The dictionary is temporarily busy. Please try again later.' : 'Unable to load the definition. Please try again.');
      });
    return () => controller.abort();
  }, [word, retry]);

  const total = result?.entries.reduce((count, entry) => count + entry.senses.length, 0) ?? 0;
  return <>
    <div className="flex items-center justify-between gap-3 border-b border-ui-border px-4 py-2">
      <div className="min-w-0"><h3 className="break-words font-semibold">{word}</h3>{result?.baseWord && <p className="text-caption text-muted-foreground">Base form: {result.baseWord}</p>}</div>
      <Button ref={closeButton} variant="ghost" size="icon-sm" aria-label="Close definition" onClick={onClose}><X /></Button>
    </div>
    <div className="max-h-[min(24rem,55dvh)] overflow-y-auto p-4 text-body" aria-live="polite">
      {error ? <div role="alert"><p>{error}</p><Button className="mt-3" variant="outline" size="sm" onClick={() => { setError(null); setResult(null); setRetry(value => value + 1); }}>Retry</Button></div> : !result ? <p role="status" className="text-muted-foreground">Looking up…</p> : !result.found ? <p className="text-muted-foreground">No definition found.</p> : <div className="space-y-4">
        {result.entries.map((entry, index) => {
          const preceding = result.entries.slice(0, index).reduce((count, previous) => count + previous.senses.length, 0);
          const senses = expanded ? entry.senses : entry.senses.slice(0, Math.max(0, 4 - preceding));
          if (!senses.length) return null;
          return <section key={index}>
            <div className="mb-2 flex flex-wrap gap-x-2 text-caption text-muted-foreground"><span className="font-medium">{entry.partOfSpeech}</span>{entry.pronunciations[0] && <span>{entry.pronunciations[0]}</span>}</div>
            <ol className="list-decimal space-y-2 pl-5">
              {senses.map((sense, senseIndex) => <li key={senseIndex} className="break-words pl-1"><p>{sense.definition}</p>{sense.examples[0] && <p className="mt-1 text-caption italic text-muted-foreground">{sense.examples[0]}</p>}{sense.synonyms.length > 0 && <p className="mt-1 text-caption text-muted-foreground">Synonyms: {sense.synonyms.slice(0, 4).join(', ')}</p>}</li>)}
            </ol>
          </section>;
        })}
        {total > 4 && <Button variant="ghost" size="sm" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : 'Show more'}</Button>}
      </div>}
    </div>
    {result?.found && <div className="border-t border-ui-border p-4"><SaveVocabularyWord word={word} /></div>}
    {result && <div className="border-t border-ui-border px-4 py-2 text-caption text-muted-foreground">
      <a className="underline underline-offset-2" href={result.sourceUrl} target="_blank" rel="noopener noreferrer">Wiktionary</a>{' via '}<a className="underline underline-offset-2" href="https://freedictionaryapi.com/" target="_blank" rel="noopener noreferrer">FreeDictionaryAPI.com</a>{' · '}<a className="underline underline-offset-2" href={result.licenseUrl} target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>
    </div>}
  </>;
}
