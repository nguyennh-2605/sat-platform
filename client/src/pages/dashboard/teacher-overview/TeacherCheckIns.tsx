import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TeacherOverviewResponse } from './teacher-overview.types';

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'ST';

export function TeacherCheckIns({ items }: { items: TeacherOverviewResponse['checkIns'] }) {
  const navigate = useNavigate();
  return <Card className="h-full">
    <CardHeader><CardTitle>Students to Check In</CardTitle><CardDescription>Rule-based signals with a clear reason.</CardDescription></CardHeader>
    <CardContent className="px-0">
      {items.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><CheckCircle2 className="size-9 text-muted-foreground" /><p className="mt-3 font-medium">No check-ins suggested</p><p className="mt-1 text-sm text-muted-foreground">No students currently match the evidence thresholds.</p></div> : <div className="divide-y">{items.map(item => <Button key={`${item.classId}:${item.studentId}`} variant="ghost" onClick={() => navigate(item.href)} className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left font-normal whitespace-normal active:translate-y-0">
        <Avatar><AvatarFallback>{initials(item.studentName)}</AvatarFallback></Avatar>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{item.studentName}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.reasonLabel}</span><span className="mt-0.5 block truncate text-xs font-medium text-foreground">{item.className}</span></span>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Button>)}</div>}
    </CardContent>
  </Card>;
}
