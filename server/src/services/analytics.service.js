const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { buildAnalyticsPayload } = require('../utils/analytics-transform');

exports.getData = async ({ userId, days }) => {
  const requestedDays = Number.parseInt(days, 10);
  const normalizedDays = Number.isInteger(requestedDays) ? Math.min(365, Math.max(1, requestedDays)) : 84;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - normalizedDays);
  cutoff.setUTCHours(0, 0, 0, 0);
  const rawData = await prisma.submission.findMany({
    where: {
      userId: userId,
      startedAt: { gte: cutoff },
    },
    orderBy: { startedAt: 'asc' },
    select: {
      id: true,
      status: true,
      startedAt: true,
      endTime: true,
      test: { select: { id: true, title: true, subject: true } },
      answers: {
        select: {
          isCorrect: true,
          question: {
            select: {
              domain: { select: { code: true, name: true, subject: true, sortOrder: true } },
              skill: { select: { code: true, name: true, sortOrder: true } },
            }
          }
        }
      }
    }
  });

  return buildAnalyticsPayload(rawData, { days: normalizedDays });
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
      },
      questionTimings: {
        select: { questionId: true, activeDurationMs: true }
      },
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

  const timingByQuestionId = new Map(
    submission.questionTimings.map(timing => [timing.questionId, timing.activeDurationMs])
  );

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
      isCorrect: ans.isCorrect,
      activeDurationMs: timingByQuestionId.get(question.id) ?? null,
    };
  });

  return {
    examTitle: submission.test.title,
    subject: submission.test.subject,
    date: submission.endTime?.toISOString() || submission.startedAt.toISOString(),
    startedAt: submission.startedAt.toISOString(),
    completedAt: submission.endTime?.toISOString() || null,
    duration: durationString,
    questions: formattedQuestions
  };
};
