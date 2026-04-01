const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createFolder = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const userId = req.user.userId;

    // 1. Validate dữ liệu đầu vào
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Tên thư mục không được để trống'
      });
    }

    // 2. Insert vào Database qua Prisma
    const newFolder = await prisma.folder.create({
      data: {
        name: name.trim(),
        userId: userId,
        parentId: parentId ? parseInt(parentId, 10) : null,
      },
    });

    // 3. Phản hồi thành công về Frontend
    return res.status(201).json({
      success: true,
      message: 'Tạo thư mục thành công',
      data: newFolder
    });

  } catch (error) {
    console.error('Lỗi khi tạo thư mục:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo thư mục'
    });
  }
};

exports.getFolderContent = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.userId;
    const parsedFolderId = folderId ? parseInt(folderId, 10) : null;

    const folders = await prisma.folder.findMany({
      where: {
        userId: userId,
        parentId: parsedFolderId,
      },
      orderBy: { createdAt: 'desc' }
    });

    const rawTests = await prisma.test.findMany({
      where: {
        authorId: userId,
        folderId: parsedFolderId,
      },
      include: {
        sections: {
          select: {
            _count: {
              select: { questions: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const tests = rawTests.map(test => {
      const totalQuestions = test.sections.reduce((sum, currentSection) => {
        return sum + currentSection._count.questions;
      }, 0);
      const { sections, ...rest } = test;
      return {
        ...rest,
        questionCount: totalQuestions
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy dũ liệu thành công',
      data: {
        folders,
        tests
      }
    });
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu Folder", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy dữ liệu"
    });
  }
};

exports.getAllFolders = async (req, res) => {
  try {
    const userId = req.user.userId;

    const folders = await prisma.folder.findMany({
      where: {
        userId: userId,
      },
      select: {
        id: true,
        name: true,
        parentId: true
      },
      orderBy: { name: 'asc' }
    });

    return res.status(200).json({ success: true, message: "Lấy danh sách thư mục thành công", data: folders });
  } catch (error) {
    console.error("Lỗi khi lấy tất cả Folder:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy dữ liệu"
    });
  }
};

exports.deleteItems = async (req, res) => {
  try {
    const { folderIds = [], testIds = [] } = req.body;
    const userId = req.user.userId;

    if (folderIds.length === 0 && testIds.length === 0) {
      return res.status(400).json({ success: false, message: "Không có mục nào để xóa" });
    }

    if (testIds.length > 0) {
      await prisma.test.deleteMany({
        where: {
          id: { in: testIds },
          authorId: userId
        }
      });
    }

    if (folderIds.length > 0) {
      await prisma.folder.deleteMany({
        where: {
          id: { in: folderIds },
          userId: userId
        }
      });
    }

    return res.status(200).json({ success: true, message: "Xóa thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi xóa dữ liệu" });
  }
};

exports.moveItems = async (req, res) => {
  try {
    const { folderIds = [], testIds = [], destinationFolderId } = req.body;
    const userId = req.user.userId;

    if (folderIds.length == 0 && testIds.length == 0) {
      return res.status(400).json({ success: false, message: "Không có mục nào được chọn để di chuyển" });
    }

    if (destinationFolderId && folderIds.includes(destinationFolderId)) {
      return res.status(400).json({ success: false, message: "Không thể di chuyển thư mục vào chính nó" });
    }

    if (testIds.length > 0) {
      await prisma.test.updateMany({
        where: {
          id: { in: testIds },
          authorId: userId
        },
        data: {
          folderId: destinationFolderId
        }
      });
    }

    if (folderIds.length > 0) {
      await prisma.folder.updateMany({
        where: {
          id: { in: folderIds },
          userId: userId
        },
        data: {
          parentId: destinationFolderId
        }
      });
    }

    return res.status(200).json({ success: true, message: "Di chuyển thành công" });
  } catch (error) {
    console.error("Lỗi khi di chuyển", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi di chuyển" });
  }
};  