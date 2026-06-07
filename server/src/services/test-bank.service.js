const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

exports.createFolder = ({ name, parentId, userId }) => {
  if (!name || name.trim() === '') {
    throw new ApiError(400, { success: false, message: 'Tên thư mục không được để trống' });
  }

  return prisma.folder.create({
    data: {
      name: name.trim(),
      userId: userId,
      parentId: parentId ? parseInt(parentId, 10) : null,
    },
  });
};

exports.getFolderContent = async ({ folderId, userId }) => {
  const parsedFolderId = folderId ? parseInt(folderId, 10) : null;

  const folders = await prisma.folder.findMany({
    where: { userId: userId, parentId: parsedFolderId },
    orderBy: { createdAt: 'desc' }
  });

  const rawTests = await prisma.test.findMany({
    where: { authorId: userId, folderId: parsedFolderId },
    include: {
      sections: {
        select: { _count: { select: { questions: true } } }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const tests = rawTests.map(test => {
    const totalQuestions = test.sections.reduce((sum, currentSection) => {
      return sum + currentSection._count.questions;
    }, 0);
    const { sections, ...rest } = test;
    return { ...rest, questionCount: totalQuestions };
  });

  return { folders, tests };
};

exports.getAllFolders = ({ userId }) =>
  prisma.folder.findMany({
    where: { userId: userId },
    select: { id: true, name: true, parentId: true },
    orderBy: { name: 'asc' }
  });

exports.deleteItems = async ({ folderIds = [], testIds = [], userId }) => {
  if (folderIds.length === 0 && testIds.length === 0) {
    throw new ApiError(400, { success: false, message: "Không có mục nào để xóa" });
  }

  if (testIds.length > 0) {
    await prisma.test.deleteMany({
      where: { id: { in: testIds }, authorId: userId }
    });
  }

  if (folderIds.length > 0) {
    await prisma.folder.deleteMany({
      where: { id: { in: folderIds }, userId: userId }
    });
  }
};

exports.moveItems = async ({ folderIds = [], testIds = [], destinationFolderId, userId }) => {
  if (folderIds.length == 0 && testIds.length == 0) {
    throw new ApiError(400, { success: false, message: "Không có mục nào được chọn để di chuyển" });
  }

  if (destinationFolderId && folderIds.includes(destinationFolderId)) {
    throw new ApiError(400, { success: false, message: "Không thể di chuyển thư mục vào chính nó" });
  }

  if (testIds.length > 0) {
    await prisma.test.updateMany({
      where: { id: { in: testIds }, authorId: userId },
      data: { folderId: destinationFolderId }
    });
  }

  if (folderIds.length > 0) {
    await prisma.folder.updateMany({
      where: { id: { in: folderIds }, userId: userId },
      data: { parentId: destinationFolderId }
    });
  }
};
