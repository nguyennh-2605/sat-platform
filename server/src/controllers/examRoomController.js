const { sendNotificationToUser } = require('./notificationController');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 3. API LẤY CHI TIẾT ĐỀ THI & CÂU HỎI (Cho ExamRoom)
// app.get('/api/test/:id', 
exports.startOrResumeTest = async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const userId = req.user.userId;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: "Thiếu thông tin User ID (userId is missing or invalid)" });
    }

    // Lấy bài thi -> Lấy Section -> Lấy Question (Test -> Section -> Question)
    const test = await prisma.test.findUnique({
      where: { id: Number(testId) }, // Chuyển id từ string sang số
      include: {
        sections: {
          orderBy: { order: 'asc' }, // Sắp xếp Module 1 trước, Module 2 sau
          include: {
            questions: {
              orderBy: {
                order: 'asc'
              },
              // KHÔNG lấy trường 'correctAnswer' để tránh lộ đáp án
              select: {
                id: true,
                blocks: true,
                questionText: true,
                choices: true, // Trả về JSON đáp án
                type: true
              }
            }
          }
        }
      }
    });

    // Kiểm tra nhanh: Nếu test.sections rỗng thì do database chưa có data
    if (!test || !test.sections || test.sections.length === 0) {
      return res.status(404).json({ error: "Đề thi này chưa có câu hỏi nào (Data rỗng)" });
    }

    let submission = await prisma.submission.findFirst({
      where: {
        userId: userId,
        testId: testId,
        status: 'DOING'
      },
      // Để luôn lấy bài mới nhất (phòng trường hợp DB lỗi có 2 bài active)
      orderBy: {
        startedAt: 'desc'
      }
    });

    if (!submission) {
      const justCreatedSubmission = await prisma.submission.findFirst({
        where: {
          userId: userId,
          testId: testId,
          startedAt: {
            gte: new Date(Date.now() - 5000) // Lấy bài tạo trong 5s gần nhất
          }
        }
      });
      
      if (justCreatedSubmission) {
        submission = justCreatedSubmission;
        console.log("Phát hiện Duplicate Request: Dùng lại bài vừa tạo.");
      }
    }


    if (submission && test.mode === 'EXAM') {
      const now = new Date();
      const startedAt = new Date(submission.startedAt);
      const durationMs = test.duration * 60 * 1000; // Thời lượng cho phép
      const expireTime = new Date(startedAt.getTime() + durationMs + (5 * 60 * 1000));

      if (now > expireTime) {
        console.log(`Bài thi ID ${submission.id} đã quá hạn nhưng chưa nộp. Đang đóng lại để tạo bài mới...`);
        // Đóng bài cũ lại
        await prisma.submission.update({
          where: { id: submission.id },
          data : {
            endTime: new Date(),
            score: 0,
            status: "COMPLETED"
          }
        });
        submission = null
      }
    }

    // Nếu chưa có bài làm tạo mới ngay lập tức
    if (!submission) {
      submission = await prisma.submission.create({
        data: {
          userId: userId,
          testId: testId,
          status: "DOING", // Đánh dấu là đang làm
          startedAt: new Date(), // Bắt đầu tính giờ từ BÂY GIỜ,
          timeRemaining: test.duration * 60,
          currentQuestionIndex: 0,
          savedAnswers: {}
        }
      });
    } 

    // 4. Trả về đề thi + Thông tin phiên làm bài
    res.json({
      ...test,
      session: {
        submissionId: submission.id, // ID phiên để tí nữa update
        startedAt: submission.startedAt, // Frontend dùng cái này để trừ lùi thời gian
        status: submission.status,
        savedAnswers: submission.savedAnswers,         // Đáp án cũ
        timeLeft: submission.timeRemaining,            // Thời gian còn lại đã lưu
        currentQuestionIndex: submission.currentQuestionIndex, // Câu đang làm dở
        violationCount: submission.violationCount
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi tải đề thi' });
  }
};

exports.saveProgress = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      submissionId, 
      answers,            // Cục JSON từ frontend: { 1: [2], 2: [3] }
      timeLeft, 
      currentQuestionIndex, 
      violationCount 
    } = req.body;

    // Validate sở hữu: Có đúng user này đang làm bài này không?
    const submission = await prisma.submission.findFirst({
      where: { id: parseInt(submissionId), userId: userId }
    });

    if (!submission) return res.status(403).json({ message: "Không có quyền truy cập" });
    if (submission.status === 'COMPLETED') return res.status(400).json({ message: "Bài đã nộp rồi" });

    // Cập nhật DB
    await prisma.submission.update({
      where: { id: parseInt(submissionId) },
      data: {
        savedAnswers: answers, // Prisma tự convert Object -> JSON DB
        timeRemaining: timeLeft,
        currentQuestionIndex: currentQuestionIndex,
        violationCount: violationCount,
      }
    });

    res.json({ success: true, message: "Đã lưu tiến độ thành công!" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lưu bài" });
  }
};

// app.post('/api/test/:id/submit'
exports.submitTest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { submissionId, answers, violationCount } = req.body; 
    const testId = parseInt(req.params.id);

    console.log(`📥 Đang chấm bài Test ID: ${testId} cho User ID: ${userId}`);

    if (!userId) {
      return res.status(400).json({ error: "Thiếu thông tin User ID (Bạn chưa đăng nhập?)" });
    }

    const submission = await prisma.submission.findFirst({
      where: { 
        id: Number(submissionId),
        userId: userId,
        testId: testId
      }
    });


    if (!submission) {
      return res.status(400).json({ error: "Không tìm thấy phiên làm bài hoặc bạn không có quyền nộp bài này"});
    }

    if (submission.status == 'COMPLETED') {
      return res.status(400).json({ error: "Bài thi này đã nộp!" });
    }

    // 1. Lấy đề thi từ DB để so sánh đáp án
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        sections: {
          include: {
            questions: true 
          }
        },
        author: true
      }
    });

    if (!test) return res.status(404).json({ error: "Không tìm thấy đề thi" });

    // 2. Tính điểm & Chuẩn bị dữ liệu chi tiết từng câu trả lời
    let correctCount = 0;
    let totalQuestions = 0;
    
    // Mảng chứa các câu trả lời để lưu vào bảng Answer
    const answersToSave = [];
    // Dùng cho frontend hiển thị
    const responseDetails = [];

    test.sections.forEach(section => {
      section.questions.forEach(question => {
        totalQuestions++;

        const userChoiceId = answers[String(question.id)]; // Lấy đáp án user (VD: "A")
        const correctChoiceId = question.correctAnswer;    // Lấy đáp án đúng (VD: "A")
        
        // Kiểm tra đúng/sai
        const isCorrect = userChoiceId === correctChoiceId;
        
        if (isCorrect) {
          correctCount++;
        }

        // Đẩy vào danh sách cần lưu
        answersToSave.push({
          questionId: question.id,
          selectedChoice: userChoiceId || null, // Nếu không chọn thì null
          isCorrect: isCorrect
        });
        responseDetails.push({
          questionId: question.id,
          isCorrect: isCorrect,
          userSelected: userChoiceId || null,
          correctOption: correctChoiceId
        });
      });
    });

    console.log(`Kết quả: ${correctCount}/${totalQuestions}`);

    const result = await prisma.$transaction(async (prisma) => {
      // A. Cập nhật Submission
      const updatedSubmission = await prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: "COMPLETED",
          score: correctCount, 
          violationCount: Number(violationCount),
          endTime: new Date(),
          savedAnswers: answers 
        }
      });
      // B. Lưu chi tiết từng câu trả lời vào bảng Answer
      // createMany nhanh hơn create từng cái
      if (answersToSave.length > 0) {
        await prisma.answer.createMany({
          data: answersToSave.map(item => ({
            submissionId: submission.id,
            questionId: item.questionId,
            selectedChoice: item.selectedChoice
          }))
        });
      }

      return updatedSubmission;
    });

    if (test.mode === 'EXAM' && test.authorId) {
      const studentInfo = await prisma.user.findUnique({
        where: {id: userId }
      });

      await sendNotificationToUser(
        test.authorId,
        `Học sinh ${studentInfo?.name || studentInfo?.email} vừa hoàn thành bài thi "${test.title}" với số điểm ${correctCount}/${totalQuestions}.`,
      );
    }

    // 4. Trả kết quả về Frontend
    res.json({
      score: correctCount,
      total: totalQuestions,
      submissionId: result.id,
      details: responseDetails,
      message: "Nộp bài và lưu kết quả thành công"
    });

  } catch (error) {
    console.error("❌ LỖI SERVER:", error);
    res.status(500).json({ error: "Lỗi server: " + error.message });
  }
};