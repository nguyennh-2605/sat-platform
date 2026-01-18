import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-react'; // Import icon

function AuthPage() {
  const [searchParams] = useSearchParams()
  const isRegisterParam = searchParams.get('mode') === 'register';

  const [isLoginMode, setIsLoginMode] = useState(!isRegisterParam);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false); // [MỚI] Để ẩn/hiện mật khẩu
  const navigate = useNavigate();

  // --- Logic cũ giữ nguyên ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLoginMode ? '/api/login' : '/api/register';
    const apiUrl = `${import.meta.env.VITE_API_URL}${endpoint}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await response.json();

      if (response.ok) {
        if (data.token) localStorage.setItem('token', data.token);
        localStorage.setItem('isLoggedIn', 'true');
        if (data.user) {
          localStorage.setItem('userId', data.user.id);
          localStorage.setItem('userName', data.user.name || 'Học viên');
          localStorage.setItem('userAvatar', data.user.avatar || '');
        }
        alert(data.message || (isLoginMode ? "Đăng nhập thành công!" : "Đăng ký thành công!"));
        navigate('/dashboard');
      } else {
        alert(`Lỗi: ${data.message}`);
      }
    } catch (error) {
      console.error("Lỗi kết nối:", error);
      alert("Không thể kết nối đến Server.");
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('userAvatar', data.user.avatar || '');
        alert('Đăng nhập Google thành công!');
        navigate('/dashboard');
      } else {
        alert(`Lỗi Google Login: ${data.message}`);
      }
    } catch (error) {
      console.log("Lỗi kết nối Google Login:", error);
      alert("Lỗi khi kết nối tới server.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        
        {/* Header: Tiêu đề */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {isLoginMode ? 'Sign in' : 'Sign up'}
          </h2>
          <p className="text-gray-500 text-sm">
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setEmail(''); setPassword(''); setName('');
              }}
              className="text-blue-600 font-semibold hover:underline"
            >
              {isLoginMode ? 'Register here' : 'Login here'}
            </button>
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          
          {/* Input Tên (Chỉ hiện khi Đăng ký) */}
          {!isLoginMode && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 block">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Input Email */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 block">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                required
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Input Password */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 block">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {/* Nút ẩn hiện pass */}
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          {isLoginMode && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-gray-500">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                  Forgot Password?
                </a>
              </div>
            </div>
          )}

          {/* Nút Submit */}
          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            {isLoginMode ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        {/* Divider "OR" */}
        <div className="mt-8 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">or</span>
          </div>
        </div>

        {/* Nút Google */}
        <div className="mt-6 flex justify-center w-full">
           {/* Wrapper này để căn chỉnh nút Google cho đẹp */}
           <div className="w-full flex justify-center"> 
              <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => alert("Đăng nhập Google thất bại.")}
                  theme="outline"    
                  size="large"        // Kích thước lớn
                  width="100%"        // Cố gắng full width (tùy thư viện hỗ trợ)
                  text="continue_with" // Text "Continue with Google"
                  shape="rectangular" // Hình chữ nhật bo góc
              />
           </div>
        </div>

      </div>
    </div>
  );
}

export default AuthPage;