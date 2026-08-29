import { ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TeacherOverviewResponse } from './teacher-overview.types';

export function TeacherClassPulse({ items }: { items: TeacherOverviewResponse['classes'] }) {
  const navigate = useNavigate();
  return <Card>
    <CardHeader><CardTitle>Your Classes</CardTitle><CardDescription>Completion and assessed performance from the last 30 days.</CardDescription></CardHeader>
    <CardContent className="px-0">
      <Table className="min-w-176">
        <TableHeader className="bg-muted/20"><TableRow><TableHead className="h-11 px-4">Class</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Completion</TableHead><TableHead className="text-right">Average score</TableHead><TableHead className="text-right">Attention</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
        <TableBody>{items.map(item => <TableRow key={item.id} role="link" tabIndex={0} onClick={() => navigate(item.href)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(item.href); } }} className="cursor-pointer outline-none focus-visible:bg-muted/60">
          <TableCell className="px-4 py-3"><div className="flex items-center gap-3"><span className="size-2.5 rounded-full border" style={{ backgroundColor: item.color }} aria-hidden="true" /><span><span className="block font-medium text-foreground">{item.name}</span><span className="text-xs text-muted-foreground">{item.activityCount ? `${item.activityCount} recent ${item.activityCount === 1 ? 'activity' : 'activities'}` : 'No recent activity'}</span></span></div></TableCell>
          <TableCell className="text-right tabular-nums">{item.studentCount}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">{item.completionRate === null ? '—' : `${item.completionRate}%`}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">{item.averageScore === null ? '—' : `${item.averageScore}%`}</TableCell>
          <TableCell className="text-right">{item.attentionCount ? <Badge variant="destructive">{item.attentionCount}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
          <TableCell><ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" /></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </CardContent>
  </Card>;
}
