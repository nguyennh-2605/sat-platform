import { useEffect, useState, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Modal } from '@/components/ui/AppUI';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Textarea } from '@/components/ui/textarea';
import axiosClient from '@/lib/axios';

interface Student { id: number; name: string | null; email: string }

export default function HomeworkActivityDialog({ open, onClose, classId, lessonId, students, onCreated }: { open: boolean; onClose: () => void; classId: string; lessonId?: string; students: Student[]; onCreated: () => Promise<void> | void }) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [availableAt, setAvailableAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [attachments, setAttachments] = useState('');
  const [links, setLinks] = useState('');
  const [allStudents, setAllStudents] = useState(true);
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) return;
    setTitle(''); setInstructions(''); setAvailableAt(''); setDueAt(''); setAttachments(''); setLinks(''); setAllStudents(true); setStudentIds([]);
  }, [open]);

  const toggleStudent = (studentId: number) => setStudentIds(current => current.includes(studentId) ? current.filter(id => id !== studentId) : [...current, studentId]);
  const urlLines = (value: string) => value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const submit = async () => {
    if (!title.trim()) return toast.error('Enter a homework title');
    if (!students.length) return toast.error('Add at least one student before publishing homework');
    if (!allStudents && !studentIds.length) return toast.error('Select at least one student');
    if (availableAt && dueAt && new Date(availableAt) >= new Date(dueAt)) return toast.error('Due date must be after availability');
    setSaving(true);
    try {
      await axiosClient.post('/api/class-activities/homework', {
        classId, lessonId: lessonId || null, title: title.trim(), instructions: instructions.trim() || null,
        availableAt: availableAt ? new Date(availableAt).toISOString() : null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        fileUrls: urlLines(attachments), links: urlLines(links), ...(!allStudents ? { studentIds } : {}),
      });
      toast.success('Homework published');
      await onCreated();
      onClose();
    } catch (error) {
      toast.error((error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Unable to publish homework.');
    } finally { setSaving(false); }
  };

  return <Modal open={open} onClose={() => !saving && onClose()} closeOnBackdrop={!saving} presentation="content-dialog" title="Add homework" subtitle={lessonId ? 'Publish homework for this lesson. Students complete it by submitting their work.' : 'Publish homework to this class. Students complete it by submitting their work.'} className="max-w-2xl!" footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving || !title.trim() || !students.length || (!allStudents && !studentIds.length)} onClick={() => void submit()}>{saving ? <><LoaderCircle size={15} className="animate-spin" />Publishing…</> : 'Publish homework'}</Button></>}>
    <div className="max-h-[68vh] space-y-5 overflow-y-auto pr-1">
      {!students.length && <p className="rounded-control border border-ui-border bg-muted p-3 text-caption text-muted-foreground">Add at least one student to this class before publishing homework.</p>}
      <Field label="Title"><Input autoFocus className="w-full" value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Complete practice set 3" /></Field>
      <Field label="Instructions"><Textarea value={instructions} onChange={event => setInstructions(event.target.value)} rows={4} placeholder="What should students complete or submit?" /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Available from"><DateTimePicker value={availableAt} onChange={setAvailableAt} placeholder="Available now" ariaLabel="Homework available from" /></Field><Field label="Due date"><DateTimePicker value={dueAt} minDate={availableAt || undefined} onChange={setDueAt} placeholder="No deadline" ariaLabel="Homework due date" /></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Attachment URLs"><Textarea value={attachments} onChange={event => setAttachments(event.target.value)} rows={3} placeholder="One URL per line" /></Field><Field label="Reference links"><Textarea value={links} onChange={event => setLinks(event.target.value)} rows={3} placeholder="One URL per line" /></Field></div>
      <div className="border-t border-ui-border pt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-body font-medium">Students</h3><p className="mt-1 text-caption text-muted-foreground">Assign to the whole class or selected students.</p></div><label className="flex items-center gap-2 text-body"><Checkbox checked={allStudents} onCheckedChange={checked => { setAllStudents(Boolean(checked)); setStudentIds([]); }} />All students</label></div>{!allStudents && <div className="mt-3 grid gap-2 sm:grid-cols-2">{students.map(student => <label key={student.id} className="flex items-center gap-3 rounded-control border border-ui-border p-3 hover:bg-muted/30"><Checkbox checked={studentIds.includes(student.id)} onCheckedChange={() => toggleStudent(student.id)} /><span className="min-w-0"><span className="block truncate text-body font-medium">{student.name || student.email}</span><span className="block truncate text-caption text-muted-foreground">{student.email}</span></span></label>)}</div>}</div>
    </div>
  </Modal>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="mb-2 block text-caption font-medium text-foreground">{label}</span>{children}</label>; }
