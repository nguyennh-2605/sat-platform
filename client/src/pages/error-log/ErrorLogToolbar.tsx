import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Bold, Check, Circle, Italic, Link2, List, ListOrdered, Loader2, RemoveFormatting, Underline } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { DataToolbar, DataToolbarActions, DataToolbarGroup, DataToolbarSearch } from '@/components/ui/data-surface';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { RichTextEditorHandle, RichTextFormats } from '@/components/ui/rich-text-editor';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDraftSummary, type ReflectionDraftStore } from './useReflectionDrafts';
import type { ReviewStatus } from './types';

export interface ErrorLogFacets {
  all: number;
  needsReview: number;
  reviewed: number;
  categories: string[];
}

interface ErrorLogToolbarProps {
  search: string;
  status: ReviewStatus;
  category: string;
  facets: ErrorLogFacets;
  facetsLoaded: boolean;
  active: boolean;
  formats: RichTextFormats;
  editor: RefObject<RichTextEditorHandle | null>;
  draftStore: ReflectionDraftStore;
  linkRequest: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ReviewStatus) => void;
  onCategoryChange: (value: string) => void;
  onReset: () => void;
}

const allCategories: ComboboxOption = { value: '', label: 'All categories' };

export function ErrorLogToolbar({ search, status, category, facets, facetsLoaded, active, formats, editor, draftStore, linkRequest, onSearchChange, onStatusChange, onCategoryChange, onReset }: ErrorLogToolbarProps) {
  const categoryOptions = useMemo(() => facets.categories.map(value => ({ value, label: value })), [facets.categories]);
  const hasFilters = Boolean(search || category || status !== 'ALL');

  return <DataToolbar data-error-log-toolbar className="sticky top-0 z-20 bg-surface lg:flex-col lg:items-stretch 2xl:flex-row 2xl:items-center">
    <DataToolbarGroup className="flex-1">
      <DataToolbarSearch label="Search error log" placeholder="Search errors…" value={search} onChange={event => onSearchChange(event.target.value)} />
      <div role="group" aria-label="Review status" className="flex items-center gap-1 rounded-control border border-ui-border bg-background p-0.5">
        <StatusButton label="All" count={facetsLoaded ? facets.all : null} selected={status === 'ALL'} onClick={() => onStatusChange('ALL')} />
        <StatusButton label="Needs review" count={facetsLoaded ? facets.needsReview : null} selected={status === 'NEEDS_REVIEW'} onClick={() => onStatusChange('NEEDS_REVIEW')} />
        <StatusButton label="Reviewed" count={facetsLoaded ? facets.reviewed : null} selected={status === 'REVIEWED'} onClick={() => onStatusChange('REVIEWED')} />
      </div>
      <Combobox
        value={category}
        options={categoryOptions}
        allOption={allCategories}
        onValueChange={onCategoryChange}
        label="Category"
        placeholder="All categories"
        searchPlaceholder="Search categories…"
        emptyMessage="No categories found."
      />
      {hasFilters && <Button variant="ghost" size="sm" onClick={onReset}>Reset</Button>}
    </DataToolbarGroup>
    <DataToolbarActions className="min-w-0 lg:ml-0 2xl:ml-auto">
      <FormattingControls editor={editor} active={active} formats={formats} linkRequest={linkRequest} />
      <DraftSaveIndicator store={draftStore} />
    </DataToolbarActions>
  </DataToolbar>;
}

function StatusButton({ label, count, selected, onClick }: { label: string; count: number | null; selected: boolean; onClick: () => void }) {
  return <Button type="button" variant={selected ? 'secondary' : 'ghost'} size="sm" aria-pressed={selected} onClick={onClick} className="gap-1.5">
    {label}{count !== null && <span className="tabular-nums text-muted-foreground">{count}</span>}
  </Button>;
}

function FormattingControls({ editor, active, formats, linkRequest }: { editor: RefObject<RichTextEditorHandle | null>; active: boolean; formats: RichTextFormats; linkRequest: number }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState('');
  const handledLinkRequest = useRef(0);
  const linkInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linkRequest > handledLinkRequest.current && active) {
      handledLinkRequest.current = linkRequest;
      setLinkError('');
      setLinkValue(formats.link || '');
      setLinkOpen(true);
    }
  }, [active, formats.link, linkRequest]);

  useEffect(() => {
    if (!linkOpen) return;
    const frame = requestAnimationFrame(() => linkInput.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [linkOpen]);

  useEffect(() => {
    if (!active) setLinkOpen(false);
  }, [active]);

  const openLink = (open: boolean) => {
    setLinkOpen(open);
    setLinkError('');
    if (open) setLinkValue(formats.link || '');
    else requestAnimationFrame(() => editor.current?.focus());
  };
  const closeLink = () => {
    setLinkOpen(false);
    requestAnimationFrame(() => editor.current?.focus());
  };
  const applyLink = () => {
    const value = linkValue.trim();
    if (!value) {
      editor.current?.setLink(null);
      closeLink();
      return;
    }
    try {
      const url = new URL(value);
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error();
      editor.current?.setLink(url.toString());
      closeLink();
    } catch {
      setLinkError('Enter a complete http, https, or mailto link.');
    }
  };

  return <TooltipProvider>
    <div role="toolbar" aria-label="Reflection formatting" className="flex min-w-0 flex-wrap items-center gap-1">
      <FormatButton label="Bold" shortcut="Ctrl/Cmd+B" active={formats.bold} disabled={!active} onPress={() => editor.current?.toggleInline('bold')}><Bold /></FormatButton>
      <FormatButton label="Italic" shortcut="Ctrl/Cmd+I" active={formats.italic} disabled={!active} onPress={() => editor.current?.toggleInline('italic')}><Italic /></FormatButton>
      <FormatButton label="Underline" shortcut="Ctrl/Cmd+U" active={formats.underline} disabled={!active} onPress={() => editor.current?.toggleInline('underline')}><Underline /></FormatButton>
      <span className="mx-1 h-5 border-l border-ui-border" aria-hidden="true" />
      <FormatButton label="Numbered list" shortcut="Ctrl/Cmd+Shift+7" active={formats.list === 'ordered'} disabled={!active} onPress={() => editor.current?.toggleList('ordered')}><ListOrdered /></FormatButton>
      <FormatButton label="Bulleted list" shortcut="Ctrl/Cmd+Shift+8" active={formats.list === 'bullet'} disabled={!active} onPress={() => editor.current?.toggleList('bullet')}><List /></FormatButton>
      <FormatButton label="Add or edit link" shortcut="Ctrl/Cmd+K" active={Boolean(formats.link)} disabled={!active} onPress={() => openLink(true)}><Link2 /></FormatButton>
      <FormatButton label="Clear formatting" disabled={!active} onPress={() => editor.current?.clearFormatting()}><RemoveFormatting /></FormatButton>
      {linkOpen && <div role="group" aria-label="Edit reflection link" className="flex w-full min-w-0 flex-wrap items-start gap-2 border-t border-ui-border pt-2 sm:w-auto sm:flex-nowrap sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
        <Field className="min-w-32 flex-1 sm:w-64 sm:flex-none">
          <FieldLabel htmlFor="reflection-link" className="sr-only">Link</FieldLabel>
          <Input ref={linkInput} id="reflection-link" type="url" value={linkValue} onChange={event => setLinkValue(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); applyLink(); }
            if (event.key === 'Escape') { event.preventDefault(); closeLink(); }
          }} placeholder="https://…" />
          {linkError && <p className="text-xs text-danger" role="alert">{linkError}</p>}
        </Field>
        {formats.link && <Button type="button" variant="ghost" size="sm" onClick={() => { editor.current?.setLink(null); closeLink(); }}>Remove</Button>}
        <Button type="button" variant="outline" size="sm" onClick={closeLink}>Cancel</Button>
        <Button type="button" size="sm" onClick={applyLink}>Apply</Button>
      </div>}
    </div>
  </TooltipProvider>;
}

function FormatButton({ label, shortcut, active = false, disabled, onPress, children }: { label: string; shortcut?: string; active?: boolean; disabled: boolean; onPress: () => void; children: ReactNode }) {
  return <Tooltip>
    <TooltipTrigger asChild>
      <Button type="button" variant={active ? 'secondary' : 'ghost'} size="icon-sm" disabled={disabled} aria-label={label} aria-pressed={active} onPointerDown={event => event.preventDefault()} onClick={onPress}>{children}</Button>
    </TooltipTrigger>
    <TooltipContent>{label}{shortcut && <Shortcut>{shortcut}</Shortcut>}</TooltipContent>
  </Tooltip>;
}

function Shortcut({ children }: { children: ReactNode }) {
  return <span className="rounded-sm bg-background/15 px-1 py-0.5 font-mono text-xs">{children}</span>;
}

function DraftSaveIndicator({ store }: { store: ReflectionDraftStore }) {
  const summary = useDraftSummary(store);

  return <div className="hidden w-20 shrink-0 justify-end text-xs text-muted-foreground sm:flex" aria-live="polite">
    {summary.status === 'saving' ? <span className="flex items-center gap-1"><Loader2 className="size-3 animate-spin" aria-hidden="true" />Saving…</span>
      : summary.status === 'error' ? <span className="text-danger">Save issue</span>
        : summary.status === 'saved' ? <span className="flex items-center gap-1"><Check className="size-3 text-success" aria-hidden="true" />Saved</span>
          : summary.status === 'pending' ? <span className="sr-only">Unsaved changes</span>
            : null}
  </div>;
}

export function ReviewStatusIcon({ reviewed }: { reviewed: boolean }) {
  const label = reviewed ? 'Reviewed' : 'Needs review';
  return <TooltipProvider><Tooltip><TooltipTrigger asChild><span className="inline-flex size-8 items-center justify-center rounded-full" aria-label={label}>
    {reviewed ? <Check className="size-4 text-success" aria-hidden="true" /> : <Circle className="size-3 fill-warning text-warning" aria-hidden="true" />}
  </span></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip></TooltipProvider>;
}
