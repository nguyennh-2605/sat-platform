const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { sendNotificationToUser } = require('./notification.service');

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

  let submission = await prisma.submission.findFirst({
    where: {
      userId: userId,
      testId: testId,
      assignmentId: assignmentId,
      classTestId: selectedClassTestId,
      status: 'DOING'
    },
    orderBy: { startedAt: 'desc' }
  });

  if (!submission) {
    const justCreatedSubmission = await prisma.submission.findFirst({
      where: {
        userId: userId,
        testId: testId,
        assignmentId: assignmentId,
        classTestId: selectedClassTestId,
        startedAt: {
          gte: new Date(Date.now() - 5000) // Lấy bài tạo trong 5s gần nhất
        }
      }
    });

    if (justCreatedSubmission) {
      submission = justCreatedSubmission;
      console.log("Phát hiện Duplicate Request: Dùng lại bài vừa tạo.");
    }
  }

  if (submission && test.mode === 'EXAM') {
    const now = new Date();
    const startedAt = new Date(submission.startedAt);
    const durationMs = test.duration * 60 * 1000;
    const expireTime = new Date(startedAt.getTime() + durationMs + (5 * 60 * 1000));

    if (now > expireTime) {
      console.log(`Bài thi ID ${submission.id} đã quá hạn nhưng chưa nộp. Đang đóng lại để tạo bài mới...`);
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          endTime: new Date(),
          score: 0,
          status: "COMPLETED"
        }
      });
      submission = null
    }
  }

  // Nếu chưa có bài làm tạo mới ngay lập tức
  if (!submission) {
    submission = await prisma.submission.create({
      data: {
        userId: userId,
        testId: testId,
        assignmentId: assignmentId,
        classTestId: selectedClassTestId,
        status: "DOING",
        startedAt: new Date(),
        timeRemaining: test.duration * 60,
        currentQuestionIndex: 0,
        savedAnswers: {}
      }
    });
  }

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
      violationCount: submission.violationCount
    }
  };
};

exports.saveProgress = async ({ userId, submissionId, answers, timeLeft, currentQuestionIndex, violationCount }) => {
  // Validate sở hữu: Có đúng user này đang làm bài này không?
  const submission = await prisma.submission.findFirst({
    where: { id: parseInt(submissionId), userId: userId }
  });

  if (!submission) throw new ApiError(403, { message: "Không có quyền truy cập" });
  if (submission.status === 'COMPLETED') throw new ApiError(400, { message: "Bài đã nộp rồi" });

  await prisma.submission.update({
    where: { id: parseInt(submissionId) },
    data: {
      savedAnswers: answers,
      timeRemaining: timeLeft,
      currentQuestionIndex: currentQuestionIndex,
      violationCount: violationCount,
    }
  });
};

exports.submitTest = async ({ userId, submissionId, answers, violationCount, testId, assignmentId, classId }) => {
  console.log(`📥 Đang chấm bài Test ID: ${testId} cho User ID: ${userId}`);

  if (!userId) {
    throw new ApiError(400, { error: "Thiếu thông tin User ID (Bạn chưa đăng nhập?)" });
  }

  const submission = await prisma.submission.findFirst({
    where: {
      id: Number(submissionId),
      userId: userId,
      testId: testId,
      assignmentId: assignmentId
    }
  });

  if (!submission) {
    throw new ApiError(400, { error: "Không tìm thấy phiên làm bài hoặc bạn không có quyền nộp bài này" });
  }

  if (submission.status == 'COMPLETED') {
    throw new ApiError(400, { error: "Bài thi này đã nộp!" });
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

  // 2. Tính điểm & Chuẩn bị dữ liệu chi tiết từng câu trả lời
  let correctCount = 0;
  let totalQuestions = 0;

  const answersToSave = [];
  const responseDetails = [];

  test.sections.forEach(section => {
    section.questions.forEach(question => {
      totalQuestions++;

      const userChoiceId = answers[String(question.id)];
      const correctChoiceId = question.correctAnswer;

      const isCorrect = userChoiceId === correctChoiceId;

      if (isCorrect) {
        correctCount++;
      }

      answersToSave.push({
        questionId: question.id,
        selectedChoice: userChoiceId || null,
        isCorrect: isCorrect
      });
      responseDetails.push({
        questionId: question.id,
        isCorrect: isCorrect,
        userSelected: userChoiceId || null,
        correctOption: correctChoiceId
      });
    });
  });

  console.log(`Kết quả: ${correctCount}/${totalQuestions}`);

  const result = await prisma.$transaction(async (prisma) => {
    // A. Cập nhật Submission
    const updatedSubmission = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "COMPLETED",
        score: correctCount,
        violationCount: Number(violationCount),
        endTime: new Date(),
        savedAnswers: answers
      }
    });

    // Nếu học sinh làm từ Practice Center theo lớp, tự động cập nhật các assignment chưa có dữ liệu
    if (!assignmentId && classId) {
      const classAssignments = await prisma.assignment.findMany({
        where: { classId: classId },
        select: { id: true, testIds: true }
      });

      const assignmentIdsToSync = classAssignments
        .filter(item => (item.testIds || []).includes(testId))
        .map(item => item.id);

      if (assignmentIdsToSync.length > 0) {
        const existedSubmissions = await prisma.submission.findMany({
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
          const clonedSubmission = await prisma.submission.create({
            data: {
              userId: userId,
              testId: testId,
              assignmentId: pendingAssignmentId,
              classTestId: submission.classTestId,
              endTime: new Date(),
              score: correctCount,
              violationCount: Number(violationCount),
              startedAt: submission.startedAt,
              currentQuestionIndex: submission.currentQuestionIndex,
              savedAnswers: answers,
              timeRemaining: submission.timeRemaining,
              status: "COMPLETED"
            }
          });

          if (answersToSave.length > 0) {
            await prisma.answer.createMany({
              data: answersToSave.map(item => ({
                submissionId: clonedSubmission.id,
                questionId: item.questionId,
                selectedChoice: item.selectedChoice
              }))
            });
          }
        }
      }
    }

    // B. Lưu chi tiết từng câu trả lời vào bảng Answer
    if (answersToSave.length > 0) {
      await prisma.answer.createMany({
        data: answersToSave.map(item => ({
          submissionId: submission.id,
          questionId: item.questionId,
          selectedChoice: item.selectedChoice
        }))
      });
    }

    return updatedSubmission;
  });

  if (test.mode === 'EXAM' && test.authorId) {
    const studentInfo = await prisma.user.findUnique({ where: { id: userId } });

    await sendNotificationToUser(
      test.authorId,
      `Học sinh ${studentInfo?.name || studentInfo?.email} vừa hoàn thành bài thi "${test.title}" với số điểm ${correctCount}/${totalQuestions}.`,
    );
  }

  return {
    score: correctCount,
    total: totalQuestions,
    submissionId: result.id,
    details: responseDetails,
    message: "Nộp bài và lưu kết quả thành công"
  };
};
