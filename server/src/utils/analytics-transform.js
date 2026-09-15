const { domains: taxonomyDomainList, getTaxonomy, skills: taxonomySkillList } = require('./question-taxonomy');

const MIN_RANKABLE_ANSWERS = 10;
const MIN_TREND_GROUP_ANSWERS = 5;
const WEAK_ACCURACY_THRESHOLD = 80;
const NEGATIVE_TREND_THRESHOLD = -8;
const SLOW_QUESTION_MS = 2 * 60 * 1000;

const round = value => Number(value.toFixed(1));
const accuracyOf = (correct, attempted) => attempted ? round((correct / attempted) * 100) : null;
const completedAtOf = submission => new Date(submission.endTime || submission.startedAt);
const normalizedSubject = value => value === 'MATH' ? 'MATH' : 'RW';

const confidenceOf = attempted => {
  if (attempted < 5) return 'NOT_ENOUGH_DATA';
  if (attempted < MIN_RANKABLE_ANSWERS) return 'EARLY_SIGNAL';
  return 'RANKABLE';
};

const trendOf = points => {
  if (points.length < MIN_TREND_GROUP_ANSWERS * 2) return null;
  const ordered = [...points].sort((first, second) => first.date - second.date);
  const splitAt = Math.floor(ordered.length / 2);
  const previous = ordered.slice(0, splitAt);
  const recent = ordered.slice(splitAt);
  if (previous.length < MIN_TREND_GROUP_ANSWERS || recent.length < MIN_TREND_GROUP_ANSWERS) return null;
  const previousAccuracy = accuracyOf(previous.filter(point => point.correct).length, previous.length);
  const recentAccuracy = accuracyOf(recent.filter(point => point.correct).length, recent.length);
  return round(recentAccuracy - previousAccuracy);
};

const averageOf = values => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

const isTimingEligible = submission => submission?.status === 'COMPLETED' && submission?.test?.mode === 'EXAM';

const sourceOf = submission => submission.deliveryId || submission.classTestId || submission.assignmentId
  ? 'CLASSROOM'
  : 'SELF_STUDY';

const skillByCode = new Map(taxonomySkillList.map(skill => [skill.code, skill]));
const skillByName = new Map(taxonomySkillList.map(skill => [skill.name, skill]));
const domainByCode = new Map(taxonomyDomainList.map(domain => [domain.code, domain]));
const domainByName = new Map(taxonomyDomainList.map(domain => [domain.name, domain]));

function classifyErrorLog(log) {
  const linkedSkillCode = log.question?.skillCode || log.question?.skill?.code;
  const linkedSkill = linkedSkillCode ? skillByCode.get(linkedSkillCode) : null;
  const categorySkill = skillByName.get(log.category);
  const skill = linkedSkill || categorySkill || null;
  const linkedDomainCode = log.question?.domainCode || log.question?.domain?.code;
  const linkedDomain = linkedDomainCode ? domainByCode.get(linkedDomainCode) : null;
  const categoryDomain = domainByName.get(log.category);
  const domain = linkedDomain || (skill ? domainByCode.get(skill.domainCode) : null) || categoryDomain || null;
  const subject = log.question?.section?.test?.subject || domain?.subject || null;
  return { skill, domain, subject };
}

function buildMistakeReview(errorLogs, subject) {
  const byArea = new Map();
  const bySkill = new Map();
  const byDomain = new Map();
  let saved = 0;
  let reviewed = 0;

  for (const log of errorLogs) {
    const classified = classifyErrorLog(log);
    if (subject !== 'ALL' && classified.subject !== subject) continue;
    saved += 1;
    if (log.reviewedAt) reviewed += 1;
    const areaKey = classified.skill?.code || classified.domain?.code || `CATEGORY:${log.category || 'General'}`;
    const areaName = classified.skill?.name || classified.domain?.name || log.category || 'General';
    const update = (map, key) => {
      if (!key) return;
      const current = map.get(key) || { saved: 0, needsReview: 0, reviewed: 0 };
      current.saved += 1;
      if (log.reviewedAt) current.reviewed += 1;
      else current.needsReview += 1;
      map.set(key, current);
    };
    update(byArea, areaKey);
    const area = byArea.get(areaKey);
    area.name = areaName;
    area.category = log.category || areaName;
    update(bySkill, classified.skill?.code);
    update(byDomain, classified.domain?.code);
  }

  return {
    summary: {
      saved,
      needsReview: saved - reviewed,
      reviewed,
      completion: saved ? round((reviewed / saved) * 100) : null,
    },
    topAreas: [...byArea.values()]
      .sort((first, second) => second.saved - first.saved || second.needsReview - first.needsReview || first.name.localeCompare(second.name))
      .slice(0, 5),
    bySkill,
    byDomain,
  };
}

function buildPerformance(submissions, errorLogs, subject) {
  const selectedTaxonomy = getTaxonomy(subject === 'ALL' ? undefined : subject);
  const states = new Map(selectedTaxonomy.map(domain => [domain.code, {
    ...domain,
    correct: 0,
    attempted: 0,
    points: [],
    timings: [],
    skills: new Map(domain.skills.map(skill => [skill.code, {
      ...skill,
      correct: 0,
      attempted: 0,
      points: [],
      timings: [],
    }])),
  }]));
  const mistakes = buildMistakeReview(errorLogs, subject);
  let total = 0;
  let classified = 0;

  for (const submission of submissions) {
    if (subject !== 'ALL' && normalizedSubject(submission.test?.subject) !== subject) continue;
    const date = completedAtOf(submission);
    const timingByQuestion = new Map((isTimingEligible(submission) ? submission.questionTimings || [] : []).map(timing => [timing.questionId, timing.activeDurationMs]));
    for (const answer of submission.answers || []) {
      total += 1;
      const domainCode = answer.question?.domainCode || answer.question?.domain?.code;
      const state = states.get(domainCode);
      if (!state) continue;
      classified += 1;
      const point = { correct: Boolean(answer.isCorrect), date };
      state.attempted += 1;
      if (answer.isCorrect) state.correct += 1;
      state.points.push(point);
      const duration = timingByQuestion.get(answer.question?.id);
      if (Number.isFinite(duration) && duration > 0) state.timings.push(duration);

      const skillCode = answer.question?.skillCode || answer.question?.skill?.code;
      const skill = state.skills.get(skillCode);
      if (!skill) continue;
      skill.attempted += 1;
      if (answer.isCorrect) skill.correct += 1;
      skill.points.push(point);
      if (Number.isFinite(duration) && duration > 0) skill.timings.push(duration);
    }
  }

  const domains = [...states.values()].map(domain => {
    const mistake = mistakes.byDomain.get(domain.code) || { saved: 0, needsReview: 0, reviewed: 0 };
    return {
      code: domain.code,
      name: domain.name,
      subject: domain.subject,
      sortOrder: domain.sortOrder,
      correct: domain.correct,
      attempted: domain.attempted,
      accuracy: accuracyOf(domain.correct, domain.attempted),
      confidence: confidenceOf(domain.attempted),
      trendDelta: trendOf(domain.points),
      mistakes: mistake.saved,
      needsReview: mistake.needsReview,
      avgTimeMs: averageOf(domain.timings),
      skills: [...domain.skills.values()].map(skill => {
        const skillMistake = mistakes.bySkill.get(skill.code) || { saved: 0, needsReview: 0, reviewed: 0 };
        return {
          code: skill.code,
          name: skill.name,
          correct: skill.correct,
          attempted: skill.attempted,
          accuracy: accuracyOf(skill.correct, skill.attempted),
          confidence: confidenceOf(skill.attempted),
          trendDelta: trendOf(skill.points),
          mistakes: skillMistake.saved,
          needsReview: skillMistake.needsReview,
          avgTimeMs: averageOf(skill.timings),
        };
      }),
    };
  });

  return {
    domains,
    mistakes,
    coverage: {
      classified,
      total,
      percentage: total ? round((classified / total) * 100) : null,
      unclassified: total - classified,
    },
  };
}

function buildFocusAreas(domains) {
  const skillCandidates = domains.flatMap(domain => domain.skills.map(skill => ({
    ...skill,
    subject: domain.subject,
    domainCode: domain.code,
    domainName: domain.name,
    kind: 'SKILL',
    category: skill.name,
  })));
  const domainCandidates = domains.map(domain => ({
    ...domain,
    domainCode: domain.code,
    domainName: domain.name,
    kind: 'DOMAIN',
    category: domain.name,
  }));
  const qualifies = item => item.attempted >= MIN_RANKABLE_ANSWERS && (
    item.accuracy < WEAK_ACCURACY_THRESHOLD
    || item.trendDelta <= NEGATIVE_TREND_THRESHOLD
    || item.needsReview > 0
  );
  const rank = item => (100 - item.accuracy)
    + Math.max(0, -(item.trendDelta || 0)) * 0.5
    + Math.min(item.needsReview, 10) * 2;
  const selected = skillCandidates.filter(qualifies).sort((first, second) => rank(second) - rank(first));
  const selectedDomains = new Set(selected.slice(0, 4).map(item => item.domainCode));
  if (selected.length < 2) {
    selected.push(...domainCandidates
      .filter(item => qualifies(item) && !selectedDomains.has(item.domainCode))
      .sort((first, second) => rank(second) - rank(first)));
  }

  return selected.slice(0, 4).map(item => ({
    kind: item.kind,
    code: item.code,
    name: item.name,
    category: item.category,
    subject: item.subject,
    domainCode: item.domainCode,
    domainName: item.domainName,
    accuracy: item.accuracy,
    attempted: item.attempted,
    trendDelta: item.trendDelta,
    mistakes: item.mistakes,
    needsReview: item.needsReview,
    reasons: [
      `${item.accuracy}% accuracy across ${item.attempted} questions`,
      ...(item.trendDelta <= NEGATIVE_TREND_THRESHOLD ? [`Accuracy is down ${Math.abs(item.trendDelta)} points`] : []),
      ...(item.needsReview ? [`${item.needsReview} mistake${item.needsReview === 1 ? '' : 's'} need review`] : []),
    ],
    action: item.needsReview ? 'REVIEW_MISTAKES' : 'VIEW_BREAKDOWN',
  }));
}

function buildPacing(submissions, subject) {
  let answered = 0;
  let timedQuestions = 0;
  let totalDurationMs = 0;
  let correctQuestions = 0;
  let correctDurationMs = 0;
  let incorrectQuestions = 0;
  let incorrectDurationMs = 0;
  let slowQuestions = 0;
  const patterns = { fastCorrect: 0, slowCorrect: 0, fastWrong: 0, slowWrong: 0 };
  const skillGroups = new Map();

  for (const submission of submissions) {
    if (subject !== 'ALL' && normalizedSubject(submission.test?.subject) !== subject) continue;
    if (!isTimingEligible(submission)) continue;
    const timingByQuestion = new Map((submission.questionTimings || []).map(timing => [timing.questionId, timing.activeDurationMs]));
    for (const answer of submission.answers || []) {
      answered += 1;
      const durationMs = timingByQuestion.get(answer.question?.id);
      if (!Number.isFinite(durationMs) || durationMs <= 0) continue;
      timedQuestions += 1;
      totalDurationMs += durationMs;
      const slow = durationMs > SLOW_QUESTION_MS;
      if (slow) slowQuestions += 1;
      if (answer.isCorrect) {
        correctQuestions += 1;
        correctDurationMs += durationMs;
        patterns[slow ? 'slowCorrect' : 'fastCorrect'] += 1;
      } else {
        incorrectQuestions += 1;
        incorrectDurationMs += durationMs;
        patterns[slow ? 'slowWrong' : 'fastWrong'] += 1;
      }

      const skillCode = answer.question?.skillCode || answer.question?.skill?.code;
      if (!skillCode) continue;
      const domainCode = answer.question?.domainCode || answer.question?.domain?.code;
      const taxonomySkill = skillByCode.get(skillCode);
      const taxonomyDomain = domainByCode.get(domainCode);
      const current = skillGroups.get(skillCode) || {
        code: skillCode,
        name: taxonomySkill?.name || answer.question?.skill?.name || null,
        domainName: taxonomyDomain?.name || answer.question?.domain?.name || null,
        subject: normalizedSubject(submission.test?.subject),
        timedQuestions: 0,
        totalDurationMs: 0,
        correct: 0,
      };
      current.timedQuestions += 1;
      current.totalDurationMs += durationMs;
      if (answer.isCorrect) current.correct += 1;
      skillGroups.set(skillCode, current);
    }
  }

  return {
    available: timedQuestions > 0,
    timedQuestions,
    answeredQuestions: answered,
    coverage: answered ? round((timedQuestions / answered) * 100) : null,
    averageTimeMs: timedQuestions ? Math.round(totalDurationMs / timedQuestions) : null,
    correctAverageMs: correctQuestions ? Math.round(correctDurationMs / correctQuestions) : null,
    incorrectAverageMs: incorrectQuestions ? Math.round(incorrectDurationMs / incorrectQuestions) : null,
    slowQuestions,
    patterns,
    skills: [...skillGroups.values()]
      .map(item => ({
        code: item.code,
        name: item.name,
        domainName: item.domainName,
        subject: item.subject,
        timedQuestions: item.timedQuestions,
        avgTimeMs: Math.round(item.totalDurationMs / item.timedQuestions),
        accuracy: accuracyOf(item.correct, item.timedQuestions),
      }))
      .sort((first, second) => second.avgTimeMs - first.avgTimeMs)
      .slice(0, 8),
  };
}

function buildSnapshot(submissions) {
  const totals = { ALL: { attempted: 0, correct: 0 }, RW: { attempted: 0, correct: 0 }, MATH: { attempted: 0, correct: 0 } };
  for (const submission of submissions) {
    const subject = normalizedSubject(submission.test?.subject);
    for (const answer of submission.answers || []) {
      totals.ALL.attempted += 1;
      totals[subject].attempted += 1;
      if (answer.isCorrect) {
        totals.ALL.correct += 1;
        totals[subject].correct += 1;
      }
    }
  }
  return {
    overallAccuracy: accuracyOf(totals.ALL.correct, totals.ALL.attempted),
    rwAccuracy: accuracyOf(totals.RW.correct, totals.RW.attempted),
    mathAccuracy: accuracyOf(totals.MATH.correct, totals.MATH.attempted),
    questionsAnswered: totals.ALL.attempted,
    correctAnswers: totals.ALL.correct,
    completedTests: submissions.length,
  };
}

function buildStudentAnalyticsPayload(rawData, errorLogs = [], { range = '90', subject = 'ALL', now = new Date() } = {}) {
  const completed = rawData
    .filter(submission => submission.status === 'COMPLETED')
    .sort((first, second) => completedAtOf(first) - completedAtOf(second));
  const diagnostic = completed.filter(submission => subject === 'ALL' || normalizedSubject(submission.test?.subject) === subject);
  const snapshot = buildSnapshot(diagnostic);
  const performance = buildPerformance(completed, errorLogs, subject);
  const trend = diagnostic.slice(-50).map(submission => {
    const totalQuestions = submission.answers?.length || 0;
    const correctCount = (submission.answers || []).filter(answer => answer.isCorrect).length;
    return {
      submissionId: submission.id,
      date: completedAtOf(submission).toISOString(),
      testName: submission.test?.title || 'Practice Test',
      subject: normalizedSubject(submission.test?.subject),
      correctCount,
      totalQuestions,
      accuracy: accuracyOf(correctCount, totalQuestions) || 0,
    };
  });
  const pacing = buildPacing(completed, subject);

  return {
    generatedAt: now.toISOString(),
    meta: {
      range: String(range),
      subject,
      classificationCoverage: performance.coverage,
      timingCoverage: {
        timedQuestions: pacing.timedQuestions,
        answeredQuestions: pacing.answeredQuestions,
        percentage: pacing.coverage,
      },
    },
    snapshot,
    focusAreas: buildFocusAreas(performance.domains),
    accuracyTrend: trend,
    skillPerformance: performance.domains,
    mistakeReview: {
      ...performance.mistakes.summary,
      topAreas: performance.mistakes.topAreas,
    },
    pacing,

    // Transitional aliases keep the existing page and deployment smoke checks
    // compatible while the richer diagnostic workspace rolls out.
    summary: {
      overallAccuracy: snapshot.overallAccuracy || 0,
      correctAnswers: snapshot.correctAnswers,
      questionsAttempted: snapshot.questionsAnswered,
      completedTests: snapshot.completedTests,
    },
    scoreHistory: trend.slice(-7).map(item => ({
      date: item.date,
      testName: item.testName,
      rw: item.subject === 'RW' ? item.accuracy : null,
      math: item.subject === 'MATH' ? item.accuracy : null,
    })),
    sectionPerformance: performance.domains,
    classificationCoverage: {
      classified: performance.coverage.classified,
      total: performance.coverage.total,
      percentage: performance.coverage.percentage,
      uncategorizedAttempted: performance.coverage.unclassified,
    },
    historyData: [...diagnostic].reverse().slice(0, 10).map(submission => {
      const totalQuestions = submission.answers?.length || 0;
      const correctCount = (submission.answers || []).filter(answer => answer.isCorrect).length;
      return {
        id: submission.id,
        createdAt: completedAtOf(submission).toISOString(),
        status: 'COMPLETED',
        test: { title: submission.test?.title || 'Practice Test' },
        subject: normalizedSubject(submission.test?.subject),
        correctCount,
        totalQuestions,
        accuracy: accuracyOf(correctCount, totalQuestions) || 0,
        source: sourceOf(submission),
      };
    }),
  };
}

function buildStudentOverviewAnalytics(rawData, { days = 90, now = new Date() } = {}) {
  const daysLimit = Number.parseInt(days, 10) || 90;
  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - daysLimit);
  startDate.setUTCHours(0, 0, 0, 0);
  const validDomainCodes = new Set(taxonomyDomainList.map(domain => domain.code));
  const chartData = [];
  let correctAnswers = 0;
  let questionsAttempted = 0;
  let classified = 0;

  for (const submission of rawData) {
    if (submission.status !== 'COMPLETED' || new Date(submission.startedAt) < startDate) continue;
    let submissionCorrect = 0;
    let submissionClassified = 0;
    const answers = submission.answers || [];
    for (const answer of answers) {
      if (answer.isCorrect) submissionCorrect += 1;
      const domainCode = answer.question?.domainCode || answer.question?.domain?.code;
      if (domainCode && validDomainCodes.has(domainCode)) submissionClassified += 1;
    }
    const totalQuestions = answers.length;
    correctAnswers += submissionCorrect;
    questionsAttempted += totalQuestions;
    classified += submissionClassified;
    chartData.push({
      date: submission.startedAt,
      testName: submission.test?.title || 'Practice Test',
      subject: submission.test?.subject || 'RW',
      correctCount: submissionCorrect,
      totalQuestions,
      accuracy: totalQuestions ? Math.round((submissionCorrect / totalQuestions) * 100) : 0,
    });
  }

  return {
    summary: {
      overallAccuracy: questionsAttempted ? round((correctAnswers / questionsAttempted) * 100) : 0,
      correctAnswers,
      questionsAttempted,
      completedTests: chartData.length,
    },
    chartData,
    classificationCoverage: {
      classified,
      total: questionsAttempted,
      percentage: questionsAttempted ? Math.round((classified / questionsAttempted) * 100) : null,
      uncategorizedAttempted: questionsAttempted - classified,
    },
  };
}

function buildAnalyticsPayload(rawData, { days = 7, now = new Date() } = {}) {
  const daysLimit = Number.parseInt(days, 10) || 7;
  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - daysLimit);
  startDate.setUTCHours(0, 0, 0, 0);

  const processedData = rawData.map(submission => {
    const totalQuestions = submission.answers.length;
    const correctCount = submission.answers.filter(answer => answer.isCorrect).length;
    return {
      id: submission.id,
      testId: submission.test?.id,
      date: submission.startedAt,
      testName: submission.test?.title || 'Practice Test',
      subject: submission.test?.subject || 'RW',
      status: submission.status,
      totalQuestions,
      correctCount,
      accuracy: totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0,
    };
  });

  const completedData = processedData.filter(item => item.status === 'COMPLETED');
  const inRangeCompleted = completedData.filter(item => item.date >= startDate);
  const questionsAttempted = inRangeCompleted.reduce((sum, item) => sum + item.totalQuestions, 0);
  const correctAnswers = inRangeCompleted.reduce((sum, item) => sum + item.correctCount, 0);
  const summary = {
    overallAccuracy: questionsAttempted ? Number(((correctAnswers / questionsAttempted) * 100).toFixed(1)) : 0,
    correctAnswers,
    questionsAttempted,
    completedTests: inRangeCompleted.length,
  };

  const scoreHistory = inRangeCompleted.slice(-7).map((item, index) => ({
    date: `Test ${Math.max(1, inRangeCompleted.length - Math.min(7, inRangeCompleted.length) + index + 1)}`,
    testName: item.testName,
    rw: item.subject === 'RW' ? item.accuracy : null,
    math: item.subject === 'MATH' ? item.accuracy : null,
  }));

  const activityByDate = new Map();
  processedData.forEach(item => {
    const key = new Date(item.date).toISOString().slice(0, 10);
    activityByDate.set(key, (activityByDate.get(key) || 0) + 1);
  });
  const heatmapData = Array.from({ length: 84 }, (_, index) => {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (83 - index));
    const key = date.toISOString().slice(0, 10);
    return { date: key, count: activityByDate.get(key) || 0 };
  });

  const performanceMap = new Map();
  const taxonomy = getTaxonomy();
  const taxonomyDomains = taxonomy.map(domain => ({
    code: domain.code,
    name: domain.name,
    subject: domain.subject,
    sortOrder: domain.sortOrder,
    skills: domain.skills.map(skill => ({ ...skill, correct: 0, attempted: 0 })),
    correct: 0,
    attempted: 0,
  }));
  const classifiedDomainCodes = new Set(taxonomyDomains.map(domain => domain.code));
  let uncategorizedCorrect = 0;
  let uncategorizedAttempted = 0;

  rawData.filter(item => item.status === 'COMPLETED' && item.startedAt >= startDate).forEach(submission => {
    submission.answers.forEach(answer => {
      const domain = answer.question?.domain;
      const skill = answer.question?.skill;
      if (!domain || !classifiedDomainCodes.has(domain.code)) {
        uncategorizedAttempted += 1;
        if (answer.isCorrect) uncategorizedCorrect += 1;
        return;
      }

      const current = performanceMap.get(domain.code) || taxonomyDomains.find(item => item.code === domain.code);
      current.attempted += 1;
      if (answer.isCorrect) current.correct += 1;

      const currentSkill = current.skills.find(item => item.code === skill?.code);
      if (currentSkill) {
        currentSkill.attempted += 1;
        if (answer.isCorrect) currentSkill.correct += 1;
      }
      performanceMap.set(domain.code, current);
    });
  });

  const sectionPerformance = taxonomyDomains.map(domain => ({
    code: domain.code,
    name: domain.name,
    subject: domain.subject,
    sortOrder: domain.sortOrder,
    correct: domain.correct,
    attempted: domain.attempted,
    accuracy: domain.attempted ? Math.round((domain.correct / domain.attempted) * 100) : null,
    skills: domain.skills.map(skill => ({
      code: skill.code,
      name: skill.name,
      attempted: skill.attempted,
      correct: skill.correct,
      accuracy: skill.attempted ? Math.round((skill.correct / skill.attempted) * 100) : null,
    })),
  }));

  const completedAnswerCount = inRangeCompleted.reduce((sum, item) => sum + item.totalQuestions, 0);
  const classifiedAttempted = completedAnswerCount - uncategorizedAttempted;

  return {
    summary,
    chartData: processedData.filter(item => item.status === 'COMPLETED' && item.date >= startDate).map(item => ({ date: item.date, accuracy: item.accuracy, correctCount: item.correctCount, totalQuestions: item.totalQuestions, testName: item.testName, subject: item.subject })),
    scoreHistory,
    heatmapData,
    sectionPerformance,
    classificationCoverage: {
      classified: classifiedAttempted,
      total: completedAnswerCount,
      percentage: completedAnswerCount ? Math.round((classifiedAttempted / completedAnswerCount) * 100) : null,
      uncategorizedAttempted,
      uncategorizedCorrect,
    },
    historyData: processedData.filter(item => item.date >= startDate).slice(-10).reverse().map(item => ({ id: item.id, createdAt: item.date, status: item.status, test: { title: item.testName }, subject: item.subject, correctCount: item.correctCount, totalQuestions: item.totalQuestions, accuracy: item.accuracy })),
  };
}

module.exports = {
  buildAnalyticsPayload,
  buildStudentOverviewAnalytics,
  buildStudentAnalyticsPayload,
  confidenceOf,
  isTimingEligible,
  sourceOf,
  trendOf,
};
