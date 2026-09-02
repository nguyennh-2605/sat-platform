import { useEffect, useState, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Modal } from '@/components/ui/AppUI';
import { Textarea } from '@/components/ui/textarea';
import axiosClient from '@/lib/axios';

export default function AnnouncementDialog({ open, onClose, classId, onCreated }: { open: boolean; onClose: () => void; classId: string; onCreated: () => Promise<void> | void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState('');
  const [links, setLinks] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) { setTitle(''); setContent(''); setAttachments(''); setLinks(''); } }, [open]);
  const urlLines = (value: string) => value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const submit = async () => {
    if (!title.trim()) return toast.error('Enter an announcement title');
    setSaving(true);
    try {
      await axiosClient.post(`/api/classes/${classId}/announcements`, { title: title.trim(), content: content.trim() || null, fileUrls: urlLines(attachments), links: urlLines(links) });
      toast.success('Announcement published');
      await onCreated();
      onClose();
    } catch (error) {
      toast.error((error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Unable to publish announcement.');
    } finally { setSaving(false); }
  };
  return <Modal open={open} onClose={() => !saving && onClose()} closeOnBackdrop={!saving} presentation="content-dialog" title="New announcement" subtitle="Share an update with everyone in this class." className="max-w-2xl!" footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving || !title.trim()} onClick={() => void submit()}>{saving ? <><LoaderCircle size={15} className="animate-spin" />Publishing…</> : 'Publish announcement'}</Button></>}>
    <div className="space-y-5"><Field label="Title"><Input autoFocus className="w-full" value={title} onChange={event => setTitle(event.target.value)} placeholder="What should students know?" /></Field><Field label="Message"><Textarea rows={6} value={content} onChange={event => setContent(event.target.value)} placeholder="Write your announcement…" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Attachment URLs"><Textarea rows={3} value={attachments} onChange={event => setAttachments(event.target.value)} placeholder="One URL per line" /></Field><Field label="Reference links"><Textarea rows={3} value={links} onChange={event => setLinks(event.target.value)} placeholder="One URL per line" /></Field></div></div>
  </Modal>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="mb-2 block text-caption font-medium text-foreground">{label}</span>{children}</label>; }
