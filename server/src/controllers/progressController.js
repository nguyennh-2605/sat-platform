const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==========================================
// WEEK MANAGEMENT
// ==========================================

// Get all weeks for a class
exports.getWeeks = async (req, res) => {
  try {
    const { classId } = req.params;

    const weeks = await prisma.week.findMany({
      where: { classId },
      orderBy: { order: 'asc' },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          include: {
            files: {
              orderBy: { createdAt: 'asc' }
            },
            assignments: true
          }
        }
      }
    });

    res.json({ success: true, data: weeks });
  } catch (error) {
    console.error('Get Weeks Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi lấy danh sách tuần học' });
  }
};

// Create a new week
exports.createWeek = async (req, res) => {
  try {
    const { classId } = req.params;
    const { title } = req.body;
    const userId = req.user?.userId || req.user?.id;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Tiêu đề tuần không được để trống' });
    }

    // Verify user is teacher of this class
    const classData = await prisma.class.findUnique({
      where: { id: classId }
    });

    if (!classData) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy lớp học' });
    }

    if (classData.teacherId !== userId) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền thêm tuần học' });
    }

    // Get the current max order
    const maxOrderWeek = await prisma.week.findFirst({
      where: { classId },
      orderBy: { order: 'desc' }
    });

    const newOrder = maxOrderWeek ? maxOrderWeek.order + 1 : 0;

    const newWeek = await prisma.week.create({
      data: {
        title,
        classId,
        order: newOrder
      }
    });

    res.status(201).json({ success: true, data: newWeek });
  } catch (error) {
    console.error('Create Week Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi tạo tuần học' });
  }
};

// Update a week
exports.updateWeek = async (req, res) => {
  try {
    const { weekId } = req.params;
    const { title, isExpanded } = req.body;
    const userId = req.user?.userId || req.user?.id;

    // Verify ownership
    const week = await prisma.week.findUnique({
      where: { id: weekId },
      include: { class: true }
    });

    if (!week) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tuần học' });
    }

    if (week.class.teacherId !== userId) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền chỉnh sửa' });
    }

    const updatedWeek = await prisma.week.update({
      where: { id: weekId },
      data: {
        ...(title && { title }),
        ...(isExpanded !== undefined && { isExpanded })
      }
    });

    res.json({ success: true, data: updatedWeek });
  } catch (error) {
    console.error('Update Week Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi cập nhật tuần học' });
  }
};

// Delete a week
exports.deleteWeek = async (req, res) => {
  try {
    const { weekId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    // Verify ownership
    const week = await prisma.week.findUnique({
      where: { id: weekId },
      include: { class: true }
    });

    if (!week) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tuần học' });
    }

    if (week.class.teacherId !== userId) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa' });
    }

    await prisma.week.delete({
      where: { id: weekId }
    });

    res.json({ success: true, message: 'Đã xóa tuần học' });
  } catch (error) {
    console.error('Delete Week Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi xóa tuần học' });
  }
};

// ==========================================
// LESSON MANAGEMENT
// ==========================================

// Create a new lesson
exports.createLesson = async (req, res) => {
  try {
    const { weekId } = req.params;
    const { title } = req.body;
    const userId = req.user?.userId || req.user?.id;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Tiêu đề buổi học không được để trống' });
    }

    // Verify ownership
    const week = await prisma.week.findUnique({
      where: { id: weekId },
      include: { class: true }
    });

    if (!week) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tuần học' });
    }

    if (week.class.teacherId !== userId) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền thêm buổi học' });
    }

    // Get the current max order
    const maxOrderLesson = await prisma.lesson.findFirst({
      where: { weekId },
      orderBy: { order: 'desc' }
    });

    const newOrder = maxOrderLesson ? maxOrderLesson.order + 1 : 0;

    const newLesson = await prisma.lesson.create({
      data: {
        title,
        weekId,
        order: newOrder
      },
      include: {
        files: true,
        assignments: true
      }
    });

    res.status(201).json({ success: true, data: newLesson });
  } catch (error) {
    console.error('Create Lesson Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi tạo buổi học' });
  }
};

// Delete a lesson
exports.deleteLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    // Verify ownership
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        week: {
          include: { class: true }
        }
      }
    });

    if (!lesson) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy buổi học' });
    }

    if (lesson.week.class.teacherId !== userId) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa' });
    }

    await prisma.lesson.delete({
      where: { id: lessonId }
    });

    res.json({ success: true, message: 'Đã xóa buổi học' });
  } catch (error) {
    console.error('Delete Lesson Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi xóa buổi học' });
  }
};

// ==========================================
// FILE MANAGEMENT
// ==========================================

// Add files to a lesson
exports.addFiles = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { files } = req.body; // Array of { name, url }
    const userId = req.user?.userId || req.user?.id;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Danh sách file không hợp lệ' });
    }

    // Verify ownership
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        week: {
          include: { class: true }
        }
      }
    });

    if (!lesson) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy buổi học' });
    }

    if (lesson.week.class.teacherId !== userId) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền thêm tài liệu' });
    }

    const newFiles = await prisma.$transaction(
      files.map(file =>
        prisma.lessonFile.create({
          data: {
            name: file.name,
            url: file.url,
            lessonId
          }
        })
      )
    );

    res.status(201).json({ success: true, data: newFiles });
  } catch (error) {
    console.error('Add Files Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi thêm tài liệu' });
  }
};

// Delete a file
exports.deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    // Verify ownership
    const file = await prisma.lessonFile.findUnique({
      where: { id: fileId },
      include: {
        lesson: {
          include: {
            week: {
              include: { class: true }
            }
          }
        }
      }
    });

    if (!file) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài liệu' });
    }

    if (file.lesson.week.class.teacherId !== userId) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa' });
    }

    await prisma.lessonFile.delete({
      where: { id: fileId }
    });

    res.json({ success: true, message: 'Đã xóa tài liệu' });
  } catch (error) {
    console.error('Delete File Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi xóa tài liệu' });
  }
};

// ==========================================
// ASSIGNMENT MANAGEMENT
// ==========================================

// Create or update assignment for a lesson
exports.createOrUpdateAssignment = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { title, content, dueDate, testIds } = req.body;
    const userId = req.user?.userId || req.user?.id;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Tiêu đề bài tập không được để trống' });
    }

    // Verify ownership
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        week: {
          include: { class: true }
        }
      }
    });

    if (!lesson) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy buổi học' });
    }

    if (lesson.week.class.teacherId !== userId) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền giao bài tập' });
    }

    const assignment = await prisma.lessonAssignment.upsert({
      where: { lessonId },
      update: {
        title,
        content: content || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        testIds: Array.isArray(testIds) ? testIds : []
      },
      create: {
        title,
        content: content || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        testIds: Array.isArray(testIds) ? testIds : [],
        lessonId
      }
    });

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    console.error('Create/Update Assignment Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi giao bài tập' });
  }
};

// Delete assignment
exports.deleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user?.userId || req.user?.id;

    // Verify ownership
    const assignment = await prisma.lessonAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        lesson: {
          include: {
            week: {
              include: { class: true }
            }
          }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bài tập' });
    }

    if (assignment.lesson.week.class.teacherId !== userId) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa' });
    }

    await prisma.lessonAssignment.delete({
      where: { id: assignmentId }
    });

    res.json({ success: true, message: 'Đã xóa bài tập' });
  } catch (error) {
    console.error('Delete Assignment Error:', error);
    res.status(500).json({ success: false, error: 'Lỗi khi xóa bài tập' });
  }
};
