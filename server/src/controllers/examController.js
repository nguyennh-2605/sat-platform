// server/src/controllers/examController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Hàm chấm điểm giả lập (Scale 200-800)
// Thực tế SAT dùng IRT (Item Response Theory), ở đây dùng Linear Mapping
const calculateScore = (totalCorrect, totalQuestions, min = 200, max = 800) => {
  if (totalQuestions === 0) return min;
  const ratio = totalCorrect / totalQuestions;
  return Math.round((ratio * (max - min)) + min);
};

const submitTest = async (req, res) => {
  const { submissionId, answers, violationCount, terminated } = req.body;
  // answers format: { questionId: "A", ... }

  try {
    // 1. Lấy thông tin bài thi
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { test: { include: { sections: { include: { questions: true } } } } }
    });

    if (!submission) return res.status(404).json({ error: "Submission not found" });

    let rwCorrect = 0, rwTotal = 0;
    let mathCorrect = 0, mathTotal = 0;
    const answerRecords = [];

    // 2. Chấm điểm từng câu
    submission.test.sections.forEach(section => {
      section.questions.forEach(q => {
        const userChoice = answers[q.id];
        const isCorrect = userChoice === q.correctAnswer;
        
        // Phân loại để tính điểm (Giả sử section name chứa loại)
        const isMath = section.name.toLowerCase().includes('math');
        if (isMath) { mathTotal++; if (isCorrect) mathCorrect++; }
        else { rwTotal++; if (isCorrect) rwCorrect++; }

        answerRecords.push({
          submissionId,
          questionId: q.id,
          selectedChoice: userChoice || null,
          isCorrect
        });
      });
    });

    // 3. Tính điểm Scale
    const rwScore = calculateScore(rwCorrect, rwTotal);
    const mathScore = calculateScore(mathCorrect, mathTotal);
    const totalScore = terminated ? 0 : (rwScore + mathScore); // Nếu vi phạm = 0 điểm

    // 4. Update Database Transaction
    await prisma.$transaction([
      prisma.answer.createMany({ data: answerRecords }),
      prisma.submission.update({
        where: { id: submissionId },
        data: {
          score: totalScore,
          endTime: new Date(),
          violationCount,
          terminated
        }
      })
    ]);

    res.json({ success: true, score: totalScore, terminated });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Grading failed" });
  }
};

module.exports = { submitTest };