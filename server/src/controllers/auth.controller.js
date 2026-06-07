const ApiError = require('../utils/ApiError');
const authService = require('../services/auth.service');

// --- ĐĂNG KÝ ---
const register = async (req, res) => {
	try {
		const { email, password, name, role } = req.body;
		const result = await authService.register({ email, password, name, role });
		res.status(201).json(result);
	} catch (error) {
		if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
		console.error(error);
		res.status(500).json({ message: "Lỗi Server", error: error.message });
	}
};

// --- ĐĂNG NHẬP THƯỜNG ---
const login = async (req, res) => {
	try {
		const { email, password } = req.body;
		const result = await authService.login({ email, password });
		res.status(200).json(result);
	} catch (error) {
		if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
		console.error(error);
		res.status(500).json({ message: "Lỗi Server", error: error.message });
	}
};

// --- ĐĂNG NHẬP GOOGLE ---
const googleLogin = async (req, res) => {
	try {
		const result = await authService.googleLogin({ token: req.body.token });
		res.status(200).json(result);
	} catch (error) {
		if (error instanceof ApiError) return res.status(error.statusCode).json(error.body);
		console.error("Google Login Error:", error);
		res.status(400).json({ message: 'Google login failed' });
	}
};

module.exports = { register, login, googleLogin };
