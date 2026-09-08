import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

const attachmentVariants = cva(
  'group/attachment flex min-w-0 items-center gap-3 rounded-control border border-ui-border bg-surface px-3 py-2.5 text-foreground transition-colors focus-within:ring-2 focus-within:ring-ring/50',
  {
    variants: {
      state: {
        idle: 'border-dashed',
        uploading: '',
        error: 'border-destructive/40',
        done: '',
      },
    },
    defaultVariants: {
      state: 'done',
    },
  },
);

type AttachmentProps = React.ComponentProps<'div'> &
  VariantProps<typeof attachmentVariants> & {
    asChild?: boolean;
  };

function Attachment({ asChild = false, className, state, ...props }: AttachmentProps) {
  const Comp = asChild ? Slot.Root : 'div';
  return <Comp data-slot="attachment" data-state={state || 'done'} className={cn(attachmentVariants({ state }), className)} {...props} />;
}

function AttachmentMedia({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="attachment-media"
      className={cn('grid size-8 shrink-0 place-items-center text-muted-foreground [&_svg]:size-4', className)}
      {...props}
    />
  );
}

function AttachmentContent({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="attachment-content" className={cn('min-w-0 flex-1 leading-tight', className)} {...props} />;
}

function AttachmentTitle({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="attachment-title" className={cn('block truncate text-sm font-medium', className)} {...props} />;
}

function AttachmentDescription({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="attachment-description" className={cn('mt-0.5 block truncate text-xs text-muted-foreground', className)} {...props} />;
}

function AttachmentActions({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="attachment-actions" className={cn('flex shrink-0 items-center gap-1', className)} {...props} />;
}

export { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle };
