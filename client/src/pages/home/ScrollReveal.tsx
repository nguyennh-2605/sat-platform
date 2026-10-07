import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Content stays visible when motion is reduced or observation is unavailable. */
export function ScrollReveal({ children, className, delay = 0 }: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;

    const reveal = () => {
      element.dataset.revealed = 'true';
      delete element.dataset.revealPending;
      observer?.disconnect();
    };
    const observe = () => {
      observer?.disconnect();
      const bounds = element.getBoundingClientRect();
      if (motion.matches || !('IntersectionObserver' in window)
        || element.dataset.revealed === 'true'
        || (bounds.top < window.innerHeight - 48 && bounds.bottom > 0)) {
        reveal();
        return;
      }
      element.dataset.revealPending = 'true';
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) reveal();
      }, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' });
      observer.observe(element);
    };

    observe();
    element.addEventListener('focusin', reveal);
    motion.addEventListener('change', observe);
    return () => {
      observer?.disconnect();
      element.removeEventListener('focusin', reveal);
      motion.removeEventListener('change', observe);
      delete element.dataset.revealPending;
    };
  }, []);

  return <div ref={ref} className={cn('scroll-reveal', className)} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>{children}</div>;
}
