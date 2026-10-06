import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { cn } from '@/lib/utils';

interface ExpandableReflectionPreviewProps {
  dataKey: string;
  html: string;
  label: string;
  active: boolean;
  expanded: boolean;
  maxHeightClassName: string;
  onActivate: () => void;
  onExpandedChange: (expanded: boolean) => void;
}

export function ExpandableReflectionPreview({ dataKey, html, label, active, expanded, maxHeightClassName, onActivate, onExpandedChange }: ExpandableReflectionPreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || expanded) return;
    const measure = () => {
      const next = viewport.scrollHeight > viewport.clientHeight + 1;
      setCanExpand(previous => previous === next ? previous : next);
    };
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [expanded, html]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== 'F2') return;
    event.preventDefault();
    onActivate();
  };

  return <div>
    <div className="relative">
      <div
        data-reflection-key={dataKey}
        role="button"
        tabIndex={0}
        aria-label={`${label}. ${html ? 'Press Enter to edit.' : 'Add reflection.'}`}
        aria-pressed={active}
        className="cursor-text outline-none focus-visible:ring-2 focus-visible:ring-foreground/70 focus-visible:ring-inset"
        onClick={event => {
          if (!(event.target as HTMLElement).closest('a, button')) onActivate();
        }}
        onKeyDown={handleKeyDown}
      >
        <div ref={viewportRef} className={cn(!expanded && maxHeightClassName, !expanded && 'overflow-hidden')}>
          {html
            ? <RichTextContent html={html} density="compact" />
            : <span className="text-sm text-muted-foreground">Add reflection…</span>}
        </div>
      </div>
      {canExpand && !expanded && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-background via-background/90 to-transparent" aria-hidden="true" />}
    </div>
    {(canExpand || expanded) && <div className="mt-1 flex justify-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={expanded}
        onClick={() => onExpandedChange(!expanded)}
      >
        {expanded ? <><ChevronUp />Show less</> : <><ChevronDown />Show more</>}
      </Button>
    </div>}
  </div>;
}
