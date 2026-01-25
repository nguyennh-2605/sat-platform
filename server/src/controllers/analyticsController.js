// controllers/analyticsController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { days } = req.query; 
    
    const daysLimit = parseInt(days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysLimit);
    // Set về đầu ngày (00:00:00) để lấy trọn vẹn dữ liệu ngày đó
    startDate.setHours(0, 0, 0, 0); 

    // 2. QUERY DATABASE (Đã tối ưu lọc ngày ngay tại đây)
    const rawData = await prisma.submission.findMany({
      where: {
        userId: userId,
        // Chỉ lấy các bài test được tạo từ ngày startDate trở đi
        startedAt: { gte: startDate }, 
      },
      orderBy: { startedAt: 'asc' }, // Sắp xếp cũ -> mới để vẽ biểu đồ cho thuận
      include: { 
        test: { select: { title: true } },
        answers: { select: { isCorrect: true } } 
      }
    });

    // 3. XỬ LÝ DỮ LIỆU CHUNG
    const processedData = rawData.map(r => {
      const totalQuestion = r.answers.length;
      const correctCount = r.answers.filter(a => a.isCorrect).length;
      
      return {
        id: r.id,
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

    // 5. DATA CHO HISTORY TABLE (Đảo ngược: Mới -> Cũ)
    const historyData = [...processedData].reverse().map(item => ({
      id: item.id,
      createdAt: item.date, // Frontend đang map theo key 'createdAt'
      status: item.status,  // Để nguyên status gốc, Frontend tự map màu sắc
      test: { title: item.testName },
      correctCount: item.correctCount, // Cần thêm cái này
      totalQuestions: item.totalQuestions, 
      accuracy: item.accuracy
    }));

    res.json({ chartData, historyData });

  } catch (error) {
    console.error("🔥 Lỗi Analytics:", error);
    res.status(500).json({ message: "Lỗi server khi lấy thống kê" });
  }
};

exports.getSubmissionDetail = async (req, res) => {
  try {
    const { id } = req.params; // Lấy ID bài thi từ URL (submissionId)
    const userId = req.user.userId; // Lấy userId từ token (để bảo mật)

    // 1. Query Database: Lấy Submission + Test + Answers + Question + Section
    const submission = await prisma.submission.findFirst({
      where: {
        id: parseInt(id), // Chuyển id từ string sang int
        userId: userId    // QUAN TRỌNG: Chỉ cho phép xem bài của chính mình
      },
      include: {
        test: {
          select: {
            title: true,
            type: true, // Ví dụ: "RW" hoặc "Math"
            description: true
          }
        },
        answers: {
          orderBy: {
            question: {
              order: 'asc' // Sắp xếp câu hỏi theo thứ tự đề bài
            }
          },
          include: {
            question: {
              include: {
                section: true // Để lấy tên Module (Section)
              }
            }
          }
        }
      }
    });

    // 2. Kiểm tra nếu không tìm thấy
    if (!submission) {
      return res.status(404).json({ message: "Không tìm thấy bài làm hoặc bạn không có quyền truy cập." });
    }

    // 3. Tính toán thời gian làm bài (Duration)
    let durationString = "N/A";
    if (submission.startTime && submission.endTime) {
      const diffSeconds = Math.floor((new Date(submission.endTime) - new Date(submission.startTime)) / 1000);
      const h = Math.floor(diffSeconds / 3600);
      const m = Math.floor((diffSeconds % 3600) / 60);
      const s = diffSeconds % 60;
      durationString = `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // 4. Map dữ liệu sang format Frontend cần (QuestionResult interface)
    const formattedQuestions = submission.answers.map((ans, index) => {
      const question = ans.question;

      return {
        id: question.id,
        // Lấy tên section (VD: "Reading Module 1") hoặc fallback
        module: `Module ${question.section?.order || 1}`,
        questionNumber: question.order || (index + 1),
        
        // Prisma tự parse JSON field thành Object, ta chỉ cần gán vào
        blocks: question.blocks || [], 
        questionText: question.questionText,
        choices: question.choices || [],
        
        correctAnswer: question.correctAnswer,
        userAnswer: ans.selectedChoice, // Đáp án user chọn (có thể null)
        isCorrect: ans.isCorrect // True/False
      };
    });

    // 5. Trả về Response
    const responseData = {
      examTitle: submission.test.title,
      subject: submission.test.type === 'RW' ? 'Reading & Writing' : 'Math', // Map lại tên môn cho đẹp
      date: submission.endTime.toLocaleString(), // Ngày làm bài
      duration: durationString,
      questions: formattedQuestions
    };

    res.json(responseData);

  } catch (error) {
    console.error("🔥 Lỗi lấy chi tiết bài thi:", error);
    res.status(500).json({ message: "Lỗi server khi tải chi tiết bài thi." });
  }
};