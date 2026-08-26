import { ArrowRight, BarChart3, BookA, BookOpenCheck, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '../../components/ui/AppUI';
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
    : role === 'ADMIN'
      ? 'Manage platform content and keep the SAT workspace organized.'
    : 'Pick up where you left off and focus on the work that matters today.';
  const roleDestinations = destinations.map(destination => destination.to === '/dashboard/practice-test'
    ? {
        ...destination,
        title: role === 'ADMIN' ? 'Test Management' : role === 'TEACHER' ? 'Test Library' : destination.title,
        description: role === 'ADMIN'
          ? 'Manage system tests and oversee teacher-created content.'
          : role === 'TEACHER'
            ? 'Create and manage tests for your classes.'
            : destination.description,
      }
    : destination);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
        <PageHeader
          title={<span className="flex flex-wrap items-center gap-2">Welcome back, {firstName}<Badge variant="outline" className="capitalize">{role.toLowerCase()}</Badge></span>}
          description={roleMessage}
          actions={<SatCountdown />}
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <section className="xl:col-span-8" aria-labelledby="workspace-title">
            <div className="mb-3">
              <h2 id="workspace-title" className="text-lg font-medium">Your workspace</h2>
              <p className="text-sm text-muted-foreground">Move between the core parts of your SAT learning plan.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                {roleDestinations.map(({ to, title, description, icon: Icon }) => (
                  <Card key={to} className="group gap-0 py-0 transition-shadow hover:shadow-md">
                    <CardContent className="flex min-h-36 items-start gap-3 p-5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-foreground"><Icon className="size-4" aria-hidden="true" /></span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium">{title}</span>
                        <span className="mt-1 text-sm leading-5 text-muted-foreground">{description}</span>
                        <Button asChild variant="ghost" size="sm" className="-ml-3 mt-auto w-fit">
                          <Link to={to}>Open<ArrowRight aria-hidden="true" /></Link>
                        </Button>
                      </span>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </section>

          <div className="xl:col-span-4">
            <ClassroomTodoPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
