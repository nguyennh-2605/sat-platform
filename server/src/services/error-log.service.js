const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

exports.getErrorLogs = ({ userId }) =>
  prisma.errorLog.findMany({
    where: { userId: userId },
    orderBy: { createdAt: 'desc' } // Mới nhất lên đầu
  });

exports.createErrorLog = ({ userId, source, category, userAnswer, correctAnswer, whyWrong, whyRight }) =>
  prisma.errorLog.create({
    data: { userId, source, category, userAnswer, correctAnswer, whyWrong, whyRight }
  });

exports.updateErrorLog = async ({ id, userId, data }) => {
  // Kiểm tra xem log này có đúng là của user này không trước khi sửa
  const existingLog = await prisma.errorLog.findUnique({ where: { id } });

  if (!existingLog || existingLog.userId !== userId) {
    throw new ApiError(403, { message: "Không có quyền sửa log này" });
  }

  return prisma.errorLog.update({ where: { id }, data });
};

exports.deleteErrorLog = async ({ id, userId }) => {
  const existingLog = await prisma.errorLog.findUnique({ where: { id } });

  if (!existingLog || existingLog.userId !== userId) {
    throw new ApiError(403, { message: "Không có quyền xóa log này" });
  }

  await prisma.errorLog.delete({ where: { id } });
};
