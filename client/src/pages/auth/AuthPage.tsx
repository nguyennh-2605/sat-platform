import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowLeft, BookOpenCheck, Eye, EyeOff, GraduationCap, Lock, Mail, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input } from '../../components/ui/AppUI';
import { storeAuthSession } from '../../lib/authSession';

type RegisterRole = 'STUDENT' | 'TEACHER';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const isRegisterParam = searchParams.get('mode') === 'register';
  const sessionEnded = searchParams.get('reason') === 'session-expired' || searchParams.get('reason') === 'unauthorized';
  const [isLoginMode, setIsLoginMode] = useState(!isRegisterParam);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<RegisterRole>('STUDENT');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const googleSignInInFlight = useRef(false);
  const navigate = useNavigate();

  useEffect(() => { if (sessionEnded) toast('Your session expired. Please sign in again.', { id: 'session-expired' }); }, [sessionEnded]);

  const switchMode = () => {
    setIsLoginMode(mode => !mode);
    setEmail(''); setPassword(''); setName(''); setRole('STUDENT');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const endpoint = isLoginMode ? '/api/login' : '/api/register';
      const response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role: isLoginMode ? undefined : role }),
      });
      const data = await response.json();
      if (!response.ok) { toast.error(data.message || 'Authentication failed'); return; }
      if (data.accessToken && data.user) storeAuthSession(data.accessToken, data.user, role);
      toast.success(data.message || (isLoginMode ? 'Signed in' : 'Account created'));
      navigate('/dashboard');
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Unable to connect to the server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) { toast.error('Google did not return a sign-in credential. Please try again.'); return; }
    if (googleSignInInFlight.current) return;
    googleSignInInFlight.current = true;
    setIsGoogleSigningIn(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/google-login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: credentialResponse.credential }) });
      const data = await response.json();
      if (!response.ok) { toast.error(data.message || 'Google sign-in failed'); return; }
      storeAuthSession(data.accessToken, data.user);
      toast.success('Signed in with Google');
      navigate('/dashboard');
    } catch (error) {
      console.error('Google sign-in connection error:', error);
      toast.error('Unable to connect to the server');
    } finally {
      googleSignInInFlight.current = false;
      setIsGoogleSigningIn(false);
    }
  };

  return <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(22rem,0.85fr)_minmax(32rem,1.15fr)]">
    <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
      <div className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full border-[50px] border-white/5" />
      <button type="button" onClick={() => navigate('/')} className="relative flex w-fit items-center gap-2.5 rounded-control text-body font-semibold"><span className="flex h-9 w-9 items-center justify-center rounded-control bg-primary"><BookOpenCheck size={19} /></span>SAT MASTER</button>
      <div className="relative max-w-lg"><p className="text-caption font-semibold uppercase tracking-[0.12em] text-sidebar-muted">Your learning workspace</p><h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">Practice with purpose. Learn from every attempt.</h1><p className="mt-5 text-body-lg leading-7 text-sidebar-foreground">Keep tests, vocabulary, classes, mistakes, and progress connected in one focused SAT platform.</p></div>
      <p className="relative text-caption text-sidebar-muted">Digital SAT preparation</p>
    </aside>

    <main className="flex min-h-screen items-center justify-center p-4 sm:p-8 lg:p-12">
      <div className="w-full max-w-md">
        <button type="button" onClick={() => navigate('/')} className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-control px-2 text-body font-medium text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"><ArrowLeft size={17} />Home</button>
        <div className="rounded-card border border-ui-border bg-surface p-6 shadow-elevated sm:p-8">
          {sessionEnded && <div role="status" className="mb-5 rounded-control border border-warning/20 bg-warning-soft px-4 py-3 text-body text-warning">Your session has expired. Sign in again to continue.</div>}
          <div className="mb-7"><span className="mb-5 flex h-10 w-10 items-center justify-center rounded-control bg-primary text-white lg:hidden"><BookOpenCheck size={20} /></span><h2 className="text-2xl font-semibold tracking-tight text-foreground">{isLoginMode ? 'Welcome back' : 'Create your account'}</h2><p className="mt-2 text-body text-muted-foreground">{isLoginMode ? "New to SAT Master? " : 'Already have an account? '}<button type="button" onClick={switchMode} className="font-semibold text-primary hover:text-primary-hover hover:underline">{isLoginMode ? 'Create an account' : 'Sign in'}</button></p></div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {!isLoginMode && <>
              <AuthField label="Full name" icon={<User size={18} />}><Input type="text" autoComplete="name" required className="w-full pl-10" placeholder="Enter your name" value={name} onChange={event => setName(event.target.value)} /></AuthField>
              <fieldset><legend className="mb-2 text-body font-medium text-foreground">I am a</legend><div className="grid grid-cols-2 gap-3"><RoleOption active={role === 'STUDENT'} icon={<User size={17} />} label="Student" onClick={() => setRole('STUDENT')} /><RoleOption active={role === 'TEACHER'} icon={<GraduationCap size={17} />} label="Teacher" onClick={() => setRole('TEACHER')} /></div></fieldset>
            </>}
            <AuthField label="Email" icon={<Mail size={18} />}><Input type="email" autoComplete="email" required className="w-full pl-10" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} /></AuthField>
            <AuthField label="Password" icon={<Lock size={18} />}>
              <Input type={showPassword ? 'text' : 'password'} autoComplete={isLoginMode ? 'current-password' : 'new-password'} required className="w-full px-10" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} />
              <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-control text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </AuthField>
            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Please wait…' : isLoginMode ? 'Sign in' : 'Create account'}</Button>
          </form>

          <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-ui-border" /></div><div className="relative flex justify-center"><span className="bg-surface px-3 text-caption text-muted-foreground">or continue with</span></div></div>
          <div className={`flex w-full justify-center ${isGoogleSigningIn ? 'pointer-events-none opacity-60' : ''}`} aria-busy={isGoogleSigningIn}><GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error('Google sign-in failed')} theme="outline" size="large" width="100%" text="continue_with" shape="rectangular" /></div>
        </div>
        <p className="mt-5 text-center text-caption leading-5 text-muted-foreground">By continuing, you agree to use SAT Master responsibly as a learning tool.</p>
      </div>
    </main>
  </div>;
}

function AuthField({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return <label className="relative block"><span className="mb-2 block text-body font-medium text-foreground">{label}</span><span className="pointer-events-none absolute bottom-0 left-0 flex h-10 w-10 items-center justify-center text-muted-foreground">{icon}</span>{children}</label>;
}

function RoleOption({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`flex min-h-11 items-center justify-center gap-2 rounded-control border px-3 text-body font-medium transition-colors ${active ? 'border-primary bg-primary-soft text-primary' : 'border-ui-border bg-surface text-subtle-foreground hover:bg-surface-subtle'}`}>{icon}{label}</button>;
}
