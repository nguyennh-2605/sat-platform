import { lazy, Suspense, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import axiosClient from '@/lib/axios';

const RichTextEditor = lazy(() => import('@/components/ui/rich-text-editor').then(module => ({ default: module.RichTextEditor })));

interface EditableAnnouncement {
  id: string;
  title: string;
  content?: string | null;
  fileUrls: string[];
  links: string[];
  isPinned: boolean;
}

interface AnnouncementDialogProps {
  open: boolean;
  onClose: () => void;
  classId: string;
  announcement?: EditableAnnouncement | null;
  onSaved: () => Promise<void> | void;
}

export default function AnnouncementDialog(props: AnnouncementDialogProps) {
  if (!props.open) return null;
  return <AnnouncementDialogContent {...props} />;
}

function AnnouncementDialogContent({ onClose, classId, announcement, onSaved }: AnnouncementDialogProps) {
  const [title, setTitle] = useState(announcement?.title || '');
  const [content, setContent] = useState(announcement?.content || '');
  const [attachments, setAttachments] = useState((announcement?.fileUrls || []).join('\n'));
  const [links, setLinks] = useState((announcement?.links || []).join('\n'));
  const [isPinned, setIsPinned] = useState(announcement?.isPinned || false);
  const [saving, setSaving] = useState(false);
  const urlLines = (value: string) => value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const submit = async () => {
    if (!title.trim()) return toast.error('Enter an announcement title');
    setSaving(true);
    try {
      const payload = { title: title.trim(), content: meaningfulRichText(content), fileUrls: urlLines(attachments), links: urlLines(links), isPinned };
      if (announcement) await axiosClient.patch(`/api/classes/${classId}/announcements/${announcement.id}`, payload);
      else await axiosClient.post(`/api/classes/${classId}/announcements`, payload);
      toast.success(announcement ? 'Announcement updated' : 'Announcement published');
      await onSaved();
      onClose();
    } catch (error) {
      toast.error((error as { response?: { data?: { error?: string } } })?.response?.data?.error || `Unable to ${announcement ? 'update' : 'publish'} announcement.`);
    } finally { setSaving(false); }
  };
  const verb = announcement ? 'Save changes' : 'Publish announcement';
  return <Modal open onClose={() => !saving && onClose()} closeOnBackdrop={!saving} presentation="content-dialog" title={announcement ? 'Edit announcement' : 'New announcement'} subtitle={announcement ? 'Update the message shared with this class.' : 'Share an update with everyone in this class.'} className="max-w-2xl!" footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving || !title.trim()} onClick={() => void submit()}>{saving ? <><LoadingSpinner />Saving…</> : verb}</Button></>}>
    <div className="space-y-5">
      <Field><FieldLabel htmlFor="announcement-title">Title</FieldLabel><Input id="announcement-title" autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="What should students know?" maxLength={160} /></Field>
      <Field><FieldLabel id="announcement-message-label">Message</FieldLabel><Suspense fallback={<Skeleton className="h-52 border border-ui-border" aria-label="Loading rich text editor" />}><RichTextEditor id="announcement-message" labelledBy="announcement-message-label" value={content} onChange={setContent} placeholder="Write your announcement…" disabled={saving} /></Suspense></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="announcement-attachments">Attachment URLs</FieldLabel><Textarea id="announcement-attachments" rows={3} value={attachments} onChange={event => setAttachments(event.target.value)} placeholder="One URL per line" /></Field><Field><FieldLabel htmlFor="announcement-links">Reference links</FieldLabel><Textarea id="announcement-links" rows={3} value={links} onChange={event => setLinks(event.target.value)} placeholder="One URL per line" /></Field></div>
      <Field orientation="horizontal" className="rounded-lg border border-ui-border bg-muted/20 p-3"><Checkbox id="announcement-pinned" checked={isPinned} disabled={saving} onCheckedChange={checked => setIsPinned(Boolean(checked))} /><div className="min-w-0"><FieldLabel htmlFor="announcement-pinned">Pin announcement</FieldLabel><FieldDescription>Keep this update above recent announcements. A class can pin up to five.</FieldDescription></div></Field>
    </div>
  </Modal>;
}

function meaningfulRichText(value: string) {
  if (typeof DOMParser === 'undefined') return value.trim() || null;
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  return parsed.body.textContent?.replace(/\u00a0/g, ' ').trim() ? value.trim() : null;
}
