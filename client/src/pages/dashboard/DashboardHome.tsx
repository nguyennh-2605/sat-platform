import { ArrowRight, BarChart3, BookA, BookOpenCheck, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ClassroomTodoPanel } from '../../features/classroom/ClassroomTodoPanel';
import { SatCountdown } from '../../features/sat-countdown/SatCountdown';

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

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl tracking-tight">Welcome back, {firstName}</h1>
              <Badge variant="outline" className="capitalize">{role.toLowerCase()}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{roleMessage}</p>
          </div>
          <SatCountdown />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <section className="xl:col-span-8" aria-labelledby="workspace-title">
            <Card>
              <CardHeader>
                <CardTitle id="workspace-title">Your workspace</CardTitle>
                <CardDescription>Move between the core parts of your SAT learning plan.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {destinations.map(({ to, title, description, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className="group flex min-h-32 items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-foreground">
                        Open <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </span>
                  </Link>
                ))}
              </CardContent>
              <CardFooter className="justify-end border-t">
                <Button asChild size="sm">
                  <Link to={role === 'TEACHER' ? '/dashboard/classes' : '/dashboard/practice-test'}>
                    {role === 'TEACHER' ? 'Open your classes' : 'Continue learning'}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </section>

          <div className="xl:col-span-4">
            <ClassroomTodoPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
