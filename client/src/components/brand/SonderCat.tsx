import type { ComponentProps } from 'react';
import blackCat from '@/assets/brand/mascot/idle-glasses-black.webp';
import whiteCat from '@/assets/brand/mascot/idle-glasses-white.webp';
import { cn } from '@/lib/utils';
import { useDarkTheme } from './use-dark-theme';

/** The favicon-aligned brand pose. Legacy activity poses remain in Mascot. */
export function SonderCat({
  className,
  eager = false,
  ...props
}: Omit<ComponentProps<'img'>, 'src' | 'alt' | 'width' | 'height'> & { eager?: boolean }) {
  const dark = useDarkTheme();

  return (
    <img
      {...props}
      src={dark ? whiteCat : blackCat}
      alt=""
      aria-hidden="true"
      width={640}
      height={640}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      className={cn('aspect-square object-contain', className)}
    />
  );
}
