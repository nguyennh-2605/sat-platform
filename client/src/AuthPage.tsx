import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function AuthPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');     // Thêm biến lưu Email
  const [password, setPassword] = useState(''); // Thêm biến lưu Password
  const [name, setName] = useState('');       // Thêm biến lưu Tên (cho lúc đăng ký)
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // --- 1. XÁC ĐỊNH URL CẦN GỌI ---
    // Nếu đang mode Đăng nhập thì gọi API login (mình sẽ làm sau), 
    // Nếu đang mode Đăng ký thì gọi API register
    const endpoint = isLoginMode ? '/api/login' : '/api/register'; 
    const apiUrl = `${import.meta.env.VITE_API_URL}${endpoint}`

    try {
      // --- 2. GỬI DỮ LIỆU XUỐNG SERVER (BACKEND) ---
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      // --- 3. XỬ LÝ KẾT QUẢ TRẢ VỀ ---
      if (response.ok) {
        // A. Nếu thành công
        alert(data.message || (isLoginMode ? "Đăng nhập thành công!" : "Đăng ký thành công!"));
        
        // Lưu tạm thông tin để giữ trạng thái đăng nhập
        localStorage.setItem('isLoggedIn', 'true');
        // Nếu server trả về user info thì lưu luôn (để hiển thị tên)
        if (data.user) {
          localStorage.setItem('userId', data.user.id)
          localStorage.setItem('userName', data.user.name || 'Học viên');
        }

        navigate('/dashboard'); // Chuyển về trang chủ
      } else {
        // B. Nếu thất bại (VD: Email trùng, Sai pass...)
        alert(`Lỗi: ${data.message}`);
      }
    } catch (error) {
      console.error("Lỗi kết nối:", error);
      alert("Không thể kết nối đến Server. Bạn đã bật Backend (port 5000) chưa?");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
        
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {isLoginMode ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isLoginMode ? 'Chào mừng quay lại!' : 'Bắt đầu hành trình SAT ngay.'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Chỉ hiện ô nhập Tên khi đang Đăng ký */}
            {!isLoginMode && (
              <div>
                <input
                  type="text"
                  required
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Họ và tên của bạn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div>
              <input
                type="email"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Địa chỉ Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isLoginMode ? 'Đăng nhập' : 'Đăng ký ngay'}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            {isLoginMode ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
            <button
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                // Reset form khi chuyển chế độ cho sạch đẹp
                setEmail(''); setPassword(''); setName('');
              }}
              className="font-medium text-blue-600 hover:text-blue-500 underline focus:outline-none"
            >
              {isLoginMode ? 'Đăng ký tại đây' : 'Đăng nhập ngay'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}

export default AuthPage;