import * as React from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';

type DataSurfaceVariant = 'management' | 'embedded';

interface DataSurfaceProps extends React.ComponentProps<'section'> {
  variant?: DataSurfaceVariant;
}

function DataSurface({ className, variant = 'management', ...props }: DataSurfaceProps) {
  return (
    <section
      data-slot="data-surface"
      data-variant={variant}
      className={cn(
        variant === 'management'
          ? 'overflow-hidden rounded-card border border-ui-border bg-surface shadow-none'
          : 'min-w-0 overflow-hidden bg-transparent',
        className,
      )}
      {...props}
    />
  );
}

function DataToolbar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="data-toolbar"
      className={cn(
        'flex min-w-0 flex-col gap-2 border-b border-ui-border px-4 py-3 lg:flex-row lg:items-center',
        className,
      )}
      {...props}
    />
  );
}

function DataToolbarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="data-toolbar-group" className={cn('flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap', className)} {...props} />;
}

function DataToolbarActions({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="data-toolbar-actions" className={cn('flex shrink-0 items-center gap-2 lg:ml-auto', className)} {...props} />;
}

interface DataToolbarSearchProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {
  label?: string;
}

function DataToolbarSearch({ className, label = 'Search', ...props }: DataToolbarSearchProps) {
  return (
    <label className="relative block w-full min-w-0 lg:w-64 lg:shrink-0">
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input type="search" aria-label={label} className={cn('pl-8', className)} {...props} />
    </label>
  );
}

function DataTableViewport({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="data-table-viewport" className={cn('min-w-0 overflow-x-auto', className)} {...props} />;
}

function DataPrimaryCell({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="data-primary-cell" className={cn('min-w-0', className)} {...props} />;
}

function DataPrimaryText({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="data-primary-text" className={cn('truncate text-sm font-medium text-foreground', className)} {...props} />;
}

function DataSecondaryText({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="data-secondary-text" className={cn('mt-0.5 truncate text-xs text-muted-foreground', className)} {...props} />;
}

interface DataStateRowProps extends React.ComponentProps<typeof TableRow> {
  colSpan: number;
}

function DataStateRow({ className, colSpan, children, ...props }: DataStateRowProps) {
  return (
    <TableRow className={cn('hover:bg-transparent', className)} {...props}>
      <TableCell colSpan={colSpan} className="h-40 whitespace-normal text-center">
        {children}
      </TableCell>
    </TableRow>
  );
}

function DataPagination({ className, ...props }: React.ComponentProps<'footer'>) {
  return (
    <footer
      data-slot="data-pagination"
      className={cn('flex flex-col gap-3 border-t border-ui-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between', className)}
      {...props}
    />
  );
}

export {
  DataPagination,
  DataPrimaryCell,
  DataPrimaryText,
  DataSecondaryText,
  DataStateRow,
  DataSurface,
  DataTableViewport,
  DataToolbar,
  DataToolbarActions,
  DataToolbarGroup,
  DataToolbarSearch,
};
