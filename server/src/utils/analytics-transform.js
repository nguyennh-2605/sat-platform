const { getTaxonomy } = require('./question-taxonomy');

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

module.exports = { buildAnalyticsPayload };
