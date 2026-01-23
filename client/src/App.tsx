// import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast'; 

import HomePage from './HomePage';
import AuthPage from './AuthPage';
import Dashboard from './Dashboard';
import ExamRoom from './pages/ExamRoom';
import RecallChallenge from './pages/LogicLab';
import { QuizToolProvider } from './context/QuizToolContext';

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
            <Route path="/dashboard" element={<Dashboard />} /> 
            <Route path="/test/:id" element={<ExamRoom />} /> 
            <Route path="/recall" element={<RecallChallenge />} />
          </Routes>
        </Router>
      </GoogleOAuthProvider>
    </QuizToolProvider>
  );
}

export default App;