import type { ReactNode } from 'react';
import { lazy, Suspense, useSyncExternalStore } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import { APP_TOAST_OPTIONS } from '../components/ui/toast';
import { QuizToolProvider } from '../context/QuizToolContext';
import { AuthSessionGuard } from '../features/auth/AuthSessionGuard';
import { getAuthStatus, subscribeAuthSession } from '../lib/authSession';

const HomePage = lazy(() => import('../pages/home/HomePage'));
const AuthPage = lazy(() => import('../pages/auth/AuthPage'));
const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'));
const DashboardHome = lazy(() => import('../pages/dashboard/DashboardHome'));
const ExamRoom = lazy(() => import('../pages/exam-room/ExamRoom'));
const PracticeTest = lazy(() => import('../pages/practice-test/PracticeTest'));
const TestDetail = lazy(() => import('../pages/practice-test/TestDetail'));
const ErrorLog = lazy(() => import('../pages/error-log/ErrorLog'));
const Classroom = lazy(() => import('../pages/classroom/Classroom'));
const ClassroomList = lazy(() => import('../pages/classroom/ClassroomList'));
const ResultAnalytics = lazy(() => import('../pages/result-analytics/ResultAnalytics'));
const ScoreReport = lazy(() => import('../pages/score-report/ScoreReport'));
const CreateTestWizard = lazy(() => import('../features/test-creation/CreateTestWizard'));
const AssignmentDetail = lazy(() => import('../features/assignment/AssignmentDetail'));
const Vocabulary = lazy(() => import('../pages/vocabulary/Vocabulary'));

const RouteFallback = () => <div className="flex min-h-screen items-center justify-center bg-background text-body text-muted-foreground">Loading…</div>;

function RequireAuth({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(subscribeAuthSession, getAuthStatus, getAuthStatus);
  if (status === 'loading') return <div className="flex min-h-screen items-center justify-center bg-background text-body text-muted-foreground">Restoring your session…</div>;
  if (status === 'anonymous') return <Navigate to="/auth" replace />;
  return children;
}

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <QuizToolProvider>
      <GoogleOAuthProvider clientId={googleClientId}>
        <Toaster position="top-right" reverseOrder={false} gutter={8} toastOptions={APP_TOAST_OPTIONS} />
        <Router>
          <AuthSessionGuard />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>}>
                <Route index element={<DashboardHome />} />
                <Route path="practice-test" element={<PracticeTest />} />
                <Route path="practice-test/:testId" element={<TestDetail />} />
                <Route path="classes" element={<ClassroomList />} />
                <Route path="vocabulary" element={<Vocabulary />} />
                <Route path="class/:classId" element={<Classroom />} />
                <Route path="error-log" element={<ErrorLog />} />
                <Route path="results-analytics" element={<ResultAnalytics />} />
                <Route path="score-report" element={<ScoreReport />} />
                <Route path="practice-test/create" element={<CreateTestWizard />} />
                <Route path="class/:classId/assignment/:assignmentId" element={<AssignmentDetail />} />
              </Route>
              <Route path="/test/:id" element={<RequireAuth><ExamRoom /></RequireAuth>} />
            </Routes>
          </Suspense>
        </Router>
      </GoogleOAuthProvider>
    </QuizToolProvider>
  );
}

export default App;
