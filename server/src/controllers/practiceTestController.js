const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getClasses = async (req, res) => {
try {
    // 1. Lấy thông tin từ Token (Middleware verifyToken đã decode ra)
    const userId = req.user.userId;
    const userRole = req.user.role; // 'STUDENT' | 'TEACHER' | 'ADMIN'

    let whereCondition = {};

    // 2. Xây dựng điều kiện lọc dựa trên Role
    if (userRole === 'TEACHER') {
      // Nếu là Giáo viên: Lấy các lớp do họ TẠO hoặc ĐỨNG LỚP
      whereCondition = {
        teacherId: userId 
      };
    } else if (userRole === 'STUDENT') {
      // Nếu là Học sinh: Lấy các lớp họ đang theo học
      whereCondition = {
        students: {
          some: {
            id: userId
          }
        }
      };
    } 

    // 3. Query Database
    const classes = await prisma.class.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        // Nếu là teacher, có thể muốn lấy thêm sĩ số
        _count: {
          select: { students: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(classes);

  } catch (error) {
    console.error("Error get classes:", error);
    res.status(500).json({ error: "Lỗi lấy danh sách lớp" });
  }
};

// 2. API LẤY DANH SÁCH BÀI THI (Cho PracticeTest)
exports.getTests = async (req, res) => {
  try {
    const userId = req.user.userId; 
    const hasUser = !isNaN(userId);

    // 2. Xây dựng điều kiện lọc (QUAN TRỌNG NHẤT)
    const whereCondition = hasUser 
      ? {
          OR: [
            // A. Đề thi thật & Public (Ai cũng thấy)
            { category: 'REAL', isPublic: true },
            
            // B. Đề thi được giao riêng cho lớp mà user này đang học
            {
              classTests: {
                some: {
                  // Cho cả trường hợp user là học sinh hoặc là giáo viên của lớp
                  isHidden: false,
                  OR: [
                    { class: { students: { some: { id: userId } } } },
                    { class: { teacherId: userId } }
                  ]
                }
              }
            },
            { authorId: userId }
          ]
        }
      : { category: 'REAL', isPublic: true }; // Nếu không có user, chỉ trả về đề Public

    // 3. Query Database (Tối ưu hóa query select)
    console.log('getTests - userId:', userId, 'hasUser:', hasUser, 'whereCondition:', JSON.stringify(whereCondition));
    const tests = await prisma.test.findMany({
      where: whereCondition,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        duration: true,
        
        // Các trường cần thiết cho Frontend Filter
        subject: true,
        category: true,
        testDate: true,
        mode: true,
        authorId: true,

        // Lấy thông tin lớp được giao (để Frontend biết đề này thuộc lớp nào)
        classTests: {
          select: { classId: true }
        },

        // Kỹ thuật "Sub-query" để check xem user có đang làm bài này không
        // Thay vì query riêng lẻ bên ngoài, ta query luôn ở đây
        ...(hasUser && {
          submissions: {
            where: {
              userId: userId,
              status: 'DOING' // Chỉ lấy bài đang làm dở
            },
            take: 1, // Chỉ cần biết có hay không, lấy 1 là đủ
            select: { id: true }
          }
        })
      }
    });

    // 4. Map dữ liệu để trả về format gọn gàng cho Frontend
    const result = tests.map(test => {
        // Tách submissions ra để tạo field isDoing boolean
        const { submissions, ...rest } = test;
        return {
            ...rest,
            // Nếu mảng submissions có dữ liệu -> Đang làm
            isDoing: submissions && submissions.length > 0 
        };
    });

    res.json(result);

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: 'Lỗi lấy danh sách bài thi' });
  }
};

exports.createTest = async (req, res) => {
  try {
    const { 
      title, description, duration, 
      subject, mode, sections, 
      assignClassId,
      testDate,
      category
    } = req.body;

    // Validate cơ bản
    if (!title || !sections) {
      return res.status(400).json({ error: 'Thiếu thông tin (Title hoặc Sections)' });
    }

    console.log(`📝 Đang tạo đề thi: ${title} - ${sections.length} modules`);

    const userId = req.user.userId;     // ID người tạo (Giáo viên/Admin)
    const userRole = req.user.role; // Role người tạo
    const isPublic = userRole === 'ADMIN';

    let finalTestDate = null;
    if (userRole === 'ADMIN' && testDate) {
      finalTestDate = new Date(testDate);
    }

    // Thực hiện Nested Write vào Database
    const newTest = await prisma.test.create({
      data: {
        title: title,
        description: description,
        duration: duration,
        subject: subject, // "RW" hoặc "MATH"
        mode: mode || 'PRACTICE',

        authorId: userId,
        isPublic: isPublic,
        category: category,
        testDate: finalTestDate,

        ...(assignClassId ? {
          classTests: { // Tên relation trong schema.prisma (VD: classTests hoặc classes)
            create: {
              classId: assignClassId
            }
          }
        } : {}),

        sections: {
          create: sections.map((section) => ({
            name: section.name,
            order: section.order,
            duration: section.duration,

            questions: {
              create: section.questions.map((q, index) => ({
                order: index + 1,
                questionText: q.questionText,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation || null,
                blocks: q.blocks, // Prisma tự động stringify mảng JSON này
                
                choices: q.choices.map(c => ({
                  id: c.id,
                  text: c.text
                }))
              }))
            }
          }))
        }
      },
      // Trả về dữ liệu đã tạo để kiểm tra
      include: {
        sections: {
          select: { id: true, name: true, questions: { select: { id: true } } }
        }
      }
    });

    console.log(`✅ Tạo thành công Test ID: ${newTest.id}`);
    res.status(200).json(newTest);

  } catch (error) {
    console.error("❌ Lỗi tạo đề thi:", error);
    res.status(500).json({ error: 'Lỗi server khi tạo đề thi', details: error.message });
  }
};