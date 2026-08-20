// import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import HomePage from '../pages/home/HomePage';
import AuthPage from '../pages/auth/AuthPage';
import Dashboard from '../pages/dashboard/Dashboard';
import { QuizToolProvider } from '../context/QuizToolContext';
// Import các pages
import ExamRoom from '../pages/exam-room/ExamRoom';
import PracticeTest from '../pages/practice-test/PracticeTest';
import ErrorLog from '../pages/error-log/ErrorLog';
import Classroom from '../pages/classroom/Classroom';
import ResultAnalytics from '../pages/result-analytics/ResultAnalytics';
import ScoreReport from '../pages/score-report/ScoreReport';
import CreateTestWizard from '../features/test-creation/CreateTestWizard';
import AssignmentDetail from '../features/assignment/AssignmentDetail';

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <QuizToolProvider>
      <GoogleOAuthProvider clientId={googleClientId}>
        <Toaster position="top-right" reverseOrder={false} />
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<Dashboard />}>
              {/* index: Khi vào /dashboard sẽ tự chuyển sang /dashboard/practice-test */}
              <Route index element={<Navigate to="practice-test" replace />} />
              {/* Các đường dẫn con */}
              <Route path="practice-test" element={<PracticeTest />} />
              <Route path="class/:classId" element={<Classroom />} />
              <Route path="error-log" element={<ErrorLog />} />
              <Route path='results-analytics' element = {<ResultAnalytics />} />
              <Route path="score-report" element={<ScoreReport />} />
              <Route path="practice-test/create" element={<CreateTestWizard />} />
              <Route path="class/:classId/assignment/:assignmentId" element={<AssignmentDetail />} />
            </Route>
            <Route path="/test/:id" element={<ExamRoom />} /> 
          </Routes>
        </Router>
      </GoogleOAuthProvider>
    </QuizToolProvider>
  );
}

export default App;
