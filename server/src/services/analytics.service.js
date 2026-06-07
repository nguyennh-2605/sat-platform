const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

exports.getData = async ({ userId, days }) => {
  const daysLimit = parseInt(days) || 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysLimit);
  // Set về đầu ngày (00:00:00) để lấy trọn vẹn dữ liệu ngày đó
  startDate.setHours(0, 0, 0, 0);

  const rawData = await prisma.submission.findMany({
    where: {
      userId: userId,
      startedAt: { gte: startDate },
    },
    orderBy: { startedAt: 'asc' },
    include: {
      test: { select: { id: true, title: true } },
      answers: { select: { isCorrect: true } }
    }
  });

  const processedData = rawData.map(r => {
    const totalQuestion = r.answers.length;
    const correctCount = r.answers.filter(a => a.isCorrect).length;

    return {
      id: r.id,
      testId: r.test?.id,
      date: r.startedAt,
      testName: r.test?.title || "Practice Test",
      status: r.status,
      totalQuestions: totalQuestion,
      correctCount: correctCount,
      accuracy: totalQuestion > 0 ? Math.round((correctCount / totalQuestion) * 100) : 0,
    };
  });

  const chartData = processedData
    .filter(item => item.status === 'COMPLETED')
    .map(item => ({
      date: item.date,
      accuracy: item.accuracy,
      correctCount: item.correctCount,
      totalQuestions: item.totalQuestions,
      testName: item.testName
    }));

  const latestSubmissionMap = new Map()

  processedData.forEach(item => {
    const key = item.testId || item.testName;
    latestSubmissionMap.set(key, item);
  });

  const historyData = Array.from(latestSubmissionMap.values())
    .reverse()
    .map(item => ({
      id: item.id,
      createdAt: item.date, // Frontend đang map theo key 'createdAt'
      status: item.status,
      test: { title: item.testName },
      correctCount: item.correctCount,
      totalQuestions: item.totalQuestions,
      accuracy: item.accuracy
    }))

  return { chartData, historyData };
};

exports.getSubmissionDetail = async ({ id, userId }) => {
  // 1. Lấy Submission + Test + Answers + Question + Section
  const submission = await prisma.submission.findFirst({
    where: {
      id: parseInt(id),
      userId: userId // QUAN TRỌNG: Chỉ cho phép xem bài của chính mình
    },
    include: {
      test: {
        select: { title: true, subject: true, description: true }
      },
      answers: {
        orderBy: { question: { order: 'asc' } },
        include: {
          question: { include: { section: true } }
        }
      }
    }
  });

  if (!submission) {
    throw new ApiError(404, { message: "Không tìm thấy bài làm hoặc bạn không có quyền truy cập." });
  }

  // Tính toán thời gian làm bài (Duration)
  let durationString = "N/A";
  if (submission.startedAt && submission.endTime) {
    const diffSeconds = Math.floor((new Date(submission.endTime) - new Date(submission.startedAt)) / 1000);
    const h = Math.floor(diffSeconds / 3600);
    const m = Math.floor((diffSeconds % 3600) / 60);
    const s = diffSeconds % 60;
    durationString = `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  const formattedQuestions = submission.answers.map((ans, index) => {
    const question = ans.question;

    return {
      id: question.id,
      module: `Module ${question.section?.order || 1}`,
      questionNumber: question.order || (index + 1),
      blocks: question.blocks || [],
      questionText: question.questionText,
      choices: question.choices || [],
      correctAnswer: question.correctAnswer,
      userAnswer: ans.selectedChoice,
      isCorrect: ans.isCorrect
    };
  });

  return {
    examTitle: submission.test.title,
    subject: submission.test.subject,
    date: submission.endTime.toLocaleString(),
    duration: durationString,
    questions: formattedQuestions
  };
};
