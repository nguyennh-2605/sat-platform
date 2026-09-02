const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const testDeliveryService = require('./test-delivery.service');
const { sendNotificationToUser } = require('./notification.service');
const { CLASS_COLORS, normalizeClassName, resolveAssignmentType, isAllowedClassColor, canManageClass } = require('../utils/classroom');
const { AUDIT_ACTIONS, recordAuditEvent } = require('./audit-event.service');
const classAnnouncementService = require('./class-announcement.service');

const parseUserId = (userId) => parseInt(userId, 10);

const assertClassMember = async ({ classId, userId, userRole }) => {
  const currentUserId = parseUserId(userId);

  if (!currentUserId) {
    throw new ApiError(401, { error: 'User information is unavailable.' });
  }

  const classroom = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      students: { select: { id: true } }
    }
  });

  if (!classroom) {
    throw new ApiError(404, { error: 'Class not found.' });
  }

  const isTeacher = classroom.teacherId === currentUserId;
  const isStudent = classroom.students.some(student => student.id === currentUserId);

  if (userRole !== 'ADMIN' && !isTeacher && !isStudent) {
    throw new ApiError(403, { error: 'You do not have permission to access this class.' });
  }

  return classroom;
};

const assertClassTeacher = async ({ classId, userId, userRole }) => {
  const currentUserId = parseUserId(userId);

  if (!currentUserId) {
    throw new ApiError(401, { error: 'User information is unavailable.' });
  }

  const classroom = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      students: { select: { id: true } }
    }
  });

  if (!classroom) {
    throw new ApiError(404, { error: 'Class not found.' });
  }

  if (!canManageClass({ teacherId: classroom.teacherId, userId: currentUserId, userRole })) {
    throw new ApiError(403, { error: 'You do not have permission to manage this class.' });
  }

  return classroom;
};

const classSummarySelect = {
  id: true,
  name: true,
  color: true,
  createdAt: true,
  teacherId: true,
  teacher: { select: { id: true, name: true, email: true } },
  _count: { select: { students: true } },
};

const toClassSummary = (classroom, currentUserId, userRole) => ({
  id: classroom.id,
  name: classroom.name,
  color: classroom.color,
  createdAt: classroom.createdAt,
  teacher: classroom.teacher,
  studentCount: classroom._count.students,
  canManage: canManageClass({ teacherId: classroom.teacherId, userId: currentUserId, userRole }),
});

const enrichClassSummaries = ({ summaries, dueActivities, activityUpdates, announcementUpdates }) => {
  const dueByClass = new Map();
  for (const activity of dueActivities) {
    const items = dueByClass.get(activity.classId) || [];
    items.push(activity);
    dueByClass.set(activity.classId, items);
  }
  const activityUpdatedByClass = new Map(activityUpdates.map(item => [item.classId, item._max.updatedAt]));
  const announcementUpdatedByClass = new Map(announcementUpdates.map(item => [item.classId, item._max.updatedAt]));
  return summaries.map(classroom => {
    const upcoming = dueByClass.get(classroom.id) || [];
    const updateDates = [activityUpdatedByClass.get(classroom.id), announcementUpdatedByClass.get(classroom.id)].filter(Boolean);
    return {
      ...classroom,
      dueInNext7DaysCount: upcoming.length,
      nextActivity: upcoming[0] ? {
        id: upcoming[0].id,
        type: upcoming[0].type,
        title: upcoming[0].title,
        dueAt: upcoming[0].dueAt,
      } : null,
      lastContentUpdateAt: updateDates.length ? new Date(Math.max(...updateDates.map(value => new Date(value).getTime()))) : null,
    };
  });
};

exports.enrichClassSummaries = enrichClassSummaries;

exports.createClass = async ({ name, color, userId, userRole }) => {
  // Validation: Chỉ giáo viên mới được tạo lớp
  if (userRole !== 'TEACHER' && userRole !== 'ADMIN') {
    throw new ApiError(403, { error: 'You do not have permission to create classes.' });
  }

  const normalizedName = normalizeClassName(name);
  const normalizedColor = String(color || CLASS_COLORS[0]).toUpperCase();
  if (!normalizedName) throw new ApiError(400, { error: 'Class name is required.' });
  if (normalizedName.length > 100) throw new ApiError(400, { error: 'Class name must be 100 characters or fewer.' });
  if (!isAllowedClassColor(normalizedColor)) throw new ApiError(400, { error: 'Choose a valid class color.' });

  return prisma.$transaction(async tx => {
    const classroom = await tx.class.create({
      data: {
        name: normalizedName,
        color: normalizedColor,
        teacherId: parseUserId(userId),
      },
    });
    await recordAuditEvent(tx, {
      action: AUDIT_ACTIONS.CLASS_CREATED,
      actorUserId: userId,
      actorRole: userRole,
      entityType: 'CLASS',
      entityId: classroom.id,
      entityLabel: classroom.name,
    });
    return classroom;
  });
};

exports.getMyClasses = async ({ userId, userRole }) => {
  if (!userId) {
    throw new ApiError(401, { error: 'Sign in to view your classes.' });
  }

  const currentUserId = parseUserId(userId);
  const canOwnClasses = userRole === 'TEACHER' || userRole === 'ADMIN';
  const classes = await prisma.class.findMany({
    where: canOwnClasses
      ? { teacherId: currentUserId }
      : { students: { some: { id: currentUserId } } },
    orderBy: { createdAt: 'desc' },
    select: classSummarySelect,
  });
  const summaries = classes.map(classroom => toClassSummary(classroom, currentUserId, userRole));
  if (!summaries.length) return summaries;

  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const classIds = summaries.map(classroom => classroom.id);
  const studentActivityScope = userRole === 'STUDENT'
    ? { assignees: { some: { studentId: currentUserId, excusedAt: null } } }
    : {};
  const [dueActivities, activityUpdates, announcementUpdates] = await Promise.all([
    prisma.classActivity.findMany({
      where: { classId: { in: classIds }, status: 'PUBLISHED', dueAt: { gte: now, lte: horizon }, ...studentActivityScope },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, classId: true, type: true, title: true, dueAt: true },
    }),
    prisma.classActivity.groupBy({
      by: ['classId'],
      where: { classId: { in: classIds }, status: 'PUBLISHED', ...studentActivityScope },
      _max: { updatedAt: true },
    }),
    prisma.classAnnouncement.groupBy({
      by: ['classId'], where: { classId: { in: classIds } }, _max: { updatedAt: true },
    }),
  ]);
  return enrichClassSummaries({ summaries, dueActivities, activityUpdates, announcementUpdates });
};

exports.updateClass = async ({ classId, name, color, userId, userRole }) => {
  await assertClassTeacher({ classId, userId, userRole });
  const data = {};

  if (name !== undefined) {
    const normalizedName = normalizeClassName(name);
    if (!normalizedName) throw new ApiError(400, { error: 'Class name is required.' });
    if (normalizedName.length > 100) throw new ApiError(400, { error: 'Class name must be 100 characters or fewer.' });
    data.name = normalizedName;
  }
  if (color !== undefined) {
    const normalizedColor = String(color).toUpperCase();
    if (!isAllowedClassColor(normalizedColor)) throw new ApiError(400, { error: 'Choose a valid class color.' });
    data.color = normalizedColor;
  }
  if (Object.keys(data).length === 0) throw new ApiError(400, { error: 'There are no changes to save.' });

  const classroom = await prisma.class.update({ where: { id: classId }, data, select: classSummarySelect });
  return toClassSummary(classroom, parseUserId(userId), userRole);
};

exports.deleteClass = async ({ classId, userId, userRole }) => {
  const classroom = await assertClassTeacher({ classId, userId, userRole });
  await prisma.$transaction(async tx => {
    await tx.class.delete({ where: { id: classId } });
    await recordAuditEvent(tx, {
      action: AUDIT_ACTIONS.CLASS_DELETED,
      actorUserId: userId,
      actorRole: userRole,
      entityType: 'CLASS',
      entityId: classroom.id,
      entityLabel: classroom.name,
    });
  });
  return { message: 'Class deleted successfully.' };
};

exports.getClassDetail = async ({ id, userId, userRole }) => {
  await assertClassMember({ classId: id, userId, userRole });

  const currentUserId = parseUserId(userId);
  const classDetail = await prisma.class.findUnique({
    where: { id: id },
    include: {
      teacher: {
        select: { id: true, name: true, email: true, createdAt: true }
      },
      students: {
        select: { id: true, name: true, email: true, avatar: true, createdAt: true }
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

exports.addStudentToClass = async ({ classId, email, currentUserId, userRole = 'TEACHER' }) => {
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

  await prisma.$transaction(async tx => {
    await tx.class.update({
      where: { id: classId },
      data: { students: { connect: { id: student.id } } },
    });

    const activeDeliveries = await tx.testDelivery.findMany({
      where: { classId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (activeDeliveries.length > 0) {
      await tx.deliveryAssignee.createMany({
        data: activeDeliveries.map(delivery => ({ deliveryId: delivery.id, studentId: student.id })),
        skipDuplicates: true,
      });
    }

    const activeActivities = await tx.classActivity.findMany({
      where: { classId, status: 'PUBLISHED', audience: 'ALL_STUDENTS' },
      select: { id: true },
    });
    if (activeActivities.length > 0) {
      await tx.activityAssignee.createMany({
        data: activeActivities.map(activity => ({ activityId: activity.id, studentId: student.id })),
        skipDuplicates: true,
      });
    }

    await recordAuditEvent(tx, {
      action: AUDIT_ACTIONS.CLASS_STUDENT_ADDED,
      actorUserId: currentUserId,
      actorRole: userRole,
      entityType: 'CLASS',
      entityId: existingClass.id,
      entityLabel: existingClass.name,
      metadata: { memberLabel: student.name || 'Student' },
    });
  });

  await sendNotificationToUser(
    student.id,
    `Bạn vừa được giáo viên thêm vào lớp học "${existingClass.name}".`,
    `/dashboard/class/${classId}`
  )

  return { message: "Thêm học sinh thành công", student: student };
};

exports.removeStudentFromClass = async ({ classId, studentId, currentUserId, userRole }) => {
  const classroom = await assertClassTeacher({ classId, userId: currentUserId, userRole });

  const student = await prisma.user.findFirst({
    where: {
      id: parseUserId(studentId),
      studyingClasses: { some: { id: classId } },
    },
    select: { id: true, name: true, email: true },
  });

  if (!student) {
    throw new ApiError(404, { error: 'This student is not enrolled in the class.' });
  }

  await prisma.$transaction(async tx => {
    await tx.class.update({
      where: { id: classId },
      data: { students: { disconnect: { id: student.id } } },
    });
    await tx.deliveryAssignee.updateMany({
      where: { studentId: student.id, delivery: { classId } },
      data: { excusedAt: new Date() },
    });
    await tx.activityAssignee.updateMany({
      where: { studentId: student.id, activity: { classId } },
      data: { status: 'EXCUSED', excusedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      action: AUDIT_ACTIONS.CLASS_STUDENT_REMOVED,
      actorUserId: currentUserId,
      actorRole: userRole,
      entityType: 'CLASS',
      entityId: classroom.id,
      entityLabel: classroom.name,
      metadata: { memberLabel: student.name || 'Student' },
    });
  });

  return { message: 'Student removed from class.', student };
};

exports.createAssignment = async ({ title, content, type, deadline, classId, driveFiles, externalLinks, testIds, currentUserId, userRole }) => {
  // Validate cơ bản
  if (!classId || !title) {
    throw new ApiError(400, { error: "Thiếu thông tin classId hoặc title" });
  }

  const classData = await assertClassTeacher({ classId, userId: currentUserId, userRole });
  // A post with a due date is always actionable coursework, even if an older
  // client still sends the default announcement type.
    const assignmentType = resolveAssignmentType({ type, deadline });
    if (assignmentType === 'announcement') {
      return classAnnouncementService.create({
        classId, userId: currentUserId, userRole,
        data: { title, content, fileUrls: driveFiles || [], links: externalLinks || [] },
      });
    }

  const newAssignment = await prisma.assignment.create({
    data: {
      title,
      type: assignmentType,
      content: content,
      deadline: (assignmentType === 'assignment' && deadline) ? new Date(deadline) : null,
      fileUrls: driveFiles || [],
      links: externalLinks || [],
      testIds: Array.isArray(testIds) ? testIds : [],
      classId: classId
    }
  });

  if (newAssignment.testIds.length > 0) {
    try {
      await testDeliveryService.syncClassAssignmentDeliveries({
        assignment: newAssignment,
        userId: currentUserId,
        userRole,
      });
    } catch (error) {
      await prisma.assignment.delete({ where: { id: newAssignment.id } });
      throw error;
    }
  }

  if (assignmentType === 'assignment') {
    const canonicalActivity = await prisma.classActivity.create({
      data: {
        type: 'HOMEWORK',
        status: 'PUBLISHED',
        classId,
        title: newAssignment.title,
        instructions: newAssignment.content,
        dueAt: newAssignment.deadline,
        maxAttempts: 1,
        scorePolicy: 'FIRST',
        completionRule: 'SUBMIT',
        audience: 'ALL_STUDENTS',
        createdById: Number.parseInt(currentUserId, 10),
        assignees: { create: classData.students.map(student => ({ studentId: student.id })) },
      },
      select: { id: true },
    });
    await prisma.$executeRaw`INSERT INTO "HomeworkActivity" ("activityId", "assignmentId") VALUES (${canonicalActivity.id}, ${newAssignment.id}) ON CONFLICT ("activityId") DO NOTHING`;
  }

  if (classData && classData.students.length > 0) {
    const teacherName = classData.teacher?.name || 'Giáo viên';
    const notifMessage = assignmentType === 'assignment'
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
        activity: { include: { activity: { include: { assignees: { where: { studentId: currentStudentId, excusedAt: null }, select: { studentId: true }, take: 1 } } } } },
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
    const activityAvailable = !assignmentInfo.activity || (assignmentInfo.activity.activity.status === 'PUBLISHED'
      && (!assignmentInfo.activity.activity.availableAt || assignmentInfo.activity.activity.availableAt <= new Date())
      && assignmentInfo.activity.activity.assignees.length > 0);

    if (!isEnrolledStudent || !activityAvailable) {
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

  const [homeworkActivity] = await prisma.$queryRaw`SELECT "activityId" FROM "HomeworkActivity" WHERE "assignmentId" = ${assignmentId} LIMIT 1`;
  if (homeworkActivity) {
    await prisma.activityAssignee.updateMany({
      where: { activityId: homeworkActivity.activityId, studentId: currentStudentId },
      data: { status: 'COMPLETED', startedAt: submission.submittedAt, completedAt: submission.submittedAt, attemptCount: 1 },
    });
  }

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
