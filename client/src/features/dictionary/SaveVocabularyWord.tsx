import { useRef, useState } from 'react';
import { BookmarkPlus, Check, ChevronDown, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LoadingSpinner } from '@/components/ui/loading';
import axiosClient from '@/lib/axios';
import { invalidateQueryCache } from '@/lib/queryCache';
import { vocabularyError } from '@/pages/vocabulary/practice.types';

interface SaveReceipt { termId: string; setId: string; setTitle: string; word: string; created: boolean }
interface CollectionChoice { id: string; title: string; status: string; autoKey?: string | null }
const notifyVocabularyChanged = () => { invalidateQueryCache('/api/vocabulary'); window.dispatchEvent(new Event('vocabulary:changed')); };

export function SaveVocabularyWord({ word, onSaved, disabled = false }: { word: string; onSaved?: (setId: string) => void; disabled?: boolean }) {
  const [receipt, setReceipt] = useState<SaveReceipt | null>(null);
  const [collection, setCollection] = useState<CollectionChoice | null>(null);
  const [choices, setChoices] = useState<CollectionChoice[]>([]);
  const [loadingChoices, setLoadingChoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const loadChoices = async () => {
    setLoadingChoices(true);
    try { setChoices(await axiosClient.get<CollectionChoice[], CollectionChoice[]>('/api/vocabulary/sets?scope=MINE')); }
    catch (failure) { setError(vocabularyError(failure, 'Unable to load your collections.')); }
    finally { setLoadingChoices(false); }
  };
  const save = async () => {
    if (inFlight.current || !word.trim()) return;
    inFlight.current = true;
    setSaving(true); setError('');
    try {
      const result = await axiosClient.post<SaveReceipt, SaveReceipt>('/api/vocabulary/saved-words', { word: word.trim(), ...(collection ? { setId: collection.id } : {}) }, { timeout: 15000 });
      setReceipt(result); notifyVocabularyChanged(); onSaved?.(result.setId);
    } catch (failure) { setError(vocabularyError(failure, 'Unable to save this word. Please try again.')); }
    finally { inFlight.current = false; setSaving(false); }
  };
  const undo = async () => {
    if (!receipt?.created || inFlight.current) return;
    inFlight.current = true; setSaving(true); setError('');
    try { await axiosClient.delete(`/api/vocabulary/saved-words/${receipt.termId}`, { timeout: 15000 }); setReceipt(null); notifyVocabularyChanged(); }
    catch (failure) { setError(vocabularyError(failure, 'Unable to undo. Manage the word in your collection.')); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <div className="min-w-0 space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <Button size="sm" variant={receipt ? 'outline' : 'default'} disabled={disabled || saving || !word.trim() || Boolean(receipt)} onClick={() => void save()}>{saving ? <LoadingSpinner /> : receipt ? <Check /> : <BookmarkPlus />}{saving ? 'Saving…' : receipt ? 'Saved' : 'Save word'}</Button>
        <DropdownMenu onOpenChange={open => { if (open) void loadChoices(); }}>
          <DropdownMenuTrigger asChild><Button size="icon-sm" variant="outline" disabled={disabled || saving} aria-label="Choose vocabulary collection"><ChevronDown /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Save to collection</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => { setCollection(null); setReceipt(null); setError(''); }}>Saved words{!collection && <Check className="ml-auto" />}</DropdownMenuItem>
            <DropdownMenuSeparator />
            {loadingChoices ? <DropdownMenuItem disabled>Loading collections…</DropdownMenuItem> : choices.filter(choice => choice.status !== 'ARCHIVED' && choice.autoKey !== 'SAVED_WORDS').map(choice => <DropdownMenuItem key={choice.id} onSelect={() => { setCollection(choice); setReceipt(null); setError(''); }}><span className="truncate">{choice.title}</span>{collection?.id === choice.id && <Check className="ml-auto" />}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {receipt?.created && <Button variant="ghost" size="sm" disabled={saving} onClick={() => void undo()}><Undo2 />Undo</Button>}
    </div>
    <p role={receipt ? 'status' : undefined} className="break-words text-xs leading-5 text-muted-foreground">{receipt ? `${receipt.created ? 'Added to' : 'Already in'} ${receipt.setTitle}.` : `To ${collection?.title || 'Saved words'}`}</p>
    {error && <p role="alert" className="break-words text-xs leading-5 text-danger">{error}</p>}
  </div>;
}
