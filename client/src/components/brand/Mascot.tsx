import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import focusBlack from '@/assets/brand/mascot/focus-black.png';
import focusWhite from '@/assets/brand/mascot/focus-white.png';
import idleBlack from '@/assets/brand/mascot/idle-black.png';
import idleWhite from '@/assets/brand/mascot/idle-white.png';
import sleepingBlack from '@/assets/brand/mascot/sleeping-black.png';
import sleepingWhite from '@/assets/brand/mascot/sleeping-white.png';
import successBlack from '@/assets/brand/mascot/success-black.png';
import successWhite from '@/assets/brand/mascot/success-white.png';
import { useDarkTheme } from './use-dark-theme';

export type MascotState = 'idle' | 'focus' | 'success' | 'sleeping';
type MascotSize = 'icon' | 'sm' | 'md' | 'lg' | 'xl';
type MascotTone = 'auto' | 'black' | 'white';

interface MascotProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  state?: MascotState;
  size?: MascotSize;
  tone?: MascotTone;
  label?: string;
  animated?: boolean;
  eager?: boolean;
}

const assets: Record<MascotState, { black: string; white: string }> = {
  idle: { black: idleBlack, white: idleWhite },
  focus: { black: focusBlack, white: focusWhite },
  success: { black: successBlack, white: successWhite },
  sleeping: { black: sleepingBlack, white: sleepingWhite },
};

const sizeClasses: Record<MascotSize, string> = {
  icon: 'size-7',
  sm: 'size-16',
  md: 'size-24',
  lg: 'size-36',
  xl: 'size-48',
};

export function Mascot({
  state = 'idle',
  size = 'md',
  tone = 'auto',
  label,
  animated = false,
  eager = false,
  className,
  ...props
}: MascotProps) {
  const dark = useDarkTheme();
  const resolvedTone = tone === 'auto' ? (dark ? 'white' : 'black') : tone;
  const imageProps = {
    alt: '',
    width: 640,
    height: 640,
    loading: eager ? 'eager' as const : 'lazy' as const,
    decoding: 'async' as const,
  };
  const accessibilityProps = label
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': true };
  const motionClass = animated ? `mascot-${state}` : undefined;

  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center', sizeClasses[size], motionClass, className)}
      {...accessibilityProps}
      {...props}
    >
      <img src={assets[state][resolvedTone]} {...imageProps} className="size-full object-contain" />
    </span>
  );
}
