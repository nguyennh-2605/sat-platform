const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { sendNotificationToUser } = require('./notification.service');

const parseUserId = (userId) => parseInt(userId, 10);

const assertClassMember = async ({ classId, userId, userRole }) => {
  const currentUserId = parseUserId(userId);

  if (!currentUserId) {
    throw new ApiError(401, { error: "Không tìm thấy thông tin người dùng." });
  }

  const classroom = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      students: { select: { id: true } }
    }
  });

  if (!classroom) {
    throw new ApiError(404, { error: "Không tìm thấy lớp học" });
  }

  const isTeacher = classroom.teacherId === currentUserId;
  const isStudent = classroom.students.some(student => student.id === currentUserId);

  if (userRole !== 'ADMIN' && !isTeacher && !isStudent) {
    throw new ApiError(403, { error: "Bạn không có quyền truy cập lớp học này." });
  }

  return classroom;
};

const assertClassTeacher = async ({ classId, userId, userRole }) => {
  const currentUserId = parseUserId(userId);

  if (!currentUserId) {
    throw new ApiError(401, { error: "Không tìm thấy thông tin người dùng." });
  }

  const classroom = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      students: { select: { id: true } }
    }
  });

  if (!classroom) {
    throw new ApiError(404, { error: "Không tìm thấy lớp học" });
  }

  if (userRole !== 'ADMIN' && classroom.teacherId !== currentUserId) {
    throw new ApiError(403, { error: "Bạn không phải giáo viên của lớp này" });
  }

  return classroom;
};

exports.createClass = async ({ name, userId, userRole }) => {
  // Validation: Chỉ giáo viên mới được tạo lớp
  if (userRole !== 'TEACHER' && userRole !== 'ADMIN') {
    throw new ApiError(403, { error: "Bạn không có quyền tạo lớp học." });
  }

  if (!name) {
    throw new ApiError(400, { error: "Tên lớp không được để trống" });
  }

  return prisma.class.create({
    data: {
      name: name,
      teacherId: userId, // Link lớp này với ID của giáo viên đang đăng nhập
    }
  });
};

exports.getMyClasses = async ({ userId, userRole }) => {
  if (!userId) {
    throw new ApiError(401, { error: "Chưa đăng nhập" });
  }

  if (userRole === 'TEACHER') {
    // Nếu là GV: Lấy danh sách lớp mình dạy
    return prisma.class.findMany({
      where: { teacherId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { students: true } } // Đếm số học sinh trong lớp
      }
    });
  }

  // Nếu là HS: Lấy danh sách lớp mình tham gia
  return prisma.class.findMany({
    where: {
      students: {
        some: { id: userId } // Tìm lớp có chứa userId này trong danh sách students
      }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      teacher: { select: { name: true, email: true } } // Lấy thêm info giáo viên
    }
  });
};

exports.getClassDetail = async ({ id, userId, userRole }) => {
  await assertClassMember({ classId: id, userId, userRole });

  const currentUserId = parseUserId(userId);
  const classDetail = await prisma.class.findUnique({
    where: { id: id },
    include: {
      teacher: {
        select: { id: true, name: true, email: true }
      },
      students: {
        select: { id: true, name: true, email: true, avatar: true }
      },
      assignments: {
        orderBy: { createdAt: 'desc' }, // Lấy bài tập mới nhất lên đầu
        include: {
          submissions: userRole === 'STUDENT'
            ? { where: { studentId: currentUserId } }
            : true
        }
      }
    }
  });

  if (!classDetail) {
    throw new ApiError(404, { error: "Không tìm thấy lớp học" });
  }

  return classDetail;
};

exports.addStudentToClass = async ({ classId, email, currentUserId }) => {
  if (!currentUserId) {
    throw new ApiError(401, { error: "Không tìm thấy thông tin người dùng." });
  }

  // 1. Kiểm tra lớp có tồn tại và thuộc về giáo viên này không
  const existingClass = await prisma.class.findUnique({
    where: { id: classId }
  });

  if (!existingClass) throw new ApiError(404, { error: "Lớp không tồn tại" });
  if (existingClass.teacherId !== parseInt(currentUserId)) {
    throw new ApiError(403, { error: "Bạn không phải giáo viên của lớp này" });
  }

  // 2. Tìm học sinh theo email
  const student = await prisma.user.findUnique({
    where: { email: email }
  });

  if (!student) {
    throw new ApiError(404, { error: "Không tìm thấy học sinh với email này" });
  }

  // 3. Cập nhật quan hệ (Connect)
  await prisma.class.update({
    where: { id: classId },
    data: {
      students: {
        connect: { id: student.id } // Connect theo ID của User tìm được
      }
    }
  });

  await sendNotificationToUser(
    student.id,
    `Bạn vừa được giáo viên thêm vào lớp học "${existingClass.name}".`,
    `/dashboard/class/${classId}`
  )

  return { message: "Thêm học sinh thành công", student: student };
};

exports.createAssignment = async ({ title, content, type, deadline, classId, driveFiles, externalLinks, testIds, currentUserId, userRole }) => {
  // Validate cơ bản
  if (!classId || !title) {
    throw new ApiError(400, { error: "Thiếu thông tin classId hoặc title" });
  }

  const classData = await assertClassTeacher({ classId, userId: currentUserId, userRole });

  const newAssignment = await prisma.assignment.create({
    data: {
      title,
      content: content,
      deadline: (type === 'assignment' && deadline) ? new Date(deadline) : null,
      fileUrls: driveFiles || [],
      links: externalLinks || [],
      testIds: Array.isArray(testIds) ? testIds : [],
      classId: classId
    }
  });

  if (classData && classData.students.length > 0) {
    const teacherName = classData.teacher?.name || 'Giáo viên';
    const notifMessage = type === 'assignment'
      ? `${teacherName} vừa giao bài tập mới: "${newAssignment.title}" cho lớp ${classData.name}.`
      : `${teacherName} vừa đăng một thông báo: "${newAssignment.title}" trong lớp ${classData.name}.`
    await Promise.all(classData.students.map(student =>
      sendNotificationToUser(
        student.id,
        notifMessage,
        `/dashboard/class/${classId}/assignment/${newAssignment.id}`
      )
    ));
  }

  return newAssignment;
};

exports.createSubmission = async ({ assignmentId, textResponse, fileUrl, studentId }) => {
  if (!assignmentId) {
    throw new ApiError(400, { error: "Thiếu thông tin bài tập (assignmentId)" });
  }

  const currentStudentId = parseUserId(studentId);

  if (!currentStudentId) {
    throw new ApiError(401, { error: "Không tìm thấy thông tin học sinh." });
  }

  const assignmentInfo = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      class: {
        include: {
          students: { select: { id: true } }
        }
      }
    }
  });

  if (!assignmentInfo) {
    throw new ApiError(404, { error: "Không tìm thấy bài tập" });
  }

  const isEnrolledStudent = assignmentInfo.class.students.some(student => student.id === currentStudentId);

  if (!isEnrolledStudent) {
    throw new ApiError(403, { error: "Bạn không có quyền nộp bài tập này." });
  }

  // Kiểm tra xem đã nộp chưa (dùng upsert để hỗ trợ nộp lại)
  const submission = await prisma.homeworkSubmission.upsert({
    where: {
      studentId_assignmentId: {
        studentId: currentStudentId,
        assignmentId: assignmentId
      }
    },
    update: {
      textResponse: textResponse || null,
      fileUrl: fileUrl || null,
      submittedAt: new Date(),
      status: 'SUBMITTED'
    },
    create: {
      studentId: currentStudentId,
      assignmentId: assignmentId,
      textResponse: textResponse || null,
      fileUrl: fileUrl || null,
    }
  });

  const studentInfo = await prisma.user.findUnique({
    where: { id: currentStudentId }
  });

  if (assignmentInfo && studentInfo) {
    await sendNotificationToUser(
      assignmentInfo.class.teacherId,
      `Học sinh ${studentInfo.name || studentInfo.email} vừa nộp bài tập "${assignmentInfo.title}" của lớp ${assignmentInfo.class.name}.`,
      `/dashboard/class/${assignmentInfo.classId}/assignment/${assignmentId}`
    );
  }

  return submission;
};

exports.getExamTests = async ({ classId, userId, userRole }) => {
  if (!classId) {
    throw new ApiError(400, { error: "Thiếu thông tin classId" });
  }

  await assertClassMember({ classId, userId, userRole });

  const tests = await prisma.test.findMany({
    where: {
      classTests: {
        some: {
          classId: classId
        }
      },
      mode: 'EXAM'
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      _count: {
        select: { submissions: true }
      }
    }
  });

  return tests.map(test => ({
    id: test.id,
    title: test.title,
    // Format ngày tháng (VD: Feb 16)
    date: new Date(test.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    submissionCount: test._count.submissions
  }));
};

exports.getScoreReportAssignments = async ({ classId, userId, userRole }) => {
  if (!classId) {
    throw new ApiError(400, { success: false, message: "Thiếu classId", data: null });
  }

  await assertClassTeacher({ classId, userId, userRole });

  const classroom = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      assignments: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          createdAt: true,
          testIds: true
        }
      }
    }
  });

  if (!classroom) {
    throw new ApiError(404, { success: false, message: "Không tìm thấy lớp học", data: null });
  }

  const allTestIds = [...new Set(
    classroom.assignments.flatMap(assignment => assignment.testIds || [])
  )];

  const examTests = allTestIds.length > 0
    ? await prisma.test.findMany({
        where: {
          id: { in: allTestIds },
          mode: 'EXAM'
        },
        select: {
          id: true,
          title: true,
          mode: true,
          subject: true,
          duration: true,
          createdAt: true
        }
      })
    : [];

  const testsMap = new Map(examTests.map(test => [test.id, test]));

  return classroom.assignments.map(assignment => {
    const examItems = (assignment.testIds || [])
      .map(testId => testsMap.get(testId))
      .filter(test => !!test)
      .map(test => ({
        id: test.id,
        title: test.title,
        mode: test.mode,
        subject: test.subject,
        duration: test.duration,
        date: new Date(test.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));

    return {
      id: assignment.id,
      title: assignment.title,
      createdAt: assignment.createdAt,
      tests: examItems
    };
  });
};

exports.getTestAnalytics = async ({ testId, assignmentId, userId, userRole }) => {
  if (!testId) throw new ApiError(400, { error: "Thiếu testId" });

  const id = parseInt(testId);

  if (Number.isNaN(id)) {
    throw new ApiError(400, { error: "testId không hợp lệ" });
  }

  if (assignmentId) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { classId: true, testIds: true }
    });

    if (!assignment) {
      throw new ApiError(404, { error: "Không tìm thấy bài tập" });
    }

    if (!assignment.testIds.includes(id)) {
      throw new ApiError(403, { error: "Bài thi không thuộc bài tập này." });
    }

    await assertClassTeacher({ classId: assignment.classId, userId, userRole });
  } else if (userRole !== 'ADMIN') {
    const currentUserId = parseUserId(userId);
    const classTest = await prisma.classTest.findFirst({
      where: {
        testId: id,
        class: { teacherId: currentUserId }
      }
    });

    if (!classTest) {
      throw new ApiError(403, { error: "Bạn không có quyền xem báo cáo bài thi này." });
    }
  }

  // 1. Lấy cấu trúc đề thi
  const testStructure = await prisma.test.findUnique({
    where: { id: id },
    include: {
      sections: {
        include: {
          questions: {
            select: { id: true, correctAnswer: true, order: true }
          }
        }
      }
    }
  });

  if (!testStructure) {
    throw new ApiError(404, { error: "Không tìm thấy bài thi" });
  }

  // --- FIX LỖI 81 CÂU & TRÙNG LẶP ---
  // Sử dụng Map để lọc trùng câu hỏi theo ID
  const uniqueQuestionsMap = new Map();

  testStructure.sections.forEach(section => {
    section.questions.forEach(q => {
      if (!uniqueQuestionsMap.has(q.id)) {
        uniqueQuestionsMap.set(q.id, q);
      }
    });
  });

  const allQuestions = Array.from(uniqueQuestionsMap.values())
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // 2. Lấy danh sách bài nộp
  const submissions = await prisma.submission.findMany({
    where: {
      testId: id,
      assignmentId: assignmentId,
      status: 'COMPLETED'
    },
    select: {
      id: true, score: true, startedAt: true, endTime: true,
      user: { select: { id: true, name: true, email: true } },
      answers: { select: { questionId: true, selectedChoice: true } }
    },
    orderBy: [
      { startedAt: 'asc' },
      { id: 'asc' }
    ]
  });

  // A. Leaderboard chỉ lấy submission đầu tiên của mỗi học sinh
  const firstSubmissionMap = new Map();
  submissions.forEach(sub => {
    if (!firstSubmissionMap.has(sub.user.id)) {
      firstSubmissionMap.set(sub.user.id, sub);
    }
  });

  const firstSubmissions = Array.from(firstSubmissionMap.values());
  const leaderboard = firstSubmissions.map(sub => {
    let timeString = "--";
    if (sub.startedAt && sub.endTime) {
      const diffMs = new Date(sub.endTime) - new Date(sub.startedAt);
      const minutes = Math.floor(diffMs / 60000);
      timeString = `${minutes}p`;
    }
    return {
      id: sub.user.id,
      name: sub.user.name || sub.user.email || "Học sinh",
      score: sub.score || 0,
      time: timeString
    };
  }).sort((a, b) => b.score - a.score);

  // Gom nhóm tất cả câu trả lời vào một Lookup Object trước để tránh loop lồng nhau
  const answersMap = {};

  submissions.forEach(sub => {
    const studentName = sub.user.name || "No Name";
    sub.answers.forEach(ans => {
      if (!answersMap[ans.questionId]) {
        answersMap[ans.questionId] = [];
      }
      if (ans.selectedChoice) {
        answersMap[ans.questionId].push({
          choice: ans.selectedChoice,
          student: studentName
        });
      }
    });
  });

  // B. Tạo Thống kê
  const questionsReport = allQuestions.map(question => {
    const choiceKeys = ['A', 'B', 'C', 'D'];
    const statsMap = { A: [], B: [], C: [], D: [] };

    const studentAnswers = answersMap[question.id] || [];

    studentAnswers.forEach(({ choice, student }) => {
      if (statsMap[choice]) {
        statsMap[choice].push(student);
      }
    });

    const statsArray = choiceKeys.map(key => ({
      key: key,
      count: statsMap[key].length,
      students: statsMap[key]
    }));

    return {
      id: question.id,
      correctChoice: question.correctAnswer,
      stats: statsArray
    };
  });

  return {
    leaderboard,
    questions: questionsReport
  };
};
