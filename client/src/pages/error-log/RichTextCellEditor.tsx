import { useRef } from 'react';

import { cn } from '@/lib/utils';
import { ExpandableReflectionPreview } from './ExpandableReflectionPreview';
import { cellKey, useCellDraft, type EditableField, type ReflectionDraftStore } from './useReflectionDrafts';
import { usePreviewExpanded, type PreviewExpansionStore } from './usePreviewExpansionStore';

export function RichTextCellEditor({ entryId, field, label, persistedValue, active, activePreviewValue, draftStore, previewStore, previewMaxHeight, onActivate }: {
  entryId: string;
  field: EditableField;
  label: string;
  persistedValue: string;
  active: boolean;
  activePreviewValue?: string;
  draftStore: ReflectionDraftStore;
  previewStore: PreviewExpansionStore;
  previewMaxHeight: string;
  onActivate: (anchor: HTMLElement, previewValue: string) => void;
}) {
  const id = cellKey(entryId, field);
  const cellRef = useRef<HTMLDivElement>(null);
  const draft = useCellDraft(draftStore, id);
  const expanded = usePreviewExpanded(previewStore, id);
  const liveValue = draft?.value ?? persistedValue;

  // The editor writes to the draft store on every keystroke. Keep the preview
  // under its Popover unchanged until edit exit so row height and anchor
  // position remain stable while typing.
  const displayValue = active ? activePreviewValue ?? liveValue : liveValue;

  const activate = () => {
    if (cellRef.current) onActivate(cellRef.current, liveValue);
  };

  return <div
    ref={cellRef}
    className={cn(
      'relative min-h-16 rounded-control px-2 py-2 transition-colors hover:bg-muted/20',
      active && 'bg-background ring-1 ring-ring ring-inset',
      draft?.status === 'error' && 'ring-1 ring-danger/60 ring-inset',
    )}
  >
    <ExpandableReflectionPreview
      dataKey={id}
      html={displayValue}
      label={label}
      active={active}
      expanded={expanded}
      maxHeightClassName={previewMaxHeight}
      onActivate={activate}
      onExpandedChange={next => previewStore.setExpanded(id, next)}
    />
    {!active && draft?.status === 'error' && <p className="mt-1 text-xs text-danger" role="alert">
      {draft.conflict ? 'Edit conflict — open to resolve' : 'Save issue — open to retry'}
    </p>}
  </div>;
}
