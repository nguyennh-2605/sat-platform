import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useDarkTheme } from './use-dark-theme';

type BrandMarkSize = 'sm' | 'md' | 'lg';

interface BrandMarkProps extends HTMLAttributes<HTMLSpanElement> {
  size?: BrandMarkSize;
  label?: string;
}

const sizeClasses: Record<BrandMarkSize, string> = {
  sm: 'size-7',
  md: 'size-8',
  lg: 'size-10',
};

export function BrandMark({ size = 'md', label, className, ...props }: BrandMarkProps) {
  const dark = useDarkTheme();
  const accessibilityProps = label
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': true };

  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-lg', sizeClasses[size], className)}
      {...accessibilityProps}
      {...props}
    >
      <img src={dark ? '/brand/favicon-dark.svg' : '/brand/favicon.svg'} alt="" width="64" height="64" className="size-full" />
    </span>
  );
}
