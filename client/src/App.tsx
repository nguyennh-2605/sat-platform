// import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage';
import AuthPage from './AuthPage';
import Dashboard from './Dashboard'; // <--- 1. Import Dashboard
import ExamRoom from './ExamRoom';

function App() {
  return (
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
  );
}

export default App;