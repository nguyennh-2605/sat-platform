import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useGoogleOAuth } from '@react-oauth/google';
import { ArrowLeft, ArrowRight, Check, GraduationCap, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { SonderCat } from '@/components/brand/SonderCat';
import { useDarkTheme } from '@/components/brand/use-dark-theme';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading';
import { getAuthStatus, storeAuthSession, subscribeAuthSession } from '@/lib/authSession';
import { GoogleSignInButton } from './GoogleSignInButton';
import './auth.css';

const benefits = ['Practice Reading & Writing and Math at your pace', 'Turn mistakes into a clearer next step', 'Keep vocabulary, classes, and progress together'];

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const sessionEnded = ['session-expired', 'unauthorized'].includes(searchParams.get('reason') || '');
  const authStatus = useSyncExternalStore(subscribeAuthSession, getAuthStatus, getAuthStatus);
  const dark = useDarkTheme();
  const { scriptLoadedSuccessfully } = useGoogleOAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [googleWidth, setGoogleWidth] = useState(200);
  const [loadingHint, setLoadingHint] = useState(false);
  const googleContainer = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const configured = clientId.endsWith('.apps.googleusercontent.com') && !clientId.startsWith('your-');

  useEffect(() => {
    const container = googleContainer.current;
    if (!container) return;
    const resize = () => setGoogleWidth(Math.min(360, Math.floor(container.clientWidth)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const timeout = window.setTimeout(() => {
      if (!container.querySelector('iframe, [role="button"], button')) setLoadingHint(true);
    }, 12000);
    return () => { observer.disconnect(); window.clearTimeout(timeout); abortRef.current?.abort(); };
  }, [authStatus]);

  const signIn = async ({ credential }: { credential?: string }) => {
    if (inFlight.current) return;
    if (!credential) { setError('Google did not return a sign-in credential. Please try again.'); return; }
    inFlight.current = true;
    setSigningIn(true);
    setError('');
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/google-login`, {
        method: 'POST', credentials: 'include', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: credential }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Google sign-in failed. Please try again.');
      if (!data.accessToken || !data.user?.id || !data.user?.role) throw new Error('The server returned an incomplete session. Please try again.');
      storeAuthSession(data.accessToken, data.user);
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.name !== 'AbortError' ? requestError.message : 'Unable to connect to the server. Please try again.');
    } finally {
      window.clearTimeout(timeout);
      inFlight.current = false;
      abortRef.current = null;
      setSigningIn(false);
    }
  };

  if (authStatus === 'authenticated') return <Navigate to="/dashboard" replace />;

  return <div className="grid min-h-svh grid-cols-1 bg-background text-foreground lg:grid-cols-2">
    <aside className="auth-welcome hidden border-r border-border p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
      <Link to="/" className="flex w-fit items-center gap-2.5 rounded-control font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><BrandMark />Sonder SAT</Link>
      <div className="mx-auto w-full max-w-lg py-10">
        <p className="text-xs font-medium uppercase tracking-widest text-subtle">One step at a time.</p>
        <h2 className="mt-5 text-4xl font-medium leading-tight tracking-tight xl:text-5xl">A little focus.<br />A clearer way forward.</h2>
        <p className="mt-5 max-w-md text-base leading-7 text-subtle">Make room for your next practice, your next insight, and everything you can become.</p>
        <ul className="mt-8 space-y-4">{benefits.map(benefit => <li key={benefit} className="flex items-start gap-3 text-sm leading-6"><Check className="mt-1 size-4 shrink-0" aria-hidden="true" />{benefit}</li>)}</ul>
        <div className="mt-10 flex items-center gap-5"><SonderCat eager className="size-36 shrink-0" /><p className="text-sm leading-6 text-subtle">A tiny companion.<br /><span className="font-medium text-foreground">A bigger journey ahead.</span></p></div>
      </div>
      <p className="text-xs text-subtle">Built for Digital SAT · Reading &amp; Writing · Math</p>
    </aside>
    <main className="flex min-h-svh min-w-0 flex-col p-5 sm:p-8 lg:p-12">
      <Button variant="ghost" asChild className="w-fit"><Link to="/"><ArrowLeft aria-hidden="true" />Back to home</Link></Button>
      <div className="mx-auto flex w-full min-w-0 max-w-md flex-1 flex-col justify-center py-10">
        <div className="mb-6 flex items-center gap-2.5 font-semibold lg:hidden"><BrandMark />Sonder SAT</div>
        <Card className="shadow-card">
          <CardHeader className="gap-3"><CardTitle className="text-2xl font-medium tracking-tight"><h1>Welcome to Sonder SAT</h1></CardTitle><CardDescription className="leading-6">One Google account. All your study tools.<br />Sign in or create your account in one step.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            {sessionEnded && <p role="status" className="rounded-control border border-warning/25 bg-warning-soft p-3 text-sm text-warning">Your session has expired. Sign in again to continue.</p>}
            {!configured ? <div role="alert" className="rounded-control border border-border bg-muted p-4 text-sm leading-6">Google sign-in is not configured yet. Ask the platform administrator to enable it.</div> : <>
              <div ref={googleContainer} className="relative min-h-11 w-full min-w-0" aria-busy={signingIn || authStatus === 'loading' || (!scriptLoadedSuccessfully && !loadingHint)}>
                <div hidden={authStatus === 'loading' || signingIn || !scriptLoadedSuccessfully} inert={authStatus === 'loading' || signingIn}>
                  <GoogleSignInButton dark={dark} width={googleWidth} onCredential={credential => void signIn(credential)} />
                </div>
                {(authStatus === 'loading' || signingIn || !scriptLoadedSuccessfully) && <div role="status" className="flex min-h-11 items-center justify-center gap-2 text-sm">{(authStatus === 'loading' || signingIn || !loadingHint) && <LoadingSpinner />}{signingIn ? 'Signing you in…' : authStatus === 'loading' ? 'Restoring your session…' : loadingHint ? 'Google sign-in could not load.' : 'Loading Google sign-in…'}</div>}
              </div>
              {loadingHint && !signingIn && <p role="status" className="text-sm leading-6 text-muted-foreground">If the Google button is missing, check your connection or browser settings, then <button type="button" className="rounded-control font-medium text-foreground underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => window.location.reload()}>reload this page</button>.</p>}
            </>}
            {error && <p role="alert" className="rounded-control border border-danger/25 bg-danger-soft p-3 text-sm leading-6 text-danger">{error}</p>}
            <div className="flex items-start gap-3 border-t border-border pt-5"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><p className="text-xs leading-5 text-muted-foreground">Google verifies your identity. Use the same Google email as your existing account to keep your study history.</p></div>
          </CardContent>
        </Card>
        <div className="mt-6 flex items-start gap-3 px-1"><GraduationCap className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><div><p className="text-sm font-medium">Here to teach?</p><p className="mt-1 text-sm leading-6 text-muted-foreground">New accounts start as students. After signing in, request teacher access in Profile &amp; settings. An admin will review your request.</p></div></div>
        <Button variant="link" asChild className="mt-5 self-center"><Link to="/">Explore Sonder SAT<ArrowRight aria-hidden="true" /></Link></Button>
      </div>
    </main>
  </div>;
}
