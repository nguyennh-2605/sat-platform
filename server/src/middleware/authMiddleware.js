const jwt = require('jsonwebtoken');

// Đảm bảo secret key khớp với file .env hoặc file login
const JWT_SECRET = process.env.JWT_SECRET || 'secret123'; 

// 1. Hàm kiểm tra đăng nhập (Xác thực Token)
const authenticateToken = (req, res, next) => {
  // Lấy header Authorization: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Lấy phần token sau chữ Bearer

  if (!token) {
    console.log("❌ Không tìm thấy token sau chữ Bearer");
    return res.status(401).json({ error: 'Không tìm thấy Token. Vui lòng đăng nhập.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log("Lỗi Verify:", err.message); // <--- Xem nó báo lỗi gì ở đây
      return res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
    
    // Nếu OK, lưu thông tin user (id, email, role) vào biến req.user
    // Để các hàm phía sau (Controller) có thể dùng được.
    req.user = user;
    next(); // Cho phép đi tiếp vào Controller
  });
};

// 2. Hàm kiểm tra quyền (Phân quyền)
// VD: authorizeRole(['TEACHER']) nghĩa là chỉ GV mới được vào
const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này.' });
    }
    next();
  };
};

module.exports = { authenticateToken, authorizeRole };