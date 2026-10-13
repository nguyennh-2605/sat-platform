import { useEffect, useId, useRef, useState } from 'react';
import { Modal } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading';
import { appToast } from '@/components/ui/toast';
import axiosClient from '@/lib/axios';
import { invalidateQueryCache } from '@/lib/queryCache';

interface JoinClassResult {
  classroom: { id: string; name: string };
  alreadyJoined: boolean;
}

export function JoinClassDialog({ onClose, onJoined }: { onClose: () => void; onJoined: (classroom: JoinClassResult['classroom']) => void }) {
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const close = () => { if (!inFlight.current) onClose(); };
  const join = async () => {
    if (inFlight.current) return;
    if (!code.trim()) { setError('Enter your class code.'); inputRef.current?.focus(); return; }
    inFlight.current = true; setJoining(true); setError('');
    try {
      const result = await axiosClient.post<JoinClassResult>('/api/classes/join', { code: code.trim() });
      invalidateQueryCache('/api/classes', '/api/tests', '/api/student', '/api/progress');
      appToast.success(result.alreadyJoined ? `You are already in ${result.classroom.name}.` : `Joined ${result.classroom.name}.`);
      onJoined(result.classroom);
    } catch (failure) {
      const response = (failure as { response?: { data?: { error?: string; message?: string } } }).response?.data;
      setError(response?.error || response?.message || 'Unable to join the class. Please try again.');
    } finally { inFlight.current = false; setJoining(false); }
  };
  return <Modal open presentation="content-dialog" alignment="viewport" title="Join a class" subtitle="Enter the class code shared by your teacher." onClose={close} footer={<><Button variant="outline" disabled={joining} onClick={close}>Cancel</Button><Button type="submit" form={`${fieldId}-form`} disabled={joining || !code.trim()}>{joining && <LoadingSpinner />}{joining ? 'Joining…' : 'Join class'}</Button></>}>
    <form id={`${fieldId}-form`} onSubmit={event => { event.preventDefault(); void join(); }} className="space-y-3">
      <label htmlFor={`${fieldId}-code`} className="block space-y-2 text-sm font-medium"><span>Class code</span><Input ref={inputRef} id={`${fieldId}-code`} value={code} onChange={event => { setCode(event.target.value); setError(''); }} maxLength={64} disabled={joining} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Paste your class code" aria-invalid={Boolean(error)} aria-describedby={`${fieldId}-${error ? 'error' : 'hint'}`} /></label>
      <p id={`${fieldId}-hint`} className="text-xs text-subtle">Ask your teacher for the code if you don’t have one.</p>
      {error && <p id={`${fieldId}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  </Modal>;
}
