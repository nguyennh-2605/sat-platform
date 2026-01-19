const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library'); // [MỚI] Thư viện Google
const jwt = require('jsonwebtoken'); // [MỚI] Thư viện tạo Token

const prisma = new PrismaClient();

// Khởi tạo Client Google với ID lấy từ biến môi trường
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'secret123'; 

// --- ĐĂNG KÝ (Cũ) ---
const register = async (req, res) => {
	try {
		const { email, password, name, role } = req.body;

		const existingUser = await prisma.user.findUnique({
			where: { email: email },
		});

		if (existingUser) {
			return res.status(400).json({ message: "Email này đã được sử dụng!" });
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		const newUser = await prisma.user.create({
			data: {
				email,
				password: hashedPassword,
				name, // Sửa lại: database của bạn là 'name' hay 'username'? Hãy check schema nhé.
				role: role || 'STUDENT'
			},
		});

		// Tạo Token ngay khi đăng ký để user tự đăng nhập luôn (Optional)
		const token = jwt.sign({ userId: newUser.id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

		res.status(201).json({ 
			message: "Đăng ký thành công!", 
			user: { id: newUser.id, email: newUser.email, name: newUser.name },
			token // Trả về token
		});

	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Lỗi Server", error: error.message });
	}
};

// --- ĐĂNG NHẬP THƯỜNG ---
const login = async (req, res) => {
	try {
			const { email, password } = req.body;

			const user = await prisma.user.findUnique({
				where: { email: email }
			});

			if (!user) {
				return res.status(400).json({ message: "Email chưa được đăng ký!" });
			}

			// Nếu user này tạo bằng Google thì password sẽ là null -> Không cho đăng nhập bằng pass
			if (!user.password) {
				return res.status(400).json({ message: "Tài khoản này đăng ký bằng Google. Vui lòng chọn 'Login with Google'." });
			}

			const isMatch = await bcrypt.compare(password, user.password);

			if (!isMatch) {
				return res.status(400).json({ message: "Sai mật khẩu!" });
			}

			// [QUAN TRỌNG] Tạo JWT Token
			const token = jwt.sign(
				{ userId: user.id, email: user.email, role: user.role },
				JWT_SECRET,
				{ expiresIn: '7d' }
			);

			res.status(200).json({
				message: "Đăng nhập thành công!",
				user: { id: user.id, email: user.email, name: user.name },
				token // Trả về token cho Frontend lưu
			});

	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Lỗi Server", error: error.message });
	}
};

// --- ĐĂNG NHẬP GOOGLE (MỚI TINH) ---
const googleLogin = async (req, res) => {
	try {
		const { token } = req.body; // Token từ Frontend gửi lên

		// 1. Xác thực token với Google
		const ticket = await client.verifyIdToken({
				idToken: token,
				audience: process.env.GOOGLE_CLIENT_ID,
		});
		const payload = ticket.getPayload();
		
		// Lấy thông tin từ Google
		const { email, name, picture } = payload;

		// 2. Kiểm tra user trong Database
		let user = await prisma.user.findUnique({ where: { email } });

		if (!user) {
			// 3. Nếu chưa có -> Tạo User mới
			// Password để null, username lấy từ tên Google
			user = await prisma.user.create({
				data: {
					email,
					name: name,     // Lưu tên
					avatar: picture,// Lưu ảnh (nếu schema có cột avatar)
					password: null, // Không có pass
				},
			});
		}

		// 4. Tạo JWT Token của web bạn
		const jwtToken = jwt.sign(
			{ userId: user.id, email: user.email, role: user.role },
			process.env.JWT_SECRET,
			{ expiresIn: '7d' }
		);

		res.status(200).json({ 
			message: 'Google login successful', 
			token: jwtToken, 
			user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } 
		});

	} catch (error) {
			console.error("Google Login Error:", error);
			res.status(400).json({ message: 'Google login failed' });
	}
};

// Xuất cả 3 hàm ra
module.exports = { register, login, googleLogin };