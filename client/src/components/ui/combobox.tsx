import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  options: ComboboxOption[];
  onValueChange: (value: string) => void;
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allOption?: ComboboxOption;
  className?: string;
}

function Combobox({ value, options, onValueChange, label, placeholder = 'Select…', searchPlaceholder = 'Search…', emptyMessage = 'No options found.', allOption, className }: ComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const allOptions = useMemo(() => allOption ? [allOption, ...options] : options, [allOption, options]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? allOptions.filter(option => option.label.toLocaleLowerCase().includes(query)) : allOptions;
  }, [allOptions, search]);
  const selected = allOptions.find(option => option.value === value);

  const choose = (nextValue: string) => {
    onValueChange(nextValue);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => Math.min(filtered.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex].value);
    }
  };

  return <Popover open={open} onOpenChange={nextOpen => {
    setOpen(nextOpen);
    setActiveIndex(0);
    if (!nextOpen) setSearch('');
  }}>
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="outline"
        size="sm"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        className={cn('min-w-40 justify-between font-normal', className)}
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-64 p-2">
      <Input
        autoFocus
        aria-label={`Search ${label.toLocaleLowerCase()}`}
        aria-controls={listId}
        aria-activedescendant={filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        placeholder={searchPlaceholder}
        value={search}
        onChange={event => { setSearch(event.target.value); setActiveIndex(0); }}
        onKeyDown={handleKeyDown}
      />
      <div id={listId} role="listbox" aria-label={label} className="mt-2 max-h-64 overflow-y-auto">
        {filtered.length ? filtered.map((option, index) => <Button
          key={option.value || '__all'}
          id={`${listId}-${index}`}
          type="button"
          role="option"
          aria-selected={option.value === value}
          variant="ghost"
          size="sm"
          className={cn('w-full justify-start font-normal', index === activeIndex && 'bg-muted')}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(option.value)}
        >
          <Check className={cn('size-4', option.value === value ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
          <span className="truncate">{option.label}</span>
        </Button>) : <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>}
      </div>
    </PopoverContent>
  </Popover>;
}

export { Combobox };
