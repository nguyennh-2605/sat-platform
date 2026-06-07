const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const ALLOWED_REGISTER_ROLES = ['STUDENT', 'TEACHER'];

exports.register = async ({ email, password, name, role }) => {
  const existingUser = await prisma.user.findUnique({ where: { email: email } });

  if (existingUser) {
    throw new ApiError(400, { message: "Email này đã được sử dụng!" });
  }

  const requestedRole = role || 'STUDENT';
  if (!ALLOWED_REGISTER_ROLES.includes(requestedRole)) {
    throw new ApiError(400, { message: "Vai trò không hợp lệ. Chỉ được chọn Học sinh hoặc Giáo viên." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: requestedRole
    },
  });

  // Tạo Token ngay khi đăng ký để user tự đăng nhập luôn
  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email, role: newUser.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    message: "Đăng ký thành công!",
    user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
    token
  };
};

exports.login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email: email } });

  if (!user) {
    throw new ApiError(400, { message: "Email chưa được đăng ký!" });
  }

  // Nếu user này tạo bằng Google thì password sẽ là null -> Không cho đăng nhập bằng pass
  if (!user.password) {
    throw new ApiError(400, { message: "Tài khoản này đăng ký bằng Google. Vui lòng chọn 'Login with Google'." });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new ApiError(400, { message: "Sai mật khẩu!" });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    message: "Đăng nhập thành công!",
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token
  };
};

exports.googleLogin = async ({ token }) => {
  // 1. Xác thực token với Google
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  const { email, name, picture } = payload;

  // 2. Kiểm tra user trong Database
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // 3. Nếu chưa có -> Tạo User mới (password null vì đăng nhập bằng Google)
    user = await prisma.user.create({
      data: {
        email,
        name: name,
        avatar: picture,
        password: null,
      },
    });
  }

  // 4. Tạo JWT Token của web
  const jwtToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    message: 'Google login successful',
    token: jwtToken,
    user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, role: user.role }
  };
};
