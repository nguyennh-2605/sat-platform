import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function HomePage() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const userName = localStorage.getItem('userName');

  // Kiểm tra xem đã đăng nhập chưa khi vừa vào trang
  useEffect(() => {
    const user = localStorage.getItem('isLoggedIn');
    if (user === 'true') {
      setIsLoggedIn(true);
    }
  }, []);

  // Xử lý khi bấm "Bắt đầu làm bài"
  const handleStartTest = () => {
    if (isLoggedIn) {
      navigate('/dashboard');
    } else {
      // Nếu chưa đăng nhập, chuyển hướng sang trang Auth
      navigate('/auth');
    }
  };

  // Xử lý đăng xuất (để test)
  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    setIsLoggedIn(false);
    alert("Đã đăng xuất!");
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col justify-center items-center p-6 font-sans">
      
      {/* --- HEADER GÓC PHẢI TRÊN --- */}
      <div className="absolute top-0 right-0 p-6 flex items-center gap-4">
        {isLoggedIn ? (
          // Giao diện khi ĐÃ đăng nhập
          <div className="flex items-center gap-4">
             <span className="text-slate-600 font-medium">Hello, {userName}</span>
             <button 
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-700 font-semibold"
             >
               Log out 
             </button>
          </div>
        ) : (
          // Giao diện khi CHƯA đăng nhập
          <>
            <button 
              onClick={() => navigate('/auth')} 
              className="text-slate-600 font-semibold hover:text-blue-600 px-3 py-2"
            >
              Log in
            </button>
            <button 
              onClick={() => navigate('/auth')} 
              className="bg-white text-blue-600 font-semibold px-5 py-2 rounded-full shadow-sm border border-blue-100 hover:shadow-md transition-all"
            >
              Register
            </button>
          </>
        )}
      </div>

      {/* --- NỘI DUNG CHÍNH (GIỮ NGUYÊN) --- */}
      <div className="max-w-3xl w-full text-center space-y-8 mt-10">
        <div className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold tracking-wide mb-4">
          Luyện thi Digital SAT 2026
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Chinh phục điểm số <br />
          <span className="text-blue-600">Digital SAT</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Nền tảng thi thử sát với thực tế nhất. Giúp bạn làm quen với áp lực thời gian và cấu trúc đề thi mới.
        </p>

        <div className="pt-8">
          <button
            onClick={handleStartTest}
            className="group relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full bg-blue-600 px-10 font-medium text-white transition-all duration-300 hover:bg-blue-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          >
            <span className="mr-2 text-lg">Bắt đầu làm bài</span>
            <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-500 border-t border-slate-200 pt-8">
          <div className="flex flex-col items-center">
            <span className="font-bold text-slate-900 text-lg">Reading & Writing</span>
            <span>Module 1 & 2</span>
          </div>
          <div className="flex flex-col items-center border-l-0 md:border-l border-slate-200">
            <span className="font-bold text-slate-900 text-lg">Math</span>
            <span>Module 1 & 2</span>
          </div>
          <div className="flex flex-col items-center border-l-0 md:border-l border-slate-200">
            <span className="font-bold text-slate-900 text-lg">Real-time</span>
            <span>Chấm điểm tức thì</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;