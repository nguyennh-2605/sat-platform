const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { chooseAttempt, percentageScore } = require('./test-delivery.service');

const RANGE_DAYS = new Set([7, 30, 90]);
const MIN_ITEM_ANSWERS = 5;
const MIN_ITEM_STUDENTS = 2;
const MIN_OUTCOME_ANSWERS = 5;

const parseRange = value => {
  const parsed = Number.parseInt(String(value || '30').replace(/d$/i, ''), 10);
  return RANGE_DAYS.has(parsed) ? parsed : 30;
};

const assertManager = async ({ classId, userId, userRole }) => {
  const classroom = await prisma.class.findUnique({
    where: { id: String(classId) },
    select: {
      id: true,
      name: true,
      teacherId: true,
      students: { orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } },
    },
  });
  if (!classroom) throw new ApiError(404, { error: 'Class not found.' });
  if (userRole !== 'ADMIN' && classroom.teacherId !== Number(userId)) {
    throw new ApiError(403, { error: 'You do not have permission to view class performance.' });
  }
  return classroom;
};

const deliveryQuestions = delivery => delivery.test.sections.flatMap(section => section.questions);

const countedSubmissions = delivery => delivery.assignees
  .filter(assignee => !assignee.excusedAt)
  .map(assignee => chooseAttempt(delivery.submissions.filter(item => item.userId === assignee.studentId), delivery.scorePolicy))
  .filter(Boolean);

const newAggregate = item => ({
  code: item.code,
  name: item.name,
  subject: item.subject,
  correct: 0,
  answerCount: 0,
  students: new Map(),
});

const addAnswer = (collection, taxonomy, studentId, isCorrect) => {
  if (!taxonomy) return;
  const aggregate = collection.get(taxonomy.code) || newAggregate(taxonomy);
  aggregate.answerCount += 1;
  aggregate.correct += Number(Boolean(isCorrect));
  const student = aggregate.students.get(studentId) || { correct: 0, answerCount: 0 };
  student.answerCount += 1;
  student.correct += Number(Boolean(isCorrect));
  aggregate.students.set(studentId, student);
  collection.set(taxonomy.code, aggregate);
};

const normalizeTaxonomy = (collection, studentsById) => [...collection.values()].map(item => {
  const measuredStudents = [...item.students.entries()];
  const affectedEvidence = measuredStudents
    .filter(([, evidence]) => evidence.answerCount >= 2 && Math.round((evidence.correct / evidence.answerCount) * 100) < 70);
  const affectedStudents = affectedEvidence
    .map(([studentId, evidence]) => ({
      id: studentId,
      name: studentsById.get(studentId)?.name || studentsById.get(studentId)?.email || 'Student',
      accuracy: Math.round((evidence.correct / evidence.answerCount) * 100),
      answerCount: evidence.answerCount,
    }))
    .sort((left, right) => left.accuracy - right.accuracy);
  const targetCorrect = affectedEvidence.reduce((sum, [, evidence]) => sum + evidence.correct, 0);
  const targetAnswers = affectedEvidence.reduce((sum, [, evidence]) => sum + evidence.answerCount, 0);
  return {
    code: item.code,
    name: item.name,
    subject: item.subject,
    correct: item.correct,
    answerCount: item.answerCount,
    studentCount: item.students.size,
    accuracy: item.answerCount ? Math.round((item.correct / item.answerCount) * 100) : null,
    sufficient: item.answerCount >= MIN_ITEM_ANSWERS && item.students.size >= MIN_ITEM_STUDENTS,
    affectedStudents,
    targetBaseline: {
      correct: affectedEvidence.length ? targetCorrect : item.correct,
      answerCount: affectedEvidence.length ? targetAnswers : item.answerCount,
      studentCount: affectedStudents.length || item.students.size,
      accuracy: targetAnswers ? Math.round((targetCorrect / targetAnswers) * 100) : item.answerCount ? Math.round((item.correct / item.answerCount) * 100) : null,
    },
  };
}).sort((left, right) => Number(right.sufficient) - Number(left.sufficient) || (left.accuracy ?? 101) - (right.accuracy ?? 101) || right.answerCount - left.answerCount);

const deriveFollowUpStatus = followUp => {
  if (['RESOLVED', 'NEEDS_FOLLOW_UP', 'DISMISSED'].includes(followUp.status)) return followUp.status;
  const assignees = followUp.activities.flatMap(activity => activity.assignees).filter(item => !item.excusedAt);
  if (!followUp.activities.length || !assignees.length) return 'OPEN';
  const completed = assignees.filter(item => item.status === 'COMPLETED').length;
  if (completed === assignees.length) return 'READY_TO_EVALUATE';
  if (completed > 0 || assignees.some(item => item.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
  return 'ASSIGNED';
};

const followUpOutcome = followUp => {
  let correct = 0;
  let answerCount = 0;
  const studentIds = new Set(followUp.targets.map(item => item.studentId));
  for (const activity of followUp.activities) {
    const delivery = activity.test?.testDelivery;
    if (!delivery) continue;
    for (const submission of countedSubmissions(delivery)) {
      if (!studentIds.has(submission.userId)) continue;
      for (const answer of submission.answers) {
        const question = answer.question;
        const matches = followUp.skillCode
          ? question.skillCode === followUp.skillCode
          : followUp.domainCode
            ? question.domainCode === followUp.domainCode
            : true;
        if (!matches) continue;
        answerCount += 1;
        correct += Number(Boolean(answer.isCorrect));
      }
    }
  }
  const accuracy = answerCount ? Math.round((correct / answerCount) * 100) : null;
  return {
    correct,
    answerCount,
    accuracy,
    sufficient: answerCount >= MIN_OUTCOME_ANSWERS,
    delta: accuracy !== null && followUp.baselineAccuracy !== null && answerCount >= MIN_OUTCOME_ANSWERS
      ? accuracy - followUp.baselineAccuracy
      : null,
  };
};

const serializeFollowUp = followUp => {
  const assignees = followUp.activities.flatMap(activity => activity.assignees).filter(item => !item.excusedAt);
  const completed = assignees.filter(item => item.status === 'COMPLETED').length;
  return {
    id: followUp.id,
    sourceType: followUp.sourceType,
    actionType: followUp.actionType,
    status: deriveFollowUpStatus(followUp),
    subject: followUp.subject,
    domainCode: followUp.domainCode,
    domainName: followUp.domainName,
    skillCode: followUp.skillCode,
    skillName: followUp.skillName,
    sourceDeliveryId: followUp.sourceDeliveryId,
    sourceStudentId: followUp.sourceStudentId,
    reason: followUp.reason,
    baseline: {
      accuracy: followUp.baselineAccuracy,
      correct: followUp.baselineCorrect,
      answerCount: followUp.baselineAnswerCount,
      studentCount: followUp.baselineStudentCount,
      classificationCoverage: followUp.classificationCoverage,
    },
    outcome: followUpOutcome(followUp),
    targets: followUp.targets.map(item => ({ id: item.student.id, name: item.student.name || item.student.email, email: item.student.email })),
    progress: { assigned: assignees.length, completed },
    activities: followUp.activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      dueAt: activity.dueAt,
      deliveryId: activity.test?.testDeliveryId || null,
      assignmentId: activity.homework?.assignmentId || null,
    })),
    resolutionNote: followUp.resolutionNote,
    createdAt: followUp.createdAt,
    resolvedAt: followUp.resolvedAt,
  };
};

exports.getClassPerformance = async ({ classId, userId, userRole, range }) => {
  const classroom = await assertManager({ classId, userId, userRole });
  const rangeDays = parseRange(range);
  const cutoff = new Date(Date.now() - rangeDays * 86_400_000);
  const [deliveries, followUps, attendanceSessions] = await Promise.all([
    prisma.testDelivery.findMany({
      where: { classId: classroom.id, status: { in: ['PUBLISHED', 'CLOSED'] }, OR: [{ createdAt: { gte: cutoff } }, { submissions: { some: { status: 'COMPLETED', endTime: { gte: cutoff } } } }] },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, dueAt: true, createdAt: true, scorePolicy: true,
        test: { select: { id: true, subject: true, mode: true, sections: { select: { questions: { select: { id: true, domainCode: true, skillCode: true, domain: { select: { code: true, name: true, subject: true } }, skill: { select: { code: true, name: true, domain: { select: { subject: true } } } } } } } } } },
        assignees: { select: { studentId: true, excusedAt: true } },
        submissions: { select: { id: true, userId: true, attemptNo: true, status: true, score: true, endTime: true, startedAt: true, answers: { select: { questionId: true, isCorrect: true } } } },
      },
    }),
    prisma.learningFollowUp.findMany({
      where: { classId: classroom.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        targets: { include: { student: { select: { id: true, name: true, email: true } } } },
        activities: {
          include: {
            assignees: { select: { studentId: true, status: true, excusedAt: true } },
            homework: { select: { assignmentId: true } },
            test: { include: { testDelivery: { select: { id: true, scorePolicy: true, assignees: { select: { studentId: true, excusedAt: true } }, submissions: { where: { status: 'COMPLETED' }, select: { userId: true, attemptNo: true, status: true, score: true, answers: { select: { isCorrect: true, question: { select: { domainCode: true, skillCode: true } } } } } } } } } },
          },
        },
      },
    }),
    prisma.attendanceSession.findMany({
      where: { lesson: { week: { classId: classroom.id } }, recordedAt: { gte: cutoff } },
      select: { id: true, records: { select: { studentId: true, status: true } } },
    }),
  ]);

  const studentsById = new Map(classroom.students.map(student => [student.id, student]));
  const studentMetrics = new Map(classroom.students.map(student => [student.id, {
    id: student.id, name: student.name || student.email, email: student.email,
    assigned: 0, completed: 0, overdue: 0, correct: 0, answerCount: 0, scores: [], skillEvidence: new Map(), attendanceMarked: 0, absences: 0, late: 0,
  }]));
  const domains = new Map();
  const skills = new Map();
  let assigned = 0;
  let completed = 0;
  let totalAnswers = 0;
  let classifiedAnswers = 0;
  const assessmentRows = [];

  for (const session of attendanceSessions) {
    for (const record of session.records) {
      const metric = studentMetrics.get(record.studentId);
      if (!metric) continue;
      metric.attendanceMarked += 1;
      metric.absences += Number(record.status === 'ABSENT');
      metric.late += Number(record.status === 'LATE');
    }
  }

  for (const delivery of deliveries) {
    const questions = deliveryQuestions(delivery);
    const questionById = new Map(questions.map(question => [question.id, question]));
    const activeAssignees = delivery.assignees.filter(item => !item.excusedAt);
    const counted = countedSubmissions(delivery);
    const completedIds = new Set(counted.map(item => item.userId));
    assigned += activeAssignees.length;
    completed += completedIds.size;
    const scores = [];
    for (const assignee of activeAssignees) {
      const metric = studentMetrics.get(assignee.studentId);
      if (!metric) continue;
      metric.assigned += 1;
      if (completedIds.has(assignee.studentId)) metric.completed += 1;
      else if (delivery.dueAt && new Date(delivery.dueAt) < new Date()) metric.overdue += 1;
    }
    for (const submission of counted) {
      const metric = studentMetrics.get(submission.userId);
      const score = percentageScore(submission.score, questions.length);
      if (Number.isFinite(score)) {
        scores.push(score);
        metric?.scores.push({ value: score, completedAt: submission.endTime || submission.startedAt });
      }
      for (const answer of submission.answers) {
        const question = questionById.get(answer.questionId);
        totalAnswers += 1;
        if (!question?.domain) continue;
        classifiedAnswers += 1;
        addAnswer(domains, question.domain, submission.userId, answer.isCorrect);
        if (question.skill) addAnswer(skills, { code: question.skill.code, name: question.skill.name, subject: question.skill.domain.subject }, submission.userId, answer.isCorrect);
        if (metric) {
          metric.answerCount += 1;
          metric.correct += Number(Boolean(answer.isCorrect));
          if (question.skill) {
            const evidence = metric.skillEvidence.get(question.skill.code) || { code: question.skill.code, name: question.skill.name, correct: 0, answerCount: 0 };
            evidence.answerCount += 1;
            evidence.correct += Number(Boolean(answer.isCorrect));
            metric.skillEvidence.set(question.skill.code, evidence);
          }
        }
      }
    }
    assessmentRows.push({
      id: delivery.id,
      title: delivery.title,
      subject: delivery.test.subject,
      mode: delivery.test.mode,
      dueAt: delivery.dueAt,
      createdAt: delivery.createdAt,
      assigned: activeAssignees.length,
      completed: completedIds.size,
      completionRate: activeAssignees.length ? Math.round((completedIds.size / activeAssignees.length) * 100) : 0,
      averageAccuracy: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
    });
  }

  const normalizedSkills = normalizeTaxonomy(skills, studentsById);
  const students = [...studentMetrics.values()].map(metric => {
    const orderedScores = metric.scores.sort((left, right) => new Date(left.completedAt) - new Date(right.completedAt));
    const recent = orderedScores.slice(-3).map(item => item.value);
    const previous = orderedScores.slice(-6, -3).map(item => item.value);
    const average = values => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
    const recentAverage = average(recent);
    const previousAverage = average(previous);
    const weakSkills = [...metric.skillEvidence.values()]
      .filter(item => item.answerCount >= 2)
      .map(item => ({ ...item, accuracy: Math.round((item.correct / item.answerCount) * 100) }))
      .filter(item => item.accuracy < 70)
      .sort((left, right) => left.accuracy - right.accuracy)
      .slice(0, 3);
    return {
      id: metric.id,
      name: metric.name,
      email: metric.email,
      assigned: metric.assigned,
      completed: metric.completed,
      completionRate: metric.assigned ? Math.round((metric.completed / metric.assigned) * 100) : null,
      overdue: metric.overdue,
      attendance: { sessions: metric.attendanceMarked, absences: metric.absences, late: metric.late },
      accuracy: metric.answerCount ? Math.round((metric.correct / metric.answerCount) * 100) : null,
      answerCount: metric.answerCount,
      trend: recentAverage !== null && previousAverage !== null ? recentAverage - previousAverage : null,
      weakSkills,
    };
  }).sort((left, right) => right.overdue - left.overdue || (left.accuracy ?? 101) - (right.accuracy ?? 101));

  const scoredStudents = students.filter(student => student.accuracy !== null);
  const attendanceRecords = attendanceSessions.flatMap(session => session.records);
  const countedAttendance = attendanceRecords.filter(record => record.status !== 'EXCUSED');
  const presentAttendance = countedAttendance.filter(record => record.status === 'PRESENT' || record.status === 'LATE').length;
  return {
    generatedAt: new Date().toISOString(),
    rangeDays,
    class: { id: classroom.id, name: classroom.name, studentCount: classroom.students.length },
    summary: {
      assigned,
      completed,
      completionRate: assigned ? Math.round((completed / assigned) * 100) : null,
      assessedStudents: scoredStudents.length,
      averageAccuracy: scoredStudents.length ? Math.round(scoredStudents.reduce((sum, student) => sum + student.accuracy, 0) / scoredStudents.length) : null,
      needsAttention: students.filter(student => student.overdue > 0 || (student.answerCount >= MIN_ITEM_ANSWERS && student.accuracy < 60) || (student.attendance.sessions >= 3 && student.attendance.absences >= 2)).length,
      classificationCoverage: totalAnswers ? Math.round((classifiedAnswers / totalAnswers) * 100) : null,
      totalAnswers,
      attendance: {
        sessions: attendanceSessions.length,
        present: presentAttendance,
        records: countedAttendance.length,
        rate: countedAttendance.length ? Math.round((presentAttendance / countedAttendance.length) * 100) : null,
      },
    },
    students,
    domains: normalizeTaxonomy(domains, studentsById),
    skills: normalizedSkills,
    assessments: assessmentRows,
    followUps: followUps.map(serializeFollowUp),
  };
};

exports.parseRange = parseRange;
exports.deriveFollowUpStatus = deriveFollowUpStatus;
exports.followUpOutcome = followUpOutcome;
