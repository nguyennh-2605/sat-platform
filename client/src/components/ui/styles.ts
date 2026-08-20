export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export const ui = {
  page: 'flex h-full min-h-0 flex-col overflow-hidden bg-[#F2F8F5] text-[#1A1A1A]',
  content: 'mx-auto w-full max-w-[1200px] p-6 lg:p-8 lg:pt-6',
  card: 'rounded-xl border border-[#E2EDE9] bg-white shadow-sm',
  muted: 'text-[#6B7280]',
};
