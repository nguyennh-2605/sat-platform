import { memo, useMemo, type ComponentProps } from 'react';

import { cn } from '@/lib/utils';

interface RichTextContentProps extends Omit<ComponentProps<'div'>, 'children' | 'dangerouslySetInnerHTML'> {
  html: string;
}

const allowedTags = new Set(['a', 'b', 'blockquote', 'br', 'code', 'em', 'h1', 'h2', 'h3', 'i', 'li', 'ol', 'p', 'pre', 's', 'strong', 'u', 'ul']);
const sanitizedCache = new Map<string, string>();
const maxCacheEntries = 300;
const maxCacheableLength = 50_000;

const RichTextContent = memo(function RichTextContent({ html, className, ...props }: RichTextContentProps) {
  const sanitizedHtml = useMemo(() => sanitizeRichText(html), [html]);

  return <div
    data-slot="rich-text-content"
    className={cn(
      'break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]',
      '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
      '[&_strong]:font-semibold [&_b]:font-semibold [&_em]:italic [&_i]:italic [&_u]:underline [&_s]:line-through',
      '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_li]:pl-0.5',
      '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-primary-hover',
      '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-ui-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
      '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs',
      '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3',
      '[&_h1]:my-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:text-sm [&_h3]:font-semibold',
      className,
    )}
    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    {...props}
  />;
});

function sanitizeRichText(value: string) {
  if (typeof DOMParser === 'undefined') return '';
  const cached = sanitizedCache.get(value);
  if (cached !== undefined) {
    sanitizedCache.delete(value);
    sanitizedCache.set(value, cached);
    return cached;
  }
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  [...parsed.body.querySelectorAll('*')].forEach(node => {
    const tagName = node.tagName.toLowerCase();
    if (!allowedTags.has(tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }
    const href = tagName === 'a' ? node.getAttribute('href') : null;
    [...node.attributes].forEach(attribute => node.removeAttribute(attribute.name));
    if (tagName !== 'a' || !href) return;
    try {
      const url = new URL(href, window.location.origin);
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return;
      node.setAttribute('href', url.href);
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    } catch {
      // Invalid links remain readable without a clickable destination.
    }
  });
  const sanitized = parsed.body.innerHTML;
  if (value.length <= maxCacheableLength) {
    sanitizedCache.set(value, sanitized);
    if (sanitizedCache.size > maxCacheEntries) {
      const oldest = sanitizedCache.keys().next().value;
      if (oldest !== undefined) sanitizedCache.delete(oldest);
    }
  }
  return sanitized;
}

export { RichTextContent, sanitizeRichText };
