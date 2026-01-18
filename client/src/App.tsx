// import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import HomePage from './HomePage';
import AuthPage from './AuthPage';
import Dashboard from './Dashboard';
import ExamRoom from './ExamRoom';
import { QuizToolProvider } from './context/QuizToolContext';

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <QuizToolProvider>
      <GoogleOAuthProvider clientId={googleClientId}>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPage />} />
            
            {/* Đường dẫn mới cho Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} /> 
            
            {/* Đường dẫn vào thi (vẫn giữ nguyên để từ Dashboard nhảy sang) */}
            <Route path="/test/:id" element={<ExamRoom />} /> 
          </Routes>
        </Router>
      </GoogleOAuthProvider>
    </QuizToolProvider>
  );
}

export default App;