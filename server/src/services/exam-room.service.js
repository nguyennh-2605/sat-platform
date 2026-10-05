const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { sendNotificationToUser } = require('./notification.service');
const { gradeQuestions } = require('../utils/grading');
const { SOLUTION_DELIVERY_SELECT, isSubmissionSolutionLocked } = require('../utils/solution-access');
const testDeliveryService = require('./test-delivery.service');
const errorLogService = require('./error-log.service');
const { normalizeQuestionTimingSnapshot, timingRowsFromSnapshot } = require('../utils/question-timing');
const { moduleTiming } = require('../utils/module-timing');
const questionBankService = require('./question-bank.service');
const {
  TIMING_PRESETS,
  attemptModeFor,
  isUntimedAttempt,
  resolveAttemptConfiguration,
  timingPresetFor,
  timingSnapshotFor,
} = require('../utils/attempt-configuration');

const orderedSections = sections => [...(sections || [])].sort((a, b) => a.order - b.order);

const examTimingPayload = ({ submission, test, serverTime = new Date() }) => {
  const sections = orderedSections(test.sections);
  const timingSnapshot = timingSnapshotFor(submission, test);
  const currentModule = Math.min(Math.max(Number(submission.currentModule) || 1, 1), sections.length);
  const moduleExpiresAt = submission.moduleExpiresAt || null;
  const attemptMode = attemptModeFor(submission, test);
  const timingPreset = timingPresetFor(submission);
  return {
    serverTime,
    attemptMode,
    timingPreset,
    currentModule,
    totalModules: sections.length,
    moduleDuration: timingSnapshot[currentModule - 1]?.allowedSeconds === null
      ? null
      : timingSnapshot[currentModule - 1].allowedSeconds / 60,
    moduleDurationSeconds: timingSnapshot.map(item => item.allowedSeconds),
    standardModuleDurationSeconds: timingSnapshot.map(item => item.standardSeconds),
    allowedDurationSeconds: submission.allowedDurationSeconds
      ?? timingSnapshot.reduce((total, item) => total + (item.allowedSeconds || 0), 0),
    moduleStartedAt: submission.moduleStartedAt || null,
    moduleExpiresAt,
    moduleAdvanceAvailableAt: attemptMode === 'EXAM' && submission.moduleStartedAt
      ? new Date(new Date(submission.moduleStartedAt).getTime() + timingSnapshot[currentModule - 1].standardSeconds * 1000)
      : null,
    timeLeft: !isUntimedAttempt(submission) && moduleExpiresAt
      ? Math.max(0, Math.ceil((new Date(moduleExpiresAt).getTime() - serverTime.getTime()) / 1000))
      : submission.timeRemaining,
  };
};

const reconcileTimedModule = async ({ submission, test, now = new Date(), db = prisma }) => {
  if (isUntimedAttempt(submission) || !submission.beganAt || !submission.moduleExpiresAt) return submission;
  const sections = orderedSections(test.sections);
  const timingSnapshot = timingSnapshotFor(submission, test);
  let currentModule = Math.min(Math.max(Number(submission.currentModule) || 1, 1), sections.length);
  let moduleStartedAt = submission.moduleStartedAt ? new Date(submission.moduleStartedAt) : null;
  let moduleExpiresAt = submission.moduleExpiresAt ? new Date(submission.moduleExpiresAt) : null;

  if (!moduleStartedAt || !moduleExpiresAt) {
    if (currentModule === 1) {
      moduleStartedAt = new Date(submission.beganAt);
      moduleExpiresAt = new Date(moduleStartedAt.getTime() + timingSnapshot[0].allowedSeconds * 1000);
    } else {
      moduleStartedAt = new Date(new Date(submission.beganAt).getTime() + timingSnapshot[0].allowedSeconds * 1000);
      moduleExpiresAt = new Date(moduleStartedAt.getTime() + timingSnapshot[1].allowedSeconds * 1000);
    }
  }

  let currentQuestionIndex = submission.currentQuestionIndex;
  if (currentModule === 1 && sections.length > 1 && now >= moduleExpiresAt) {
    currentModule = 2;
    moduleStartedAt = moduleExpiresAt;
    moduleExpiresAt = new Date(moduleStartedAt.getTime() + timingSnapshot[1].allowedSeconds * 1000);
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

const loadTestContext = async ({ testId, userId, userRole, assignmentId, classId, deliveryId, includeQuestions }) => {
  if (!userId || isNaN(userId)) {
    throw new ApiError(400, { error: 'User information is missing or invalid.' });
  }

  const test = await prisma.test.findUnique({
    where: { id: Number(testId) },
    include: {
      sections: {
        orderBy: { order: 'asc' },
        ...(includeQuestions ? {
          include: {
            questions: {
              orderBy: { order: 'asc' },
              select: { id: true, blocks: true, questionText: true, choices: true, type: true },
            },
          },
        } : {
          select: { order: true, duration: true, _count: { select: { questions: true } } },
        }),
      },
    },
  });

  if (!test || !test.sections?.length) {
    throw new ApiError(404, { error: 'This test has no questions.' });
  }

  if (userRole === 'TEACHER' && test.authorId !== userId) {
    throw new ApiError(403, { error: 'You do not have access to this test.' });
  }

  let selectedClassTestId = null;
  let selectedDelivery = null;
  let hasClassAccess = false;
  if (deliveryId) {
    if (userRole === 'STUDENT') {
      await testDeliveryService.assertStudentDeliveryAccess({ deliveryId, testId, userId });
    }
    selectedDelivery = await prisma.testDelivery.findUnique({ where: { id: String(deliveryId) } });
    if (!selectedDelivery || selectedDelivery.testId !== Number(testId)) {
      throw new ApiError(400, { error: 'The assigned test does not match this test.' });
    }
    selectedClassTestId = selectedDelivery.legacyClassTestId;
    hasClassAccess = true;
  } else if (assignmentId) {
    const assignment = await prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        testIds: { has: Number(testId) },
        ...(userRole === 'STUDENT' ? { class: { students: { some: { id: userId } } } } : {}),
      },
      select: { id: true },
    });
    hasClassAccess = Boolean(assignment);
  } else if (classId) {
    const classTest = await prisma.classTest.findFirst({
      where: {
        classId,
        testId: Number(testId),
        ...(userRole === 'STUDENT' ? {
          isHidden: false,
          class: { students: { some: { id: userId } } },
        } : {}),
      },
      select: { id: true },
    });
    if (!classTest) throw new ApiError(400, { error: 'This test is not assigned to the selected class.' });
    selectedClassTestId = classTest.id;
    hasClassAccess = true;
  }

  const isSystemPublishedTest = test.scope === 'SYSTEM' && test.status === 'PUBLISHED';
  const isStudentGeneratedTest = userRole === 'STUDENT'
    && test.scope === 'PERSONAL'
    && test.status === 'PUBLISHED'
    && test.authorId === Number(userId)
    && test.isDiscoverable === false;
  if (userRole === 'STUDENT' && !isSystemPublishedTest && !isStudentGeneratedTest && !hasClassAccess) {
    throw new ApiError(403, { error: 'This test has not been assigned to your class.' });
  }

  return {
    test,
    selectedClassTestId,
    selectedDelivery,
    canCustomize: userRole === 'STUDENT'
      && (isSystemPublishedTest || isStudentGeneratedTest)
      && !deliveryId
      && !assignmentId
      && !classId,
  };
};

const submissionContextWhere = ({ userId, testId, assignmentId, deliveryId, selectedClassTestId }) => ({
  userId,
  testId: Number(testId),
  ...(deliveryId
    ? { deliveryId: String(deliveryId) }
    : { assignmentId: assignmentId || null, classTestId: selectedClassTestId }),
  status: 'DOING',
});

exports.getTestSetup = async params => {
  const { test, selectedClassTestId, canCustomize } = await loadTestContext({ ...params, includeQuestions: false });
  const activeSubmission = await prisma.submission.findFirst({
    where: submissionContextWhere({ ...params, selectedClassTestId }),
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      attemptMode: true,
      timingPreset: true,
      allowedDurationSeconds: true,
      moduleTimingSnapshot: true,
      beganAt: true,
    },
  });
  const standardTiming = resolveAttemptConfiguration({ test, canCustomize: false });
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    questionCount: test.sections.reduce((total, section) => total + section._count.questions, 0),
    standardDurationSeconds: test.duration * 60,
    standardModuleDurationSeconds: standardTiming.moduleTimingSnapshot.map(item => item.standardSeconds),
    defaultMode: test.mode,
    canCustomize,
    timingPresets: canCustomize ? TIMING_PRESETS : ['STANDARD'],
    activeAttempt: activeSubmission ? {
      submissionId: activeSubmission.id,
      attemptMode: attemptModeFor(activeSubmission, test),
      timingPreset: timingPresetFor(activeSubmission),
      allowedDurationSeconds: activeSubmission.allowedDurationSeconds,
      moduleTimingSnapshot: timingSnapshotFor(activeSubmission, test),
      beganAt: activeSubmission.beganAt,
    } : null,
  };
};

exports.startOrResumeTest = async ({
  testId,
  userId,
  userRole,
  assignmentId,
  classId,
  deliveryId,
  attemptMode,
  timingPreset,
  customDurationMinutes,
}) => {
  const { test, selectedClassTestId, selectedDelivery, canCustomize } = await loadTestContext({
    testId, userId, userRole, assignmentId, classId, deliveryId, includeQuestions: true,
  });
  const attemptConfiguration = resolveAttemptConfiguration({
    test,
    requestedMode: attemptMode,
    requestedTimingPreset: timingPreset,
    customDurationMinutes,
    canCustomize,
  });

  // Serverless deployments can issue the same GET concurrently. A PostgreSQL
  // transaction-scoped advisory lock makes find-or-create atomic per user/test.
  const submission = await prisma.$transaction(async (tx) => {
    // pg_advisory_xact_lock returns PostgreSQL's `void` type. Use executeRaw
    // because this statement is only for synchronization and has no result set
    // for Prisma to deserialize.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${Number(userId)}::integer, ${Number(testId)}::integer)`;

    const activeSubmission = await tx.submission.findFirst({
      where: submissionContextWhere({ userId, testId, assignmentId, deliveryId, selectedClassTestId }),
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

    return tx.submission.create({
      data: {
        userId,
        testId,
        assignmentId,
        classTestId: selectedClassTestId,
        deliveryId: deliveryId ? String(deliveryId) : null,
        attemptNo,
        ...attemptConfiguration,
        status: "DOING",
        startedAt: new Date(),
        timeRemaining: attemptConfiguration.moduleTimingSnapshot[0].allowedSeconds,
        currentModule: 1,
        currentQuestionIndex: 0,
        savedAnswers: {}
      }
    });
  });

  const serverTime = new Date();
  const reconciledSubmission = await reconcileTimedModule({ submission, test, now: serverTime });
  const timing = examTimingPayload({ submission: reconciledSubmission, test, serverTime });

  // Trả về đề thi + Thông tin phiên làm bài
  return {
    ...test,
    mode: timing.attemptMode,
    session: {
      submissionId: reconciledSubmission.id,
      startedAt: reconciledSubmission.startedAt,
      status: reconciledSubmission.status,
      savedAnswers: reconciledSubmission.savedAnswers,
      timeLeft: timing.timeLeft,
      currentModule: timing.currentModule,
      totalModules: timing.totalModules,
      moduleDuration: timing.moduleDuration,
      moduleDurationSeconds: timing.moduleDurationSeconds,
      standardModuleDurationSeconds: timing.standardModuleDurationSeconds,
      allowedDurationSeconds: timing.allowedDurationSeconds,
      attemptMode: timing.attemptMode,
      timingPreset: timing.timingPreset,
      moduleStartedAt: timing.moduleStartedAt,
      moduleExpiresAt: timing.moduleExpiresAt,
      moduleAdvanceAvailableAt: timing.moduleAdvanceAvailableAt,
      currentQuestionIndex: reconciledSubmission.currentQuestionIndex,
      questionTimingSnapshot: reconciledSubmission.questionTimingSnapshot || {},
      violationCount: reconciledSubmission.violationCount,
      // ISO timestamps are timezone-independent. Returning the server clock lets
      // the browser compensate when a student's device clock is fast or slow.
      serverTime,
      beganAt: reconciledSubmission.beganAt,
      module1ExpiresAt: timing.moduleExpiresAt,
      expiresAt: timing.allowedDurationSeconds !== null && reconciledSubmission.beganAt
        ? new Date(new Date(reconciledSubmission.beganAt).getTime() + timing.allowedDurationSeconds * 1000)
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
  const now = new Date();
  const timingSnapshot = timingSnapshotFor(submission, submission.test);
  if (!beganAt) {
    // updateMany makes this one-shot even when the start button/request is retried.
    await prisma.submission.updateMany({
      where: { id: submission.id, beganAt: null, status: 'DOING' },
      data: {
        beganAt: now,
        startedAt: now,
        currentModule: 1,
        moduleStartedAt: now,
        moduleExpiresAt: isUntimedAttempt(submission)
          ? null
          : new Date(now.getTime() + timingSnapshot[0].allowedSeconds * 1000),
        timeRemaining: timingSnapshot[0].allowedSeconds,
      }
    });
    const current = await prisma.submission.findUnique({ where: { id: submission.id } });
    beganAt = current.beganAt;
    Object.assign(submission, current);
  } else if (attemptModeFor(submission, submission.test) === 'PRACTICE'
    && !isUntimedAttempt(submission)
    && !submission.moduleExpiresAt) {
    const secondsLeft = Number.isInteger(submission.timeRemaining)
      ? submission.timeRemaining
      : timingSnapshot[(submission.currentModule || 1) - 1].allowedSeconds;
    const resumed = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        moduleStartedAt: now,
        moduleExpiresAt: new Date(now.getTime() + secondsLeft * 1000),
      },
    });
    Object.assign(submission, resumed);
  }

  const serverTime = new Date();
  const reconciled = await reconcileTimedModule({ submission, test: submission.test, now: serverTime });
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
  const reconciled = await reconcileTimedModule({ submission, test: submission.test, now });
  if (reconciled.currentModule === 2) {
    return {
      ...examTimingPayload({ submission: reconciled, test: submission.test, serverTime: now }),
      currentQuestionIndex: reconciled.currentQuestionIndex,
    };
  }
  const timingSnapshot = timingSnapshotFor(reconciled, submission.test);
  const attemptMode = attemptModeFor(reconciled, submission.test);
  const standardUnlockAt = reconciled.moduleStartedAt
    ? new Date(new Date(reconciled.moduleStartedAt).getTime() + timingSnapshot[0].standardSeconds * 1000)
    : null;
  if (attemptMode === 'EXAM' && standardUnlockAt && now < standardUnlockAt) {
    throw new ApiError(409, {
      error: 'Module 1 is still in progress.',
      timeLeft: Math.max(1, Math.ceil((standardUnlockAt.getTime() - now.getTime()) / 1000)),
    });
  }

  const next = moduleTiming({ totalDuration: submission.test.duration, sections, moduleNumber: 2 });
  const moduleStartedAt = now;
  const moduleExpiresAt = isUntimedAttempt(reconciled) || !reconciled.beganAt
    ? null
    : new Date(moduleStartedAt.getTime() + timingSnapshot[1].allowedSeconds * 1000);
  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      currentModule: 2,
      currentQuestionIndex: next.firstQuestionIndex,
      moduleStartedAt,
      moduleExpiresAt,
      timeRemaining: timingSnapshot[1].allowedSeconds,
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
  const attemptMode = attemptModeFor(submission, submission.test);
  const authoritativeTimeLeft = !isUntimedAttempt(submission) && submission.moduleExpiresAt
    ? Math.max(0, Math.ceil((new Date(submission.moduleExpiresAt).getTime() - Date.now()) / 1000))
    : (isUntimedAttempt(submission) ? null : (Number.isFinite(clientTimeLeft) ? Math.max(0, Math.floor(clientTimeLeft)) : submission.timeRemaining));
  const questionTimingSnapshot = attemptMode === 'EXAM'
    ? normalizeQuestionTimingSnapshot({
        snapshot: questionTimings,
        questionIds: submission.test.sections.flatMap(section => section.questions.map(question => question.id)),
        maxTotalMs: submission.beganAt
          ? Math.min(submission.allowedDurationSeconds || submission.test.duration * 60, Math.max(0, (Date.now() - new Date(submission.beganAt).getTime()) / 1000)) * 1000
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
      ...(attemptMode === 'EXAM' ? { questionTimingSnapshot } : {}),
    }
  });
};

exports.pauseTest = async ({ userId, submissionId, testId }) => {
  const submission = await prisma.submission.findFirst({
    where: { id: Number(submissionId), userId, testId, status: 'DOING' },
    include: {
      test: {
        select: {
          mode: true,
          duration: true,
          sections: { orderBy: { order: 'asc' }, select: { order: true, duration: true, questions: { select: { id: true } } } },
        },
      },
    },
  });
  if (!submission) throw new ApiError(404, { error: 'Active test session not found.' });
  if (attemptModeFor(submission, submission.test) !== 'PRACTICE') {
    throw new ApiError(409, { error: 'Exam simulations cannot be paused.' });
  }
  if (isUntimedAttempt(submission)) return examTimingPayload({ submission, test: submission.test });

  const now = new Date();
  const reconciled = await reconcileTimedModule({ submission, test: submission.test, now });
  const timeRemaining = reconciled.moduleExpiresAt
    ? Math.max(0, Math.ceil((new Date(reconciled.moduleExpiresAt).getTime() - now.getTime()) / 1000))
    : reconciled.timeRemaining;
  const paused = await prisma.submission.update({
    where: { id: submission.id },
    data: { moduleExpiresAt: null, timeRemaining },
  });
  return examTimingPayload({ submission: paused, test: submission.test, serverTime: now });
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
  const attemptMode = attemptModeFor(submission, test);
  const timingSnapshot = attemptMode === 'EXAM'
    ? normalizeQuestionTimingSnapshot({
        snapshot: questionTimings || submission.questionTimingSnapshot,
        questionIds: allQuestions.map(question => question.id),
        maxTotalMs: submission.beganAt
          ? Math.min((submission.allowedDurationSeconds || test.duration * 60) * 1000, Math.max(0, Date.now() - new Date(submission.beganAt).getTime()))
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
        ...(attemptMode === 'EXAM' ? { questionTimingSnapshot: timingSnapshot } : {}),
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
              beganAt: submission.beganAt,
              attemptMode,
              timingPreset: timingPresetFor(submission),
              allowedDurationSeconds: submission.allowedDurationSeconds,
              moduleTimingSnapshot: submission.moduleTimingSnapshot,
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

      const questionById = new Map(allQuestions.map(question => [question.id, question]));
      for (const answer of answersToSave) {
        const question = questionById.get(answer.questionId);
        if (question?.sourceBankQuestionId) {
          await questionBankService.recordProgressWithDb({
            db: tx,
            userId,
            question,
            selectedChoice: answer.selectedChoice,
            isCorrect: answer.isCorrect,
          });
        }
      }

      await errorLogService.syncSubmissionErrorLogs({
        db: tx,
        userId,
        submissionId: submission.id,
        test,
        answerRows: answersToSave,
      });
    }

    if (attemptMode === 'EXAM') {
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

  let solutionsLocked = false;
  let solutionAvailableAt = null;
  if (submission.deliveryId) {
    const delivery = await prisma.testDelivery.findUnique({
      where: { id: submission.deliveryId },
      select: SOLUTION_DELIVERY_SELECT,
    });
    solutionsLocked = isSubmissionSolutionLocked({ ...transactionResult.submission, delivery });
    solutionAvailableAt = solutionsLocked ? delivery?.dueAt || null : null;
  }

  return {
    score: correctCount,
    total: totalQuestions,
    totalQuestions,
    submissionId: transactionResult.submission.id,
    submittedAt: transactionResult.submission.endTime,
    solutionsLocked,
    solutionAvailableAt,
    details: solutionsLocked
      ? responseDetails.map(detail => ({ ...detail, correctOption: null, isCorrect: null }))
      : responseDetails,
    message: "Nộp bài và lưu kết quả thành công"
  };
};
