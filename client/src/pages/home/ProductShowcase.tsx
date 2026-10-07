import { useState, type CSSProperties } from 'react';
import { ArrowRight, BarChart3, BookOpen, BookOpenCheck, Check, ImageOff, Maximize2, NotebookPen } from 'lucide-react';
import { useDarkTheme } from '@/components/brand/use-dark-theme';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ScrollReveal } from './ScrollReveal';

const features = [
  {
    id: 'practice', number: '01', name: 'Practice', icon: BookOpenCheck,
    eyebrow: 'Make practice your own', title: 'Your pace.\nYour practice.',
    description: 'Make room for focused Reading & Writing and Math practice. Choose your mode and timing before you begin.',
    capabilities: ['Flexible practice or exam simulation', 'Standard, extended, or untimed practice', 'Automatic saving so you can pick up where you left off'],
    caption: 'A real practice setup, before the timer starts.',
    alt: 'Digital SAT practice setup with Practice and Exam simulation modes, timing presets, and instructions.',
    desktop: { width: 1152, height: 671 }, mobile: { width: 358, height: 700 },
  },
  {
    id: 'error-log', number: '02', name: 'Error Log', icon: NotebookPen,
    eyebrow: 'Make the lesson stick', title: 'A mistake today.\nAn insight tomorrow.',
    description: 'Keep the reasoning close to the question. Organize your mistakes, write down what went wrong, and return with a clearer understanding.',
    capabilities: ['Organize by SAT skill and review status', 'Keep both sides of your reflection together', 'Revisit the original question when it is available'],
    caption: 'Worked examples saved in the actual Error Log.',
    alt: 'Error Log showing categorized worked examples with incorrect reasoning and correct explanations side by side.',
    desktop: { width: 1008, height: 620 }, mobile: { width: 390, height: 710 },
  },
  {
    id: 'vocabulary', number: '03', name: 'Vocabulary', icon: BookOpen,
    eyebrow: 'A few words, every day', title: 'Build recall.\nOne word at a time.',
    description: 'Give new words a place in your routine. Move from a vocabulary set to flashcards, then check your recall with a quiz.',
    capabilities: ['Words, definitions, and examples in one place', 'Flashcards and quizzes for retrieval practice', 'Resumable study sessions'],
    caption: 'Flashcard review in the Official SAT Library.',
    alt: 'Vocabulary flashcard review for the word ubiquitous with session progress and study controls.',
    desktop: { width: 1008, height: 680 }, mobile: { width: 390, height: 700 },
  },
  {
    id: 'analytics', number: '04', name: 'Analytics', icon: BarChart3,
    eyebrow: 'Let your practice guide you', title: 'See the pattern.\nFind your next step.',
    description: 'Understand the skills behind your results. Use evidence from completed attempts to decide what deserves another look.',
    capabilities: ['Reading & Writing and Math skill breakdowns', 'Clear labels when a sample is still too small', 'Direct links to the mistakes worth reviewing'],
    caption: 'An actual skill breakdown; accuracy is not an SAT score.',
    alt: 'Reading and Writing skill performance with Craft and Structure expanded and confidence labels for each skill.',
    desktop: { width: 960, height: 569 }, mobile: { width: 358, height: 860 },
  },
];

type FeatureId = typeof features[number]['id'];

export function ProductScreenshot({ featureId, eager = false, hero = false }: {
  featureId: FeatureId;
  eager?: boolean;
  hero?: boolean;
}) {
  const dark = useDarkTheme();
  const feature = features.find(item => item.id === featureId) ?? features[0];
  const tone = dark ? 'dark' : 'light';
  return <ScreenshotImage key={tone} feature={feature} tone={tone} eager={eager} hero={hero} />;
}

function ScreenshotImage({ feature, tone, eager, hero }: {
  feature: typeof features[number];
  tone: 'light' | 'dark';
  eager: boolean;
  hero: boolean;
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const desktopSrc = `/landing/${feature.id}-desktop-${tone}.webp`;
  const mobileSrc = `/landing/${feature.id}-mobile-${tone}.webp`;
  const frameStyle = {
    '--capture-desktop-ratio': `${feature.desktop.width} / ${feature.desktop.height}`,
    '--capture-mobile-ratio': hero ? '1 / 1' : `${feature.mobile.width} / ${feature.mobile.height}`,
  } as CSSProperties;

  return (
    <figure className={cn('min-w-0', !hero && 'mx-auto w-full max-w-sm sm:max-w-none')}>
      <Card className="gap-0 bg-background py-0 shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium"><feature.icon className="size-3.5" aria-hidden="true" />Sonder SAT<span className="text-muted-foreground">/ {feature.name}</span></div>
          <div className="flex gap-1.5" aria-hidden="true"><span className="size-1.5 rounded-full bg-muted-foreground/40" /><span className="size-1.5 rounded-full bg-muted-foreground/40" /><span className="size-1.5 rounded-full bg-muted-foreground/40" /></div>
        </div>
        <div style={frameStyle} className="relative aspect-(--capture-mobile-ratio) overflow-hidden bg-background sm:aspect-(--capture-desktop-ratio)">
          {status === 'loading' && <Skeleton aria-hidden="true" className="absolute inset-0 size-full rounded-none motion-reduce:animate-none" />}
          {status === 'error' ? (
            <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"><ImageOff className="size-6 text-muted-foreground" aria-hidden="true" /><p className="text-sm font-medium">Preview could not load.</p><p className="text-xs text-muted-foreground">You can still explore this tool from your workspace.</p></div>
          ) : (
            <picture className="absolute inset-0 block">
              <source media="(max-width: 639px)" srcSet={mobileSrc} />
              <img
                src={desktopSrc}
                alt={feature.alt}
                width={feature.desktop.width}
                height={feature.desktop.height}
                loading={eager ? 'eager' : 'lazy'}
                fetchPriority={eager ? 'high' : 'auto'}
                decoding="async"
                onLoad={() => setStatus('loaded')}
                onError={() => setStatus('error')}
                className="size-full object-cover object-top"
              />
            </picture>
          )}
        </div>
      </Card>
      <figcaption className="mt-3 flex items-start justify-between gap-4 px-1 text-xs leading-5 text-muted-foreground">
        <span>{feature.caption}</span>
        <Button variant="ghost" size="icon-lg" asChild className="size-9 shrink-0">
          <a href={desktopSrc} target="_blank" rel="noopener noreferrer" aria-label={`Open full ${feature.name} screenshot in a new tab`}><Maximize2 className="size-3.5" aria-hidden="true" /></a>
        </Button>
      </figcaption>
    </figure>
  );
}

export function ProductShowcase() {
  return (
    <section id="workspace" aria-labelledby="workspace-title" className="scroll-mt-24">
      <div className="mx-auto max-w-6xl px-5 pb-8 pt-16 sm:px-8 sm:pt-24">
        <ScrollReveal>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">One workspace. A clearer way forward.</p>
          <h2 id="workspace-title" className="mt-4 max-w-2xl text-3xl font-medium leading-tight tracking-tight sm:text-5xl">Meet the tools behind<br />your next small step.</h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">A look inside Sonder SAT. Real screens, connected study tools, and space to find what works for you.</p>
          <nav aria-label="Study tools" className="mt-6 flex flex-wrap gap-2">
            {features.map(({ id, name, icon: Icon }) => <Button key={id} variant="outline" size="lg" asChild className="h-10 px-3"><a href={`#${id}`}><Icon aria-hidden="true" />{name}</a></Button>)}
          </nav>
        </ScrollReveal>
      </div>
      {features.map((feature, index) => (
        <section id={feature.id} key={feature.id} aria-labelledby={`${feature.id}-title`} className={cn('scroll-mt-24', index % 2 === 1 && 'border-y border-border bg-muted/25')}>
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-12 lg:gap-12">
            <ScrollReveal className={cn('lg:col-span-5', index % 2 === 1 && 'lg:order-2')}>
              <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-muted-foreground"><span className="tabular-nums">{feature.number}</span><span className="h-px w-6 bg-border" aria-hidden="true" />{feature.eyebrow}</p>
              <h3 id={`${feature.id}-title`} className="mt-5 whitespace-pre-line text-3xl font-medium leading-tight tracking-tight sm:text-4xl">{feature.title}</h3>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">{feature.description}</p>
              <ul className="mt-6 space-y-3">{feature.capabilities.map(item => <li key={item} className="flex items-start gap-3 text-sm leading-6"><Check className="mt-1 size-4 shrink-0" aria-hidden="true" />{item}</li>)}</ul>
              <Button variant="link" size="lg" asChild className="mt-5 h-10 px-0"><a href="#start-learning">Make room for {feature.name.toLowerCase()}<ArrowRight aria-hidden="true" /></a></Button>
            </ScrollReveal>
            <ScrollReveal delay={100} className={cn('landing-preview min-w-0 lg:col-span-7', index % 2 === 1 && 'lg:order-1', feature.id === 'error-log' && 'landing-preview-rose', feature.id === 'analytics' && 'landing-preview-cool')}>
              <ProductScreenshot featureId={feature.id} />
            </ScrollReveal>
          </div>
        </section>
      ))}
    </section>
  );
}
