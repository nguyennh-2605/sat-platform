const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const CORE_WINDOW_DAYS = 30;
const UPCOMING_DAYS = 14;
const DUE_SOON_HOURS = 48;
const INACTIVITY_DAYS = 8;
const MIN_INSIGHT_ANSWERS = 30;
const MIN_ITEM_ANSWERS = 20;
const MIN_ITEM_STUDENTS = 3;
const MIN_CLASSIFICATION_COVERAGE = 70;

const addDays = (date, days) => new Date(date.getTime() + days * 86_400_000);
const addHours = (date, hours) => new Date(date.getTime() + hours * 3_600_000);
const activeAssignees = activity => (activity.assignees || []).filter(item => !item.excusedAt);
const completedAssignees = activity => activeAssignees(activity).filter(item => item.status === 'COMPLETED');
const assessedActivity = activity => activity.type === 'TEST' || activity.type === 'VOCABULARY';

const activityHref = activity => {
  if (activity.type === 'TEST' && activity.test?.testDeliveryId) {
    return `/dashboard/class/${activity.classId}?tab=performance&deliveryId=${activity.test.testDeliveryId}`;
  }
  if (activity.type === 'HOMEWORK' && activity.homework?.assignmentId) {
    return `/dashboard/class/${activity.classId}/assignment/${activity.homework.assignmentId}`;
  }
  return `/dashboard/class/${activity.classId}?tab=activities`;
};

const activityAction = activity => activity.type === 'TEST'
  ? 'View performance'
  : activity.type === 'HOMEWORK'
    ? 'Open assignment'
    : 'Open activity';

const activityStats = (activity, now) => {
  const assignees = activeAssignees(activity);
  const completed = assignees.filter(item => item.status === 'COMPLETED').length;
  const inProgress = assignees.filter(item => item.status === 'IN_PROGRESS').length;
  const incomplete = Math.max(0, assignees.length - completed);
  const overdue = Boolean(activity.dueAt && new Date(activity.dueAt) < now);
  return {
    assigned: assignees.length,
    completed,
    inProgress,
    incomplete,
    missing: overdue ? incomplete : 0,
  };
};

const buildAttention = (activities, now = new Date()) => {
  const dueSoonAt = addHours(now, DUE_SOON_HOURS);
  return activities.flatMap(activity => {
    if (!activity.dueAt) return [];
    const dueAt = new Date(activity.dueAt);
    const stats = activityStats(activity, now);
    if (stats.assigned === 0 || stats.incomplete === 0 || dueAt > dueSoonAt) return [];
    const reason = dueAt < now ? 'OVERDUE' : 'DUE_SOON';
    return [{
      id: activity.id,
      type: activity.type,
      title: activity.title,
      classId: activity.classId,
      className: activity.class.name,
      dueAt: dueAt.toISOString(),
      reason,
      reasonLabel: reason === 'OVERDUE'
        ? `${stats.missing} ${stats.missing === 1 ? 'student' : 'students'} missing`
        : `${stats.incomplete} ${stats.incomplete === 1 ? 'student' : 'students'} remaining`,
      stats,
      href: activityHref(activity),
      actionLabel: activityAction(activity),
    }];
  }).sort((first, second) => {
    const reasonDifference = Number(first.reason !== 'OVERDUE') - Number(second.reason !== 'OVERDUE');
    return reasonDifference || new Date(first.dueAt) - new Date(second.dueAt);
  }).slice(0, 8);
};

const buildUpcoming = (activities, lessons, now = new Date()) => {
  const horizon = addDays(now, UPCOMING_DAYS);
  const events = [];
  for (const activity of activities) {
    for (const [eventType, value] of [['AVAILABLE', activity.availableAt], ['DUE', activity.dueAt]]) {
      if (!value) continue;
      const occursAt = new Date(value);
      if (occursAt <= now || occursAt > horizon) continue;
      events.push({
        id: `${activity.id}:${eventType}`,
        eventType,
        activityType: activity.type,
        title: activity.title,
        classId: activity.classId,
        className: activity.class.name,
        occursAt: occursAt.toISOString(),
        href: activityHref(activity),
      });
    }
  }
  for (const lesson of lessons) {
    if (!lesson.scheduledAt) continue;
    const occursAt = new Date(lesson.scheduledAt);
    if (occursAt <= now || occursAt > horizon) continue;
    events.push({
      id: `lesson:${lesson.id}`,
      eventType: 'LESSON',
      activityType: null,
      title: lesson.title,
      classId: lesson.week.class.id,
      className: lesson.week.class.name,
      occursAt: occursAt.toISOString(),
      href: `/dashboard/class/${lesson.week.class.id}?tab=lessons`,
    });
  }
  return events.sort((first, second) => new Date(first.occursAt) - new Date(second.occursAt)).slice(0, 8);
};

const buildClassPulse = ({ classes, activities, attention, now = new Date() }) => {
  const cutoff = addDays(now, -CORE_WINDOW_DAYS);
  const attentionByClass = attention.reduce((map, item) => map.set(item.classId, (map.get(item.classId) || 0) + 1), new Map());
  return classes.map(classroom => {
    const recentActivities = activities.filter(activity => {
      if (activity.classId !== classroom.id) return false;
      if (activity.availableAt && new Date(activity.availableAt) > now) return false;
      return new Date(activity.dueAt || activity.createdAt) >= cutoff;
    });
    const assignees = recentActivities.flatMap(activeAssignees);
    const completed = assignees.filter(item => item.status === 'COMPLETED').length;
    const scores = recentActivities
      .filter(assessedActivity)
      .flatMap(completedAssignees)
      .map(item => item.bestScore)
      .filter(Number.isFinite);
    return {
      id: classroom.id,
      name: classroom.name,
      color: classroom.color,
      studentCount: classroom.students.length,
      activityCount: recentActivities.length,
      completionRate: assignees.length ? Math.round((completed / assignees.length) * 100) : null,
      averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
      attentionCount: attentionByClass.get(classroom.id) || 0,
      href: `/dashboard/class/${classroom.id}`,
    };
  });
};

const chooseAttempt = submissions => {
  const completed = submissions.filter(item => item.status === 'COMPLETED');
  if (!completed.length) return null;
  const policy = completed[0].delivery?.scorePolicy || 'FIRST';
  if (policy === 'BEST') return [...completed].sort((a, b) => (b.score || 0) - (a.score || 0) || a.attemptNo - b.attemptNo)[0];
  if (policy === 'LATEST') return [...completed].sort((a, b) => b.attemptNo - a.attemptNo)[0];
  return [...completed].sort((a, b) => a.attemptNo - b.attemptNo)[0];
};

const countedTestScores = submissions => {
  const grouped = new Map();
  for (const submission of submissions) {
    const key = `${submission.deliveryId}:${submission.userId}`;
    const group = grouped.get(key) || [];
    group.push(submission);
    grouped.set(key, group);
  }
  return [...grouped.values()].flatMap(group => {
    const chosen = chooseAttempt(group);
    if (!chosen || !Number.isFinite(chosen.score)) return [];
    const questionCount = (chosen.test?.sections || []).reduce((sum, section) => sum + section._count.questions, 0);
    if (!questionCount) return [];
    return [{
      studentId: chosen.userId,
      classId: chosen.delivery.classId,
      deliveryId: chosen.deliveryId,
      completedAt: chosen.endTime || chosen.startedAt,
      score: Math.round((chosen.score / questionCount) * 100),
    }];
  });
};

const buildCheckIns = ({ classes, activities, submissions, now = new Date() }) => {
  const inactivityCutoff = addDays(now, -INACTIVITY_DAYS);
  const scores = countedTestScores(submissions);
  const candidates = [];

  for (const classroom of classes) {
    const classActivities = activities.filter(activity => activity.classId === classroom.id);
    for (const student of classroom.students) {
      const assignments = classActivities.flatMap(activity => activeAssignees(activity)
        .filter(assignee => assignee.studentId === student.id)
        .map(assignee => ({ activity, assignee })));
      const overdue = assignments.filter(({ activity, assignee }) => activity.dueAt && new Date(activity.dueAt) < now && assignee.status !== 'COMPLETED').length;
      if (overdue > 0) {
        candidates.push({
          studentId: student.id,
          studentName: student.name || student.email,
          studentEmail: student.email,
          classId: classroom.id,
          className: classroom.name,
          reason: 'OVERDUE',
          reasonLabel: `${overdue} overdue ${overdue === 1 ? 'activity' : 'activities'}`,
          priority: 0,
          magnitude: overdue,
          href: `/dashboard/class/${classroom.id}?tab=activities`,
        });
        continue;
      }

      const outstanding = assignments.filter(({ assignee }) => assignee.status !== 'COMPLETED' && new Date(assignee.assignedAt) <= inactivityCutoff);
      const latestAction = assignments
        .flatMap(({ assignee }) => [assignee.startedAt, assignee.completedAt].filter(Boolean))
        .map(value => new Date(value))
        .sort((first, second) => second - first)[0];
      if (outstanding.length > 0 && (!latestAction || latestAction <= inactivityCutoff)) {
        candidates.push({
          studentId: student.id,
          studentName: student.name || student.email,
          studentEmail: student.email,
          classId: classroom.id,
          className: classroom.name,
          reason: 'INACTIVE',
          reasonLabel: `No classroom activity started in ${INACTIVITY_DAYS} days`,
          priority: 1,
          magnitude: outstanding.length,
          href: `/dashboard/class/${classroom.id}?tab=activities`,
        });
        continue;
      }

      const recentScores = scores
        .filter(item => item.classId === classroom.id && item.studentId === student.id)
        .sort((first, second) => new Date(second.completedAt) - new Date(first.completedAt))
        .slice(0, 3)
        .reverse();
      if (recentScores.length === 3) {
        const [oldest, middle, latest] = recentScores;
        const decline = oldest.score - latest.score;
        if (oldest.score > middle.score && middle.score > latest.score && decline >= 10) {
          candidates.push({
            studentId: student.id,
            studentName: student.name || student.email,
            studentEmail: student.email,
            classId: classroom.id,
            className: classroom.name,
            reason: 'DECLINING_SCORE',
            reasonLabel: `Score dropped ${decline} points across the last 3 tests`,
            priority: 2,
            magnitude: decline,
            href: `/dashboard/class/${classroom.id}?tab=performance&deliveryId=${latest.deliveryId}`,
          });
        }
      }
    }
  }

  const uniqueStudents = new Set();
  return candidates
    .sort((first, second) => first.priority - second.priority || second.magnitude - first.magnitude || first.studentName.localeCompare(second.studentName))
    .filter(item => {
      if (uniqueStudents.has(item.studentId)) return false;
      uniqueStudents.add(item.studentId);
      return true;
    })
    .slice(0, 5)
    .map(({ priority, magnitude, ...item }) => item);
};

const scopeFor = async ({ db, teacherId, classId }) => {
  const classes = await db.class.findMany({
    where: { teacherId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      color: true,
      students: { select: { id: true, name: true, email: true } },
    },
  });
  const requestedClassId = classId && classId !== 'all' ? String(classId) : null;
  if (requestedClassId && !classes.some(classroom => classroom.id === requestedClassId)) {
    throw new ApiError(403, { error: 'You do not have access to this class.' });
  }
  return {
    classes,
    selectedClassId: requestedClassId,
    scopedClasses: requestedClassId ? classes.filter(classroom => classroom.id === requestedClassId) : classes,
  };
};

async function getOverviewWithDb({ db, userId, classId, now = new Date() }) {
  const teacherId = Number.parseInt(userId, 10);
  if (!teacherId) throw new ApiError(401, { error: 'Sign in to view your overview.' });
  const scope = await scopeFor({ db, teacherId, classId });
  const scopedClassIds = scope.scopedClasses.map(classroom => classroom.id);
  if (!scopedClassIds.length) {
    return {
      generatedAt: now.toISOString(),
      scope: { selectedClassId: scope.selectedClassId, classes: scope.classes.map(({ id, name }) => ({ id, name })) },
      needsAttention: [], upcoming: [], classes: [], checkIns: [],
    };
  }

  const cutoff = addDays(now, -CORE_WINDOW_DAYS);
  const horizon = addDays(now, UPCOMING_DAYS);
  const [activities, lessons, submissions] = await Promise.all([
    db.classActivity.findMany({
      where: { classId: { in: scopedClassIds }, status: 'PUBLISHED' },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true, type: true, title: true, classId: true, availableAt: true, dueAt: true, createdAt: true,
        class: { select: { id: true, name: true } },
        assignees: { select: { studentId: true, status: true, assignedAt: true, startedAt: true, completedAt: true, bestScore: true, excusedAt: true } },
        test: { select: { testDeliveryId: true } },
        homework: { select: { assignmentId: true } },
      },
    }),
    db.lesson.findMany({
      where: { week: { classId: { in: scopedClassIds } }, scheduledAt: { gt: now, lte: horizon }, status: { in: ['SCHEDULED', 'PUBLISHED'] } },
      orderBy: { scheduledAt: 'asc' },
      select: { id: true, title: true, scheduledAt: true, week: { select: { class: { select: { id: true, name: true } } } } },
    }),
    db.submission.findMany({
      where: { status: 'COMPLETED', endTime: { gte: cutoff }, delivery: { classId: { in: scopedClassIds } } },
      orderBy: { endTime: 'desc' },
      select: {
        userId: true, deliveryId: true, attemptNo: true, status: true, score: true, startedAt: true, endTime: true,
        delivery: { select: { classId: true, scorePolicy: true } },
        test: { select: { sections: { select: { _count: { select: { questions: true } } } } } },
      },
    }),
  ]);

  const needsAttention = buildAttention(activities, now);
  return {
    generatedAt: now.toISOString(),
    scope: {
      selectedClassId: scope.selectedClassId,
      classes: scope.classes.map(({ id, name }) => ({ id, name })),
    },
    needsAttention,
    upcoming: buildUpcoming(activities, lessons, now),
    classes: buildClassPulse({ classes: scope.scopedClasses, activities, attention: needsAttention, now }),
    checkIns: buildCheckIns({ classes: scope.scopedClasses, activities, submissions, now }),
  };
}

const buildInsights = ({ submissions, now = new Date(), rangeDays = CORE_WINDOW_DAYS }) => {
  const grouped = new Map();
  for (const submission of submissions) {
    const key = `${submission.deliveryId}:${submission.userId}`;
    const group = grouped.get(key) || [];
    group.push(submission);
    grouped.set(key, group);
  }
  const counted = [...grouped.values()].map(chooseAttempt).filter(Boolean);
  const domains = new Map();
  const skills = new Map();
  let total = 0;
  let classified = 0;

  for (const submission of counted) {
    for (const answer of submission.answers || []) {
      total += 1;
      const domain = answer.question?.domain;
      const skill = answer.question?.skill;
      if (!domain) continue;
      classified += 1;
      const domainItem = domains.get(domain.code) || { code: domain.code, name: domain.name, subject: domain.subject, correct: 0, answerCount: 0, students: new Set() };
      domainItem.answerCount += 1;
      domainItem.correct += Number(Boolean(answer.isCorrect));
      domainItem.students.add(submission.userId);
      domains.set(domain.code, domainItem);
      if (!skill) continue;
      const skillItem = skills.get(skill.code) || { code: skill.code, name: skill.name, subject: domain.subject, correct: 0, answerCount: 0, students: new Set() };
      skillItem.answerCount += 1;
      skillItem.correct += Number(Boolean(answer.isCorrect));
      skillItem.students.add(submission.userId);
      skills.set(skill.code, skillItem);
    }
  }

  const coverage = total ? Math.round((classified / total) * 100) : null;
  const normalize = collection => [...collection.values()]
    .map(item => ({
      code: item.code,
      name: item.name,
      subject: item.subject,
      correct: item.correct,
      answerCount: item.answerCount,
      studentCount: item.students.size,
      accuracy: Math.round((item.correct / item.answerCount) * 100),
    }))
    .filter(item => item.answerCount >= MIN_ITEM_ANSWERS && item.studentCount >= MIN_ITEM_STUDENTS)
    .sort((first, second) => first.accuracy - second.accuracy || second.answerCount - first.answerCount);

  return {
    generatedAt: now.toISOString(),
    rangeDays,
    sufficient: classified >= MIN_INSIGHT_ANSWERS && coverage >= MIN_CLASSIFICATION_COVERAGE,
    classificationCoverage: { classified, total, percentage: coverage },
    completedSubmissions: counted.length,
    studentCount: new Set(counted.map(item => item.userId)).size,
    domains: normalize(domains),
    skills: normalize(skills),
  };
};

async function getInsightsWithDb({ db, userId, classId, range = '30d', now = new Date() }) {
  const teacherId = Number.parseInt(userId, 10);
  if (!teacherId) throw new ApiError(401, { error: 'Sign in to view learning insights.' });
  const rangeDays = range === '90d' ? 90 : range === '7d' ? 7 : CORE_WINDOW_DAYS;
  const scope = await scopeFor({ db, teacherId, classId });
  const scopedClassIds = scope.scopedClasses.map(classroom => classroom.id);
  if (!scopedClassIds.length) return buildInsights({ submissions: [], now, rangeDays });
  const cutoff = addDays(now, -rangeDays);
  const submissions = await db.submission.findMany({
    where: { status: 'COMPLETED', endTime: { gte: cutoff }, delivery: { classId: { in: scopedClassIds } } },
    orderBy: { endTime: 'asc' },
    select: {
      userId: true, deliveryId: true, attemptNo: true, status: true, score: true, startedAt: true, endTime: true,
      delivery: { select: { classId: true, scorePolicy: true } },
      test: { select: { subject: true } },
      answers: { select: { isCorrect: true, question: { select: { domain: { select: { code: true, name: true, subject: true } }, skill: { select: { code: true, name: true } } } } } },
    },
  });
  return buildInsights({ submissions, now, rangeDays });
}

exports.getOverview = params => getOverviewWithDb({ ...params, db: prisma });
exports.getInsights = params => getInsightsWithDb({ ...params, db: prisma });
exports.getOverviewWithDb = getOverviewWithDb;
exports.getInsightsWithDb = getInsightsWithDb;
exports.buildAttention = buildAttention;
exports.buildUpcoming = buildUpcoming;
exports.buildClassPulse = buildClassPulse;
exports.buildCheckIns = buildCheckIns;
exports.buildInsights = buildInsights;
exports.chooseAttempt = chooseAttempt;
