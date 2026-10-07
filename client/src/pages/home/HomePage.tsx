import { useState, useSyncExternalStore } from 'react';
import { ArrowDown, ArrowRight, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/brand/BrandMark';
import { SonderCat } from '@/components/brand/SonderCat';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { appToast } from '@/components/ui/toast';
import { getAuthStatus, logoutAuthSession, subscribeAuthSession } from '@/lib/authSession';
import { ClassroomSection, FaqSection, LearningCycle } from './LandingSections';
import { ProductScreenshot, ProductShowcase } from './ProductShowcase';
import { ScrollReveal } from './ScrollReveal';
import './landing.css';

const navigation = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#workspace', label: 'The workspace' },
  { href: '#faq', label: 'FAQ' },
];

export default function HomePage() {
  const authStatus = useSyncExternalStore(subscribeAuthSession, getAuthStatus, getAuthStatus);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isLoggedIn = authStatus === 'authenticated';
  const isCheckingSession = authStatus === 'loading';
  const startHref = isLoggedIn ? '/dashboard' : '/auth?mode=register';
  const startLabel = isLoggedIn ? 'Open dashboard' : 'Get started';

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await logoutAuthSession();
      appToast.success('Signed out');
    } catch {
      // The session helper clears the local session even if the server is offline.
      appToast.error('Signed out on this device. Unable to reach the server.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const startAction = (className?: string) => isCheckingSession ? (
    <Button size="lg" disabled className={className} aria-busy="true">
      <LoadingSpinner /> Checking session
    </Button>
  ) : (
    <Button size="lg" asChild className={className}>
      <Link to={startHref}>{startLabel}<ArrowRight aria-hidden="true" /></Link>
    </Button>
  );

  return (
    <div className="landing-page min-h-svh bg-background text-foreground">
      <a href="#main-content" className="fixed left-4 top-4 z-50 -translate-y-24 rounded-control bg-background px-4 py-3 text-sm font-medium ring-2 ring-ring focus:translate-y-0">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link to="/" aria-label="Sonder SAT home" className="flex shrink-0 items-center gap-2.5 rounded-control text-base font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandMark /> Sonder SAT
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
            {navigation.map(item => <Button key={item.href} variant="ghost" size="lg" asChild><a href={item.href}>{item.label}</a></Button>)}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              {!isCheckingSession && (isLoggedIn ? (
                <Button variant="ghost" size="lg" disabled={isSigningOut} onClick={() => void handleLogout()}>{isSigningOut ? <><LoadingSpinner /> Signing out</> : 'Log out'}</Button>
              ) : <Button variant="ghost" size="lg" asChild><Link to="/auth">Log in</Link></Button>)}
              {startAction('px-4')}
            </div>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild><Button variant="outline" size="icon-lg" className="size-10 lg:hidden" aria-label="Open navigation"><Menu aria-hidden="true" /></Button></SheetTrigger>
              <SheetContent overlayClassName="motion-reduce:animate-none! motion-reduce:transition-none! supports-backdrop-filter:backdrop-blur-none" className="w-80 max-w-[calc(100%-2rem)] [&>button[data-slot=sheet-close]]:size-10 motion-reduce:animate-none! motion-reduce:transition-none!">
                <SheetHeader>
                  <SheetTitle>Sonder SAT</SheetTitle>
                  <SheetDescription>Your SAT learning workspace.</SheetDescription>
                </SheetHeader>
                <nav aria-label="Mobile navigation" className="flex flex-col gap-2 px-4">
                  {navigation.map(item => <SheetClose asChild key={item.href}><Button variant="ghost" size="lg" asChild className="justify-start"><a href={item.href}>{item.label}</a></Button></SheetClose>)}
                </nav>
                <div className="mt-2 flex flex-col gap-3 border-t border-border p-4">
                  {isCheckingSession ? <Button disabled size="lg"><LoadingSpinner /> Checking session</Button> : (
                    <>
                      <SheetClose asChild><Button asChild size="lg"><Link to={startHref}>{startLabel}<ArrowRight aria-hidden="true" /></Link></Button></SheetClose>
                      {isLoggedIn ? <Button variant="outline" size="lg" disabled={isSigningOut} onClick={() => void handleLogout()}>{isSigningOut ? 'Signing out…' : 'Log out'}</Button> : <SheetClose asChild><Button variant="outline" size="lg" asChild><Link to="/auth">Log in</Link></Button></SheetClose>}
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        <section aria-labelledby="hero-title" className="landing-hero">
          <div className="mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-20">
          <ScrollReveal className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">A little focus. A lot of possibility.</p>
            <h1 id="hero-title" className="mt-6 text-4xl font-medium leading-tight tracking-tight sm:text-6xl sm:leading-tight lg:text-7xl">Small steps.<br /><span className="text-muted-foreground">A clearer SAT journey.</span></h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground">Practice with purpose, make mistakes useful, and build what comes next. Your study tools, together in one focused workspace.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {startAction('h-11 px-5')}
              <Button variant="ghost" size="lg" asChild className="h-11 px-4"><a href="#workspace">Explore the workspace<ArrowDown aria-hidden="true" /></a></Button>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={80} className="mx-auto mt-10 max-w-5xl sm:mt-14">
            <ProductScreenshot featureId="practice" eager hero />
          </ScrollReveal>
          <div className="mx-auto mt-4 flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><span>Built for Digital SAT</span><span aria-hidden="true">/</span><span>Reading &amp; Writing</span><span aria-hidden="true">/</span><span>Math</span></div>
            <div className="flex items-center gap-3"><SonderCat className="size-16" /><p className="text-xs leading-5 text-muted-foreground">A tiny cat for a bigger journey.<br /><span className="font-medium text-foreground">One step at a time.</span></p></div>
          </div>
          </div>
        </section>

        <LearningCycle />
        <ProductShowcase />
        <ClassroomSection />
        <FaqSection />

        <section id="start-learning" aria-labelledby="start-title" className="landing-start scroll-mt-24 border-y border-border">
          <ScrollReveal className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center md:py-16">
            <div><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Your next chapter</p><h2 id="start-title" className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Start small. Keep going.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Your next practice, your next insight, your next step.</p></div>
            {startAction('h-11 px-5')}
          </ScrollReveal>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link to="/" className="flex w-fit items-center gap-2 rounded-control text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><BrandMark size="sm" />Sonder SAT</Link>
        <p className="text-xs leading-5 text-muted-foreground">A focused workspace for your Digital SAT journey.</p>
        <Button variant="ghost" size="lg" asChild className="w-fit"><a href="#main-content">Back to top<ArrowRight className="-rotate-90" aria-hidden="true" /></a></Button>
      </footer>
    </div>
  );
}
