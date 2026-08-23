import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Mail, Lock, Eye, EyeOff, User, GraduationCap } from 'lucide-react'; // Đã thêm icon GraduationCap
import toast from 'react-hot-toast';
import { storeAuthSession } from '../../lib/authSession';

function AuthPage() {
  const [searchParams] = useSearchParams()
  const isRegisterParam = searchParams.get('mode') === 'register';
  const sessionEnded = searchParams.get('reason') === 'session-expired' || searchParams.get('reason') === 'unauthorized';

  const [isLoginMode, setIsLoginMode] = useState(!isRegisterParam);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  type RegisterRole = 'STUDENT' | 'TEACHER';
  const [role, setRole] = useState<RegisterRole>('STUDENT');
  
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionEnded) toast('Your session expired. Please sign in again.', { id: 'session-expired' });
  }, [sessionEnded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLoginMode ? '/api/login' : '/api/register';
    const apiUrl = `${import.meta.env.VITE_API_URL}${endpoint}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // [MỚI 2] Gửi kèm role lên server khi đăng ký
        body: JSON.stringify({ 
            email, 
            password, 
            name, 
            role: isLoginMode ? undefined : role // Chỉ gửi role khi đăng ký
        }),
      });
      const data = await response.json();

      if (response.ok) {
        if (data.token && data.user) storeAuthSession(data.token, data.user, role);
        
        toast.success(data.message || (isLoginMode ? "Signed in" : "Account created"));
        navigate('/dashboard');
      } else {
        toast.error(data.message || 'Authentication failed');
      }
    } catch (error) {
      console.error("Connection error:", error);
      toast.error("Unable to connect to the server");
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });
      const data = await res.json();
      if (res.ok) {
        storeAuthSession(data.token, data.user);

        toast.success('Signed in with Google');
        navigate('/dashboard');
      } else {
        toast.error(data.message || 'Google sign-in failed');
      }
    } catch (error) {
      console.log("Google sign-in connection error:", error);
      toast.error("Unable to connect to the server");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F8F5] px-4 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-xl border border-[#E2EDE9]">
        {sessionEnded && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Your session has expired. Sign in again to continue.</div>}
        
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
                setRole('STUDENT');
              }}
              className="text-[#1B7A5A] font-semibold hover:underline"
            >
              {isLoginMode ? 'Register here' : 'Login here'}
            </button>
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          
          {!isLoginMode && (
            <>
                <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 block">Full Name</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                    type="text"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-[#E2EDE9] rounded-lg bg-[#F8FBF9] text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1B7A5A]/20 focus:border-[#1B7A5A] transition-all"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    />
                </div>
                </div>

                {/* [MỚI 5] Phần chọn Role (Chỉ hiện khi Đăng ký) */}
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700 block">I am a</label>
                    <div className="flex gap-4 mt-2">
                        <label className={`flex-1 flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-all ${role === 'STUDENT' ? 'border-[#1B7A5A] bg-[#E8F5EF] text-[#1B7A5A]' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <input
                                type="radio"
                                name="role"
                                value="STUDENT"
                                checked={role === 'STUDENT'}
                                onChange={() => setRole('STUDENT')}
                                className="hidden"
                            />
                            <User className="h-4 w-4 mr-2" />
                            <span className="font-medium text-sm">Student</span>
                        </label>

                        <label className={`flex-1 flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-all ${role === 'TEACHER' ? 'border-[#1B7A5A] bg-[#E8F5EF] text-[#1B7A5A]' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <input
                                type="radio"
                                name="role"
                                value="TEACHER"
                                checked={role === 'TEACHER'}
                                onChange={() => setRole('TEACHER')}
                                className="hidden"
                            />
                            <GraduationCap className="h-4 w-4 mr-2" />
                            <span className="font-medium text-sm">Teacher</span>
                        </label>
                    </div>
                </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 block">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                required
                className="block w-full pl-10 pr-3 py-3 border border-[#E2EDE9] rounded-lg bg-[#F8FBF9] text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1B7A5A]/20 focus:border-[#1B7A5A] transition-all"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 block">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="block w-full pl-10 pr-10 py-3 border border-[#E2EDE9] rounded-lg bg-[#F8FBF9] text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1B7A5A]/20 focus:border-[#1B7A5A] transition-all"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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

          {isLoginMode && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-[#1B7A5A] focus:ring-[#1B7A5A] border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-gray-500">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <a href="#" className="font-medium text-[#1B7A5A] hover:text-[#145F47]">
                  Forgot Password?
                </a>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-[#1B7A5A] hover:bg-[#145F47] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1B7A5A] transition-colors"
          >
            {isLoginMode ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <div className="mt-8 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">or</span>
          </div>
        </div>

        <div className="mt-6 flex justify-center w-full">
           <div className="w-full flex justify-center"> 
              <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error("Google sign-in failed")}
                  theme="outline"    
                  size="large"        
                  width="100%"        
                  text="continue_with" 
                  shape="rectangular" 
              />
           </div>
        </div>

      </div>
    </div>
  );
}

export default AuthPage;
