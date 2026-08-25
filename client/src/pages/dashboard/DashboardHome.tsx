import { ArrowRight, BarChart3, BookA, BookOpenCheck, GraduationCap, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppHeader, Card } from '../../components/ui/AppUI';
import { ui } from '../../components/ui/styles';
import { SatCountdown } from '../../features/sat-countdown/SatCountdown';
import { ClassroomTodoPanel } from '../../features/classroom/ClassroomTodoPanel';

const destinations = [
  { to: '/dashboard/practice-test', title: 'Practice Center', description: 'Continue a test or start targeted SAT practice.', icon: BookOpenCheck },
  { to: '/dashboard/classes', title: 'Classroom', description: 'Open your classes, assignments, and announcements.', icon: GraduationCap },
  { to: '/dashboard/vocabulary', title: 'Vocabulary', description: 'Build recall with focused word practice.', icon: BookA },
  { to: '/dashboard/results-analytics', title: 'Results & Analytics', description: 'Review performance and decide what to study next.', icon: BarChart3 },
] as const;

export default function DashboardHome() {
  const userName = localStorage.getItem('userName') || 'Student';
  const firstName = userName.trim().split(/\s+/)[0] || 'Student';
  const role = (localStorage.getItem('userRole') || 'STUDENT').toUpperCase();
  const roleMessage = role === 'TEACHER'
    ? 'Manage learning activities and keep each class moving forward.'
    : 'Pick up where you left off and focus on the work that matters today.';

  return <div className={ui.page}>
    <AppHeader title="Overview" subtitle="Your SAT learning workspace" centerContent={<SatCountdown />} />
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={ui.content}>
        <section className="overflow-hidden rounded-card border border-primary/15 bg-gradient-to-br from-sidebar via-primary-hover to-primary p-6 text-white shadow-elevated sm:p-8" aria-labelledby="welcome-title">
          <div className="max-w-2xl">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-control bg-white/10" aria-hidden="true"><Sparkles size={20} /></div>
            <h2 id="welcome-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back, {firstName}</h2>
            <p className="mt-3 max-w-xl text-body-lg text-white/80">{roleMessage}</p>
            <Link to={role === 'TEACHER' ? '/dashboard/classes' : '/dashboard/practice-test'} className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-control bg-white px-4 py-2 text-body font-semibold text-primary shadow-sm transition-colors hover:bg-primary-soft">
              {role === 'TEACHER' ? 'Open your classes' : 'Continue learning'} <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-labelledby="workspace-title">
            <div className="mb-3">
              <h2 id="workspace-title" className="text-heading font-semibold text-foreground">Your workspace</h2>
              <p className="mt-1 text-body text-muted-foreground">Move between the core parts of your learning plan.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {destinations.map(({ to, title, description, icon: Icon }) => <Link key={to} to={to} className="group rounded-card focus-visible:outline-none">
                <Card className="h-full p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-elevated group-focus-visible:border-primary group-focus-visible:ring-2 group-focus-visible:ring-primary/20">
                  <span className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-soft text-primary"><Icon size={20} aria-hidden="true" /></span>
                  <h3 className="mt-4 text-title font-semibold text-foreground group-hover:text-primary-hover">{title}</h3>
                  <p className="mt-1 text-body leading-6 text-muted-foreground">{description}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-body font-semibold text-primary">Open <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
                </Card>
              </Link>)}
            </div>
          </section>
          <ClassroomTodoPanel />
        </div>
      </div>
    </div>
  </div>;
}
