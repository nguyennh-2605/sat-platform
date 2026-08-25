import { useSyncExternalStore } from 'react';
import { ArrowRight, BarChart3, BookOpenCheck, CheckCircle2, GraduationCap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Card } from '../../components/ui/AppUI';
import { getAuthStatus, logoutAuthSession, subscribeAuthSession } from '../../lib/authSession';

const features = [
  { icon: BookOpenCheck, title: 'Focused SAT practice', description: 'Move from full tests to targeted review without losing your place.' },
  { icon: GraduationCap, title: 'Connected classroom', description: 'Assignments, announcements, and learning materials stay in one workspace.' },
  { icon: BarChart3, title: 'Actionable analytics', description: 'See patterns in your attempts and know what to study next.' },
] as const;

export default function HomePage() {
  const navigate = useNavigate();
  const authStatus = useSyncExternalStore(subscribeAuthSession, getAuthStatus, getAuthStatus);
  const isLoggedIn = authStatus === 'authenticated';
  const userName = localStorage.getItem('userName') || 'Student';

  const handleLogout = async () => {
    await logoutAuthSession();
    toast('Signed out');
  };

  return <div className="min-h-screen overflow-hidden bg-background text-foreground">
    <a href="#main-content" className="fixed left-3 top-3 z-50 -translate-y-20 rounded-control bg-surface px-4 py-2 text-body font-semibold text-primary shadow-elevated transition-transform focus:translate-y-0">Skip to content</a>
    <header className="relative z-20 border-b border-ui-border bg-surface/90 backdrop-blur-sm">
      <div className="mx-auto flex min-h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 rounded-control">
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-primary text-white"><BookOpenCheck size={19} aria-hidden="true" /></span>
          <span className="text-body font-semibold tracking-[0.04em]">SAT MASTER</span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Account">
          {isLoggedIn ? <>
            <span className="hidden text-body text-muted-foreground sm:inline">Hello, {userName}</span>
            <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>Log out</Button>
            <Button size="sm" onClick={() => navigate('/dashboard')}>Dashboard <ArrowRight size={15} aria-hidden="true" /></Button>
          </> : <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>Log in</Button>
            <Button size="sm" onClick={() => navigate('/auth?mode=register')}>Create account</Button>
          </>}
        </nav>
      </div>
    </header>

    <main id="main-content">
      <section className="relative isolate px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_20%,rgba(27,122,90,0.16),transparent_32%),radial-gradient(circle_at_15%_70%,rgba(232,192,64,0.14),transparent_28%)]" />
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-primary/25 bg-primary-soft px-3 py-1 text-caption font-semibold uppercase tracking-widest text-primary">Digital SAT preparation</span>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.035em] text-foreground sm:text-5xl lg:text-6xl lg:leading-[1.08]">A calmer, clearer path to your target SAT score.</h1>
            <p className="mt-6 max-w-2xl text-body-lg leading-7 text-subtle-foreground sm:text-lg sm:leading-8">Practice, learn from mistakes, build vocabulary, and follow your progress in one focused learning workspace.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={() => navigate(isLoggedIn ? '/dashboard' : '/auth')} className="px-6">{isLoggedIn ? 'Open dashboard' : 'Start learning'} <ArrowRight size={18} aria-hidden="true" /></Button>
              {!isLoggedIn && <Button variant="outline" size="lg" onClick={() => navigate('/auth?mode=register')} className="px-6">Create free account</Button>}
            </div>
            <ul className="mt-8 flex flex-col gap-3 text-body text-subtle-foreground sm:flex-row sm:gap-6">
              {['Reading & Writing', 'Math', 'Instant review'].map(item => <li key={item} className="flex items-center gap-2"><CheckCircle2 size={17} className="text-primary" aria-hidden="true" />{item}</li>)}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-lg" aria-label="SAT Master workspace preview">
            <div className="absolute -inset-8 -z-10 rounded-full bg-primary/10 blur-3xl" />
            <Card className="overflow-hidden border-primary/20 p-0 shadow-elevated">
              <div className="flex items-center justify-between border-b border-ui-border bg-surface-subtle px-5 py-4"><span className="text-body font-semibold">Today’s focus</span><span className="rounded-full bg-primary-soft px-2.5 py-1 text-caption font-semibold text-primary">Study plan</span></div>
              <div className="space-y-3 p-5">
                <PreviewRow number="01" title="Targeted Reading practice" meta="12 questions · 18 min" active />
                <PreviewRow number="02" title="Review vocabulary" meta="24 words" />
                <PreviewRow number="03" title="Analyze recent mistakes" meta="5 entries" />
              </div>
              <div className="border-t border-ui-border bg-sidebar p-5 text-white"><p className="text-caption uppercase tracking-widest text-sidebar-muted">One workspace</p><p className="mt-2 text-heading font-semibold">Practice → Review → Improve</p></div>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-y border-ui-border bg-surface px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="features-title">
        <div className="mx-auto max-w-[1280px]">
          <div className="max-w-2xl"><p className="text-caption font-semibold uppercase tracking-widest text-primary">Built for focused progress</p><h2 id="features-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Everything you need, without the noise.</h2></div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">{features.map(({ icon: Icon, title, description }) => <Card key={title} className="p-6"><span className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-soft text-primary"><Icon size={20} aria-hidden="true" /></span><h3 className="mt-4 text-title font-semibold">{title}</h3><p className="mt-2 text-body leading-6 text-muted-foreground">{description}</p></Card>)}</div>
        </div>
      </section>
    </main>
    <footer className="bg-sidebar px-4 py-8 text-sidebar-foreground sm:px-6 lg:px-8"><div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-3 text-caption sm:flex-row"><span className="font-semibold text-white">SAT MASTER</span><span>Focused preparation for the Digital SAT.</span></div></footer>
  </div>;
}

function PreviewRow({ number, title, meta, active = false }: { number: string; title: string; meta: string; active?: boolean }) {
  return <div className={`flex items-center gap-4 rounded-control border p-4 ${active ? 'border-primary/30 bg-primary-soft' : 'border-ui-border bg-surface'}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-caption font-semibold ${active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{number}</span><span className="min-w-0"><span className="block truncate text-body font-semibold text-foreground">{title}</span><span className="mt-0.5 block text-caption text-muted-foreground">{meta}</span></span></div>;
}
