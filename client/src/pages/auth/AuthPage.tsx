import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowLeft, BookOpenCheck, Check, Eye, EyeOff, GraduationCap, Lock, Mail, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { storeAuthSession } from '../../lib/authSession';

type RegisterRole = 'STUDENT' | 'TEACHER';

const benefits = [
  'Practice tests and focused review in one workspace',
  'Class assignments and announcements stay connected',
  'Progress and mistakes become the next study plan',
] as const;

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

  useEffect(() => {
    if (sessionEnded) toast('Your session expired. Please sign in again.', { id: 'session-expired' });
  }, [sessionEnded]);

  const switchMode = () => {
    setIsLoginMode(mode => !mode);
    setEmail('');
    setPassword('');
    setName('');
    setRole('STUDENT');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const endpoint = isLoginMode ? '/api/login' : '/api/register';
      const response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role: isLoginMode ? undefined : role }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message || 'Authentication failed');
        return;
      }
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
    if (!credentialResponse.credential) {
      toast.error('Google did not return a sign-in credential. Please try again.');
      return;
    }
    if (googleSignInInFlight.current) return;
    googleSignInInFlight.current = true;
    setIsGoogleSigningIn(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/google-login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message || 'Google sign-in failed');
        return;
      }
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

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden border-r bg-muted/35 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <button type="button" onClick={() => navigate('/')} className="flex w-fit items-center gap-2.5 rounded-lg text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpenCheck className="size-4" aria-hidden="true" />
          </span>
          SAT Master
        </button>

        <div className="max-w-lg">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Your learning workspace</p>
          <h1 className="mt-4 text-4xl font-medium leading-tight tracking-tight">Practice with purpose. Learn from every attempt.</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">A focused place for Digital SAT practice, classes, vocabulary, mistakes, and progress.</p>
          <ul className="mt-8 space-y-3">
            {benefits.map(benefit => (
              <li key={benefit} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border bg-background">
                  <Check className="size-3" aria-hidden="true" />
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">Digital SAT preparation</p>
      </aside>

      <main className="flex min-h-svh items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-5 lg:hidden">
            <ArrowLeft aria-hidden="true" />
            Home
          </Button>

          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpenCheck className="size-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold">SAT Master</span>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">{isLoginMode ? 'Welcome back' : 'Create your account'}</CardTitle>
              <CardDescription>
                {isLoginMode ? 'Sign in to continue your SAT learning plan.' : 'Choose your role and create a SAT Master account.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessionEnded && (
                <div role="status" className="mb-5 rounded-lg border border-warning/25 bg-warning-soft px-3 py-2.5 text-sm text-warning">
                  Your session has expired. Sign in again to continue.
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                {!isLoginMode && (
                  <>
                    <AuthField label="Full name" icon={<User aria-hidden="true" />}>
                      <Input type="text" autoComplete="name" required className="pl-9" placeholder="Enter your name" value={name} onChange={event => setName(event.target.value)} />
                    </AuthField>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium">I am a</legend>
                      <div className="grid grid-cols-2 gap-2">
                        <RoleOption active={role === 'STUDENT'} icon={<User aria-hidden="true" />} label="Student" onClick={() => setRole('STUDENT')} />
                        <RoleOption active={role === 'TEACHER'} icon={<GraduationCap aria-hidden="true" />} label="Teacher" onClick={() => setRole('TEACHER')} />
                      </div>
                    </fieldset>
                  </>
                )}

                <AuthField label="Email" icon={<Mail aria-hidden="true" />}>
                  <Input type="email" autoComplete="email" required className="pl-9" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} />
                </AuthField>

                <AuthField label="Password" icon={<Lock aria-hidden="true" />}>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                    required
                    className="px-9"
                    placeholder="Enter your password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowPassword(value => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute bottom-0.5 right-0.5"
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </AuthField>

                <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Please wait…' : isLoginMode ? 'Sign in' : 'Create account'}
                </Button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">or continue with</span></div>
              </div>

              <div className={`flex w-full justify-center ${isGoogleSigningIn ? 'pointer-events-none opacity-60' : ''}`} aria-busy={isGoogleSigningIn}>
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error('Google sign-in failed')} theme="outline" size="large" width="100%" text="continue_with" shape="rectangular" />
              </div>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                {isLoginMode ? 'New to SAT Master? ' : 'Already have an account? '}
                <button type="button" onClick={switchMode} className="font-medium text-foreground underline underline-offset-4">
                  {isLoginMode ? 'Create an account' : 'Sign in'}
                </button>
              </p>
            </CardContent>
          </Card>

          <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">By continuing, you agree to use SAT Master responsibly as a learning tool.</p>
        </div>
      </main>
    </div>
  );
}

function AuthField({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center text-muted-foreground [&_svg]:size-4">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function RoleOption({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <Button type="button" variant={active ? 'secondary' : 'outline'} aria-pressed={active} onClick={onClick} className="w-full">
      {icon}
      {label}
    </Button>
  );
}
