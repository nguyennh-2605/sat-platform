const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const parseUserId = (value) => Number.parseInt(value, 10);
const validScorePolicies = new Set(['FIRST', 'BEST', 'LATEST']);

const assertClassManager = async (client, { classId, userId, userRole }) => {
  const classroom = await client.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      teacherId: true,
      students: { select: { id: true } },
    },
  });
  if (!classroom) throw new ApiError(404, { error: 'Class not found.' });
  if (userRole !== 'ADMIN' && classroom.teacherId !== parseUserId(userId)) {
    throw new ApiError(403, { error: 'You do not have permission to manage this class.' });
  }
  return classroom;
};

const normalizeDate = (value, fieldName) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, { error: `${fieldName} is invalid.` });
  return date;
};

const chooseAttempt = (submissions, scorePolicy) => {
  const completed = submissions.filter(item => item.status === 'COMPLETED');
  if (completed.length === 0) return null;
  if (scorePolicy === 'BEST') {
    return [...completed].sort((a, b) => (b.score || 0) - (a.score || 0) || a.attemptNo - b.attemptNo)[0];
  }
  if (scorePolicy === 'LATEST') {
    return [...completed].sort((a, b) => b.attemptNo - a.attemptNo)[0];
  }
  return [...completed].sort((a, b) => a.attemptNo - b.attemptNo)[0];
};

const percentageScore = (score, questionCount) => questionCount > 0 && Number.isFinite(Number(score))
  ? Math.round((Number(score) / questionCount) * 100)
  : null;

const median = (values) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

exports.createDeliveries = async ({ classIds, testIds, lessonId, title, availableAt, dueAt, maxAttempts, scorePolicy, userId, userRole }) => {
  const normalizedClassIds = [...new Set((Array.isArray(classIds) ? classIds : []).map(String).filter(Boolean))];
  const normalizedTestIds = [...new Set((Array.isArray(testIds) ? testIds : []).map(Number).filter(Number.isInteger))];
  if (normalizedClassIds.length === 0 || normalizedTestIds.length === 0) {
    throw new ApiError(400, { error: 'Select at least one test and one class.' });
  }

  const normalizedAvailableAt = normalizeDate(availableAt, 'Available date');
  const normalizedDueAt = normalizeDate(dueAt, 'Due date');
  if (normalizedAvailableAt && normalizedDueAt && normalizedAvailableAt >= normalizedDueAt) {
    throw new ApiError(400, { error: 'Due date must be after the available date.' });
  }
  const normalizedMaxAttempts = Math.min(10, Math.max(1, Number.parseInt(maxAttempts, 10) || 1));
  const normalizedScorePolicy = validScorePolicies.has(scorePolicy) ? scorePolicy : 'FIRST';
  if (lessonId && normalizedClassIds.length !== 1) {
    throw new ApiError(400, { error: 'A lesson can only be attached when assigning to one class.' });
  }

  return prisma.$transaction(async tx => {
    const classes = [];
    for (const classId of normalizedClassIds) {
      classes.push(await assertClassManager(tx, { classId, userId, userRole }));
    }

    const tests = await tx.test.findMany({
      where: {
        id: { in: normalizedTestIds },
        ...(userRole === 'ADMIN' ? {} : { authorId: parseUserId(userId) }),
      },
      select: { id: true, title: true },
    });
    if (tests.length !== normalizedTestIds.length) {
      throw new ApiError(403, { error: 'You can only assign tests you own.' });
    }

    if (lessonId) {
      const lesson = await tx.lesson.findFirst({
        where: { id: String(lessonId), week: { classId: normalizedClassIds[0] } },
        select: { id: true },
      });
      if (!lesson) throw new ApiError(400, { error: 'The selected lesson does not belong to this class.' });
    }

    const deliveries = [];
    for (const classroom of classes) {
      for (const test of tests) {
        const classTest = await tx.classTest.upsert({
          where: { classId_testId: { classId: classroom.id, testId: test.id } },
          update: { isHidden: false, dueDate: normalizedDueAt },
          create: { classId: classroom.id, testId: test.id, dueDate: normalizedDueAt, isHidden: false },
          select: { id: true },
        });
        const legacyAlreadyLinked = await tx.testDelivery.findUnique({
          where: { legacyClassTestId: classTest.id }, select: { id: true },
        });

        const delivery = await tx.testDelivery.create({
          data: {
            classId: classroom.id,
            testId: test.id,
            lessonId: lessonId ? String(lessonId) : null,
            title: normalizedTestIds.length === 1 && String(title || '').trim() ? String(title).trim() : test.title,
            availableAt: normalizedAvailableAt,
            dueAt: normalizedDueAt,
            maxAttempts: normalizedMaxAttempts,
            scorePolicy: normalizedScorePolicy,
            createdById: parseUserId(userId),
            legacyClassTestId: legacyAlreadyLinked ? null : classTest.id,
            assignees: {
              create: classroom.students.map(student => ({ studentId: student.id })),
            },
          },
          include: { test: { select: { id: true, title: true, mode: true } }, class: { select: { id: true, name: true } } },
        });
        const canonicalActivity = await tx.classActivity.create({
          data: {
            type: 'TEST',
            status: 'PUBLISHED',
            classId: classroom.id,
            lessonId: lessonId ? String(lessonId) : null,
            title: delivery.title,
            availableAt: normalizedAvailableAt,
            dueAt: normalizedDueAt,
            maxAttempts: normalizedMaxAttempts,
            scorePolicy: normalizedScorePolicy,
            completionRule: 'SUBMIT',
            audience: 'ALL_STUDENTS',
            createdById: parseUserId(userId),
            assignees: { create: classroom.students.map(student => ({ studentId: student.id })) },
          },
          select: { id: true },
        });
        await tx.$executeRaw`INSERT INTO "TestActivity" ("activityId", "testDeliveryId") VALUES (${canonicalActivity.id}, ${delivery.id}) ON CONFLICT ("activityId") DO NOTHING`;
        deliveries.push(delivery);
      }
    }
    return deliveries;
  });
};

exports.listClassDeliveries = async ({ classId, userId, userRole }) => {
  await assertClassManager(prisma, { classId, userId, userRole });
  const deliveries = await prisma.testDelivery.findMany({
    where: { classId },
    orderBy: { createdAt: 'desc' },
    include: {
      test: { include: { sections: { select: { _count: { select: { questions: true } } } } } },
      lesson: { select: { id: true, title: true, week: { select: { id: true, title: true } } } },
      assignees: { select: { studentId: true, excusedAt: true } },
      submissions: { select: { userId: true, status: true, score: true, attemptNo: true, beganAt: true, endTime: true } },
    },
  });

  return deliveries.map(delivery => {
    const questionCount = delivery.test.sections.reduce((sum, section) => sum + section._count.questions, 0);
    const activeAssignees = delivery.assignees.filter(item => !item.excusedAt);
    const counted = activeAssignees.map(assignee => chooseAttempt(
      delivery.submissions.filter(item => item.userId === assignee.studentId), delivery.scorePolicy
    )).filter(Boolean);
    const scores = counted.map(item => percentageScore(item.score, questionCount)).filter(Number.isFinite);
    const doingStudentIds = new Set(delivery.submissions.filter(item => item.status === 'DOING').map(item => item.userId));
    const completedStudentIds = new Set(counted.map(item => item.userId));
    const duePassed = delivery.dueAt && delivery.dueAt < new Date();

    return {
      id: delivery.id,
      title: delivery.title,
      status: delivery.status,
      availableAt: delivery.availableAt,
      dueAt: delivery.dueAt,
      maxAttempts: delivery.maxAttempts,
      scorePolicy: delivery.scorePolicy,
      createdAt: delivery.createdAt,
      test: { id: delivery.test.id, title: delivery.test.title, mode: delivery.test.mode, questionCount },
      lesson: delivery.lesson,
      stats: {
        assigned: activeAssignees.length,
        completed: completedStudentIds.size,
        inProgress: activeAssignees.filter(item => doingStudentIds.has(item.studentId) && !completedStudentIds.has(item.studentId)).length,
        missing: duePassed ? activeAssignees.filter(item => !completedStudentIds.has(item.studentId)).length : 0,
        averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
      },
    };
  });
};

const getManagedDelivery = async ({ deliveryId, userId, userRole }) => {
  const delivery = await prisma.testDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      class: { select: { id: true, name: true, teacherId: true } },
      lesson: { select: { id: true, title: true, week: { select: { id: true, title: true } } } },
      test: {
        include: {
          sections: {
            orderBy: { order: 'asc' },
            include: {
              questions: {
                orderBy: { order: 'asc' },
                select: { id: true, order: true, questionText: true, correctAnswer: true, domainCode: true, skillCode: true, domain: { select: { name: true } }, skill: { select: { name: true } } },
              },
            },
          },
        },
      },
      assignees: { include: { student: { select: { id: true, name: true, email: true } } } },
      submissions: {
        include: {
          answers: { select: { questionId: true, selectedChoice: true, isCorrect: true } },
          questionTimings: { select: { questionId: true, activeDurationMs: true, visitCount: true } },
        },
        orderBy: [{ userId: 'asc' }, { attemptNo: 'asc' }],
      },
    },
  });
  if (!delivery) throw new ApiError(404, { error: 'Assigned test not found.' });
  if (userRole !== 'ADMIN' && delivery.class.teacherId !== parseUserId(userId)) {
    throw new ApiError(403, { error: 'You do not have permission to view this performance report.' });
  }
  return delivery;
};

exports.getDeliveryPerformance = async ({ deliveryId, userId, userRole }) => {
  const delivery = await getManagedDelivery({ deliveryId, userId, userRole });
  const questions = delivery.test.sections.flatMap(section => section.questions.map(question => ({ ...question, sectionName: section.name })));
  const questionCount = questions.length;
  const activeAssignees = delivery.assignees.filter(item => !item.excusedAt);
  const countedByStudent = new Map();
  for (const assignee of activeAssignees) {
    const chosen = chooseAttempt(delivery.submissions.filter(item => item.userId === assignee.studentId), delivery.scorePolicy);
    if (chosen) countedByStudent.set(assignee.studentId, chosen);
  }
  const counted = [...countedByStudent.values()];
  const scores = counted.map(item => percentageScore(item.score, questionCount)).filter(Number.isFinite);
  const rawScores = counted.map(item => Number(item.score)).filter(Number.isFinite);
  const completionTimes = counted.map(item => item.beganAt && item.endTime ? Math.max(0, new Date(item.endTime) - new Date(item.beganAt)) : null).filter(Number.isFinite);
  const duePassed = delivery.dueAt && delivery.dueAt < new Date();

  const students = activeAssignees.map(assignee => {
    const studentSubmissions = delivery.submissions.filter(item => item.userId === assignee.studentId);
    const chosen = countedByStudent.get(assignee.studentId) || null;
    const doing = studentSubmissions.find(item => item.status === 'DOING');
    return {
      id: assignee.student.id,
      name: assignee.student.name || assignee.student.email,
      email: assignee.student.email,
      status: chosen ? 'COMPLETED' : doing ? 'IN_PROGRESS' : duePassed ? 'MISSING' : 'ASSIGNED',
      score: chosen ? percentageScore(chosen.score, questionCount) : null,
      rawScore: chosen?.score ?? null,
      attempts: studentSubmissions.length,
      submissionId: chosen?.id ?? doing?.id ?? null,
      beganAt: chosen?.beganAt ?? doing?.beganAt ?? null,
      submittedAt: chosen?.endTime ?? null,
      completionTimeMs: chosen?.beganAt && chosen?.endTime ? Math.max(0, new Date(chosen.endTime) - new Date(chosen.beganAt)) : null,
    };
  });

  const questionPerformance = questions.map((question, index) => {
    const answers = counted.map(submission => submission.answers.find(answer => answer.questionId === question.id));
    const correct = answers.filter(answer => answer?.isCorrect).length;
    const timings = counted.map(submission => submission.questionTimings.find(timing => timing.questionId === question.id)?.activeDurationMs).filter(Number.isFinite);
    return {
      id: question.id,
      number: index + 1,
      sectionName: question.sectionName,
      questionText: question.questionText,
      domain: question.domain?.name || null,
      skill: question.skill?.name || null,
      correct,
      incorrect: Math.max(0, counted.length - correct),
      correctPercentage: counted.length ? Math.round((correct / counted.length) * 100) : 0,
      averageTimeMs: timings.length ? Math.round(timings.reduce((sum, value) => sum + value, 0) / timings.length) : null,
    };
  });

  const distribution = [
    { label: '< 50%', min: 0, max: 49 },
    { label: '50%', min: 50, max: 59 },
    { label: '60%', min: 60, max: 69 },
    { label: '70%', min: 70, max: 79 },
    { label: '80%', min: 80, max: 89 },
    { label: '90–100%', min: 90, max: 100 },
  ].map(bucket => ({ label: bucket.label, count: scores.filter(score => score >= bucket.min && score <= bucket.max).length }));

  return {
    delivery: {
      id: delivery.id,
      title: delivery.title,
      class: delivery.class,
      lesson: delivery.lesson,
      dueAt: delivery.dueAt,
      maxAttempts: delivery.maxAttempts,
      scorePolicy: delivery.scorePolicy,
      test: { id: delivery.test.id, title: delivery.test.title, mode: delivery.test.mode, duration: delivery.test.duration, subject: delivery.test.subject, questionCount },
    },
    kpis: {
      averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
      averageCorrect: rawScores.length ? Math.round((rawScores.reduce((sum, score) => sum + score, 0) / rawScores.length) * 10) / 10 : null,
      medianScore: scores.length ? median(scores) : null,
      highestScore: scores.length ? Math.max(...scores) : null,
      highestCorrect: rawScores.length ? Math.max(...rawScores) : null,
      lowestScore: scores.length ? Math.min(...scores) : null,
      lowestCorrect: rawScores.length ? Math.min(...rawScores) : null,
      participants: counted.length,
      assigned: activeAssignees.length,
      completionRate: activeAssignees.length ? Math.round((counted.length / activeAssignees.length) * 100) : 0,
      averageTimeMs: completionTimes.length ? Math.round(completionTimes.reduce((sum, value) => sum + value, 0) / completionTimes.length) : null,
    },
    students,
    questions: questionPerformance,
    hardestQuestions: [...questionPerformance].sort((a, b) => a.correctPercentage - b.correctPercentage).slice(0, 3),
    scoreDistribution: distribution,
  };
};

exports.getStudentPerformance = async ({ deliveryId, studentId, userId, userRole }) => {
  const delivery = await getManagedDelivery({ deliveryId, userId, userRole });
  const assignee = delivery.assignees.find(item => item.studentId === Number(studentId));
  if (!assignee) throw new ApiError(404, { error: 'Student is not assigned to this test.' });
  const questions = delivery.test.sections.flatMap(section => section.questions.map(question => ({ ...question, sectionName: section.name })));
  const attempts = delivery.submissions.filter(item => item.userId === Number(studentId)).map(submission => ({
    id: submission.id,
    attemptNo: submission.attemptNo,
    status: submission.status,
    score: percentageScore(submission.score, questions.length),
    rawScore: submission.score,
    beganAt: submission.beganAt,
    submittedAt: submission.endTime,
    completionTimeMs: submission.beganAt && submission.endTime ? Math.max(0, new Date(submission.endTime) - new Date(submission.beganAt)) : null,
    questions: questions.map((question, index) => {
      const answer = submission.answers.find(item => item.questionId === question.id);
      const timing = submission.questionTimings.find(item => item.questionId === question.id);
      return {
        id: question.id,
        number: index + 1,
        sectionName: question.sectionName,
        questionText: question.questionText,
        domain: question.domain?.name || null,
        skill: question.skill?.name || null,
        selectedChoice: answer?.selectedChoice ?? null,
        correctAnswer: question.correctAnswer,
        isCorrect: answer?.isCorrect ?? false,
        activeDurationMs: delivery.test.mode === 'EXAM' ? timing?.activeDurationMs ?? 0 : null,
        visitCount: delivery.test.mode === 'EXAM' ? timing?.visitCount ?? 0 : null,
      };
    }),
  }));
  return { student: assignee.student, testMode: delivery.test.mode, attempts };
};

exports.assertStudentDeliveryAccess = async ({ deliveryId, testId, userId }) => {
  const delivery = await prisma.testDelivery.findFirst({
    where: {
      id: deliveryId,
      testId: Number(testId),
      status: 'PUBLISHED',
      assignees: { some: { studentId: Number(userId), excusedAt: null } },
    },
    include: { assignees: { where: { studentId: Number(userId) }, take: 1 } },
  });
  if (!delivery) throw new ApiError(403, { error: 'This test has not been assigned to you.' });
  const now = new Date();
  if (delivery.availableAt && delivery.availableAt > now) throw new ApiError(403, { error: 'This test is not available yet.' });
  return delivery;
};

exports.syncClassAssignmentDeliveries = async ({ assignment, userId, userRole }) => {
  const normalizedTestIds = [...new Set((assignment.testIds || []).map(Number).filter(Number.isInteger))];
  const existing = await prisma.testDelivery.findMany({
    where: { sourceAssignmentId: assignment.id },
    select: { id: true, testId: true },
  });
  await prisma.testDelivery.updateMany({
    where: {
      sourceAssignmentId: assignment.id,
      testId: { notIn: normalizedTestIds.length ? normalizedTestIds : [-1] },
    },
    data: { status: 'CLOSED' },
  });
  await prisma.testDelivery.updateMany({
    where: { sourceAssignmentId: assignment.id, testId: { in: normalizedTestIds } },
    data: { title: assignment.title, dueAt: assignment.deadline || null, status: 'PUBLISHED' },
  });
  const linkedActivities = await prisma.$queryRaw`
    SELECT adapter."activityId", delivery."testId"
    FROM "TestActivity" adapter
    JOIN "TestDelivery" delivery ON delivery."id" = adapter."testDeliveryId"
    WHERE delivery."sourceAssignmentId" = ${assignment.id}
  `;
  const activeActivityIds = linkedActivities.filter(item => normalizedTestIds.includes(item.testId)).map(item => item.activityId);
  const closedActivityIds = linkedActivities.filter(item => !normalizedTestIds.includes(item.testId)).map(item => item.activityId);
  if (activeActivityIds.length) {
    await prisma.classActivity.updateMany({ where: { id: { in: activeActivityIds } }, data: { title: assignment.title, dueAt: assignment.deadline || null, status: 'PUBLISHED' } });
  }
  if (closedActivityIds.length) {
    await prisma.classActivity.updateMany({ where: { id: { in: closedActivityIds } }, data: { status: 'CLOSED' } });
  }
  const existingTestIds = new Set(existing.map(item => item.testId));
  const newTestIds = normalizedTestIds.filter(testId => !existingTestIds.has(testId));
  if (newTestIds.length === 0) return;
  const deliveries = await exports.createDeliveries({
    classIds: [assignment.classId],
    testIds: newTestIds,
    title: assignment.title,
    dueAt: assignment.deadline,
    maxAttempts: 1,
    scorePolicy: 'FIRST',
    userId,
    userRole,
  });
  await prisma.testDelivery.updateMany({
    where: { id: { in: deliveries.map(item => item.id) } },
    data: { sourceAssignmentId: assignment.id },
  });
};

exports.chooseAttempt = chooseAttempt;
exports.percentageScore = percentageScore;
