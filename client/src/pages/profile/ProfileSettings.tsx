import { useCallback, useEffect, useState } from 'react';
import { LogOut, Monitor, Moon, RefreshCw, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/AppUI';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardBack } from '@/features/navigation/DashboardBackContext';
import { NextSatCard, ScoreGoalCard } from '@/pages/dashboard/student-overview/StudentProductivitySidebar';
import type { StudentOverviewResponse } from '@/pages/dashboard/student-overview/student-overview.types';
import { useDashboardTheme, type DashboardTheme } from '@/features/theme/dashboardTheme';
import axiosClient from '@/lib/axios';
import { logoutAuthSession, refreshAccessToken, updateStoredAuthUser } from '@/lib/authSession';
import { TeacherAccessCard } from './TeacherAccessCard';

interface AccountProfile {
  id: number;
  email: string;
  name: string | null;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  avatar: string | null;
  loginMethod: 'GOOGLE' | 'PASSWORD';
}

const emptyPreferences: StudentOverviewResponse['preferences'] = { satTestDate: null, currentScore: null, targetScore: null };
const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } }).response?.data?.error || fallback;

export default function ProfileSettings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [preferences, setPreferences] = useState(emptyPreferences);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  useDashboardBack(() => navigate('/dashboard'));

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const account = await axiosClient.get<AccountProfile, AccountProfile>('/api/account/profile');
      setProfile(account);
      setName(account.name || '');
      if (account.role === 'STUDENT') {
        const [date, score] = await Promise.all([
          axiosClient.get<{ satTestDate: string | null }, { satTestDate: string | null }>('/api/user-preferences/sat-test-date'),
          axiosClient.get<{ currentScore: number | null; targetScore: number | null }, { currentScore: number | null; targetScore: number | null }>('/api/user-preferences/sat-score-goal'),
        ]);
        setPreferences({ satTestDate: date.satTestDate, ...score });
      }
    } catch (requestError) {
      console.error('Unable to load profile settings:', requestError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refreshRole = useCallback(async () => {
    const account = await axiosClient.get<AccountProfile>('/api/account/profile');
    if (!await refreshAccessToken({ redirectOnFailure: false })) throw new Error('Unable to refresh session. Sign in again.');
    setProfile(account);
    updateStoredAuthUser({ id: account.id, name: account.name, avatar: account.avatar, role: account.role });
  }, []);

  const saveProfile = async () => {
    if (!name.trim()) return toast.error('Display name is required.');
    setSaving(true);
    try {
      const updated = await axiosClient.patch<AccountProfile, AccountProfile, { name: string }>('/api/account/profile', { name });
      setProfile(updated);
      setName(updated.name || '');
      updateStoredAuthUser({ id: updated.id, name: updated.name, avatar: updated.avatar, role: updated.role });
      toast.success('Profile updated.');
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await logoutAuthSession();
    navigate('/auth', { replace: true });
  };

  if (loading && !profile) return <ProfileSkeleton />;
  if (error || !profile) return <div className="h-full overflow-y-auto bg-background p-4 md:p-6"><EmptyState icon={<RefreshCw />} title="Profile settings are unavailable" description="We could not load your account details. Check the server connection and try again." action={<Button variant="outline" onClick={() => void load()}><RefreshCw />Try again</Button>} className="min-h-96" /></div>;

  const displayName = profile.name || profile.email;
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const unchanged = name.trim().replace(/\s+/g, ' ') === (profile.name || '');

  return <div className="h-full overflow-y-auto bg-background">
    <main className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <header><h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Profile & settings</h1><p className="mt-1 text-base text-muted-foreground">Manage your account identity, study goals, and dashboard appearance.</p></header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle><CardDescription>Your display name is visible across classrooms and activity records.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4"><Avatar className="size-14"><AvatarImage src={profile.avatar || undefined} alt={displayName} /><AvatarFallback>{initials || 'U'}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate font-medium text-foreground">{displayName}</p><p className="truncate text-sm text-muted-foreground">{profile.email}</p><Badge variant="outline" className="mt-2 capitalize">{profile.role.toLowerCase()}</Badge></div></div>
              <Separator />
              <Field><FieldLabel htmlFor="profile-name">Display name</FieldLabel><Input id="profile-name" maxLength={100} value={name} onChange={event => setName(event.target.value)} /><FieldDescription>Use the name teachers and classmates should recognize.</FieldDescription></Field>
              <Field><FieldLabel htmlFor="profile-email">Email</FieldLabel><Input id="profile-email" value={profile.email} disabled /><FieldDescription>Email changes require a separate verified account flow and are not available here.</FieldDescription></Field>
              <div className="flex justify-end"><Button disabled={saving || !name.trim() || unchanged} onClick={() => void saveProfile()}>{saving ? 'Saving…' : 'Save profile'}</Button></div>
            </CardContent>
          </Card>

          {profile.role === 'STUDENT' && <section aria-labelledby="study-preferences-heading"><div className="mb-3"><h2 id="study-preferences-heading" className="font-heading text-xl font-semibold">Study preferences</h2><p className="mt-1 text-sm text-muted-foreground">Keep your dashboard countdown and self-reported score goal current.</p></div><div className="grid gap-4 sm:grid-cols-2"><NextSatCard value={preferences.satTestDate} onSaved={value => setPreferences(current => ({ ...current, satTestDate: value }))} /><ScoreGoalCard currentScore={preferences.currentScore} targetScore={preferences.targetScore} onSaved={value => setPreferences(current => ({ ...current, ...value }))} /></div></section>}

          <AppearanceCard />
          {profile.role !== 'ADMIN' && <TeacherAccessCard onRoleChanged={refreshRole} />}
        </div>

        <aside className="space-y-4">
          <Card size="sm"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-muted-foreground" />Account</CardTitle></CardHeader><CardContent className="space-y-3"><div><p className="text-xs text-muted-foreground">Signed in with</p><p className="mt-1 text-sm font-medium">{profile.loginMethod === 'GOOGLE' ? 'Google' : 'Email and password'}</p></div><Separator /><Button variant="destructive" className="w-full" onClick={() => void logout()}><LogOut />Log out</Button></CardContent></Card>
          <Card size="sm"><CardContent className="flex items-start gap-3"><UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><p className="text-xs leading-5 text-muted-foreground">Sign in with Google. Your Google identity keeps your account connected; you can edit your display name here.</p></CardContent></Card>
        </aside>
      </div>
    </main>
  </div>;
}

function AppearanceCard() {
  const { theme, setTheme } = useDashboardTheme();
  const choices: Array<{ value: DashboardTheme; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];
  return <Card><CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Choose how the dashboard looks on this device.</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Dashboard theme">{choices.map(choice => <Button key={choice.value} variant={theme === choice.value ? 'secondary' : 'outline'} className="h-auto justify-start p-3" aria-pressed={theme === choice.value} onClick={() => setTheme(choice.value)}><choice.icon />{choice.label}</Button>)}</div></CardContent></Card>;
}

function ProfileSkeleton() {
  return <div className="h-full overflow-y-auto bg-background"><main className="mx-auto w-full max-w-5xl p-4 md:p-6"><Skeleton className="h-9 w-64" /><Skeleton className="mt-2 h-5 w-112 max-w-full" /><div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="space-y-6"><Card className="h-96 p-4"><Skeleton className="h-full w-full" /></Card><div className="grid gap-4 sm:grid-cols-2"><Card className="h-36 p-4"><Skeleton className="h-full w-full" /></Card><Card className="h-36 p-4"><Skeleton className="h-full w-full" /></Card></div><Card className="h-40 p-4"><Skeleton className="h-full w-full" /></Card></div><Card className="h-48 p-4"><Skeleton className="h-full w-full" /></Card></div></main></div>;
}
