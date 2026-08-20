const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { sendNotificationToUser } = require('./notification.service');
const { gradeQuestions } = require('../utils/grading');

exports.startOrResumeTest = async ({ testId, userId, assignmentId, classId }) => {
  if (!userId || isNaN(userId)) {
    throw new ApiError(400, { error: "Thiếu thông tin User ID (userId is missing or invalid)" });
  }

  // Lấy bài thi -> Lấy Section -> Lấy Question (Test -> Section -> Question)
  const test = await prisma.test.findUnique({
    where: { id: Number(testId) },
    include: {
      sections: {
        orderBy: { order: 'asc' }, // Sắp xếp Module 1 trước, Module 2 sau
        include: {
          questions: {
            orderBy: { order: 'asc' },
            // KHÔNG lấy trường 'correctAnswer' để tránh lộ đáp án
            select: {
              id: true,
              blocks: true,
              questionText: true,
              choices: true,
              type: true
            }
          }
        }
      }
    }
  });

  // Nếu test.sections rỗng thì do database chưa có data
  if (!test || !test.sections || test.sections.length === 0) {
    throw new ApiError(404, { error: "Đề thi này chưa có câu hỏi nào (Data rỗng)" });
  }

  let selectedClassTestId = null;
  if (!assignmentId && classId) {
    const classTest = await prisma.classTest.findFirst({
      where: { classId: classId, testId: testId },
      select: { id: true }
    });

    if (!classTest) {
      throw new ApiError(400, { error: "Bài test này không thuộc lớp đã chọn" });
    }

    selectedClassTestId = classTest.id;
  }

  // Serverless deployments can issue the same GET concurrently. A PostgreSQL
  // transaction-scoped advisory lock makes find-or-create atomic per user/test.
  const submission = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${Number(userId)}::integer, ${Number(testId)}::integer)`;

    const activeSubmission = await tx.submission.findFirst({
      where: {
        userId,
        testId,
        assignmentId,
        classTestId: selectedClassTestId,
        status: 'DOING'
      },
      orderBy: { startedAt: 'desc' }
    });

    if (activeSubmission) return activeSubmission;

    return tx.submission.create({
      data: {
        userId,
        testId,
        assignmentId,
        classTestId: selectedClassTestId,
        status: "DOING",
        startedAt: new Date(),
        timeRemaining: test.duration * 60,
        currentQuestionIndex: 0,
        savedAnswers: {}
      }
    });
  });

  // Trả về đề thi + Thông tin phiên làm bài
  return {
    ...test,
    session: {
      submissionId: submission.id,
      startedAt: submission.startedAt,
      status: submission.status,
      savedAnswers: submission.savedAnswers,
      timeLeft: submission.timeRemaining,
      currentQuestionIndex: submission.currentQuestionIndex,
      violationCount: submission.violationCount,
      // ISO timestamps are timezone-independent. Returning the server clock lets
      // the browser compensate when a student's device clock is fast or slow.
      serverTime: new Date(),
      beganAt: submission.beganAt,
      module1ExpiresAt: test.mode === 'EXAM' && submission.beganAt
        ? new Date(new Date(submission.beganAt).getTime() + test.sections[0].duration * 60 * 1000)
        : null,
      expiresAt: test.mode === 'EXAM' && submission.beganAt
        ? new Date(new Date(submission.beganAt).getTime() + test.duration * 60 * 1000)
        : null
    }
  };
};

exports.beginTest = async ({ userId, submissionId, testId }) => {
  const submission = await prisma.submission.findFirst({
    where: { id: Number(submissionId), userId, testId, status: 'DOING' },
    include: {
      test: {
        select: {
          mode: true,
          duration: true,
          sections: { orderBy: { order: 'asc' }, select: { duration: true } }
        }
      }
    }
  });

  if (!submission) throw new ApiError(404, { error: 'Không tìm thấy phiên làm bài đang hoạt động' });

  let beganAt = submission.beganAt;
  if (submission.test.mode === 'EXAM' && !beganAt) {
    const now = new Date();
    // updateMany makes this one-shot even when the start button/request is retried.
    await prisma.submission.updateMany({
      where: { id: submission.id, beganAt: null, status: 'DOING' },
      data: {
        beganAt: now,
        startedAt: now,
        timeRemaining: submission.test.duration * 60
      }
    });
    const current = await prisma.submission.findUnique({
      where: { id: submission.id }, select: { beganAt: true }
    });
    beganAt = current.beganAt;
  }

  const serverTime = new Date();
  return {
    serverTime,
    beganAt,
    module1ExpiresAt: beganAt
      ? new Date(new Date(beganAt).getTime() + (submission.test.sections[0]?.duration || 0) * 60 * 1000)
      : null,
    expiresAt: beganAt
      ? new Date(new Date(beganAt).getTime() + submission.test.duration * 60 * 1000)
      : null
  };
};

exports.saveProgress = async ({ userId, submissionId, answers, timeLeft, currentQuestionIndex, violationCount }) => {
  // Validate sở hữu: Có đúng user này đang làm bài này không?
  const submission = await prisma.submission.findFirst({
    where: { id: parseInt(submissionId), userId: userId },
    include: { test: { select: { mode: true, duration: true } } }
  });

  if (!submission) throw new ApiError(403, { message: "Không có quyền truy cập" });
  if (submission.status === 'COMPLETED') throw new ApiError(400, { message: "Bài đã nộp rồi" });

  const clientTimeLeft = Number(timeLeft);
  const authoritativeTimeLeft = submission.test.mode === 'EXAM' && submission.beganAt
    ? Math.max(0, Math.ceil(
        (new Date(submission.beganAt).getTime() + submission.test.duration * 60 * 1000 - Date.now()) / 1000
      ))
    : (Number.isFinite(clientTimeLeft) ? Math.max(0, Math.floor(clientTimeLeft)) : submission.timeRemaining);

  await prisma.submission.updateMany({
    where: { id: parseInt(submissionId), userId, status: 'DOING' },
    data: {
      savedAnswers: answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {},
      timeRemaining: authoritativeTimeLeft,
      currentQuestionIndex: Number.isInteger(Number(currentQuestionIndex))
        ? Math.max(0, Number(currentQuestionIndex))
        : submission.currentQuestionIndex,
      violationCount: Number.isFinite(Number(violationCount))
        ? Math.max(0, Number(violationCount))
        : submission.violationCount,
    }
  });
};

exports.submitTest = async ({ userId, submissionId, answers, violationCount, testId, assignmentId, classId }) => {
  console.log(`📥 Đang chấm bài Test ID: ${testId} cho User ID: ${userId}`);

  if (!userId) {
    throw new ApiError(400, { error: "Thiếu thông tin User ID (Bạn chưa đăng nhập?)" });
  }

  let expectedClassTestId;
  if (!assignmentId && classId) {
    const classTest = await prisma.classTest.findFirst({
      where: { classId, testId },
      select: { id: true }
    });
    if (!classTest) throw new ApiError(400, { error: "Bài test này không thuộc lớp đã chọn" });
    expectedClassTestId = classTest.id;
  }

  const submission = await prisma.submission.findFirst({
    where: {
      id: Number(submissionId),
      userId: userId,
      testId: testId,
      assignmentId: assignmentId,
      ...(expectedClassTestId !== undefined ? { classTestId: expectedClassTestId } : {})
    }
  });

  if (!submission) {
    throw new ApiError(400, { error: "Không tìm thấy phiên làm bài hoặc bạn không có quyền nộp bài này" });
  }

  // 1. Lấy đề thi từ DB để so sánh đáp án
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      sections: { include: { questions: true } },
      author: true
    }
  });

  if (!test) throw new ApiError(404, { error: "Không tìm thấy đề thi" });

  // If Vercel/the browser retries a completed request, grade from the answers
  // already committed instead of rejecting the retry or overwriting the result.
  const submittedAnswers = submission.status === 'COMPLETED'
    ? submission.savedAnswers
    : answers;
  const allQuestions = test.sections.flatMap(section => section.questions);
  let {
    correctCount,
    totalQuestions,
    answerRows: answersToSave,
    details: responseDetails
  } = gradeQuestions(allQuestions, submittedAnswers);

  console.log(`Kết quả: ${correctCount}/${totalQuestions}`);

  const safeViolationCount = Number.isFinite(Number(violationCount))
    ? Math.max(0, Number(violationCount))
    : submission.violationCount;
  const safeAnswers = submittedAnswers && typeof submittedAnswers === 'object' && !Array.isArray(submittedAnswers)
    ? submittedAnswers
    : {};

  const transactionResult = await prisma.$transaction(async (tx) => {
    // Claim the submission atomically. Concurrent double-clicks/retries can no
    // longer insert a second set of Answer rows or change an existing score.
    const claim = await tx.submission.updateMany({
      where: { id: submission.id, userId, status: 'DOING' },
      data: {
        status: "COMPLETED",
        score: correctCount,
        violationCount: safeViolationCount,
        endTime: new Date(),
        savedAnswers: safeAnswers
      }
    });

    if (claim.count === 0) {
      return {
        submission: await tx.submission.findUnique({ where: { id: submission.id } }),
        didSubmit: false
      };
    }

    const updatedSubmission = await tx.submission.findUnique({ where: { id: submission.id } });

    // Nếu học sinh làm từ Practice Center theo lớp, tự động cập nhật các assignment chưa có dữ liệu
    if (!assignmentId && classId) {
      const classAssignments = await tx.assignment.findMany({
        where: { classId: classId },
        select: { id: true, testIds: true }
      });

      const assignmentIdsToSync = classAssignments
        .filter(item => (item.testIds || []).includes(testId))
        .map(item => item.id);

      if (assignmentIdsToSync.length > 0) {
        const existedSubmissions = await tx.submission.findMany({
          where: {
            userId: userId,
            testId: testId,
            assignmentId: { in: assignmentIdsToSync }
          },
          select: { assignmentId: true }
        });

        const existedAssignmentIds = new Set(
          existedSubmissions
            .map(item => item.assignmentId)
            .filter(id => !!id)
        );

        const pendingAssignmentIds = assignmentIdsToSync.filter(id => !existedAssignmentIds.has(id));

        for (const pendingAssignmentId of pendingAssignmentIds) {
          const clonedSubmission = await tx.submission.create({
            data: {
              userId: userId,
              testId: testId,
              assignmentId: pendingAssignmentId,
              classTestId: submission.classTestId,
              endTime: new Date(),
              score: correctCount,
              violationCount: safeViolationCount,
              startedAt: submission.startedAt,
              currentQuestionIndex: submission.currentQuestionIndex,
              savedAnswers: safeAnswers,
              timeRemaining: submission.timeRemaining,
              status: "COMPLETED"
            }
          });

          if (answersToSave.length > 0) {
            await tx.answer.createMany({
              data: answersToSave.map(item => ({
                submissionId: clonedSubmission.id,
                questionId: item.questionId,
                selectedChoice: item.selectedChoice,
                isCorrect: item.isCorrect
              }))
            });
          }
        }
      }
    }

    // B. Lưu chi tiết từng câu trả lời vào bảng Answer
    if (answersToSave.length > 0) {
      await tx.answer.deleteMany({ where: { submissionId: submission.id } });
      await tx.answer.createMany({
        data: answersToSave.map(item => ({
          submissionId: submission.id,
          questionId: item.questionId,
          selectedChoice: item.selectedChoice,
          isCorrect: item.isCorrect
        }))
      });
    }

    return { submission: updatedSubmission, didSubmit: true };
  });

  if (!transactionResult.didSubmit) {
    const committedGrade = gradeQuestions(allQuestions, transactionResult.submission?.savedAnswers);
    correctCount = committedGrade.correctCount;
    totalQuestions = committedGrade.totalQuestions;
    responseDetails = committedGrade.details;
  }

  if (transactionResult.didSubmit && test.mode === 'EXAM' && test.authorId) {
    try {
      const studentInfo = await prisma.user.findUnique({ where: { id: userId } });
      await sendNotificationToUser(
        test.authorId,
        `Học sinh ${studentInfo?.name || studentInfo?.email} vừa hoàn thành bài thi "${test.title}" với số điểm ${correctCount}/${totalQuestions}.`,
      );
    } catch (error) {
      // The grade is already committed. A notification outage must not turn a
      // successful submission into a 500 response that encourages resubmits.
      console.error('Không thể gửi thông báo sau khi nộp bài:', error);
    }
  }

  return {
    score: correctCount,
    total: totalQuestions,
    totalQuestions,
    submissionId: transactionResult.submission.id,
    details: responseDetails,
    message: "Nộp bài và lưu kết quả thành công"
  };
};
