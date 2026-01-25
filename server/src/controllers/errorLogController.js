const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Lấy danh sách Error Log của User đang đăng nhập
exports.getErrorLogs = async (req, res) => {
  try {
    // req.user được tạo ra từ middleware xác thực (verifyToken)
    const userId = req.user.userId; 

    const logs = await prisma.errorLog.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' } // Mới nhất lên đầu
    });
    
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách" });
  }
};

// 2. Tạo Error Log mới
exports.createErrorLog = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      console.log("Lỗi: Không tìm thấy user ID trong request");
      return res.status(401).json({ message: "Chưa xác thực user (Token lỗi hoặc Middleware chưa chạy)" });
    }

    const userId = req.user.userId;
    const { source, category, userAnswer, correctAnswer, whyWrong, whyRight } = req.body;

    const newLog = await prisma.errorLog.create({
      data: {
        userId, // Quan trọng: Gán log này cho user đang đăng nhập
        source,
        category,
        userAnswer,
        correctAnswer,
        whyWrong,
        whyRight
      }
    });

    res.status(201).json(newLog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi tạo log mới" });
  }
};

// 3. Cập nhật Error Log
exports.updateErrorLog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const data = req.body;

    // Kiểm tra xem log này có đúng là của user này không trước khi sửa
    const existingLog = await prisma.errorLog.findUnique({ where: { id } });
    
    if (!existingLog || existingLog.userId !== userId) {
      return res.status(403).json({ message: "Không có quyền sửa log này" });
    }

    const updatedLog = await prisma.errorLog.update({
      where: { id },
      data: data
    });

    res.json(updatedLog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi cập nhật" });
  }
};

// 4. Xóa Error Log
exports.deleteErrorLog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const existingLog = await prisma.errorLog.findUnique({ where: { id } });

    if (!existingLog || existingLog.userId !== userId) {
      return res.status(403).json({ message: "Không có quyền xóa log này" });
    }

    await prisma.errorLog.delete({ where: { id } });
    
    res.json({ message: "Đã xóa thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi xóa" });
  }
};