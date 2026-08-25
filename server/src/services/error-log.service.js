const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginationMeta } = require('../utils/pagination');

exports.getErrorLogs = async ({ userId, query = {} }) => {
  const pagination = parsePagination(query, { defaultPageSize: 10, maxPageSize: 50 });
  const search = String(query.search || '').trim().slice(0, 100);
  const where = {
    userId,
    ...(search ? { OR: [
      { source: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
      { whyWrong: { contains: search, mode: 'insensitive' } },
    ] } : {}),
  };
  const [total, items] = await prisma.$transaction([
    prisma.errorLog.count({ where }),
    prisma.errorLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.pageSize }),
  ]);
  return { items, pagination: paginationMeta({ ...pagination, total }) };
};

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
