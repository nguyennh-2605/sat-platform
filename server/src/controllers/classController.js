const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createClass = async (req, res) => {
  try {
    const { name } = req.body;
    
    // Giả sử middleware đã decode token và gán user vào req.user
    // Nếu bạn chưa có auth, bạn có thể hardcode: const userId = 1;
    const userId = req.user?.userId || req.user?.id; 
    const userRole = req.user?.role || req.user?.userRole;

    console.log("Role thuc te trong token", userRole)

    // Validation: Chỉ giáo viên mới được tạo lớp
    if (userRole !== 'TEACHER' && userRole !== 'ADMIN') {
      return res.status(403).json({ error: "Bạn không có quyền tạo lớp học." });
    }

    if (!name) {
      return res.status(400).json({ error: "Tên lớp không được để trống" });
    }

    const newClass = await prisma.class.create({
      data: {
        name: name,
        teacherId: userId, // Link lớp này với ID của giáo viên đang đăng nhập
      }
    });

    res.status(201).json(newClass);
  } catch (error) {
    console.error("Create Class Error:", error);
    res.status(500).json({ error: "Lỗi server khi tạo lớp học" });
  }
};

// ==========================================
// 2. LẤY DANH SÁCH LỚP (Theo Role)
// ==========================================
exports.getMyClasses = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: "Chưa đăng nhập" });
    }

    let classes;

    if (userRole === 'TEACHER') {
      // Nếu là GV: Lấy danh sách lớp mình dạy
      classes = await prisma.class.findMany({
        where: { teacherId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { students: true } } // Đếm số học sinh trong lớp
        }
      });
    } else {
      // Nếu là HS: Lấy danh sách lớp mình tham gia
      classes = await prisma.class.findMany({
        where: {
          students: {
            some: { id: userId } // Tìm lớp có chứa userId này trong danh sách students
          }
        },
        orderBy: { createdAt: 'desc' },
        include: {
          teacher: { select: { name: true, email: true } } // Lấy thêm info giáo viên
        }
      });
    }

    res.json(classes);
  } catch (error) {
    console.error("Get Classes Error:", error);
    res.status(500).json({ error: "Lỗi lấy danh sách lớp" });
  }
};

// 3. LẤY CHI TIẾT 1 LỚP (Kèm bài tập & HS)
exports.getClassDetail = async (req, res) => {
  try {
    const { id } = req.params; // ID lớp học (UUID string)

    const classDetail = await prisma.class.findUnique({
      where: { id: id },
      include: {
        teacher: {
          select: { id: true, name: true, email: true }
        },
        students: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        assignments: {
          orderBy: { createdAt: 'desc' }, // Lấy bài tập mới nhất lên đầu
          include: {
            submissions: true
          }
        }
      }
    });

    if (!classDetail) {
      return res.status(404).json({ error: "Không tìm thấy lớp học" });
    }

    res.json(classDetail);
  } catch (error) {
    console.error("Get Class Detail Error:", error);
    res.status(500).json({ error: "Lỗi lấy thông tin lớp" });
  }
};

// ==========================================
// 4. THÊM HỌC SINH VÀO LỚP (Bằng Email)
// ==========================================
exports.addStudentToClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { email } = req.body; // Giáo viên nhập email học sinh để add
    const currentUserId = req.user?.id || req.user?.userId;

    if (!currentUserId) {
        return res.status(401).json({ error: "Không tìm thấy thông tin người dùng." });
    }

    // 1. Kiểm tra lớp có tồn tại và thuộc về giáo viên này không
    const existingClass = await prisma.class.findUnique({
      where: { id: classId }
    });

    if (!existingClass) return res.status(404).json({ error: "Lớp không tồn tại" });
    if (existingClass.teacherId !== parseInt(currentUserId)) {
      return res.status(403).json({ error: "Bạn không phải giáo viên của lớp này" });
    }

    // 2. Tìm học sinh theo email
    const student = await prisma.user.findUnique({
      where: { email: email }
    });

    if (!student) {
      return res.status(404).json({ error: "Không tìm thấy học sinh với email này" });
    }

    // 3. Cập nhật quan hệ (Connect)
    await prisma.class.update({
      where: { id: classId },
      data: {
        students: {
          connect: { id: student.id } // Connect theo ID của User tìm được
        }
      }
    });

    res.json({ message: "Thêm học sinh thành công", student: student });

  } catch (error) {
    console.error("Add Student Error:", error);
    res.status(500).json({ error: "Lỗi khi thêm học sinh" });
  }
};


exports.createAssignment = async (req, res) => {
  try {
    const { title, content, deadline, fileUrl, classId } = req.body;
    
    // Validate cơ bản
    if (!classId || !title) {
        return res.status(400).json({ error: "Thiếu thông tin classId hoặc title" });
    }

    const newAssignment = await prisma.assignment.create({
      data: {
        title,
        content: content, // Frontend gửi là content, DB nếu lưu là description thì map lại
        deadline: deadline,
        fileUrl,
        classId: classId
      }
    });

    res.json(newAssignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi tạo bài tập" });
  }
};

exports.createSubmission = async (req, res) => {
  try {
    // 1. Lấy dữ liệu từ Frontend gửi lên
    const { assignmentId, textResponse, fileUrl } = req.body;
    const studentId = req.user?.id || req.user?.userId; // Lấy ID học sinh từ Token

    if (!assignmentId) {
      return res.status(400).json({ error: "Thiếu thông tin bài tập (assignmentId)" });
    }

    // 2. Kiểm tra xem đã nộp chưa (Nếu muốn cho nộp lại thì dùng upsert, ở đây dùng create cho đơn giản)
    // Lưu ý: assignmentId có thể cần ép kiểu về Int nếu DB để Int
    const submission = await prisma.homeworkSubmission.upsert({
      where: {
        // Tìm xem học sinh này đã nộp bài này chưa
        studentId_assignmentId: {
          studentId: parseInt(studentId),
          assignmentId: assignmentId
        }
      },
      update: {
        // Nếu nộp rồi thì cập nhật lại nội dung mới
        textResponse: textResponse || null,
        fileUrl: fileUrl || null,
        submittedAt: new Date(), // Cập nhật lại thời gian nộp
        status: 'SUBMITTED' // Reset lại trạng thái nếu trước đó bị chấm LATE/FAIL
      },
      create: {
        // Nếu chưa nộp thì tạo mới
        studentId: parseInt(studentId),
        assignmentId: assignmentId,
        textResponse: textResponse || null,
        fileUrl: fileUrl || null,
      }
    });

    console.log("Học sinh đã nộp bài:", submission);
    res.status(201).json({ message: "Nộp bài thành công!", data: submission });

  } catch (error) {
    console.error("❌ Lỗi nộp bài:", error);
    res.status(500).json({ error: "Lỗi server khi nộp bài" });
  }
};

exports.getExamTests = async (req, res) => {
  try {
    const { classId } = req.query;
    if (!classId) {
      return res.status(400).json({ error: "Thiếu thông tin classId" });
    }
    const tests = await prisma.test.findMany({
      where: {
        classTests: {
          some: {
            classId: classId
          }
        },
        mode: 'EXAM'
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        _count: {
          select: { submissions: true }
        }
      }
    });

    const formattedTests = tests.map(test => ({
      id: test.id,
      title: test.title,
      // Format ngày tháng (VD: Feb 16)
      date: new Date(test.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      submissionCount: test._count.submissions
    }));

    res.json(formattedTests);
  } catch (error) {
    console.error("Lỗi lấy danh sách bài thi:", error);
    res.status(500).json({ error: "Lỗi server khi lấy danh sách" });
  }
};

exports.getTestAnalytics = async (req, res) => {
  try {
    const { testId } = req.params;

    if (!testId) return res.status(400).json({ error: "Thiếu testId" });

    const id = parseInt(testId);

    // 1. Lấy cấu trúc đề thi
    const testStructure = await prisma.test.findUnique({
      where: { id: id },
      include: {
        sections: {
          include: {
            questions: {
              select: { id: true, correctAnswer: true, order: true } // Lấy thêm order nếu cần sort
            }
          }
        }
      }
    });

    if (!testStructure) {
      return res.status(404).json({ error: "Không tìm thấy bài thi" });
    }

    // --- FIX LỖI 81 CÂU & TRÙNG LẶP ---
    // Sử dụng Map để lọc trùng câu hỏi theo ID
    const uniqueQuestionsMap = new Map();
    
    testStructure.sections.forEach(section => {
      section.questions.forEach(q => {
        // Chỉ thêm nếu chưa tồn tại trong Map
        if (!uniqueQuestionsMap.has(q.id)) {
            uniqueQuestionsMap.set(q.id, q);
        }
      });
    });

    // Chuyển Map về mảng và sắp xếp lại (nếu cần theo thứ tự câu hỏi)
    const allQuestions = Array.from(uniqueQuestionsMap.values())
        .sort((a, b) => (a.order || 0) - (b.order || 0)); // Sort lại cho chắc chắn

    // 2. Lấy danh sách bài nộp
    const submissions = await prisma.submission.findMany({
      where: {
        testId: id,
        status: 'COMPLETED'
      },
      select: {
        id: true, score: true, startedAt: true, endTime: true,
        user: { select: { id: true, name: true, email: true } },
        answers: { select: { questionId: true, selectedChoice: true } }
      },
      orderBy: { score: 'desc' }
    });

    // A. Tạo Leaderboard (Giữ nguyên logic của bạn - Tốt)
    const leaderboard = submissions.map(sub => {
      let timeString = "--";
      if (sub.startedAt && sub.endTime) {
        const diffMs = new Date(sub.endTime) - new Date(sub.startedAt);
        const minutes = Math.floor(diffMs / 60000);
        timeString = `${minutes}p`;
      }
      return {
        id: sub.user.id,
        name: sub.user.name || sub.user.email || "Học sinh",
        score: sub.score || 0,
        time: timeString
      };
    });

    // --- TỐI ƯU HIỆU NĂNG TÍNH TOÁN ---
    // Thay vì loop lồng nhau (Questions x Submissions), 
    // ta gom nhóm tất cả câu trả lời của Submissions vào một Lookup Object trước.
    
    // Tạo map: { questionId: [List các lựa chọn của HS] }
    // Ví dụ: { 101: ['A', 'B', 'A'], 102: ['C', 'C'] }
    const answersMap = {}; 

    submissions.forEach(sub => {
        const studentName = sub.user.name || "No Name";
        sub.answers.forEach(ans => {
            if (!answersMap[ans.questionId]) {
                answersMap[ans.questionId] = [];
            }
            // Lưu object gồm choice và tên HS để dùng bên dưới
            if (ans.selectedChoice) {
                answersMap[ans.questionId].push({
                    choice: ans.selectedChoice,
                    student: studentName
                });
            }
        });
    });

    // B. Tạo Thống kê (Chạy nhanh hơn nhiều)
    const questionsReport = allQuestions.map(question => {
      const choiceKeys = ['A', 'B', 'C', 'D'];
      const statsMap = { A: [], B: [], C: [], D: [] };

      // Lấy danh sách bài làm cho câu hỏi này từ answersMap (O(1) lookup)
      const studentAnswers = answersMap[question.id] || [];

      // Phân loại vào A, B, C, D
      studentAnswers.forEach(({ choice, student }) => {
          if (statsMap[choice]) {
              statsMap[choice].push(student);
          }
      });

      // Format kết quả
      const statsArray = choiceKeys.map(key => ({
        key: key,
        count: statsMap[key].length,
        students: statsMap[key]
      }));

      return {
        id: question.id,
        correctChoice: question.correctAnswer,
        stats: statsArray
      };
    });

    res.json({
      leaderboard,
      questions: questionsReport
    });

  } catch (error) {
    console.error("Lỗi Test Analytics:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
};
