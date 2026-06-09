const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

exports.deleteAssignment = async ({ assignmentId, userId }) => {
  // 1. Try to find regular Assignment first
  let assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { class: true }
  });

  if (assignment) {
    // Regular Assignment
    if (assignment.class.teacherId !== userId) {
      throw new ApiError(403, { message: "Bạn không có quyền xóa bài tập của lớp này!" });
    }
    await prisma.assignment.delete({ where: { id: assignmentId } });
    return;
  }

  // 2. Try LessonAssignment
  const lessonAssignment = await prisma.lessonAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      lesson: {
        include: {
          week: {
            include: {
              class: true
            }
          }
        }
      }
    }
  });

  if (!lessonAssignment) {
    throw new ApiError(404, { message: "Không tìm thấy bài tập này!" });
  }

  if (lessonAssignment.lesson.week.class.teacherId !== userId) {
    throw new ApiError(403, { message: "Bạn không có quyền xóa bài tập của lớp này!" });
  }

  await prisma.lessonAssignment.delete({ where: { id: assignmentId } });
};

exports.updateAssignment = async ({ assignmentId, userId, title, content, fileUrls, links, deadline, testIds }) => {
  // 1. Try to find regular Assignment first
  let assignment = await prisma.assignment.findUnique({
    where: { assignmentId },
    include: { class: true }
  });

  if (assignment) {
    // Regular Assignment
    if (assignment.class.teacherId !== userId) {
      throw new ApiError(403, { message: "Bạn không có quyền chỉnh sửa bài tập này!" });
    }

    let formattedDeadline = undefined;
    if (deadline !== undefined) {
      formattedDeadline = deadline ? new Date(deadline) : null;
    }

    return prisma.assignment.update({
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
  }

  // 2. Try LessonAssignment
  const lessonAssignment = await prisma.lessonAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      lesson: {
        include: {
          week: {
            include: {
              class: true
            }
          }
        }
      }
    }
  });

  if (!lessonAssignment) {
    throw new ApiError(404, { message: "Không tìm thấy bài tập!" });
  }

  if (lessonAssignment.lesson.week.class.teacherId !== userId) {
    throw new ApiError(403, { message: "Bạn không có quyền chỉnh sửa bài tập này!" });
  }

  let formattedDeadline = undefined;
  if (deadline !== undefined) {
    formattedDeadline = deadline ? new Date(deadline) : null;
  }

  return prisma.lessonAssignment.update({
    where: { id: assignmentId },
    data: {
      title: title !== undefined ? title : undefined,
      content: content !== undefined ? content : undefined,
      testIds: testIds !== undefined ? testIds : undefined,
      dueDate: formattedDeadline
    }
  });
};

exports.getAssignmentById = async ({ id, userId, userRole }) => {
  const currentUserId = parseInt(userId, 10);

  if (!currentUserId) {
    throw new ApiError(401, { message: "Không tìm thấy thông tin người dùng." });
  }

  // Try to find regular Assignment first
  let assignment = await prisma.assignment.findUnique({
    where: { id: id },
    include: {
      class: {
        select: {
          teacherId: true,
          students: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      },
      submissions: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      },
      testSubmissions: {
        include: {
          test: {
            select: {
              id: true,
              title: true
            }
          },
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  let isLessonAssignment = false;

  // If not found, try LessonAssignment
  if (!assignment) {
    const lessonAssignment = await prisma.lessonAssignment.findUnique({
      where: { id: id },
      include: {
        lesson: {
          include: {
            week: {
              include: {
                class: {
                  select: {
                    teacherId: true,
                    students: {
                      select: {
                        id: true,
                        name: true,
                        email: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!lessonAssignment) {
      throw new ApiError(404, { message: "Không tìm thấy bài tập" });
    }

    // Transform LessonAssignment to match Assignment structure
    assignment = {
      id: lessonAssignment.id,
      title: lessonAssignment.title,
      content: lessonAssignment.content,
      fileUrls: [],
      links: [],
      testIds: lessonAssignment.testIds,
      deadline: lessonAssignment.dueDate,
      createdAt: lessonAssignment.createdAt,
      class: lessonAssignment.lesson.week.class,
      submissions: [],
      testSubmissions: []
    };
    isLessonAssignment = true;
  }

  const isTeacher = assignment.class.teacherId === currentUserId;
  const isStudent = assignment.class.students.some(student => student.id === currentUserId);

  if (userRole !== 'ADMIN' && !isTeacher && !isStudent) {
    throw new ApiError(403, { message: "Bạn không có quyền xem bài tập này!" });
  }

  const selectedTests = assignment.testIds.length > 0
    ? await prisma.test.findMany({
        where: { id: { in: assignment.testIds } },
        include: {
          sections: {
            select: { _count: { select: { questions: true } } }
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

  const assignmentData = { ...assignment };
  delete assignmentData.class;

  // Add teacher-specific data
  if (isTeacher) {
    const formattedSubmissions = assignment.submissions.map(sub => ({
      id: sub.id,
      studentId: sub.student.id,
      studentName: sub.student.name,
      studentEmail: sub.student.email,
      fileUrl: sub.fileUrl,
      textResponse: sub.textResponse,
      submittedAt: sub.submittedAt,
      score: sub.score,
      feedback: sub.feedback,
      status: sub.status
    }));

    // Calculate stats
    const totalStudents = assignment.class.students.length;
    const submitted = assignment.submissions.length;
    const notSubmitted = totalStudents - submitted;

    // Calculate test completions
    const completedTests = assignment.testSubmissions.filter(ts => ts.status === 'COMPLETED').length;
    const totalTests = assignment.testIds.length * totalStudents;

    const stats = {
      totalStudents,
      submitted,
      notSubmitted,
      testsCompleted: completedTests,
      totalTests
    };

    // Group test completions by student
    const testCompletions = assignment.testSubmissions
      .filter(ts => ts.status === 'COMPLETED')
      .map(ts => ({
        testId: ts.test.id,
        testTitle: ts.test.title,
        studentId: ts.user.id,
        studentName: ts.user.name,
        completed: true,
        completedAt: ts.endTime,
        score: ts.score
      }));

    return {
      ...assignmentData,
      selectedTests: formattedSelectedTests,
      submissions: formattedSubmissions,
      stats,
      testCompletions,
      isLessonAssignment
    };
  }

  delete assignmentData.submissions;
  delete assignmentData.testSubmissions;

  return {
    ...assignmentData,
    selectedTests: formattedSelectedTests,
    isLessonAssignment
  };
};
