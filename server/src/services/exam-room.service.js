const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { sendNotificationToUser } = require('./notification.service');
const { gradeQuestions } = require('../utils/grading');
const testDeliveryService = require('./test-delivery.service');
const errorLogService = require('./error-log.service');
const { normalizeQuestionTimingSnapshot, timingRowsFromSnapshot } = require('../utils/question-timing');
const { allocateModuleDurations, moduleTiming } = require('../utils/module-timing');

const orderedSections = sections => [...(sections || [])].sort((a, b) => a.order - b.order);

const examTimingPayload = ({ submission, test, serverTime = new Date() }) => {
  const sections = orderedSections(test.sections);
  const durations = allocateModuleDurations(test.duration, sections.length);
  const currentModule = Math.min(Math.max(Number(submission.currentModule) || 1, 1), sections.length);
  const moduleExpiresAt = submission.moduleExpiresAt || null;
  return {
    serverTime,
    currentModule,
    totalModules: sections.length,
    moduleDuration: durations[currentModule - 1],
    moduleStartedAt: submission.moduleStartedAt || null,
    moduleExpiresAt,
    timeLeft: test.mode === 'EXAM' && moduleExpiresAt
      ? Math.max(0, Math.ceil((new Date(moduleExpiresAt).getTime() - serverTime.getTime()) / 1000))
      : submission.timeRemaining,
  };
};

const reconcileExamModule = async ({ submission, test, now = new Date(), db = prisma }) => {
  if (test.mode !== 'EXAM' || !submission.beganAt) return submission;
  const sections = orderedSections(test.sections);
  const durations = allocateModuleDurations(test.duration, sections.length);
  let currentModule = Math.min(Math.max(Number(submission.currentModule) || 1, 1), sections.length);
  let moduleStartedAt = submission.moduleStartedAt ? new Date(submission.moduleStartedAt) : null;
  let moduleExpiresAt = submission.moduleExpiresAt ? new Date(submission.moduleExpiresAt) : null;

  if (!moduleStartedAt || !moduleExpiresAt) {
    if (currentModule === 1) {
      moduleStartedAt = new Date(submission.beganAt);
      moduleExpiresAt = new Date(moduleStartedAt.getTime() + durations[0] * 60 * 1000);
    } else {
      moduleStartedAt = new Date(new Date(submission.beganAt).getTime() + durations[0] * 60 * 1000);
      moduleExpiresAt = new Date(moduleStartedAt.getTime() + durations[1] * 60 * 1000);
    }
  }

  let currentQuestionIndex = submission.currentQuestionIndex;
  if (currentModule === 1 && sections.length > 1 && now >= moduleExpiresAt) {
    currentModule = 2;
    moduleStartedAt = moduleExpiresAt;
    moduleExpiresAt = new Date(moduleStartedAt.getTime() + durations[1] * 60 * 1000);
    currentQuestionIndex = sections[0].questions?.length || 0;
  }

  const timeRemaining = Math.max(0, Math.ceil((moduleExpiresAt.getTime() - now.getTime()) / 1000));
  const changed = currentModule !== submission.currentModule
    || currentQuestionIndex !== submission.currentQuestionIndex
    || !submission.moduleStartedAt
    || !submission.moduleExpiresAt
    || submission.timeRemaining !== timeRemaining;
  if (!changed) return submission;

  return db.submission.update({
    where: { id: submission.id },
    data: { currentModule, currentQuestionIndex, moduleStartedAt, moduleExpiresAt, timeRemaining },
  });
};

exports.startOrResumeTest = async ({ testId, userId, userRole, assignmentId, classId, deliveryId }) => {
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

  if (userRole === 'TEACHER' && test.authorId !== userId) {
    throw new ApiError(403, { error: 'Bạn không có quyền truy cập đề thi này' });
  }

  if (userRole === 'STUDENT') {
    const isSystemPublishedTest = test.scope === 'SYSTEM' && test.status === 'PUBLISHED';
    let hasClassAccess = false;

    if (deliveryId) {
      await testDeliveryService.assertStudentDeliveryAccess({ deliveryId, testId, userId });
      hasClassAccess = true;
    } else if (assignmentId) {
      const assignment = await prisma.assignment.findFirst({
        where: {
          id: assignmentId,
          testIds: { has: testId },
          class: { students: { some: { id: userId } } }
        },
        select: { id: true }
      });
      hasClassAccess = !!assignment;
    } else if (classId) {
      const classTestAccess = await prisma.classTest.findFirst({
        where: {
          classId,
          testId,
          isHidden: false,
          class: { students: { some: { id: userId } } }
        },
        select: { id: true }
      });
      hasClassAccess = !!classTestAccess;
    }

    if (!isSystemPublishedTest && !hasClassAccess) {
      throw new ApiError(403, { error: 'Đề thi này chưa được giao cho lớp của bạn' });
    }
  }

  let selectedClassTestId = null;
  let selectedDelivery = null;
  if (deliveryId) {
    selectedDelivery = await prisma.testDelivery.findUnique({ where: { id: String(deliveryId) } });
    if (!selectedDelivery || selectedDelivery.testId !== Number(testId)) {
      throw new ApiError(400, { error: 'The assigned test does not match this test.' });
    }
    selectedClassTestId = selectedDelivery.legacyClassTestId;
  } else if (!assignmentId && classId) {
    const classTest = await prisma.classTest.findFirst({
      where: {
        classId: classId,
        testId: testId,
        ...(userRole === 'STUDENT' ? {
          isHidden: false,
          class: { students: { some: { id: userId } } }
        } : {})
      },
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
    // pg_advisory_xact_lock returns PostgreSQL's `void` type. Use executeRaw
    // because this statement is only for synchronization and has no result set
    // for Prisma to deserialize.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${Number(userId)}::integer, ${Number(testId)}::integer)`;

    const activeSubmission = await tx.submission.findFirst({
      where: {
        userId,
        testId,
        ...(deliveryId
          ? { deliveryId: String(deliveryId) }
          : { assignmentId, classTestId: selectedClassTestId }),
        status: 'DOING'
      },
      orderBy: { startedAt: 'desc' }
    });

    if (activeSubmission) return activeSubmission;

    let attemptNo = 1;
    if (deliveryId) {
      const priorAttempts = await tx.submission.findMany({
        where: { userId, deliveryId: String(deliveryId) },
        orderBy: { attemptNo: 'desc' },
        select: { id: true, attemptNo: true, status: true },
      });
      const completedAttempts = priorAttempts.filter(item => item.status === 'COMPLETED').length;
      if (completedAttempts >= selectedDelivery.maxAttempts) {
        const latestCompleted = priorAttempts.find(item => item.status === 'COMPLETED');
        throw new ApiError(409, {
          code: 'ATTEMPT_LIMIT_REACHED',
          error: 'You have used all attempts for this assignment.',
          submissionId: latestCompleted?.id || null,
        });
      }
      attemptNo = priorAttempts.reduce((highest, item) => Math.max(highest, item.attemptNo), 0) + 1;
    }

    const firstModuleDuration = allocateModuleDurations(test.duration, test.sections.length)[0];
    return tx.submission.create({
      data: {
        userId,
        testId,
        assignmentId,
        classTestId: selectedClassTestId,
        deliveryId: deliveryId ? String(deliveryId) : null,
        attemptNo,
        status: "DOING",
        startedAt: new Date(),
        timeRemaining: firstModuleDuration * 60,
        currentModule: 1,
        currentQuestionIndex: 0,
        savedAnswers: {}
      }
    });
  });

  const serverTime = new Date();
  const reconciledSubmission = await reconcileExamModule({ submission, test, now: serverTime });
  const timing = examTimingPayload({ submission: reconciledSubmission, test, serverTime });

  // Trả về đề thi + Thông tin phiên làm bài
  return {
    ...test,
    session: {
      submissionId: reconciledSubmission.id,
      startedAt: reconciledSubmission.startedAt,
      status: reconciledSubmission.status,
      savedAnswers: reconciledSubmission.savedAnswers,
      timeLeft: timing.timeLeft,
      currentModule: timing.currentModule,
      totalModules: timing.totalModules,
      moduleDuration: timing.moduleDuration,
      moduleStartedAt: timing.moduleStartedAt,
      moduleExpiresAt: timing.moduleExpiresAt,
      currentQuestionIndex: reconciledSubmission.currentQuestionIndex,
      questionTimingSnapshot: reconciledSubmission.questionTimingSnapshot || {},
      violationCount: reconciledSubmission.violationCount,
      // ISO timestamps are timezone-independent. Returning the server clock lets
      // the browser compensate when a student's device clock is fast or slow.
      serverTime,
      beganAt: reconciledSubmission.beganAt,
      module1ExpiresAt: test.mode === 'EXAM' && reconciledSubmission.beganAt
        ? new Date(new Date(reconciledSubmission.beganAt).getTime() + allocateModuleDurations(test.duration, test.sections.length)[0] * 60 * 1000)
        : null,
      expiresAt: test.mode === 'EXAM' && reconciledSubmission.beganAt
        ? new Date(new Date(reconciledSubmission.beganAt).getTime() + test.duration * 60 * 1000)
        : null,
      delivery: selectedDelivery ? {
        id: selectedDelivery.id,
        dueAt: selectedDelivery.dueAt,
        maxAttempts: selectedDelivery.maxAttempts,
        scorePolicy: selectedDelivery.scorePolicy,
      } : null,
    },
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
          sections: { orderBy: { order: 'asc' }, select: { order: true, duration: true, questions: { select: { id: true } } } }
        }
      }
    }
  });

  if (!submission) throw new ApiError(404, { error: 'Không tìm thấy phiên làm bài đang hoạt động' });

  let beganAt = submission.beganAt;
  if (submission.test.mode === 'EXAM' && !beganAt) {
    const now = new Date();
    const firstDuration = allocateModuleDurations(submission.test.duration, submission.test.sections.length)[0];
    // updateMany makes this one-shot even when the start button/request is retried.
    await prisma.submission.updateMany({
      where: { id: submission.id, beganAt: null, status: 'DOING' },
      data: {
        beganAt: now,
        startedAt: now,
        currentModule: 1,
        moduleStartedAt: now,
        moduleExpiresAt: new Date(now.getTime() + firstDuration * 60 * 1000),
        timeRemaining: firstDuration * 60
      }
    });
    const current = await prisma.submission.findUnique({ where: { id: submission.id } });
    beganAt = current.beganAt;
    Object.assign(submission, current);
  }

  const serverTime = new Date();
  const reconciled = await reconcileExamModule({ submission, test: submission.test, now: serverTime });
  return { ...examTimingPayload({ submission: reconciled, test: submission.test, serverTime }), beganAt };
};

exports.advanceModule = async ({ userId, submissionId, testId }) => {
  const submission = await prisma.submission.findFirst({
    where: { id: Number(submissionId), userId, testId, status: 'DOING' },
    include: {
      test: {
        select: {
          mode: true,
          duration: true,
          sections: { orderBy: { order: 'asc' }, select: { order: true, questions: { select: { id: true } } } },
        },
      },
    },
  });
  if (!submission) throw new ApiError(404, { error: 'Active test session not found.' });
  const sections = orderedSections(submission.test.sections);
  if (sections.length < 2) throw new ApiError(409, { error: 'This test has no second module.' });

  const now = new Date();
  const reconciled = await reconcileExamModule({ submission, test: submission.test, now });
  if (reconciled.currentModule === 2) {
    return {
      ...examTimingPayload({ submission: reconciled, test: submission.test, serverTime: now }),
      currentQuestionIndex: reconciled.currentQuestionIndex,
    };
  }
  if (submission.test.mode === 'EXAM' && reconciled.moduleExpiresAt && now < new Date(reconciled.moduleExpiresAt)) {
    throw new ApiError(409, {
      error: 'Module 1 is still in progress.',
      timeLeft: Math.max(1, Math.ceil((new Date(reconciled.moduleExpiresAt).getTime() - now.getTime()) / 1000)),
    });
  }

  const next = moduleTiming({ totalDuration: submission.test.duration, sections, moduleNumber: 2 });
  const moduleStartedAt = submission.test.mode === 'EXAM' && reconciled.moduleExpiresAt
    ? new Date(reconciled.moduleExpiresAt)
    : now;
  const moduleExpiresAt = submission.test.mode === 'EXAM'
    ? new Date(moduleStartedAt.getTime() + next.durationMinutes * 60 * 1000)
    : null;
  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      currentModule: 2,
      currentQuestionIndex: next.firstQuestionIndex,
      moduleStartedAt,
      moduleExpiresAt,
      timeRemaining: next.durationMinutes * 60,
    },
  });
  return {
    ...examTimingPayload({ submission: updated, test: submission.test, serverTime: now }),
    currentQuestionIndex: updated.currentQuestionIndex,
  };
};

exports.saveProgress = async ({ userId, submissionId, answers, timeLeft, currentQuestionIndex, violationCount, questionTimings }) => {
  // Validate sở hữu: Có đúng user này đang làm bài này không?
  const submission = await prisma.submission.findFirst({
    where: { id: parseInt(submissionId), userId: userId },
    include: {
      test: {
        select: {
          mode: true,
          duration: true,
          sections: { orderBy: { order: 'asc' }, select: { order: true, questions: { select: { id: true } } } },
        },
      },
    }
  });

  if (!submission) throw new ApiError(403, { message: "Không có quyền truy cập" });
  if (submission.status === 'COMPLETED') throw new ApiError(400, { message: "Bài đã nộp rồi" });

  const clientTimeLeft = Number(timeLeft);
  const authoritativeTimeLeft = submission.test.mode === 'EXAM' && submission.moduleExpiresAt
    ? Math.max(0, Math.ceil((new Date(submission.moduleExpiresAt).getTime() - Date.now()) / 1000))
    : (Number.isFinite(clientTimeLeft) ? Math.max(0, Math.floor(clientTimeLeft)) : submission.timeRemaining);
  const questionTimingSnapshot = submission.test.mode === 'EXAM'
    ? normalizeQuestionTimingSnapshot({
        snapshot: questionTimings,
        questionIds: submission.test.sections.flatMap(section => section.questions.map(question => question.id)),
        maxTotalMs: submission.beganAt
          ? Math.min(submission.test.duration * 60 * 1000, Math.max(0, Date.now() - new Date(submission.beganAt).getTime()))
          : 0,
      })
    : null;

  await prisma.submission.updateMany({
    where: { id: parseInt(submissionId), userId, status: 'DOING' },
    data: {
      savedAnswers: answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {},
      timeRemaining: authoritativeTimeLeft,
      currentQuestionIndex: Number.isInteger(Number(currentQuestionIndex))
        ? Math.min(
            Math.max(
              moduleTiming({ totalDuration: submission.test.duration, sections: submission.test.sections, moduleNumber: submission.currentModule }).firstQuestionIndex,
              Number(currentQuestionIndex),
            ),
            moduleTiming({ totalDuration: submission.test.duration, sections: submission.test.sections, moduleNumber: submission.currentModule }).firstQuestionIndex
              + submission.test.sections[submission.currentModule - 1].questions.length - 1,
          )
        : submission.currentQuestionIndex,
      violationCount: Number.isFinite(Number(violationCount))
        ? Math.max(submission.violationCount, Number(violationCount))
        : submission.violationCount,
      ...(submission.test.mode === 'EXAM' ? { questionTimingSnapshot } : {}),
    }
  });
};

exports.submitTest = async ({ userId, submissionId, answers, violationCount, testId, assignmentId, classId, deliveryId, questionTimings }) => {
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
      ...(deliveryId ? { deliveryId: String(deliveryId) } : {}),
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
  const timingSnapshot = test.mode === 'EXAM'
    ? normalizeQuestionTimingSnapshot({
        snapshot: questionTimings || submission.questionTimingSnapshot,
        questionIds: allQuestions.map(question => question.id),
        maxTotalMs: submission.beganAt
          ? Math.min(test.duration * 60 * 1000, Math.max(0, Date.now() - new Date(submission.beganAt).getTime()))
          : 0,
      })
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
        savedAnswers: safeAnswers,
        ...(test.mode === 'EXAM' ? { questionTimingSnapshot: timingSnapshot } : {}),
      }
    });

    if (claim.count === 0) {
      return {
        submission: await tx.submission.findUnique({ where: { id: submission.id } }),
        didSubmit: false
      };
    }

    const updatedSubmission = await tx.submission.findUnique({ where: { id: submission.id } });

    if (submission.deliveryId) {
      const [testActivity] = await tx.$queryRaw`SELECT "activityId" FROM "TestActivity" WHERE "testDeliveryId" = ${submission.deliveryId} LIMIT 1`;
      if (testActivity) {
        const currentAssignee = await tx.activityAssignee.findUnique({
          where: { activityId_studentId: { activityId: testActivity.activityId, studentId: userId } },
          select: { bestScore: true },
        });
        const percentage = allQuestions.length ? Math.round((correctCount / allQuestions.length) * 100) : 0;
        await tx.activityAssignee.updateMany({
          where: { activityId: testActivity.activityId, studentId: userId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            bestScore: Math.max(currentAssignee?.bestScore || 0, percentage),
            attemptCount: submission.attemptNo,
          },
        });
      }
    }

    // Nếu học sinh làm từ Practice Center theo lớp, tự động cập nhật các assignment chưa có dữ liệu
    if (!deliveryId && !assignmentId && classId) {
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

      await errorLogService.syncSubmissionErrorLogs({
        db: tx,
        userId,
        submissionId: submission.id,
        test,
        answerRows: answersToSave,
      });
    }

    if (test.mode === 'EXAM') {
      await tx.questionTiming.deleteMany({ where: { submissionId: submission.id } });
      const timingRows = timingRowsFromSnapshot({ submissionId: submission.id, snapshot: timingSnapshot });
      if (timingRows.length > 0) await tx.questionTiming.createMany({ data: timingRows });
    }

    return { submission: updatedSubmission, didSubmit: true };
  });

  if (!transactionResult.didSubmit) {
    const committedGrade = gradeQuestions(allQuestions, transactionResult.submission?.savedAnswers);
    correctCount = committedGrade.correctCount;
    totalQuestions = committedGrade.totalQuestions;
    responseDetails = committedGrade.details;
  }

  if (transactionResult.didSubmit && submission.deliveryId) {
    try {
      const [studentInfo, delivery, completedCount] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
        prisma.testDelivery.findUnique({
          where: { id: submission.deliveryId },
          select: { id: true, classId: true, class: { select: { teacherId: true } } },
        }),
        prisma.submission.count({
          where: { deliveryId: submission.deliveryId, userId, status: 'COMPLETED' },
        }),
      ]);
      if (delivery && completedCount === 1) {
        await sendNotificationToUser(
          delivery.class.teacherId,
          `${studentInfo?.name || studentInfo?.email} completed "${test.title}" with ${correctCount}/${totalQuestions} correct.`,
          `/dashboard/class/${delivery.classId}?tab=activities&deliveryId=${delivery.id}`,
        );
      }
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
    submittedAt: transactionResult.submission.endTime,
    details: responseDetails,
    message: "Nộp bài và lưu kết quả thành công"
  };
};
