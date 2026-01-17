const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client'); // 👈 Import Prisma
const { register, login } = require('./src/controllers/authController');

const app = express();
const prisma = new PrismaClient(); // 👈 Khởi tạo kết nối DB
const PORT = 5000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- ROUTES (Đường dẫn) ---

// 1. AUTHENTICATION
app.post('/api/register', register);
app.post('/api/login', login);

// 2. API LẤY DANH SÁCH BÀI THI (Cho Dashboard)
app.get('/api/tests', async (req, res) => {
  try {
    const userId = parseInt(req.query.userId);

    const tests = await prisma.test.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        duration: true
      }
    });

    if (!userId || isNaN(userId)) {
      const testsDefaults = tests.map(test => ({ ...test, isDoing: false }));
      return res.json(testsDefaults);
    }

    // 3. 👇 TỐI ƯU: Tìm tất cả bài ĐANG LÀM của user này 1 lần duy nhất
    // (Thay vì lặp từng bài thi để query -> Rất chậm)
    const activeSubmission = await prisma.submission.findMany({
      where: {
        userId: userId,
        endTime: null
      },
      select: { testId: true }
    });

    const doingTestIds = new Set(activeSubmission.map(s => s.testId));

    const result = tests.map(test => ({
      ...test,
      isDoing: doingTestIds.has(test.id)
    }));

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi lấy danh sách bài thi' });
  }
});

// 3. API LẤY CHI TIẾT ĐỀ THI & CÂU HỎI (Cho ExamRoom)
app.get('/api/test/:id', async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const userId = parseInt(req.query.userId);

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
              // ⚠️ QUAN TRỌNG: Chỉ lấy nội dung câu hỏi và options
              // KHÔNG lấy trường 'correctAnswer' để tránh lộ đáp án
              select: {
                id: true,
                blocks: true,
                questionText: true,
                choices: true // Trả về JSON đáp án
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
        endTime: null
      },
      // Để luôn lấy bài mới nhất (phòng trường hợp DB lỗi có 2 bài active)
      orderBy: {
        startedAt: 'desc'
      }
    });

    if (submission) {
      const now = new Date();
      const startedAt = new Date(submission.startedAt);
      const durationMs = test.duration * 60 * 1000; // Thời lượng cho phép
      const expireTime = new Date(startedAt.getTime() + durationMs + (5 * 60 * 1000));

      if (now > expireTime) {
        console.log(`⏳ Bài thi ID ${submission.id} đã quá hạn nhưng chưa nộp. Đang đóng lại để tạo bài mới...`);
        // Đóng bài cũ lại
        await prisma.submission.update({
          where: { id: submission.id },
          data : {
            endTime: new Date(),
            score: 0,
            status: "EXPIRED"
          }
        });
        submission = null
      }
    }

    // Nếu chưa có bài làm tạo mới ngay lập tức
    if (!submission) {

      // Kiểm tra xem User có tồn tại không trước khi tạo Submission
      const existingUser = await prisma.user.findUnique({
          where: { id: userId }
      });

      if (!existingUser) {
          console.log(`⚠️ User ID ${userId} không tồn tại trong DB mới. Đang tự động tạo lại...`);
          const safeIdStr = String(userId);
          // Tự động tạo lại User "ma" này để không bị lỗi khóa ngoại
          await prisma.user.create({
            data: {
              id: userId, // Dùng lại đúng cái ID cũ mà Frontend gửi lên
              email: `auto_restore_${safeIdStr}@example.com`,
              password: '123',
              name: 'Restored User'
            }
          });
      }
      
      submission = await prisma.submission.create({
        data: {
          userId: userId,
          testId: testId,
          status: "DOING", // Đánh dấu là đang làm
          startedAt: new Date() // Bắt đầu tính giờ từ BÂY GIỜ
        }
      });
    }

    // 4. Trả về đề thi + Thông tin phiên làm bài
    res.json({
      ...test,
      session: {
        submissionId: submission.id, // ID phiên để tí nữa update
        startedAt: submission.startedAt, // Frontend dùng cái này để trừ lùi thời gian
        duration: test.duration
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi tải đề thi' });
  }
});

// server/index.js

// ... (Các phần import và setup giữ nguyên)

app.post('/api/test/:id/submit', async (req, res) => {
  // 👉 Nhận thêm userId từ Frontend gửi lên
  const { submissionId, answers, userId, violationCount } = req.body; 
  const testId = parseInt(req.params.id);

  console.log(`📥 Đang chấm bài Test ID: ${testId} cho User ID: ${userId}`);

  if (!userId) {
    return res.status(400).json({ error: "Thiếu thông tin User ID (Bạn chưa đăng nhập?)" });
  }

  try {
    const userExists = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!userExists) {
      console.log(`❌ Lỗi: User ID ${userId} không tồn tại trong Database!`);
      // Gợi ý fix: Nếu đang test, hãy tạo nhanh 1 user
      return res.status(400).json({ 
        error: `User ID ${userId} không tồn tại. Hãy đăng ký tài khoản mới hoặc sửa userId trong code.` 
      });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId }
    });

    if (submission.status == 'COMPLETED') {
      return res.status(400).json({ error: "Bài thi này đã nộp!" });
    }

    if (!submission) {
      return res.status(400).json({ error: "Bài thi này không tồn tại! "});
    }

    // 1. Lấy đề thi từ DB để so sánh đáp án
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        sections: {
          include: {
            questions: true 
          }
        }
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

    console.log(`✅ Kết quả: ${correctCount}/${totalQuestions}`);

    // 3. LƯU VÀO DATABASE (QUAN TRỌNG)
    // Chúng ta dùng Prisma để tạo Submission và các Answer cùng lúc
    const UpdateSubmission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "COMPLETED",
        score: correctCount,
        violationCount: Number(violationCount),
        endTime: new Date(),
        // Lưu luôn danh sách câu trả lời chi tiết
        answers: {
          create: answersToSave
        }
      }
    });

    console.log("💾 Đã lưu kết quả vào DB với ID:", UpdateSubmission.id);

    // 4. Trả kết quả về Frontend
    res.json({
      score: correctCount,
      total: totalQuestions,
      submission: UpdateSubmission, // Trả về ID bài nộp để sau này tra cứu
      details: responseDetails,
      message: "Nộp bài và lưu kết quả thành công"
    });

  } catch (error) {
    console.error("❌ LỖI SERVER:", error);
    res.status(500).json({ error: "Lỗi server: " + error.message });
  }
});

// --- KHỞI ĐỘNG SERVER ---
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});