import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Angry, Frown, ImagePlus, Laugh, Meh, MessageSquarePlus, Smile, X } from 'lucide-react';
import { Modal } from '@/components/ui/AppUI';
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentTitle } from '@/components/ui/attachment';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading';
import { RatingScale } from '@/components/ui/rating-scale';
import { Textarea } from '@/components/ui/textarea';
import { appToast } from '@/components/ui/toast';
import axiosClient from '@/lib/axios';
import { feedbackError, feedbackLevels, type FeedbackImage, type FeedbackLevel } from './feedback.types';

interface DraftImage { key: string; file: File }

const levelOptions = [
  { value: 'CRITICAL', label: 'Critical', icon: <Angry className="size-7" /> },
  { value: 'MAJOR', label: 'Major', accessibleLabel: feedbackLevels.MAJOR.label, icon: <Frown className="size-7" /> },
  { value: 'MINOR', label: 'Minor', accessibleLabel: feedbackLevels.MINOR.label, icon: <Meh className="size-7" /> },
  { value: 'IMPROVEMENT', label: 'Improve', accessibleLabel: feedbackLevels.IMPROVEMENT.label, icon: <Smile className="size-7" /> },
  { value: 'GENERAL', label: 'General', accessibleLabel: feedbackLevels.GENERAL.label, icon: <Laugh className="size-7" /> },
] as const;

function ImagePreview({ file }: { file: File }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return <img ref={imageRef} alt={`Preview of ${file.name}`} className="size-12 shrink-0 rounded-control border border-border object-cover" />;
}

export function FeedbackButton() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<FeedbackLevel>('MINOR');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<DraftImage[]>([]);
  const [pagePath, setPagePath] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const uploaded = useRef(new Map<string, FeedbackImage>());
  const lastSubmission = useRef<{ signature: string; id: string } | null>(null);

  const close = () => { if (!inFlight.current) setOpen(false); };
  const show = () => {
    if (!message.trim() && !images.length) setPagePath(location.pathname.slice(0, 500));
    setOpen(true);
  };
  const addImages = (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files);
    if (images.length + selected.length > 3) { setError('You can attach up to three images.'); return; }
    if (selected.some(file => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024)) {
      setError('Choose PNG, JPEG, or WebP images of 5 MB or less.'); return;
    }
    setImages(previous => [...previous, ...selected.map(file => ({ key: crypto.randomUUID(), file }))]);
    setError('');
  };
  const send = async () => {
    if (inFlight.current || !message.trim()) return;
    inFlight.current = true; setSending(true); setError('');
    try {
      const attachmentIds: string[] = [];
      for (const [index, image] of images.entries()) {
        setProgress(`Uploading image ${index + 1} of ${images.length}…`);
        let asset = uploaded.current.get(image.key);
        if (!asset) {
          const form = new FormData(); form.append('image', image.file);
          asset = await axiosClient.post<FeedbackImage>('/api/feedback/images', form, { headers: { 'Content-Type': undefined } });
          uploaded.current.set(image.key, asset);
        }
        attachmentIds.push(asset.id);
      }
      setProgress('Sending feedback…');
      const payload = { level, message: message.trim(), pagePath, attachmentIds };
      const signature = JSON.stringify(payload);
      if (lastSubmission.current?.signature !== signature) lastSubmission.current = { signature, id: crypto.randomUUID() };
      await axiosClient.post('/api/feedback', { ...payload, submissionId: lastSubmission.current.id });
      setMessage(''); setImages([]); setLevel('MINOR'); uploaded.current.clear(); lastSubmission.current = null;
      setOpen(false);
      appToast.success('Feedback sent. Thank you for helping us improve!');
    } catch (failure) {
      setError(feedbackError(failure, 'Unable to send feedback. Your draft is still here; please try again.'));
    } finally { inFlight.current = false; setSending(false); setProgress(''); }
  };

  return <>
    <Button variant="ghost" size="icon" onClick={show} aria-label="Send feedback" title="Send feedback"><MessageSquarePlus aria-hidden="true" /></Button>
    <Modal open={open} presentation="content-dialog" title="Send feedback" subtitle="Tell us what happened or how we can improve." onClose={close} initialFocusRef={messageRef} footer={<><Button variant="outline" disabled={sending} onClick={close}>Close</Button><Button type="submit" form="feedback-form" disabled={sending || !message.trim()}>{sending && <LoadingSpinner />}{sending ? 'Sending…' : 'Send feedback'}</Button></>}>
      <form id="feedback-form" className="space-y-5" onSubmit={event => { event.preventDefault(); void send(); }}>
        <Field>
          <FieldLabel id="feedback-level-label">How does this affect you?</FieldLabel>
          <RatingScale options={levelOptions} value={level} disabled={sending} aria-labelledby="feedback-level-label" aria-describedby="feedback-level-description" onValueChange={value => setLevel(value as FeedbackLevel)} />
          <FieldDescription id="feedback-level-description">{feedbackLevels[level].description}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="feedback-message">Your feedback</FieldLabel>
          <Textarea ref={messageRef} id="feedback-message" required rows={5} maxLength={5000} value={message} disabled={sending} onChange={event => setMessage(event.target.value)} placeholder="What happened? What did you expect? For a suggestion, describe what would help you." aria-describedby="feedback-message-hint" />
          <FieldDescription id="feedback-message-hint">{message.length.toLocaleString('en-US')} / 5,000 characters. Avoid including passwords or sensitive information.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Images (optional)</FieldLabel>
          <Input ref={inputRef} type="file" className="sr-only" tabIndex={-1} accept="image/png,image/jpeg,image/webp" multiple disabled={sending || images.length >= 3} aria-label="Attach feedback images" onChange={event => { addImages(event.target.files); event.target.value = ''; }} />
          <Button variant="outline" type="button" className="w-fit" disabled={sending || images.length >= 3} onClick={() => inputRef.current?.click()}><ImagePlus aria-hidden="true" />Attach images</Button>
          <FieldDescription>Up to 3 images, 5 MB each. PNG, JPEG or WebP.</FieldDescription>
          {images.length > 0 && <ul className="space-y-2" aria-label="Attached images">{images.map(image => <li key={image.key}><Attachment><ImagePreview file={image.file} /><AttachmentContent><AttachmentTitle>{image.file.name}</AttachmentTitle><AttachmentDescription>{(image.file.size / 1024 / 1024).toFixed(2)} MB</AttachmentDescription></AttachmentContent><AttachmentActions><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${image.file.name}`} disabled={sending} onClick={() => { uploaded.current.delete(image.key); setImages(previous => previous.filter(item => item.key !== image.key)); setError(''); }}><X aria-hidden="true" /></Button></AttachmentActions></Attachment></li>)}</ul>}
        </Field>
        {sending && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{progress}</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  </>;
}
