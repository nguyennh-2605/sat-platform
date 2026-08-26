import { ArrowRight, Archive, BookOpenCheck, Building2, FilePenLine, GraduationCap, UserRound, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminOverviewResponse, OverviewRange } from './admin-overview.types';

const rangeLabel = { '7d': '7 days', '30d': '30 days', '90d': '90 days' } as const;

function SnapshotRow({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) {
  return <div className="flex items-center gap-3 py-2.5"><span className="flex size-8 shrink-0 items-center justify-center rounded-control border border-ui-border bg-muted text-muted-foreground"><Icon className="size-4" aria-hidden="true" /></span><span className="min-w-0 flex-1 text-sm text-muted-foreground">{label}</span><span className="font-medium tabular-nums text-foreground">{value.toLocaleString('en-US')}</span></div>;
}

function SnapshotSkeleton() {
  return <Card><CardHeader><Skeleton className="h-5 w-36" /><Skeleton className="h-4 w-52" /></CardHeader><CardContent className="space-y-3">{[1, 2, 3, 4].map(item => <Skeleton key={item} className="h-10 w-full" />)}</CardContent></Card>;
}

export function OverviewSnapshots({ data, loading, range }: { data: AdminOverviewResponse | null; loading: boolean; range: OverviewRange }) {
  if (loading || !data) return <div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><SnapshotSkeleton /><SnapshotSkeleton /></div>;

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-label="Content and classroom snapshots">
      <Card>
        <CardHeader>
          <CardTitle>Test &amp; Content</CardTitle>
          <CardDescription>System lifecycle and teacher-created content.</CardDescription>
          <CardAction><Button asChild variant="outline" size="sm"><Link to="/dashboard/practice-test">Manage tests<ArrowRight data-icon="inline-end" /></Link></Button></CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 rounded-control border border-ui-border p-3">
            <div><p className="text-xs text-muted-foreground">Published</p><p className="mt-1 text-2xl tabular-nums text-foreground">{data.tests.system.published.toLocaleString('en-US')}</p></div>
            <div><p className="text-xs text-muted-foreground">Draft</p><p className="mt-1 text-2xl tabular-nums text-foreground">{data.tests.system.draft.toLocaleString('en-US')}</p></div>
            <div><p className="text-xs text-muted-foreground">Archived</p><p className="mt-1 text-2xl tabular-nums text-foreground">{data.tests.system.archived.toLocaleString('en-US')}</p></div>
          </div>
          <div className="mt-2 divide-y divide-ui-border">
            <SnapshotRow icon={BookOpenCheck} label="Teacher tests" value={data.tests.teacher.total} />
            <SnapshotRow icon={FilePenLine} label={`Teacher tests created in ${rangeLabel[range]}`} value={data.tests.teacher.createdInPeriod} />
            <SnapshotRow icon={Archive} label="System tests across all lifecycle states" value={data.tests.system.published + data.tests.system.draft + data.tests.system.archived} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classroom Snapshot</CardTitle>
          <CardDescription>Platform-wide classroom reach without inferred health states.</CardDescription>
          <CardAction><span className="flex size-7 items-center justify-center rounded-control border border-ui-border bg-muted text-muted-foreground"><Building2 className="size-4" /></span></CardAction>
        </CardHeader>
        <CardContent className="divide-y divide-ui-border">
          <SnapshotRow icon={Building2} label="Total classrooms" value={data.classrooms.total} />
          <SnapshotRow icon={UserRound} label="Teachers with classrooms" value={data.classrooms.teachersWithClasses} />
          <SnapshotRow icon={UsersRound} label="Enrolled students" value={data.classrooms.uniqueEnrolledStudents} />
          <SnapshotRow icon={GraduationCap} label={`Created in the last ${rangeLabel[range]}`} value={data.classrooms.createdInPeriod} />
        </CardContent>
      </Card>
    </section>
  );
}
