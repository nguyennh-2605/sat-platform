// import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast'; 
import HomePage from './HomePage';
import AuthPage from './AuthPage';
import Dashboard from './Dashboard';
import { QuizToolProvider } from './context/QuizToolContext';
// Import các pages
import ExamRoom from './pages/ExamRoom';
import LogicLab from './pages/LogicLab';
import PracticeTest from './pages/PracticeTest';
import ErrorLog from './pages/ErrorLog';
import HomeworkModule from './pages/HomeworkModule';
import ResultAnalytics from './pages/ResultAnalytics';
import ScoreReport from './ScoreReport';

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
              <Route path="homework" element={<HomeworkModule />} />
              <Route path="error-log" element={<ErrorLog />} />
              <Route path="logic-lab" element={<LogicLab />} />
              <Route path='results-analytics' element = {<ResultAnalytics />} />
            </Route>
            <Route path="/test/:id" element={<ExamRoom />} /> 
            <Route path="/score-report" element={<ScoreReport />} />
          </Routes>
        </Router>
      </GoogleOAuthProvider>
    </QuizToolProvider>
  );
}

export default App;