const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

exports.getClasses = ({ userId, userRole }) => {
  let whereCondition = {};

  if (userRole === 'TEACHER') {
    // Nếu là Giáo viên: Lấy các lớp do họ TẠO hoặc ĐỨNG LỚP
    whereCondition = { teacherId: userId };
  } else if (userRole === 'STUDENT') {
    // Nếu là Học sinh: Lấy các lớp họ đang theo học
    whereCondition = { students: { some: { id: userId } } };
  }

  return prisma.class.findMany({
    where: whereCondition,
    select: {
      id: true,
      name: true,
      _count: { select: { students: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
};

exports.getTests = async ({ userId }) => {
  const hasUser = !isNaN(userId);

  // Xây dựng điều kiện lọc
  const whereCondition = hasUser
    ? {
        OR: [
          // A. Đề thi thật & Public (Ai cũng thấy)
          { category: 'REAL', isPublic: true },
          // B. Đề thi được giao riêng cho lớp mà user này đang học
          {
            classTests: {
              some: {
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

  const tests = await prisma.test.findMany({
    where: whereCondition,
    orderBy: { id: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      duration: true,
      subject: true,
      category: true,
      testDate: true,
      mode: true,
      authorId: true,
      classTests: { select: { classId: true } },
      // Sub-query để check xem user có đang làm bài này không
      ...(hasUser && {
        submissions: {
          where: { userId: userId, status: 'DOING' },
          take: 1,
          select: { id: true }
        }
      })
    }
  });

  // Map dữ liệu để trả về format gọn gàng cho Frontend
  return tests.map(test => {
    const { submissions, ...rest } = test;
    return {
      ...rest,
      isDoing: submissions && submissions.length > 0
    };
  });
};

exports.createTest = async ({ title, description, duration, subject, mode, sections, assignClassId, testDate, category, folderId, userId, userRole }) => {
  // Validate cơ bản
  if (!title || !sections) {
    throw new ApiError(400, { error: 'Thiếu thông tin (Title hoặc Sections)' });
  }

  console.log(`📝 Đang tạo đề thi: ${title} - ${sections.length} modules`);

  const isPublic = userRole === 'ADMIN';

  let finalTestDate = null;
  if (userRole === 'ADMIN' && testDate) {
    finalTestDate = new Date(testDate);
  }

  // Nested Write vào Database
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
      folderId: folderId,
      ...(assignClassId ? {
        classTests: {
          create: { classId: assignClassId }
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
              type: q.type,
              explanation: q.explanation || null,
              blocks: q.blocks,
              choices: q.choices.map(c => ({ id: c.id, text: c.text }))
            }))
          }
        }))
      }
    },
    include: {
      sections: {
        select: { id: true, name: true, questions: { select: { id: true } } }
      }
    }
  });

  console.log(`✅ Tạo thành công Test ID: ${newTest.id}`);
  return newTest;
};
