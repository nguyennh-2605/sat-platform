export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export const ui = {
  page: 'flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground',
  content: 'mx-auto w-full max-w-[1280px] p-4 sm:p-6 lg:p-8 lg:pt-6',
  card: 'rounded-card border border-ui-border bg-surface shadow-card',
  cardInteractive: 'transition-shadow hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  muted: 'text-muted-foreground',
};
