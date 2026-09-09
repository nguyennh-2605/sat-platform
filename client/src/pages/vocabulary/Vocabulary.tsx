import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Archive, BookOpen, Check, ChevronLeft, ChevronRight, Clock3, ClipboardCheck, Edit3, ListFilter, MoreHorizontal, Pause, Play, Plus, RotateCcw, Search, Send, Shuffle, Sparkles, Target, Trash2, Trophy, Volume2, X } from 'lucide-react';
import axiosClient from '../../lib/axios';
import { Badge, Card, EmptyState, LoadingBar, Modal, PageHeader, Select, Tabs, type TabItem } from '../../components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '../../components/ui/DateTimePicker';
import { appToast } from '../../components/ui/toast';
import { ui } from '../../components/ui/styles';
import { useDashboardBack } from '../../features/navigation/DashboardBackContext';
import { cachedGet, invalidateQueryCache } from '../../lib/queryCache';
import { DataPagination, DataSurface, DataToolbar, DataToolbarActions, DataToolbarGroup, DataToolbarSearch } from '@/components/ui/data-surface';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type DetailTab = 'TERMS' | 'FLASHCARDS' | 'QUIZ';
type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';
type ProgressFilter = 'ALL' | 'MASTERED' | 'LEARNING' | 'NOT_STUDIED';
type QuizMasteryFilter = ProgressFilter;
interface QuizConfig { startIndex: number; endIndex: number; masteries: Array<Exclude<QuizMasteryFilter, 'ALL'>>; restart?: boolean }
interface StudyConfig extends QuizConfig { questionCount?: number; shuffle: boolean; sourceTermIds?: string[]; restart?: boolean }
interface ActiveStudySession { id: string; mode: 'FLASHCARD' | 'QUIZ'; answeredCount: number; totalItems: number; rangeStart?: number | null; rangeEnd?: number | null; nextSourceOrder?: number | null; shuffle: boolean; startedAt: string; lastActivityAt: string }

interface SetSummary {
  id: string; title: string; description?: string | null; scope: 'SYSTEM' | 'PERSONAL'; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; termCount: number; studiedCount: number; learningCount: number; masteredCount: number; lastStudiedAt?: string | null; activeFlashcardSession?: ActiveStudySession | null; activeQuizSession?: ActiveStudySession | null; ownerId?: number | null; createdAt: string; updatedAt: string; assignedActivityId?: string;
}
interface Term { id?: string; sourceTermId?: string | null; word: string; meaning: string; translation: string; exampleSentence?: string | null; progress?: { mastery: string; seenCount?: number; lastReviewedAt?: string | null } | null }
interface SetDetail extends SetSummary { canEdit: boolean; version: number; terms: Term[] }
interface StudyQuestion { id: string; sourceTermId?: string | null; prompt: string; order: number; sourceOrder?: number | null; options: string[]; selectedMeaning?: string | null; isCorrect?: boolean | null; meaning?: string; translation?: string; exampleSentence?: string | null }
interface StudySession { id: string; setId: string; activityId?: string | null; mode: 'FLASHCARD' | 'QUIZ'; status: 'IN_PROGRESS' | 'COMPLETED'; totalItems: number; answeredCount: number; correctCount: number; score: number; rangeStart?: number | null; rangeEnd?: number | null; shuffle: boolean; startedAt: string; lastActivityAt: string; questions: StudyQuestion[] }
interface InlineTermDraft { word: string; meaning: string; translation: string; exampleSentence: string }
interface ClassInfo { id: string; name: string }
interface VocabularyActivity { id: string; title: string; dueAt?: string | null; completionRule: string; passingScore?: number | null; maxAttempts: number; vocabulary: { vocabularySet: SetSummary; items: Term[] }; class: { id: string; name: string } }

const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
const PAGE_SIZE = 40;
const collectionKey = (set: SetSummary) => set.assignedActivityId ? `activity:${set.assignedActivityId}` : `set:${set.id}`;
const createDraftTerm = (): Term => ({ id: crypto.randomUUID(), word: '', meaning: '', translation: '', exampleSentence: '' });
const formatStudyDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

const mergeAssignedActivityDetail = (detail: SetDetail, activity: VocabularyActivity): SetDetail => {
  const progressByTerm = new Map(detail.terms.map(term => [term.id, term.progress]));
  const terms = activity.vocabulary.items.map(item => ({ ...item, id: item.sourceTermId || item.id, progress: progressByTerm.get(item.sourceTermId || item.id) || null }));
  const studiedTerms = terms.filter(term => (term.progress?.seenCount || 0) > 0);
  const lastStudiedAt = studiedTerms.reduce<string | null>((latest, term) => {
    const reviewedAt = term.progress?.lastReviewedAt || null;
    return reviewedAt && (!latest || reviewedAt > latest) ? reviewedAt : latest;
  }, null);
  return {
    ...detail,
    termCount: terms.length,
    studiedCount: studiedTerms.length,
    learningCount: studiedTerms.filter(term => term.progress?.mastery === 'LEARNING').length,
    masteredCount: studiedTerms.filter(term => term.progress?.mastery === 'MASTERED').length,
    lastStudiedAt,
    terms,
  };
};

const loadCollection = async (set: SetSummary, force = false) => {
  if (!set.assignedActivityId) {
    return {
      detail: await cachedGet<SetDetail>(`/api/vocabulary/sets/${set.id}`, { ttlMs: 30_000, force }),
      activity: null as VocabularyActivity | null,
    };
  }
  const activity = await cachedGet<VocabularyActivity>(`/api/vocabulary/activities/${set.assignedActivityId}`, { ttlMs: 30_000, force });
  const detail = await cachedGet<SetDetail>(`/api/vocabulary/sets/${set.id}?activityId=${set.assignedActivityId}`, { ttlMs: 30_000, force });
  return { detail: mergeAssignedActivityDetail(detail, activity), activity };
};

export default function Vocabulary() {
  const [searchParams, setSearchParams] = useSearchParams();
  const role = (localStorage.getItem('userRole') || 'STUDENT') as UserRole;
  const assignToClassId = searchParams.get('assignTo') || '';
  const requestedSetId = searchParams.get('set') || '';
  const [systemSets, setSystemSets] = useState<SetSummary[]>([]);
  const [personalSets, setPersonalSets] = useState<SetSummary[]>([]);
  const [assignedSets, setAssignedSets] = useState<SetSummary[]>([]);
  const [currentSet, setCurrentSet] = useState<SetDetail | null>(null);
  const [currentActivity, setCurrentActivity] = useState<VocabularyActivity | null>(null);
  const [wordQuery, setWordQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('ALL');
  const [wordPage, setWordPage] = useState(1);
  const [selectedWord, setSelectedWord] = useState<Term | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selected, setSelected] = useState<SetDetail | null>(null);
  const [activity, setActivity] = useState<VocabularyActivity | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('TERMS');
  const [creatingSet, setCreatingSet] = useState(false);
  const [editingSet, setEditingSet] = useState<SetDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SetSummary | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [studySetupOpen, setStudySetupOpen] = useState(false);
  const [studyConfig, setStudyConfig] = useState<StudyConfig | null>(null);
  const [quizSetupOpen, setQuizSetupOpen] = useState(false);
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
  const requestIdRef = useRef(0);
  const currentCollectionKeyRef = useRef('');

  const loadSets = useCallback(async (force = false) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const [system, personal, assigned] = await Promise.all([
        cachedGet<SetSummary[]>('/api/vocabulary/sets?scope=SYSTEM', { ttlMs: 60_000, force }),
        cachedGet<SetSummary[]>('/api/vocabulary/sets?scope=MINE', { ttlMs: 60_000, force }),
        role === 'STUDENT' ? cachedGet<SetSummary[]>('/api/vocabulary/sets?scope=ASSIGNED', { ttlMs: 60_000, force }) : Promise.resolve([]),
      ]);
      if (requestId !== requestIdRef.current) return;
      setSystemSets(system);
      setPersonalSets(personal);
      setAssignedSets(assigned);
      const choices = [...system, ...personal, ...assigned];
      const preferred = choices.find(item => collectionKey(item) === currentCollectionKeyRef.current)
        || choices.find(item => item.id === requestedSetId)
        || system.find(item => item.status === 'PUBLISHED')
        || system[0]
        || personal[0]
        || assigned[0];
      if (preferred) {
        const result = await loadCollection(preferred, force);
        if (requestId !== requestIdRef.current) return;
        currentCollectionKeyRef.current = collectionKey(preferred);
        setCurrentSet(result.detail);
        setCurrentActivity(result.activity);
      } else {
        setCurrentSet(null);
        setCurrentActivity(null);
      }
      setHasLoaded(true);
    } catch (error) { appToast.error(errorMessage(error, 'Unable to load vocabulary sets.')); }
    finally { if (requestId === requestIdRef.current) setLoading(false); }
  }, [requestedSetId, role]);

  useEffect(() => { void loadSets(); }, [loadSets]);

  useEffect(() => {
    const activityId = searchParams.get('activity');
    const setId = searchParams.get('set');
    if (!activityId && setId) {
      axiosClient.get<SetDetail, SetDetail>(`/api/vocabulary/sets/${setId}`)
        .then(detail => {
          currentCollectionKeyRef.current = `set:${detail.id}`;
          setCurrentActivity(null);
          setCurrentSet(detail);
          setSelected(null);
          setWordQuery('');
          setProgressFilter('ALL');
          setWordPage(1);
        })
        .catch(error => appToast.error(errorMessage(error, 'Unable to open this vocabulary set.')));
      return;
    }
    if (!activityId) return;
    axiosClient.get<VocabularyActivity, VocabularyActivity>(`/api/vocabulary/activities/${activityId}`)
      .then(async result => {
        setActivity(result);
        const detail = await axiosClient.get<SetDetail, SetDetail>(`/api/vocabulary/sets/${result.vocabulary.vocabularySet.id}?activityId=${activityId}`);
        setSelected(mergeAssignedActivityDetail(detail, result));
        setDetailTab(result.completionRule === 'SCORE_AT_LEAST' && result.vocabulary.items.length >= 4 ? 'QUIZ' : 'FLASHCARDS');
      })
      .catch(error => appToast.error(errorMessage(error, 'Unable to open the assigned vocabulary.')));
  }, [searchParams]);

  useEffect(() => {
    if (assignToClassId && currentSet && (role === 'TEACHER' || role === 'ADMIN')) setAssignOpen(true);
  }, [assignToClassId, currentSet, role]);

  const selectCollection = useCallback(async (set: SetSummary) => {
    const requestId = ++requestIdRef.current;
    currentCollectionKeyRef.current = collectionKey(set);
    setLoading(true);
    try {
      const result = await loadCollection(set);
      if (requestId !== requestIdRef.current) return;
      setCurrentSet(result.detail);
      setCurrentActivity(result.activity);
      setWordQuery('');
      setProgressFilter('ALL');
      setWordPage(1);
      setSelectedWord(null);
    } catch (error) { appToast.error(errorMessage(error, 'Unable to open this vocabulary set.')); }
    finally { if (requestId === requestIdRef.current) setLoading(false); }
  }, []);

  const openMode = useCallback((tab: Exclude<DetailTab, 'TERMS'>) => {
    if (!currentSet) return;
    setSelected(currentSet);
    setActivity(currentActivity);
    setDetailTab(tab);
  }, [currentActivity, currentSet]);
  const startFlashcards = useCallback((config: StudyConfig | null) => {
    setStudyConfig(config);
    openMode('FLASHCARDS');
  }, [openMode]);
  const openFlashcards = useCallback(() => {
    if (!currentSet) return;
    if (currentSet.activeFlashcardSession) {
      startFlashcards(null);
      return;
    }
    const allMasteries: StudyConfig['masteries'] = ['NOT_STUDIED', 'LEARNING', 'MASTERED'];
    if (currentActivity) {
      startFlashcards({ startIndex: 1, endIndex: currentSet.termCount, masteries: allMasteries, questionCount: currentSet.termCount, shuffle: false });
      return;
    }
    const notStudiedCount = Math.max(0, currentSet.termCount - currentSet.studiedCount);
    if (notStudiedCount > 0) {
      startFlashcards({ startIndex: 1, endIndex: currentSet.termCount, masteries: ['NOT_STUDIED'], questionCount: Math.min(10, notStudiedCount), shuffle: false });
      return;
    }
    if (currentSet.learningCount > 0) {
      startFlashcards({ startIndex: 1, endIndex: currentSet.termCount, masteries: ['LEARNING'], questionCount: currentSet.learningCount, shuffle: false });
      return;
    }
    startFlashcards({ startIndex: 1, endIndex: currentSet.termCount, masteries: allMasteries, questionCount: currentSet.termCount, shuffle: false });
  }, [currentActivity, currentSet, startFlashcards]);
  const openQuiz = useCallback(() => {
    if (currentSet?.activeQuizSession) {
      setQuizConfig(null);
      openMode('QUIZ');
      return;
    }
    setQuizSetupOpen(true);
  }, [currentSet?.activeQuizSession, openMode]);

  const closeDetail = () => {
    setSelected(null); setActivity(null); setDetailTab('TERMS'); setStudyConfig(null); setQuizConfig(null);
    invalidateQueryCache('/api/vocabulary');
    void loadSets(true);
    if (searchParams.has('activity') || searchParams.has('set') || searchParams.has('assignTo')) { const next = new URLSearchParams(searchParams); next.delete('activity'); next.delete('set'); next.delete('assignTo'); setSearchParams(next, { replace: true }); }
  };
  const closeAssignDialog = () => {
    setAssignOpen(false);
    if (searchParams.has('assignTo')) {
      const next = new URLSearchParams(searchParams);
      next.delete('assignTo');
      setSearchParams(next, { replace: true });
    }
  };
  useDashboardBack(
    editingSet ? () => setEditingSet(null) : creatingSet ? () => setCreatingSet(false) : closeDetail,
    Boolean(editingSet || creatingSet || selected),
    5,
  );

  const choices = useMemo(() => [...systemSets, ...personalSets, ...assignedSets], [assignedSets, personalSets, systemSets]);
  const currentKey = currentActivity ? `activity:${currentActivity.id}` : currentSet ? `set:${currentSet.id}` : '';
  const distinctMeanings = useMemo(() => new Set(currentSet?.terms.map(term => term.meaning.trim().toLocaleLowerCase('en-US')) || []).size, [currentSet?.terms]);
  const canQuiz = distinctMeanings >= 4;
  const deferredWordQuery = useDeferredValue(wordQuery);
  const filteredTerms = useMemo(() => currentSet?.terms.filter(term => {
    const needle = deferredWordQuery.trim().toLocaleLowerCase('en-US');
    const mastery = term.progress?.mastery || 'NOT_STUDIED';
    const matchesProgress = progressFilter === 'ALL' || mastery === progressFilter;
    const matchesQuery = !needle || [term.word, term.meaning, term.translation, term.exampleSentence].some(value => String(value || '').toLocaleLowerCase('en-US').includes(needle));
    return matchesProgress && matchesQuery;
  }) || [], [currentSet?.terms, deferredWordQuery, progressFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredTerms.length / PAGE_SIZE));
  const safeWordPage = Math.min(wordPage, pageCount);
  const visibleTerms = useMemo(() => filteredTerms.slice((safeWordPage - 1) * PAGE_SIZE, safeWordPage * PAGE_SIZE), [filteredTerms, safeWordPage]);

  if (editingSet) return <CollectionEditorScreen key={editingSet.id} role={role} set={editingSet} onBack={() => setEditingSet(null)} onSaved={async detail => { currentCollectionKeyRef.current = `set:${detail.id}`; setCurrentSet(detail); if (selected?.id === detail.id) setSelected(detail); setEditingSet(null); await loadSets(true); }} />;
  if (creatingSet) return <CollectionEditorScreen key="new-set" role={role} onBack={() => setCreatingSet(false)} onSaved={async detail => { currentCollectionKeyRef.current = `set:${detail.id}`; setCurrentSet(detail); setCurrentActivity(null); setCreatingSet(false); await loadSets(true); }} />;
  if (selected) return <SetWorkspace set={selected} activity={activity} tab={detailTab} onTab={setDetailTab} role={role} studyConfig={studyConfig} quizConfig={quizConfig} onBack={closeDetail} onEdit={() => setEditingSet(selected)} onTermSaved={detail => { setSelected(detail); setCurrentSet(detail); invalidateQueryCache('/api/vocabulary'); }} onAssign={() => setAssignOpen(true)} onRefresh={async () => { const refreshed = await loadCollection({ ...selected, assignedActivityId: activity?.id }, true); setSelected(refreshed.detail); setCurrentSet(refreshed.detail); }} assigner={<AssignDialog open={assignOpen} set={selected} initialClassId={assignToClassId} onClose={closeAssignDialog} />} />;

  return <div className={ui.page}>
    <main className="relative min-h-0 flex-1 overflow-y-auto"><LoadingBar active={loading} /><div className={ui.content}>
      <PageHeader title="Vocabulary" description="Build vocabulary through review and retrieval practice." />
      {!hasLoaded && loading ? <VocabularyHomeSkeleton /> : !currentSet ? <EmptyState icon={<BookOpen size={20} />} title="No vocabulary sets available" description="Create a personal set or ask an administrator to publish a system set." action={<Button variant="outline" onClick={() => setCreatingSet(true)}><Plus size={15} />New set</Button>} /> : <>
        <section aria-labelledby="vocabulary-sets-heading" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2"><h2 id="vocabulary-sets-heading" className="text-heading font-semibold text-foreground">Vocabulary sets</h2><span className="text-caption font-normal text-muted-foreground">{choices.length}</span></div>
            <Button variant="outline" size="sm" onClick={() => setCreatingSet(true)}><Plus size={15} />New set</Button>
          </div>
          <CollectionGrid sets={choices} currentKey={currentKey} onSelect={selectCollection} />
        </section>

        <SelectedSetSummary
          set={currentSet}
          activity={currentActivity}
          role={role}
          canQuiz={canQuiz}
          onReview={openFlashcards}
          onStudyOptions={() => setStudySetupOpen(true)}
          onQuiz={openQuiz}
          onQuizOptions={() => setQuizSetupOpen(true)}
          onAssign={() => setAssignOpen(true)}
          onEdit={() => setEditingSet(currentSet)}
          onDelete={() => setDeleteTarget(currentSet)}
        />

        <section aria-labelledby="set-words-heading" className="mt-10">
          <div className="mb-3 flex items-baseline gap-2"><h2 id="set-words-heading" className="text-heading font-semibold text-foreground">Words</h2><span className="text-caption font-normal text-muted-foreground">{currentSet.termCount}</span></div>
          <DataSurface>
            <DataToolbar>
              <DataToolbarGroup className="flex-1">
                <DataToolbarSearch value={wordQuery} onChange={event => { setWordQuery(event.target.value); setWordPage(1); }} placeholder="Search words…" label="Search words" />
              </DataToolbarGroup>
              <DataToolbarActions>
                <ProgressFilterMenu value={progressFilter} onChange={value => { setProgressFilter(value); setWordPage(1); }} />
              </DataToolbarActions>
            </DataToolbar>
            {visibleTerms.length > 0 && <div className="hidden grid-cols-[minmax(0,1.05fr)_minmax(0,1.55fr)_12rem] gap-6 border-b border-ui-border bg-muted/20 px-5 py-2.5 text-caption font-medium text-muted-foreground md:grid" aria-hidden="true"><span>Word</span><span>Definition</span><span className="text-right">Progress</span></div>}
            {visibleTerms.length ? <WordList terms={visibleTerms} onSelect={setSelectedWord} /> : <div className="px-4 py-8"><EmptyState compact surface={false} icon={<Search size={19} />} title={currentSet.terms.length ? 'No matching words' : 'No words in this set'} description={currentSet.terms.length ? 'Try another word, meaning, translation, or progress filter.' : 'Add words to this set before starting a review.'} action={currentSet.terms.length ? <Button variant="outline" size="sm" onClick={() => { setWordQuery(''); setProgressFilter('ALL'); }}>Clear filters</Button> : undefined} /></div>}
            <DataPagination><p className="text-caption text-muted-foreground">{filteredTerms.length ? `Showing ${(safeWordPage - 1) * PAGE_SIZE + 1}–${Math.min(safeWordPage * PAGE_SIZE, filteredTerms.length)} of ${filteredTerms.length} words` : 'Showing 0 words'}</p><Pagination page={safeWordPage} pageCount={pageCount} onChange={setWordPage} /></DataPagination>
          </DataSurface>
        </section>
      </>}
    </div></main>
    <DeleteCollectionDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={async deletedId => { if (currentSet?.id === deletedId) currentCollectionKeyRef.current = ''; setDeleteTarget(null); invalidateQueryCache('/api/vocabulary'); await loadSets(true); }} />
    <WordDetailSheet term={selectedWord} onOpenChange={open => { if (!open) setSelectedWord(null); }} />
    {currentSet && <AssignDialog open={assignOpen} set={currentSet} initialClassId={assignToClassId} onClose={closeAssignDialog} />}
    {currentSet && studySetupOpen && <StudySetupModal open set={currentSet} onClose={() => setStudySetupOpen(false)} onStart={config => { setStudySetupOpen(false); startFlashcards(config); }} />}
    {currentSet && quizSetupOpen && <QuizSetupModal open set={currentSet} onClose={() => setQuizSetupOpen(false)} onStart={config => { setQuizConfig(config); setQuizSetupOpen(false); setSelected(currentSet); setActivity(currentActivity); setDetailTab('QUIZ'); }} />}
  </div>;
}

const CollectionGrid = memo(function CollectionGrid({ sets, currentKey, onSelect }: { sets: SetSummary[]; currentKey: string; onSelect: (set: SetSummary) => void }) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sets.map(set => <CollectionCard key={collectionKey(set)} set={set} active={collectionKey(set) === currentKey} onClick={() => void onSelect(set)} />)}</div>;
});

function CollectionCard({ set, active, onClick }: { set: SetSummary; active: boolean; onClick: () => void }) {
  const studiedCount = set.studiedCount || 0;
  const coverage = set.termCount ? Math.round((studiedCount / set.termCount) * 100) : 0;
  const lastStudied = formatStudyDate(set.lastStudiedAt);
  return <Card className={`group relative min-h-28 overflow-hidden p-0 shadow-none transition-colors hover:bg-muted/40 ${active ? 'border-ui-border-strong bg-muted ring-1 ring-border' : 'border-ui-border bg-surface'}`}>
    <Button variant="ghost" onClick={onClick} aria-pressed={active} className="absolute inset-0 z-10 h-auto w-full rounded-card bg-transparent p-0 shadow-none hover:bg-transparent" aria-label={`Select ${set.title}`}><span className="sr-only">Select {set.title}</span></Button>
    <div className="pointer-events-none flex min-h-28 min-w-0 flex-col p-4 text-left">
      <span className="flex min-w-0 items-start justify-between gap-3"><span className="line-clamp-2 text-title font-semibold leading-5">{set.title}</span>{set.scope === 'SYSTEM' && !set.assignedActivityId && <Badge tone="neutral">System</Badge>}{set.assignedActivityId && <Badge tone="gold">Assigned</Badge>}</span>
      {set.description && <span className="mt-1.5 line-clamp-2 whitespace-normal text-caption font-normal leading-4 text-muted-foreground">{set.description}</span>}
      <span className="mt-auto flex items-center justify-between gap-3 pt-4 text-caption font-normal text-muted-foreground"><span>{studiedCount.toLocaleString()} / {set.termCount.toLocaleString()} studied</span><span>{coverage}%</span></span>
      <Progress value={coverage} aria-label={`${coverage}% of words studied`} className="mt-2" />
      <span className="mt-2 text-caption font-normal text-muted-foreground">{set.masteredCount.toLocaleString()} mastered{lastStudied ? ` · Last studied ${lastStudied}` : ''}</span>
    </div>
  </Card>;
}

function SelectedSetSummary({ set, activity, role, canQuiz, onReview, onStudyOptions, onQuiz, onQuizOptions, onAssign, onEdit, onDelete }: { set: SetDetail; activity: VocabularyActivity | null; role: UserRole; canQuiz: boolean; onReview: () => void; onStudyOptions: () => void; onQuiz: () => void; onQuizOptions: () => void; onAssign: () => void; onEdit: () => void; onDelete: () => void }) {
  const canAssign = (role === 'TEACHER' || role === 'ADMIN') && set.status === 'PUBLISHED' && !activity;
  const canManage = set.canEdit && (set.scope !== 'SYSTEM' || role === 'ADMIN');
  const canDelete = set.scope === 'PERSONAL' && !activity;
  const hasContextActions = !activity || canAssign || canManage || canDelete;
  const studiedCount = set.studiedCount ?? set.terms.filter(term => term.progress && term.progress.mastery !== 'NOT_STUDIED').length;
  const learningCount = set.learningCount ?? set.terms.filter(term => term.progress?.mastery === 'LEARNING').length;
  const activeStudy = set.activeFlashcardSession;
  const notStudiedCount = Math.max(0, set.termCount - studiedCount);
  const studyLabel = activeStudy
    ? 'Continue studying'
    : activity
      ? 'Start studying'
      : notStudiedCount > 0
        ? `Learn ${Math.min(10, notStudiedCount)} new`
        : learningCount > 0
          ? `Review ${learningCount} learning`
          : 'Review words';
  const StudyIcon = activeStudy || notStudiedCount === 0 ? RotateCcw : Play;
  const lastStudied = formatStudyDate(set.lastStudiedAt);
  const rangeLabel = activeStudy?.rangeStart && activeStudy.rangeEnd ? `Words ${activeStudy.rangeStart}–${activeStudy.rangeEnd}` : null;
  return <Card className="mt-6 p-5 shadow-none sm:p-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold tracking-tight text-foreground">{set.title}</h2>{activity ? <Badge tone="gold">Assigned</Badge> : set.scope === 'SYSTEM' ? <Badge tone="neutral">System</Badge> : null}{set.status !== 'PUBLISHED' && <Badge tone="warning">{set.status === 'DRAFT' ? 'Draft' : 'Archived'}</Badge>}</div>
        <p className="mt-2 text-caption font-medium text-muted-foreground">{set.termCount.toLocaleString()} words{lastStudied ? ` · Last studied ${lastStudied}` : ''}{activity ? ` · ${activity.class.name}` : ''}</p>
        <div className="mt-4 max-w-xl" aria-label={`${set.masteredCount} mastered, ${learningCount} learning, ${notStudiedCount} not studied`} role="img">
          <div className="flex flex-wrap items-center justify-between gap-2 text-caption"><span className="font-medium text-foreground">Learning progress</span><span className="text-muted-foreground">{set.masteredCount} mastered · {learningCount} learning · {studiedCount}/{set.termCount} studied</span></div>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted"><span className="bg-primary" style={{ width: `${set.termCount ? (set.masteredCount / set.termCount) * 100 : 0}%` }} /><span className="bg-muted-foreground/60" style={{ width: `${set.termCount ? (learningCount / set.termCount) * 100 : 0}%` }} /></div>
        </div>
        {activeStudy && <p className="mt-2 text-caption text-foreground">Continue: {activeStudy.answeredCount} of {activeStudy.totalItems} cards studied{!activeStudy.shuffle && activeStudy.nextSourceOrder ? ` · Resume at word ${activeStudy.nextSourceOrder}` : ''}{rangeLabel ? ` · ${rangeLabel}` : ''}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onReview} disabled={set.termCount === 0} title={set.termCount === 0 ? 'Add words before starting a study session.' : undefined}><StudyIcon />{studyLabel}</Button>
        <Button variant="outline" onClick={onQuiz} disabled={!canQuiz} title={!canQuiz ? 'A quiz needs at least four distinct meanings.' : undefined}><ClipboardCheck size={16} />{set.activeQuizSession ? 'Continue quiz' : 'Take quiz'}</Button>
        {hasContextActions && <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="shadow-none" aria-label={`More actions for ${set.title}`}><MoreHorizontal size={18} /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Set actions</DropdownMenuLabel><DropdownMenuSeparator />
            {!activity && <DropdownMenuItem onSelect={onStudyOptions}><BookOpen />{activeStudy ? 'Start another range' : 'Study options'}</DropdownMenuItem>}
            {!activity && set.activeQuizSession && <DropdownMenuItem onSelect={onQuizOptions}><ClipboardCheck />Start another quiz</DropdownMenuItem>}
            {canAssign && <DropdownMenuItem onSelect={onAssign}><Send />Assign to class</DropdownMenuItem>}
            {canManage && <DropdownMenuItem onSelect={onEdit}><Edit3 />Edit set</DropdownMenuItem>}
            {canDelete && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />Delete set</DropdownMenuItem></>}
          </DropdownMenuContent>
        </DropdownMenu>}
      </div>
    </div>
  </Card>;
}

function DeleteCollectionDialog({ target, onClose, onDeleted }: { target: SetSummary | null; onClose: () => void; onDeleted: (setId: string) => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    if (!target || deleting) return;
    setDeleting(true);
    try {
      await axiosClient.delete(`/api/vocabulary/sets/${target.id}`);
      appToast.success('Vocabulary collection deleted.');
      await onDeleted(target.id);
    } catch (error) { appToast.error(errorMessage(error, 'Unable to delete the vocabulary collection.')); }
    finally { setDeleting(false); }
  };
  return <Modal open={Boolean(target)} onClose={onClose} closeOnBackdrop title="Delete collection?" subtitle="This permanently removes the collection, its words, and your study progress." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="destructive" disabled={deleting} onClick={() => void remove()}><Trash2 size={15} />{deleting ? 'Deleting…' : 'Delete collection'}</Button></>}><p className="text-body text-muted-foreground">You’re about to delete <strong className="font-semibold text-foreground">{target?.title}</strong>. This action cannot be undone.</p></Modal>;
}

const masteryDetails = (term: Term) => {
  const mastery = term.progress?.mastery || 'NOT_STUDIED';
  const tone = mastery === 'MASTERED' ? 'success' : mastery === 'LEARNING' ? 'warning' : 'neutral';
  const label = mastery === 'MASTERED' ? 'Mastered' : mastery === 'LEARNING' ? 'Learning' : 'Not studied';
  return { label, tone } as const;
};

function ProgressFilterMenu({ value, onChange }: { value: ProgressFilter; onChange: (value: ProgressFilter) => void }) {
  const labels: Record<ProgressFilter, string> = { ALL: 'All progress', MASTERED: 'Mastered', LEARNING: 'Learning', NOT_STUDIED: 'Not studied' };
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className={value !== 'ALL' ? 'bg-muted' : undefined}><ListFilter size={15} />{labels[value]}</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-44">
      <DropdownMenuLabel>Progress</DropdownMenuLabel><DropdownMenuSeparator />
      <DropdownMenuRadioGroup value={value} onValueChange={next => onChange(next as ProgressFilter)}>
        {(Object.entries(labels) as Array<[ProgressFilter, string]>).map(([filter, label]) => <DropdownMenuRadioItem key={filter} value={filter}>{label}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

const WordList = memo(function WordList({ terms, onSelect }: { terms: Term[]; onSelect: (term: Term) => void }) {
  return <div className="divide-y divide-ui-border/60">{terms.map((term, index) => <WordListRow key={term.id || `${term.word}-${index}`} term={term} onSelect={() => onSelect(term)} />)}</div>;
});

const WordListRow = memo(function WordListRow({ term, onSelect }: { term: Term; onSelect: () => void }) {
  const { label, tone } = masteryDetails(term);
  const reviewed = term.progress?.lastReviewedAt ? new Date(term.progress.lastReviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  return <Button variant="ghost" onClick={onSelect} className="h-auto min-h-20 w-full justify-start rounded-none px-4 py-3 text-left shadow-none hover:bg-muted/30 sm:px-5">
    <span className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.55fr)_12rem] md:items-center md:gap-6">
      <span className="min-w-0"><span className="block truncate text-body font-semibold text-foreground">{term.word}</span><span className="mt-1 block truncate text-caption font-normal text-foreground/80">{term.translation}</span></span>
      <span className="line-clamp-2 whitespace-normal text-body font-normal leading-5 text-muted-foreground">{term.meaning}</span>
      <span className="flex flex-wrap items-center gap-2 md:justify-end"><Badge tone={tone}>{label}</Badge>{reviewed && <span className="text-[11px] font-normal text-muted-foreground">Reviewed {reviewed}</span>}</span>
    </span>
  </Button>;
});

function WordDetailSheet({ term, onOpenChange }: { term: Term | null; onOpenChange: (open: boolean) => void }) {
  const progress = term ? masteryDetails(term) : null;
  const lastReviewed = term?.progress?.lastReviewedAt
    ? new Date(term.progress.lastReviewedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Not reviewed yet';
  return <Sheet open={Boolean(term)} onOpenChange={onOpenChange}>
    <SheetContent className="w-full gap-0 sm:max-w-md">
      <SheetHeader className="border-b border-ui-border px-5 py-5 pr-14">
        <SheetTitle className="text-xl font-semibold tracking-tight">{term?.word || 'Word details'}</SheetTitle>
        <SheetDescription className="text-sm text-foreground/80">{term?.translation}</SheetDescription>
      </SheetHeader>
      {term && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <dl className="space-y-6">
          <div><dt className="text-caption font-medium text-muted-foreground">Definition</dt><dd className="mt-2 text-body leading-6 text-foreground">{term.meaning}</dd></div>
          <div><dt className="text-caption font-medium text-muted-foreground">Example</dt><dd className="mt-2 text-body leading-6 text-foreground">{term.exampleSentence ? <span className="italic">“{term.exampleSentence}”</span> : <span className="text-muted-foreground">No example sentence yet.</span>}</dd></div>
          <div className="grid grid-cols-2 gap-4 border-t border-ui-border pt-5">
            <div><dt className="text-caption font-medium text-muted-foreground">Progress</dt><dd className="mt-2">{progress && <Badge tone={progress.tone}>{progress.label}</Badge>}</dd></div>
            <div><dt className="text-caption font-medium text-muted-foreground">Last reviewed</dt><dd className="mt-2 text-body text-foreground">{lastReviewed}</dd></div>
          </div>
        </dl>
      </div>}
    </SheetContent>
  </Sheet>;
}

function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  if (pageCount <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const pages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => start + index);
  return <nav aria-label="Vocabulary word pages" className="flex flex-wrap items-center justify-center gap-1"><Button variant="ghost" size="icon-sm" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft /></Button>{pages.map(item => <Button key={item} variant={item === page ? 'default' : 'ghost'} size="sm" aria-current={item === page ? 'page' : undefined} onClick={() => onChange(item)}>{item}</Button>)}<Button variant="ghost" size="icon-sm" disabled={page === pageCount} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight /></Button></nav>;
}

function VocabularyHomeSkeleton() {
  return <div className="mt-8 space-y-8" aria-label="Loading vocabulary"><div><div className="h-6 w-40 animate-pulse rounded bg-muted" /><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(item => <div key={item} className="h-28 animate-pulse rounded-card border border-ui-border bg-muted" />)}</div></div><div className="h-40 animate-pulse rounded-card border border-ui-border bg-muted" /><div><div className="h-6 w-24 animate-pulse rounded bg-muted" /><div className="mt-3 overflow-hidden rounded-card border border-ui-border">{[1, 2, 3, 4].map(item => <div key={item} className="h-20 animate-pulse border-b border-ui-border bg-muted/50 last:border-0" />)}</div></div></div>;
}

function SetWorkspace({ set, activity, tab, onTab, role, studyConfig, quizConfig, onBack, onEdit, onTermSaved, onAssign, onRefresh, assigner }: { set: SetDetail; activity: VocabularyActivity | null; tab: DetailTab; onTab: (tab: DetailTab) => void; role: UserRole; studyConfig: StudyConfig | null; quizConfig: QuizConfig | null; onBack: () => void; onEdit: () => void; onTermSaved: (set: SetDetail) => void; onAssign: () => void; onRefresh: () => Promise<void>; assigner: React.ReactNode }) {
  if (tab === 'FLASHCARDS') return <FlashcardWorkspace set={set} activityId={activity?.id} config={studyConfig} canEdit={set.canEdit && !activity} onBack={onBack} onTermSaved={onTermSaved} />;
  if (tab === 'QUIZ') return <QuizWorkspace set={set} activityId={activity?.id} config={quizConfig} />;
  const tabs: Array<TabItem<DetailTab>> = [{ value: 'TERMS', label: 'Terms', icon: BookOpen }, { value: 'FLASHCARDS', label: 'Flashcards', icon: RotateCcw }, { value: 'QUIZ', label: 'Test', icon: ClipboardCheck, disabled: set.terms.length < 4 }];
  const publish = async () => { try { await axiosClient.post(`/api/vocabulary/sets/${set.id}/publish`); invalidateQueryCache('/api/vocabulary'); appToast.success('Vocabulary set published.'); await onRefresh(); } catch (error) { appToast.error(errorMessage(error, 'Unable to publish the set.')); } };
  const archive = async () => { try { await axiosClient.post(`/api/vocabulary/sets/${set.id}/archive`); invalidateQueryCache('/api/vocabulary'); appToast.success('Vocabulary set archived.'); onBack(); } catch (error) { appToast.error(errorMessage(error, 'Unable to archive the set.')); } };
  return <div className={ui.page}>
    <main className="min-h-0 flex-1 overflow-y-auto"><div className={ui.content}>
      <PageHeader title={set.title} description={`${set.termCount} words${activity ? ` · ${activity.class.name}` : ''}`} actions={<>{set.canEdit && <Button variant="outline" size="sm" onClick={onEdit}><Edit3 size={14} />Edit</Button>}{role === 'ADMIN' && set.scope === 'SYSTEM' && set.status !== 'PUBLISHED' && <Button size="sm" onClick={() => void publish()}><Sparkles size={14} />Publish</Button>}{(role === 'TEACHER' || role === 'ADMIN') && set.status === 'PUBLISHED' && <Button size="sm" onClick={onAssign}><Send size={14} />Assign</Button>}{set.canEdit && <Button variant="ghost" size="icon" onClick={() => void archive()} aria-label="Archive set"><Archive size={16} /></Button>}</>} />
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-2"><Badge tone={set.scope === 'SYSTEM' ? 'green' : 'neutral'}>{set.scope === 'SYSTEM' ? 'System library' : 'Personal'}</Badge>{set.status !== 'PUBLISHED' && <Badge tone="warning">{set.status}</Badge>}{set.description && <p className="text-body text-muted-foreground">{set.description}</p>}</div><p className="text-caption text-muted-foreground">{set.masteredCount}/{set.termCount} mastered</p></div>
      <Tabs items={tabs} value={tab} onValueChange={onTab} ariaLabel="Vocabulary study modes" className="mt-6 border-b border-ui-border-strong" />
      <div key={tab} role="tabpanel" className="mt-6 min-h-[360px]"><TermList terms={set.terms} /></div>
    </div></main>{assigner}
  </div>;
}

function FlashcardWorkspace({ set, activityId, config, canEdit, onBack, onTermSaved }: { set: SetDetail; activityId?: string; config: StudyConfig | null; canEdit: boolean; onBack: () => void; onTermSaved: (set: SetDetail) => void }) {
  const didStartRef = useRef(false);
  const [session, setSession] = useState<StudySession | null>(null);
  const [questionOrder, setQuestionOrder] = useState<string[]>([]);
  const [originalQuestionOrder, setOriginalQuestionOrder] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [termDraft, setTermDraft] = useState<InlineTermDraft | null>(null);
  const [savingTerm, setSavingTerm] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const start = useCallback(async (overrideConfig?: StudyConfig) => {
    setLoading(true);
    try {
      const result = await axiosClient.post<StudySession, StudySession>(`/api/vocabulary/sets/${set.id}/sessions`, { mode: 'FLASHCARD', activityId, ...(overrideConfig || config || {}) });
      setSession(result);
      setShowCompletion(false);
      const sessionOrder = result.questions.map(question => question.id);
      const sourceOrder = [...result.questions].sort((left, right) => (left.sourceOrder ?? left.order) - (right.sourceOrder ?? right.order)).map(question => question.id);
      setQuestionOrder(result.shuffle ? sessionOrder : sourceOrder);
      setOriginalQuestionOrder(sourceOrder);
      setShuffled(result.shuffle);
      const displayedOrder = result.shuffle ? sessionOrder : sourceOrder;
      const firstUnanswered = displayedOrder.findIndex(id => !result.questions.find(question => question.id === id)?.selectedMeaning);
      setIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
      setFlipped(false);
    } catch (error) { appToast.error(errorMessage(error, 'Unable to start flashcards.')); }
    finally { setLoading(false); }
  }, [activityId, config, set.id]);
  useEffect(() => {
    if (didStartRef.current) return;
    didStartRef.current = true;
    void start();
  }, [start]);

  const orderedQuestions = useMemo(() => {
    if (!session) return [];
    const byId = new Map(session.questions.map(question => [question.id, question]));
    return questionOrder.map(id => byId.get(id)).filter((question): question is StudyQuestion => Boolean(question));
  }, [questionOrder, session]);
  const current = orderedQuestions[index];
  const goTo = useCallback((nextIndex: number) => { setIndex(nextIndex); setFlipped(false); }, []);
  const toggleShuffle = useCallback(async () => {
    if (!session || reordering) return;
    const currentId = current?.id;
    const previousOrder = [...questionOrder];
    const previousShuffled = shuffled;
    const previousIndex = index;
    const nextOrder = shuffled ? [...originalQuestionOrder] : (() => {
      const next = [...originalQuestionOrder];
      for (let item = next.length - 1; item > 0; item -= 1) {
        const target = Math.floor(Math.random() * (item + 1));
        [next[item], next[target]] = [next[target], next[item]];
      }
      if (next.length > 1 && next.every((id, item) => id === originalQuestionOrder[item])) next.push(next.shift() as string);
      return next;
    })();
    setQuestionOrder(nextOrder);
    setShuffled(!shuffled);
    if (currentId) setIndex(Math.max(0, nextOrder.indexOf(currentId)));
    setFlipped(false);
    setReordering(true);
    try {
      const updated = await axiosClient.patch<StudySession, StudySession>(`/api/vocabulary/sessions/${session.id}/order`, { questionIds: nextOrder, shuffle: !shuffled });
      setSession(updated);
    } catch (error) {
      setQuestionOrder(previousOrder);
      setShuffled(previousShuffled);
      setIndex(previousIndex);
      appToast.error(errorMessage(error, 'Unable to update the flashcard order.'));
    } finally {
      setReordering(false);
    }
  }, [current?.id, index, originalQuestionOrder, questionOrder, reordering, session, shuffled]);
  useEffect(() => {
    if (!autoplay || !current) return undefined;
    const timer = window.setTimeout(() => {
      if (!flipped) setFlipped(true);
      else { setIndex(value => value >= orderedQuestions.length - 1 ? 0 : value + 1); setFlipped(false); }
    }, flipped ? 2600 : 3400);
    return () => window.clearTimeout(timer);
  }, [autoplay, current, flipped, orderedQuestions.length]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speak = useCallback(() => {
    if (!current || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(current.prompt);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }, [current]);
  const answer = useCallback(async (mastery: 'LEARNING' | 'KNOW') => {
    if (!session || !current || saving || current.selectedMeaning) return;
    setSaving(true);
    try {
      const result = await axiosClient.post<StudySession, StudySession>(`/api/vocabulary/sessions/${session.id}/questions/${current.id}/answer`, { mastery });
      setSession(result);
      if (result.status === 'COMPLETED') {
        setAutoplay(false);
        setShowCompletion(true);
      }
      invalidateQueryCache('/api/vocabulary');
    }
    catch (error) { appToast.error(errorMessage(error, 'Unable to save your progress.')); }
    finally { setSaving(false); }
  }, [current, saving, session]);
  useEffect(() => {
    if (!current || loading || saving || reordering || editingQuestionId || showCompletion) return undefined;
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLocaleLowerCase('en-US');
      if (event.key === ' ' && !target?.closest('button')) {
        event.preventDefault();
        setFlipped(value => !value);
      } else if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        goTo(index - 1);
      } else if (event.key === 'ArrowRight' && index < orderedQuestions.length - 1) {
        event.preventDefault();
        goTo(index + 1);
      } else if (key === 'p') {
        event.preventDefault();
        speak();
      } else if (flipped && !current.selectedMeaning && key === '1') {
        event.preventDefault();
        void answer('LEARNING');
      } else if (flipped && !current.selectedMeaning && key === '2') {
        event.preventDefault();
        void answer('KNOW');
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [answer, current, editingQuestionId, flipped, goTo, index, loading, orderedQuestions.length, reordering, saving, showCompletion, speak]);
  const beginTermEdit = (question: StudyQuestion) => {
    setAutoplay(false);
    setEditingQuestionId(question.id);
    setTermDraft({ word: question.prompt, meaning: question.meaning || '', translation: question.translation || '', exampleSentence: question.exampleSentence || '' });
  };
  const cancelTermEdit = () => { setEditingQuestionId(null); setTermDraft(null); };
  const updateTermDraft = (field: keyof InlineTermDraft, value: string) => setTermDraft(current => current ? { ...current, [field]: value } : current);
  const saveTermEdit = async () => {
    if (!editingQuestionId || !termDraft || savingTerm || !termDraft.word.trim() || !termDraft.meaning.trim() || !termDraft.translation.trim()) return;
    setSavingTerm(true);
    try {
      const detail = await axiosClient.patch<SetDetail, SetDetail>(`/api/vocabulary/sets/${set.id}/terms/${editingQuestionId}`, termDraft);
      const updated = detail.terms.find(term => term.id === editingQuestionId);
      if (updated) setSession(currentSession => currentSession ? { ...currentSession, questions: currentSession.questions.map(question => question.id === editingQuestionId ? { ...question, prompt: updated.word, meaning: updated.meaning, translation: updated.translation, exampleSentence: updated.exampleSentence } : question) } : currentSession);
      onTermSaved(detail);
      cancelTermEdit();
      appToast.success('Vocabulary term updated.');
    } catch (error) { appToast.error(errorMessage(error, 'Unable to update this vocabulary term.')); }
    finally { setSavingTerm(false); }
  };

  if (showCompletion && session?.status === 'COMPLETED') {
    const stillLearningIds = session.questions
      .filter(question => question.selectedMeaning === 'LEARNING' && question.sourceTermId)
      .map(question => question.sourceTermId as string);
    const restart = (sourceTermIds?: string[]) => void start({
      startIndex: 1,
      endIndex: set.termCount,
      masteries: ['NOT_STUDIED', 'LEARNING', 'MASTERED'],
      questionCount: sourceTermIds?.length || set.termCount,
      shuffle: false,
      ...(sourceTermIds?.length ? { sourceTermIds } : {}),
    });
    return <FlashcardCompleteScreen
      session={session}
      loading={loading}
      canReviewStillLearning={!activityId && stillLearningIds.length > 0}
      onReviewStillLearning={() => restart(stillLearningIds)}
      onStudyAgain={() => restart()}
      onBack={onBack}
    />;
  }

  return <div className={ui.page}>
    <main className="relative min-h-0 flex-1 overflow-y-auto"><LoadingBar active={loading || saving} />
      <div className={`${ui.content} !max-w-[1080px] !pt-5`}>
      <header className="mx-auto max-w-[820px] text-center">
        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-primary">Vocabulary set</p>
        <h1 className="mt-1 text-display font-semibold text-foreground">{set.title}</h1>
        <p className="mt-1 text-body text-muted-foreground">{session ? `${session.answeredCount} of ${session.totalItems} studied${session.rangeStart && session.rangeEnd ? ` · Words ${session.rangeStart}–${session.rangeEnd}` : ''}` : `${set.termCount} terms · ${set.masteredCount} mastered`}</p>
      </header>
      {loading ? <div className="mt-8 h-[430px] animate-pulse rounded-card border border-ui-border bg-muted" /> : !current ? <EmptyState icon={<RotateCcw size={20} />} title="No flashcards available" description="Add words to this set before starting flashcards." /> : <>
        <section aria-labelledby="flashcard-heading" className="mt-6">
          <div className="mx-auto mb-4 max-w-[820px]"><div className="flex items-end justify-between gap-4"><h2 id="flashcard-heading" className="text-title font-semibold text-foreground">Flashcard review</h2><p className="text-title font-semibold text-foreground" aria-live="polite">{index + 1} <span className="font-normal text-muted-foreground">/ {orderedQuestions.length}</span></p></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((index + 1) / orderedQuestions.length) * 100}%` }} /></div></div>

          <div className="grid items-center gap-2 sm:grid-cols-[48px_minmax(0,820px)_48px] sm:justify-center sm:gap-4">
            <Button variant="ghost" size="icon" className="hidden h-12 w-12 sm:inline-flex" disabled={index === 0} onClick={() => goTo(index - 1)} aria-label="Previous flashcard"><ChevronLeft size={25} /></Button>
            <div className="relative min-w-0">
              <Button variant="ghost" size="icon" className="absolute right-4 top-4 z-20 h-10 w-10 bg-surface/90 text-foreground" onClick={speak} aria-label={`Pronounce ${current.prompt}`}><Volume2 size={20} /></Button>
              <button type="button" aria-pressed={flipped} aria-label={flipped ? 'Show the term' : 'Reveal the meaning'} onClick={() => setFlipped(value => !value)} className={`flashcard-perspective relative min-h-[390px] w-full overflow-hidden rounded-card border border-ui-border-strong bg-surface text-center shadow-card ${ui.cardInteractive}`}>
                <span key={current.id} className={`flashcard-inner ${flipped ? 'is-flipped' : ''}`}>
                  <span className="flashcard-face bg-surface" aria-hidden={flipped}><span className="px-8 text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-tight text-foreground">{current.prompt}</span><span className="absolute bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-caption font-medium text-muted-foreground"><RotateCcw size={14} className="mr-1.5 inline" />Click card to reveal meaning</span></span>
                  <span className="flashcard-face flashcard-back bg-surface" aria-hidden={!flipped}><span className="max-w-2xl px-8 text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-tight text-foreground">{current.meaning}</span><span className="mt-5 text-heading font-medium text-primary">{current.translation}</span>{current.exampleSentence && <span className="mt-5 max-w-xl px-8 text-body italic text-muted-foreground">“{current.exampleSentence}”</span>}<span className="absolute bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-caption font-medium text-muted-foreground"><RotateCcw size={14} className="mr-1.5 inline" />Click to see the term</span></span>
                </span>
              </button>
            </div>
            <Button variant="ghost" size="icon" className="hidden h-12 w-12 sm:inline-flex" disabled={index === orderedQuestions.length - 1} onClick={() => goTo(index + 1)} aria-label="Next flashcard"><ChevronRight size={25} /></Button>
          </div>

          <div className="mx-auto mt-5 flex max-w-[820px] flex-wrap items-center justify-between gap-3"><div className="flex gap-2 sm:hidden"><Button variant="outline" size="icon" disabled={index === 0} onClick={() => goTo(index - 1)} aria-label="Previous flashcard"><ChevronLeft size={20} /></Button><Button variant="outline" size="icon" disabled={index === orderedQuestions.length - 1} onClick={() => goTo(index + 1)} aria-label="Next flashcard"><ChevronRight size={20} /></Button></div><div className="flex gap-2"><Button variant={shuffled ? 'secondary' : 'outline'} aria-pressed={shuffled} disabled={reordering} onClick={() => void toggleShuffle()} title={shuffled ? 'Restore the original set order' : 'Shuffle cards randomly'}><Shuffle size={16} />{reordering ? 'Updating…' : 'Shuffle'}</Button><Button variant={autoplay ? 'default' : 'outline'} onClick={() => setAutoplay(value => !value)}>{autoplay ? <Pause size={16} /> : <Play size={16} />}{autoplay ? 'Pause' : 'Autoplay'}</Button></div>{flipped ? current.selectedMeaning ? <Badge tone={current.selectedMeaning === 'KNOW' ? 'success' : 'warning'}>{current.selectedMeaning === 'KNOW' ? 'Got it' : 'Still learning'}</Badge> : <div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={() => void answer('LEARNING')}>Still learning</Button><Button disabled={saving} onClick={() => void answer('KNOW')}><Check size={16} />Got it</Button></div> : <p className="hidden text-caption text-muted-foreground md:block">Flip the card to rate your recall</p>}</div>
          <p className="mx-auto mt-3 hidden max-w-[820px] text-center text-caption text-muted-foreground md:block"><kbd className="rounded-sm border border-ui-border bg-muted px-1.5 py-0.5 font-mono text-foreground">Space</kbd> flip · <kbd className="rounded-sm border border-ui-border bg-muted px-1.5 py-0.5 font-mono text-foreground">←</kbd> <kbd className="rounded-sm border border-ui-border bg-muted px-1.5 py-0.5 font-mono text-foreground">→</kbd> move · <kbd className="rounded-sm border border-ui-border bg-muted px-1.5 py-0.5 font-mono text-foreground">1</kbd> still learning · <kbd className="rounded-sm border border-ui-border bg-muted px-1.5 py-0.5 font-mono text-foreground">2</kbd> got it · <kbd className="rounded-sm border border-ui-border bg-muted px-1.5 py-0.5 font-mono text-foreground">P</kbd> pronounce</p>
        </section>

        <section aria-labelledby="terms-in-set-heading" className="mt-16"><div className="flex items-end justify-between gap-4"><div><h2 id="terms-in-set-heading" className="text-display font-semibold text-foreground">Terms in this set</h2><p className="mt-1 text-body text-muted-foreground">Review every term and its complete definition.</p></div><div className="flex items-center gap-2">{!canEdit && <Badge tone="neutral">Read only</Badge>}<Badge tone="neutral">{orderedQuestions.length} terms</Badge>{session?.status === 'COMPLETED' && <Badge tone="success">Session complete · {session.score}%</Badge>}</div></div><div className="mt-5 space-y-4">{orderedQuestions.map(question => <InlineEditableTermCard key={question.id} question={question} canEdit={canEdit} editing={editingQuestionId === question.id} draft={editingQuestionId === question.id ? termDraft : null} saving={savingTerm} onEdit={() => beginTermEdit(question)} onCancel={cancelTermEdit} onChange={updateTermDraft} onSave={() => void saveTermEdit()} />)}</div></section>
      </>}
    </div></main>
  </div>;
}

function FlashcardCompleteScreen({ session, loading, canReviewStillLearning, onReviewStillLearning, onStudyAgain, onBack }: { session: StudySession; loading: boolean; canReviewStillLearning: boolean; onReviewStillLearning: () => void; onStudyAgain: () => void; onBack: () => void }) {
  const gotItCount = session.questions.filter(question => question.selectedMeaning === 'KNOW').length;
  const stillLearningCount = session.questions.filter(question => question.selectedMeaning === 'LEARNING').length;
  return <div className={ui.page}><main className="relative min-h-0 flex-1 overflow-y-auto"><LoadingBar active={loading} /><div className={`${ui.content} !max-w-3xl py-10`}>
    <section className="text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success"><Check size={28} /></span><h1 className="mt-5 text-display font-semibold text-foreground">Review complete</h1><p className="mt-2 text-body text-muted-foreground">You studied all {session.totalItems} cards in this session.</p></section>
    <Card className="mt-8 overflow-hidden shadow-none"><div className="grid divide-y divide-ui-border sm:grid-cols-3 sm:divide-x sm:divide-y-0"><div className="p-5 text-center"><p className="text-display font-semibold tabular-nums text-foreground">{session.totalItems}</p><p className="mt-1 text-caption text-muted-foreground">Cards studied</p></div><div className="p-5 text-center"><p className="text-display font-semibold tabular-nums text-success">{gotItCount}</p><p className="mt-1 text-caption text-muted-foreground">Got it</p></div><div className="p-5 text-center"><p className="text-display font-semibold tabular-nums text-warning">{stillLearningCount}</p><p className="mt-1 text-caption text-muted-foreground">Still learning</p></div></div><div className="border-t border-ui-border bg-muted/30 px-5 py-3 text-center text-caption text-muted-foreground">“Got it” is your self-rating. A word becomes Mastered after successful quiz recall.</div></Card>
    <div className="mt-6 flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={loading} onClick={onBack}>Back to set</Button>{canReviewStillLearning ? <Button disabled={loading} onClick={onReviewStillLearning}><RotateCcw />{loading ? 'Starting…' : `Review ${stillLearningCount} still learning`}</Button> : <Button disabled={loading} onClick={onStudyAgain}><RotateCcw />{loading ? 'Starting…' : 'Study again'}</Button>}</div>
  </div></main></div>;
}

const InlineEditableTermCard = memo(function InlineEditableTermCard({ question, canEdit, editing, draft, saving, onEdit, onCancel, onChange, onSave }: { question: StudyQuestion; canEdit: boolean; editing: boolean; draft: InlineTermDraft | null; saving: boolean; onEdit: () => void; onCancel: () => void; onChange: (field: keyof InlineTermDraft, value: string) => void; onSave: () => void }) {
  if (editing && draft) {
    const valid = Boolean(draft.word.trim() && draft.meaning.trim() && draft.translation.trim());
    return <Card className="overflow-hidden border-primary shadow-raised ring-2 ring-primary/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/15 bg-primary-soft/60 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 text-caption font-semibold text-primary"><Edit3 size={15} />Editing term</div>
        <div className="flex items-center gap-2"><Button variant="ghost" size="sm" disabled={saving} onClick={onCancel}>Cancel</Button><Button size="sm" disabled={saving || !valid} onClick={onSave}><Check size={15} />{saving ? 'Saving…' : 'Save'}</Button></div>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(210px,0.34fr)_1fr] sm:p-6">
        <label className="text-caption font-medium text-foreground">Word <span className="text-danger">*</span><Input autoFocus className="mt-2 w-full" value={draft.word} onChange={event => onChange('word', event.target.value)} placeholder="Enter the word" /></label>
        <div className="grid gap-4 border-ui-border-strong sm:border-l-2 sm:pl-6">
          <label className="text-caption font-medium text-foreground">English meaning <span className="text-danger">*</span><Input className="mt-2 w-full" value={draft.meaning} onChange={event => onChange('meaning', event.target.value)} placeholder="Enter the English meaning" /></label>
          <label className="text-caption font-medium text-foreground">Translation <span className="text-danger">*</span><Input className="mt-2 w-full" value={draft.translation} onChange={event => onChange('translation', event.target.value)} placeholder="Enter the translation" /></label>
          <label className="text-caption font-medium text-foreground">Example sentence <span className="font-normal text-muted-foreground">(optional)</span><Input className="mt-2 w-full" value={draft.exampleSentence} onChange={event => onChange('exampleSentence', event.target.value)} placeholder="Use the word in a sentence" /></label>
        </div>
      </div>
    </Card>;
  }
  return <Card className="relative grid min-h-32 gap-4 border-ui-border-strong p-5 pr-16 shadow-card sm:grid-cols-[minmax(210px,0.34fr)_1fr] sm:items-center sm:p-6 sm:pr-16">
    <p className="break-words text-heading font-semibold leading-7 text-foreground">{question.prompt}</p>
    <div className="border-ui-border-strong sm:border-l-2 sm:pl-6"><p className="text-title leading-6 text-foreground">{question.meaning}</p><p className="mt-2 text-body font-semibold text-primary">{question.translation}</p>{question.exampleSentence && <p className="mt-2 text-body italic leading-6 text-muted-foreground">“{question.exampleSentence}”</p>}</div>
    {canEdit && <Button variant="ghost" size="icon" className="absolute right-3 top-1/2 h-10 w-10 -translate-y-1/2 bg-transparent text-primary hover:bg-primary-soft hover:text-primary" onClick={onEdit} aria-label={`Edit ${question.prompt}`} title="Edit term"><Edit3 size={17} /></Button>}
  </Card>;
});

type StudySelection = 'ALL' | 'NEXT_UNSTUDIED' | 'LEARNING' | 'RANGE';

function StudySetupModal({ open, set, onClose, onStart }: { open: boolean; set: SetDetail; onClose: () => void; onStart: (config: StudyConfig) => void }) {
  const notStudiedCount = set.terms.filter(term => (term.progress?.mastery || 'NOT_STUDIED') === 'NOT_STUDIED').length;
  const learningCount = set.terms.filter(term => term.progress?.mastery === 'LEARNING').length;
  const [selection, setSelection] = useState<StudySelection>(notStudiedCount > 0 ? 'NEXT_UNSTUDIED' : learningCount > 0 ? 'LEARNING' : 'ALL');
  const [startIndex, setStartIndex] = useState(1);
  const [endIndex, setEndIndex] = useState(Math.min(20, set.terms.length));
  const [shuffleCards, setShuffleCards] = useState(false);
  const validRange = startIndex >= 1 && endIndex >= startIndex && endIndex <= set.terms.length;
  const selectedCount = selection === 'ALL'
    ? set.terms.length
    : selection === 'NEXT_UNSTUDIED'
      ? Math.min(10, notStudiedCount)
      : selection === 'LEARNING'
        ? learningCount
      : validRange ? endIndex - startIndex + 1 : 0;
  const canStart = selectedCount > 0 && (selection !== 'RANGE' || validRange);
  const start = () => {
    if (!canStart) return;
    onStart({
      startIndex: selection === 'RANGE' ? startIndex : 1,
      endIndex: selection === 'RANGE' ? endIndex : set.terms.length,
      masteries: selection === 'NEXT_UNSTUDIED' ? ['NOT_STUDIED'] : selection === 'LEARNING' ? ['LEARNING'] : ['NOT_STUDIED', 'LEARNING', 'MASTERED'],
      questionCount: selection === 'NEXT_UNSTUDIED' ? Math.min(10, notStudiedCount) : selectedCount,
      shuffle: shuffleCards,
      restart: Boolean(set.activeFlashcardSession),
    });
  };
  const choices: Array<{ value: StudySelection; title: string; description: string; disabled?: boolean }> = [
    { value: 'ALL', title: 'All words', description: `Study all ${set.terms.length} words in this set.` },
    { value: 'NEXT_UNSTUDIED', title: 'Next 10 unstudied', description: `${notStudiedCount} words have not been studied yet.`, disabled: notStudiedCount === 0 },
    { value: 'LEARNING', title: 'Review learning', description: `${learningCount} words still need retrieval practice.`, disabled: learningCount === 0 },
    { value: 'RANGE', title: 'Custom range', description: 'Choose a consecutive group by its position in the set.' },
  ];
  return <Modal open={open} onClose={onClose} presentation="content-dialog" title="Study setup" subtitle={`Choose what to study from ${set.title}.`} className="!max-w-2xl" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button size="lg" disabled={!canStart} onClick={start}>Start studying<ChevronRight /></Button></>}>
    <div className="space-y-6">
      {set.activeFlashcardSession && <div className="rounded-control border border-warning/25 bg-warning-soft p-3 text-sm text-foreground"><p className="font-medium">You have an unfinished study session.</p><p className="mt-1 text-caption text-muted-foreground">Starting another selection will replace that session. Use Continue studying if you want to keep it.</p></div>}
      <section aria-labelledby="study-selection-heading">
        <h3 id="study-selection-heading" className="text-title font-semibold text-foreground">Words to study</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{choices.map(choice => <Button key={choice.value} type="button" variant="outline" disabled={choice.disabled} aria-pressed={selection === choice.value} onClick={() => setSelection(choice.value)} className={`h-auto min-h-20 items-start justify-start whitespace-normal p-3 text-left shadow-none ${selection === choice.value ? 'border-ring bg-muted ring-2 ring-ring/20' : ''}`}><span><span className="flex items-center gap-2 font-medium text-foreground">{choice.title}{selection === choice.value && <Check />}</span><span className="mt-1 block text-xs font-normal leading-4 text-muted-foreground">{choice.description}</span></span></Button>)}</div>
      </section>
      {selection === 'RANGE' && <section aria-labelledby="study-range-heading"><h3 id="study-range-heading" className="text-title font-semibold text-foreground">Range</h3><div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-3"><label className="text-caption font-medium text-foreground">From<Input type="number" min={1} max={set.terms.length} className="mt-2" value={startIndex} onChange={event => setStartIndex(Number(event.target.value))} /></label><span className="pb-2 text-muted-foreground">to</span><label className="text-caption font-medium text-foreground">To<Input type="number" min={1} max={set.terms.length} className="mt-2" value={endIndex} onChange={event => setEndIndex(Number(event.target.value))} /></label></div>{!validRange && <p className="mt-2 text-caption text-danger">Choose a valid range within this set.</p>}</section>}
      <label className="flex cursor-pointer items-start gap-3 rounded-control border border-ui-border p-3"><Checkbox checked={shuffleCards} onCheckedChange={checked => setShuffleCards(checked === true)} aria-label="Shuffle cards" /><span><span className="block text-sm font-medium text-foreground">Shuffle cards</span><span className="mt-0.5 block text-xs text-muted-foreground">Study in a random order. You can turn shuffle off during the session to restore the original set order.</span></span></label>
      <div className="rounded-control border border-ui-border bg-muted/30 p-3"><p className="text-sm font-medium text-foreground">{selectedCount} {selectedCount === 1 ? 'word' : 'words'} selected</p><p className="mt-1 text-caption text-muted-foreground">{shuffleCards ? 'Cards will start in a random order.' : 'Cards will follow their original order in the set.'}</p></div>
    </div>
  </Modal>;
}

function QuizSetupModal({ open, set, onClose, onStart }: { open: boolean; set: SetDetail; onClose: () => void; onStart: (config: QuizConfig) => void }) {
  const [startIndex, setStartIndex] = useState(1);
  const [endIndex, setEndIndex] = useState(Math.min(10, set.terms.length));
  const [mastery, setMastery] = useState<QuizMasteryFilter>('ALL');
  const candidates = useMemo(() => set.terms.slice(Math.max(0, startIndex - 1), Math.min(set.terms.length, endIndex)).filter(term => mastery === 'ALL' || (term.progress?.mastery || 'NOT_STUDIED') === mastery), [endIndex, mastery, set.terms, startIndex]);
  const distinctMeanings = useMemo(() => new Set(candidates.map(term => term.meaning.trim().toLocaleLowerCase('en-US'))).size, [candidates]);
  const rangeSize = endIndex - startIndex + 1;
  const validRange = startIndex >= 1 && endIndex >= startIndex && endIndex <= set.terms.length && rangeSize <= 40;
  const canStart = validRange && candidates.length >= 4 && distinctMeanings >= 4;
  const masteryOptions: Array<{ value: QuizMasteryFilter; label: string; description: string }> = [
    { value: 'ALL', label: 'All statuses', description: 'Mix every word in the selected range' },
    { value: 'NOT_STUDIED', label: 'Not studied', description: 'Focus on words you have not reviewed' },
    { value: 'LEARNING', label: 'Learning', description: 'Practice words still in progress' },
    { value: 'MASTERED', label: 'Mastered', description: 'Check long-term recall' },
  ];
  return <Modal open={open} onClose={onClose} presentation="content-dialog" title="Set up your quiz" subtitle={`Choose what to test from ${set.title}.`} className="!max-w-2xl" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button size="lg" disabled={!canStart} onClick={() => onStart({ startIndex, endIndex, masteries: mastery === 'ALL' ? ['NOT_STUDIED', 'LEARNING', 'MASTERED'] : [mastery], restart: Boolean(set.activeQuizSession) })}>Start quiz<ChevronRight size={17} /></Button></>}>
    <div className="space-y-6">{set.activeQuizSession && <div className="rounded-control border border-warning/25 bg-warning-soft p-3 text-sm text-foreground"><p className="font-medium">You have an unfinished quiz.</p><p className="mt-1 text-caption text-muted-foreground">Starting another range will replace that quiz. Use Continue quiz if you want to keep it.</p></div>}<section aria-labelledby="quiz-range-heading"><div className="flex items-center justify-between gap-3"><div><h3 id="quiz-range-heading" className="text-title font-semibold text-foreground">Question range</h3><p className="mt-1 text-caption text-muted-foreground">Choose up to 40 consecutive words from this set.</p></div><Badge tone="neutral">{set.terms.length} words</Badge></div><div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-3"><label className="text-caption font-medium text-foreground">From<Input type="number" min={1} max={set.terms.length} className="mt-2 h-10 w-full" value={startIndex} onChange={event => setStartIndex(Number(event.target.value))} /></label><span className="pb-3 text-muted-foreground">to</span><label className="text-caption font-medium text-foreground">To<Input type="number" min={1} max={set.terms.length} className="mt-2 h-10 w-full" value={endIndex} onChange={event => setEndIndex(Number(event.target.value))} /></label></div>{!validRange && <p className="mt-2 text-caption text-danger">Use a valid range of no more than 40 words.</p>}</section>
    <section aria-labelledby="quiz-status-heading"><h3 id="quiz-status-heading" className="text-title font-semibold text-foreground">Learning status</h3><p className="mt-1 text-caption text-muted-foreground">Select which group of words should appear.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{masteryOptions.map(option => <Button key={option.value} type="button" variant="outline" aria-pressed={mastery === option.value} onClick={() => setMastery(option.value)} className={`h-auto min-h-20 items-start justify-start whitespace-normal p-3 text-left shadow-none ${mastery === option.value ? 'border-ring bg-muted ring-2 ring-ring/20' : ''}`}><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 text-body font-semibold text-foreground">{option.label}{mastery === option.value && <Check size={16} />}</span><span className="mt-1 block text-caption font-normal leading-4 text-muted-foreground">{option.description}</span></span></Button>)}</div></section>
    <div className={`rounded-control border p-4 ${canStart ? 'border-primary/20 bg-primary-soft' : 'border-warning/25 bg-accent-soft'}`}><p className="font-semibold text-foreground">{candidates.length} matching words</p><p className="mt-1 text-caption text-muted-foreground">{canStart ? 'Your quiz is ready. Questions and answer choices will be shuffled.' : 'At least 4 words with different meanings are required.'}</p></div></div>
  </Modal>;
}

function QuizWorkspace({ set, activityId, config }: { set: SetDetail; activityId?: string; config: QuizConfig | null }) {
  const didStartRef = useRef(false);
  const [session, setSession] = useState<StudySession | null>(null);
  const [index, setIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const effectiveConfig = useMemo<QuizConfig>(() => config || { startIndex: 1, endIndex: Math.min(10, set.terms.length), masteries: ['NOT_STUDIED', 'LEARNING', 'MASTERED'] }, [config, set.terms.length]);
  const start = useCallback(async () => {
    setLoading(true);
    try {
      const result = await axiosClient.post<StudySession, StudySession>(`/api/vocabulary/sets/${set.id}/sessions`, { mode: 'QUIZ', activityId, ...effectiveConfig, questionCount: Math.min(40, effectiveConfig.endIndex - effectiveConfig.startIndex + 1) });
      const firstUnanswered = result.questions.findIndex(question => !question.selectedMeaning);
      setSession(result); setIndex(firstUnanswered >= 0 ? firstUnanswered : 0); setSelectedAnswer(''); setStartedAt(Date.now()); setElapsedSeconds(0);
    } catch (error) { appToast.error(errorMessage(error, 'Unable to start the quiz.')); }
    finally { setLoading(false); }
  }, [activityId, effectiveConfig, set.id]);
  useEffect(() => {
    if (didStartRef.current) return;
    didStartRef.current = true;
    void start();
  }, [start]);
  const current = session?.questions[index];
  const answered = Boolean(current?.selectedMeaning);
  const submit = async () => {
    if (!session || !current || !selectedAnswer || saving || answered) return;
    setSaving(true);
    try {
      const result = await axiosClient.post<StudySession, StudySession>(`/api/vocabulary/sessions/${session.id}/questions/${current.id}/answer`, { selectedMeaning: selectedAnswer });
      setSession(result);
      invalidateQueryCache('/api/vocabulary');
      if (result.status === 'COMPLETED') setElapsedSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    } catch (error) { appToast.error(errorMessage(error, 'Unable to check your answer.')); }
    finally { setSaving(false); }
  };
  const next = () => { if (!session || index >= session.questions.length - 1) return; setIndex(value => value + 1); setSelectedAnswer(''); };

  if (session?.status === 'COMPLETED') return <QuizCompleteScreen session={session} elapsedSeconds={elapsedSeconds} retrying={loading} onRetry={() => void start()} />;
  return <div className={ui.page}>
    <main className="relative min-h-0 flex-1 overflow-y-auto"><LoadingBar active={loading || saving} /><div className={`${ui.content} !max-w-[980px] !pt-5`}>
      <div className="flex min-h-9 items-center justify-center"><h1 className="hidden text-title font-semibold text-foreground sm:block">{set.title}</h1></div>
      {loading ? <div className="mt-8 h-[520px] animate-pulse rounded-card border border-ui-border bg-muted" /> : !current || !session ? <EmptyState icon={<ClipboardCheck size={20} />} title="Quiz unavailable" description="There are not enough matching words for this quiz." /> : <section aria-labelledby="quiz-question-heading" className="mt-6"><div className="flex items-center justify-between gap-4"><p className="text-caption font-semibold uppercase tracking-wide text-primary">Question {index + 1} of {session.totalItems}</p><p className="text-caption text-muted-foreground">Choose one answer</p></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((index + 1) / session.totalItems) * 100}%` }} /></div>
        <Card className="mt-7 overflow-hidden"><div className="border-b border-ui-border bg-muted/40 px-6 py-5 text-center"><p className="text-caption font-medium uppercase tracking-[0.16em] text-muted-foreground">Target word</p><h2 id="quiz-question-heading" className="mt-4 text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-tight text-foreground">{current.prompt}</h2>{current.translation && answered && <p className="mt-3 text-title font-medium text-primary">{current.translation}</p>}</div><div className="p-5 sm:p-7"><p className="text-title font-semibold text-foreground">Which meaning best matches this word?</p><div className="mt-5 grid gap-3">{current.options.map((option, optionIndex) => { const selected = selectedAnswer === option; const correct = answered && option === current.meaning; const incorrect = answered && selected && !current.isCorrect; return <button key={option} type="button" disabled={answered || saving} onClick={() => setSelectedAnswer(option)} className={`flex min-h-16 items-center gap-4 rounded-control border px-4 py-3 text-left transition-colors ${correct ? 'border-success bg-success-soft text-success' : incorrect ? 'border-danger bg-danger-soft text-danger' : selected ? 'border-primary bg-primary-soft ring-1 ring-primary/20' : 'border-ui-border bg-surface text-foreground hover:border-primary/45 hover:bg-primary-soft/40'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${correct ? 'bg-success text-white' : incorrect ? 'bg-danger text-white' : selected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{String.fromCharCode(65 + optionIndex)}</span><span className="flex-1 text-body font-medium">{option}</span>{correct && <Check size={19} />}{incorrect && <X size={19} />}</button>; })}</div>{answered && <div className={`mt-5 rounded-control border p-4 ${current.isCorrect ? 'border-success/25 bg-success-soft' : 'border-danger/20 bg-danger-soft'}`}><p className="font-semibold text-foreground">{current.isCorrect ? 'Correct — well done.' : 'Not quite — review the correct meaning.'}</p>{current.exampleSentence && <p className="mt-1 text-caption italic text-muted-foreground">“{current.exampleSentence}”</p>}</div>}</div></Card>
        <div className="mt-5 flex justify-end"><Button size="lg" className="min-w-40" disabled={saving || (!answered && !selectedAnswer)} onClick={() => answered ? next() : void submit()}>{answered ? 'Next question' : 'Check answer'}<ChevronRight size={18} /></Button></div>
      </section>}
    </div></main>
  </div>;
}

function QuizCompleteScreen({ session, elapsedSeconds, retrying, onRetry }: { session: StudySession; elapsedSeconds: number; retrying: boolean; onRetry: () => void }) {
  const mistakes = useMemo(() => session.questions.filter(question => !question.isCorrect), [session.questions]);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return <div className={ui.page}><main className="relative min-h-0 flex-1 overflow-y-auto"><QuizConfetti /><div className={`${ui.content} relative !max-w-[1100px] py-10`}>
    <PageHeader title="Quiz complete" description="Vocabulary practice results." />
    <section className="text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success shadow-card"><Trophy size={30} /></span><h1 className="mt-5 text-display font-semibold text-foreground">Quiz complete</h1><p className="mt-2 text-title text-muted-foreground">{mistakes.length ? `${mistakes.length} ${mistakes.length === 1 ? 'word needs' : 'words need'} another review.` : 'Excellent work — every answer was correct.'}</p></section>
    <section aria-label="Quiz results" className="mt-8 grid gap-4 md:grid-cols-3"><Card className="relative overflow-hidden p-6"><Target size={70} className="absolute -right-3 -top-3 text-primary opacity-[0.08]" /><p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Final score</p><p className="mt-4 text-display font-semibold text-primary">{session.correctCount}<span className="text-heading font-medium text-muted-foreground"> / {session.totalItems}</span></p><p className="mt-3 text-caption font-medium text-success">{session.score >= 80 ? 'Strong performance' : 'Keep building recall'}</p></Card><Card className="p-6"><p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Accuracy</p><div className="mt-4 flex items-center gap-4"><div className="relative flex h-20 w-20 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--ui-primary) ${session.score}%, var(--ui-muted) 0)` }}><span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-title font-semibold">{session.score}%</span></div><p className="text-caption text-muted-foreground">{session.correctCount} correct<br />{mistakes.length} incorrect</p></div></Card><Card className="p-6"><p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Total time</p><div className="mt-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary"><Clock3 size={20} /></span><p className="text-heading font-semibold text-foreground">{minutes}m {String(seconds).padStart(2, '0')}s</p></div><p className="mt-4 text-caption text-muted-foreground">Completed {session.totalItems} questions</p></Card></section>
    <section id="quiz-mistakes" aria-labelledby="quiz-review-heading" className="mt-8"><Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-5 py-4 sm:px-6"><div><h2 id="quiz-review-heading" className="text-heading font-semibold text-foreground">Words to review</h2><p className="mt-1 text-caption text-muted-foreground">Review incorrect answers before your next attempt.</p></div><Badge tone={mistakes.length ? 'danger' : 'success'}>{mistakes.length} {mistakes.length === 1 ? 'mistake' : 'mistakes'}</Badge></div>{mistakes.length ? <div className="divide-y divide-ui-border">{mistakes.map(question => <div key={question.id} className="grid gap-4 p-5 sm:grid-cols-[0.65fr_1fr_1fr] sm:p-6"><div><p className="font-semibold text-foreground">{question.prompt}</p><p className="mt-1 text-caption font-medium text-primary">{question.translation}</p></div><div><p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Your answer</p><p className="mt-2 text-body text-danger">{question.selectedMeaning}</p></div><div><p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Correct meaning</p><p className="mt-2 text-body text-success">{question.meaning}</p></div></div>)}</div> : <div className="p-8 text-center"><Check size={24} className="mx-auto text-success" /><p className="mt-3 font-semibold text-foreground">Nothing to review</p><p className="mt-1 text-caption text-muted-foreground">You answered every question correctly.</p></div>}</Card></section>
    <div className="mt-7 flex flex-wrap justify-end gap-3">{mistakes.length > 0 && <Button variant="outline" size="lg" onClick={() => document.getElementById('quiz-mistakes')?.scrollIntoView({ behavior: 'smooth' })}>Review mistakes</Button>}<Button variant="outline" size="lg" disabled={retrying} onClick={onRetry}><RotateCcw size={17} />{retrying ? 'Starting…' : 'Retry quiz'}</Button></div>
  </div></main></div>;
}

const confettiPieces = ['8%', '15%', '24%', '33%', '43%', '54%', '64%', '73%', '82%', '91%', '19%', '39%', '59%', '79%'];
function QuizConfetti() { return <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-72 overflow-hidden motion-reduce:hidden">{confettiPieces.map((left, index) => <span key={left} className="quiz-confetti-piece" style={{ left, animationDelay: `${(index % 7) * 90}ms`, backgroundColor: index % 3 === 0 ? '#16835f' : index % 3 === 1 ? '#f2c94c' : '#75d6b0' }} />)}</div>; }

function TermList({ terms }: { terms: Term[] }) { return <div className="space-y-3">{terms.map((term, index) => <Card key={term.id || index} className="grid gap-3 p-5 md:grid-cols-[180px_1fr_180px]"><div><p className="font-semibold">{term.word}</p>{term.progress?.mastery && <Badge className="mt-2" tone={term.progress.mastery === 'MASTERED' ? 'success' : 'warning'}>{term.progress.mastery.replace('_', ' ').toLowerCase()}</Badge>}</div><div><p className="text-body">{term.meaning}</p>{term.exampleSentence && <p className="mt-2 text-caption italic text-muted-foreground">{term.exampleSentence}</p>}</div><p className="text-body font-medium text-primary">{term.translation}</p></Card>)}</div>; }

function CollectionEditorScreen({ role, set, onBack, onSaved }: { role: UserRole; set?: SetDetail; onBack: () => void; onSaved: (set: SetDetail) => void }) {
  const editing = Boolean(set);
  const [title, setTitle] = useState(set?.title || '');
  const [description, setDescription] = useState(set?.description || '');
  const [scope, setScope] = useState<'PERSONAL' | 'SYSTEM'>(set?.scope || 'PERSONAL');
  const [terms, setTerms] = useState<Term[]>(set?.terms.length ? set.terms.map(term => ({ ...term })) : [createDraftTerm()]);
  const [saving, setSaving] = useState(false);
  const updateTerm = useCallback((index: number, field: keyof Term, value: string) => setTerms(current => current.map((term, termIndex) => termIndex === index ? { ...term, [field]: value } : term)), []);
  const removeTerm = useCallback((index: number) => setTerms(current => current.length === 1 ? current : current.filter((_, termIndex) => termIndex !== index)), []);
  const addTerm = useCallback(() => setTerms(current => [...current, createDraftTerm()]), []);
  const canSave = Boolean(title.trim()) && terms.length > 0 && terms.every(term => term.word.trim() && term.meaning.trim() && term.translation.trim());
  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      let detail: SetDetail;
      if (set) {
        await axiosClient.patch(`/api/vocabulary/sets/${set.id}`, { title, description });
        detail = await axiosClient.put<SetDetail, SetDetail>(`/api/vocabulary/sets/${set.id}/terms`, { terms });
      } else {
        detail = await axiosClient.post<SetDetail, SetDetail>('/api/vocabulary/sets', { title, description, scope, terms });
      }
      invalidateQueryCache('/api/vocabulary');
      appToast.success(editing ? 'Vocabulary collection updated.' : 'Vocabulary set created.');
      onSaved(detail);
    } catch (error) { appToast.error(errorMessage(error, editing ? 'Unable to update the vocabulary collection.' : 'Unable to create the vocabulary set.')); }
    finally { setSaving(false); }
  };
  return <div className={ui.page}>
    <main className="min-h-0 flex-1 overflow-y-auto"><div className={`${ui.content} !max-w-[1040px]`}>
      <PageHeader title={editing ? 'Edit vocabulary collection' : 'New vocabulary set'} description={editing ? 'Update collection details and vocabulary cards.' : 'Build a reusable collection for study and practice.'} />

      <Card className="mt-7 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-ui-border bg-muted/50 px-5 py-4 sm:px-6"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-caption font-semibold text-white">1</span><div><h2 className="text-title font-semibold text-foreground">Collection details</h2><p className="mt-0.5 text-caption text-muted-foreground">Give this set a clear, recognizable name.</p></div></div>
        <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
          <label className="text-caption font-medium text-foreground">Collection title <span className="text-danger">*</span><Input autoFocus className="mt-2 h-10 w-full" value={title} maxLength={120} onChange={event => setTitle(event.target.value)} placeholder="e.g. Essential SAT vocabulary" /></label>
          {role === 'ADMIN' && !editing ? <label className="text-caption font-medium text-foreground">Collection type<Select className="mt-2 h-10 w-full" value={scope} onChange={event => setScope(event.target.value as typeof scope)}><option value="PERSONAL">Personal collection</option><option value="SYSTEM">System library</option></Select></label> : <div><p className="text-caption font-medium text-foreground">Collection type</p><div className="mt-2 flex h-10 items-center rounded-control border border-ui-border bg-background px-3 text-body text-muted-foreground">{set?.scope === 'SYSTEM' ? 'System library' : 'Personal collection'}</div></div>}
          <label className="text-caption font-medium text-foreground md:col-span-2">Description <span className="font-normal text-muted-foreground">(optional)</span><Textarea className="mt-2 min-h-24" value={description} maxLength={500} onChange={event => setDescription(event.target.value)} placeholder="What is this collection for?" /></label>
        </div>
      </Card>

      <section aria-labelledby="vocabulary-terms-heading" className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-caption font-semibold text-white">2</span><h2 id="vocabulary-terms-heading" className="text-heading font-semibold text-foreground">Vocabulary cards</h2></div><p className="ml-10 mt-1 text-caption text-muted-foreground">{terms.length} {terms.length === 1 ? 'word' : 'words'} in this collection</p></div><span className="text-caption text-muted-foreground"><span className="text-danger">*</span> Required fields</span></div>
        <div className="mt-4 space-y-4">{terms.map((term, index) => <VocabularyTermEditor key={term.id || index} index={index} term={term} canRemove={terms.length > 1} onUpdate={updateTerm} onRemove={removeTerm} />)}</div>
        <Button type="button" variant="outline" onClick={addTerm} className="mt-4 min-h-20 w-full border-dashed"><Plus size={18} />Add another vocabulary card</Button>
      </section>

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-ui-border py-6 sm:flex-row sm:items-center sm:justify-between"><p className="text-caption text-muted-foreground">{editing ? 'Changes apply to future study sessions.' : 'You can edit this collection and add more words later.'}</p><div className="flex gap-3"><Button variant="ghost" size="lg" onClick={onBack}>Cancel</Button><Button size="lg" className="min-w-36" disabled={!canSave || saving} onClick={() => void save()}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save collection'}<Check size={17} /></Button></div></div>
    </div></main>
  </div>;
}

const VocabularyTermEditor = memo(function VocabularyTermEditor({ index, term, canRemove, onUpdate, onRemove }: { index: number; term: Term; canRemove: boolean; onUpdate: (index: number, field: keyof Term, value: string) => void; onRemove: (index: number) => void }) {
  return <Card className="overflow-hidden">
    <div className="flex items-center justify-between border-b border-ui-border bg-muted/50 px-5 py-3"><div className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">{index + 1}</span><h3 className="text-caption font-semibold uppercase tracking-wide text-foreground">Vocabulary card</h3></div><Button variant="ghost" size="icon" disabled={!canRemove} onClick={() => onRemove(index)} aria-label={`Remove vocabulary card ${index + 1}`}><X size={16} /></Button></div>
    <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
      <label className="text-caption font-medium text-foreground">Word <span className="text-danger">*</span><Input className="mt-2 h-10 w-full" value={term.word} onChange={event => onUpdate(index, 'word', event.target.value)} placeholder="Enter a word" /></label>
      <label className="text-caption font-medium text-foreground">English meaning <span className="text-danger">*</span><Input className="mt-2 h-10 w-full" value={term.meaning} onChange={event => onUpdate(index, 'meaning', event.target.value)} placeholder="Enter the definition" /></label>
      <label className="text-caption font-medium text-foreground">Translation <span className="text-danger">*</span><Input className="mt-2 h-10 w-full" value={term.translation} onChange={event => onUpdate(index, 'translation', event.target.value)} placeholder="Enter the translation" /></label>
      <label className="text-caption font-medium text-foreground">Example sentence <span className="font-normal text-muted-foreground">(optional)</span><Input className="mt-2 h-10 w-full" value={term.exampleSentence || ''} onChange={event => onUpdate(index, 'exampleSentence', event.target.value)} placeholder="Use the word in context" /></label>
    </div>
  </Card>;
});

function AssignDialog({ open, set, initialClassId = '', onClose }: { open: boolean; set: SetDetail; initialClassId?: string; onClose: () => void }) {
  const [classes, setClasses] = useState<ClassInfo[]>([]); const [classId, setClassId] = useState(''); const [dueAt, setDueAt] = useState(''); const [passingScore, setPassingScore] = useState(80); const [maxAttempts, setMaxAttempts] = useState(3); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) return; axiosClient.get<ClassInfo[], ClassInfo[]>('/api/classes').then(result => { setClasses(result); setClassId(result.some(item => item.id === initialClassId) ? initialClassId : result[0]?.id || ''); }).catch(() => setClasses([])); }, [initialClassId, open]);
  const assign = async () => { setSaving(true); try { await axiosClient.post('/api/vocabulary/activities', { classId, setId: set.id, title: set.title, dueAt: dueAt || null, passingScore, maxAttempts, completionRule: 'SCORE_AT_LEAST', scorePolicy: 'BEST' }); appToast.success('Vocabulary assigned to the class.'); onClose(); } catch (error) { appToast.error(errorMessage(error, 'Unable to assign vocabulary.')); } finally { setSaving(false); } };
  return <Modal open={open} onClose={onClose} presentation="content-dialog" title="Assign vocabulary" subtitle={set.title} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving || !classId} onClick={() => void assign()}>{saving ? 'Assigning…' : 'Assign'}</Button></>}><div className="space-y-4"><label className="block text-caption font-medium">Class<Select className="mt-1 w-full" value={classId} onChange={event => setClassId(event.target.value)}><option value="">Choose a class</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label><label className="block text-caption font-medium">Due date<DateTimePicker className="mt-1" value={dueAt} onChange={setDueAt} placeholder="No deadline" ariaLabel="Vocabulary due date" /></label><div className="grid grid-cols-2 gap-4"><label className="text-caption font-medium">Passing score<Input className="mt-1 w-full" type="number" min={1} max={100} value={passingScore} onChange={event => setPassingScore(Number(event.target.value))} /></label><label className="text-caption font-medium">Attempts<Input className="mt-1 w-full" type="number" min={1} max={10} value={maxAttempts} onChange={event => setMaxAttempts(Number(event.target.value))} /></label></div></div></Modal>;
}
