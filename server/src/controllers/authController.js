const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // Thư viện mã hóa

const prisma = new PrismaClient();

const register = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // 1. Kiểm tra xem email đã tồn tại chưa
        const existingUser = await prisma.user.findUnique({
            where: { email: email },
        });

        if (existingUser) {
            return res.status(400).json({ message: "Email này đã được sử dụng!" });
        }

        // 2. Mã hóa mật khẩu (Băm)
        // Số 10 là độ khó (salt rounds), càng cao càng an toàn nhưng chậm
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Lưu vào Database
        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword, // Lưu mật khẩu đã mã hóa
                name,
            },
        });

        // 4. Trả về kết quả thành công
        res.status(201).json({ 
            message: "Đăng ký thành công!", 
            user: { id: newUser.id, email: newUser.email, name: newUser.name } 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi Server", error: error.message });
    }
};

// --- ĐĂNG NHẬP (Mới thêm) ---
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Tìm user theo email
        const user = await prisma.user.findUnique({
            where: { email: email }
        });

        // Nếu không thấy user
        if (!user) {
            return res.status(400).json({ message: "Email chưa được đăng ký!" });
        }

        // 2. So sánh mật khẩu (Quan trọng)
        // Dùng bcrypt so sánh pass nhập vào (123) với pass mã hóa ($2b$10...)
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Sai mật khẩu!" });
        }

        // 3. Đăng nhập thành công -> Trả về thông tin user (trừ mật khẩu)
        res.status(200).json({
            message: "Đăng nhập thành công!",
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi Server", error: error.message });
    }
};

// Xuất cả 2 hàm ra
module.exports = { register, login };