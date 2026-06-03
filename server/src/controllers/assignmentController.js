const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// XÓA BÀI TẬP
exports.deleteAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const userId = req.user.userId || req.user.id;

    // 1. Kiểm tra bài tập có tồn tại và lấy thông tin lớp học
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { class: true }
    });

    if (!assignment) {
      return res.status(404).json({ message: "Không tìm thấy bài tập này!" });
    }

    // 2. Phân quyền: Chỉ Giáo viên của lớp đó mới được xóa
    if (assignment.class.teacherId !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền xóa bài tập của lớp này!" });
    }

    // 3. Xóa bài tập (Prisma tự động xóa luôn các bài nộp nhờ Cascade)
    await prisma.assignment.delete({
      where: { id: assignmentId }
    });

    return res.status(200).json({
      success: true,
      message: "Xóa bài tập thành công!"
    });

  } catch (error) {
    console.error("Lỗi xóa bài tập:", error);
    return res.status(500).json({ message: "Lỗi server khi xóa bài tập" });
  }
};

// CẬP NHẬT BÀI TẬP
exports.updateAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const userId = req.user.userId || req.user.id;
    const { title, content, fileUrls, links, deadline, testIds } = req.body;

    // 1. Kiểm tra tồn tại và phân quyền
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { class: true }
    });

    if (!assignment) {
      return res.status(404).json({ message: "Không tìm thấy bài tập!" });
    }

    if (assignment.class.teacherId !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền chỉnh sửa bài tập này!" });
    }

    // 2. Format lại deadline nếu có (chuyển string thành Date object)
    let formattedDeadline = undefined;
    if (deadline !== undefined) {
      formattedDeadline = deadline ? new Date(deadline) : null;
    }

    // 3. Cập nhật dữ liệu
    const updatedAssignment = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        title: title !== undefined ? title : undefined,
        content: content !== undefined ? content : undefined,
        fileUrls: fileUrls !== undefined ? fileUrls : undefined,
        links: links !== undefined ? links : undefined,
        testIds: testIds !== undefined ? testIds : undefined,
        deadline: formattedDeadline
      }
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật bài tập thành công!",
      data: updatedAssignment
    });

  } catch (error) {
    console.error("Lỗi cập nhật bài tập:", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật bài tập" });
  }
};


exports.getAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await prisma.assignment.findUnique({
      where: { id: id }
    });
    if (!assignment) {
      return res.status(404).json({ message: "Không tìm thấy bài tập" });
    }

    const selectedTests = assignment.testIds.length > 0
      ? await prisma.test.findMany({
          where: { id: { in: assignment.testIds } },
          include: {
            sections: {
              select: {
                _count: {
                  select: { questions: true }
                }
              }
            }
          }
        })
      : [];

    const formattedSelectedTests = selectedTests.map(test => ({
      id: test.id,
      title: test.title,
      subject: test.subject,
      mode: test.mode,
      duration: test.duration,
      folderId: test.folderId,
      questionCount: test.sections.reduce((sum, section) => {
        return sum + section._count.questions;
      }, 0)
    }));

    return res.status(200).json({
      success: true,
      data: {
        ...assignment,
        selectedTests: formattedSelectedTests
      }
    });
  } catch (error) {
    console.log("Lỗi khi lấy assignment", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

