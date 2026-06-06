const fs = require('fs');
const path = require('path');

const prisma = require('../src/db');

async function main() {
  console.log('🌱 Đang khởi tạo dữ liệu...');

  // 1. Xóa dữ liệu cũ
  await prisma.answer.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.question.deleteMany();
  await prisma.section.deleteMany();
  await prisma.test.deleteMany();
  console.log('🗑️  Đã dọn dẹp dữ liệu cũ.');

  // 2. Đường dẫn thư mục data
  const dataDir = path.join(__dirname, 'data');

  // 3. Đọc danh sách file JSON
  // Kiểm tra xem thư mục có tồn tại không trước khi đọc
  if (!fs.existsSync(dataDir)) {
      console.error(`❌ Lỗi: Không tìm thấy thư mục ${dataDir}`);
      process.exit(1);
  }

  const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
  console.log(`📂 Tìm thấy ${files.length} file dữ liệu:`, files);

  // 4. Vòng lặp nạp dữ liệu
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const testData = JSON.parse(fileContent);

    console.log(`⏳ Đang nạp file: ${file}...`);

    // 👇 SỬA LỖI Ở ĐÂY: Gán kết quả vào biến 'createdTest'
    const createdTest = await prisma.test.create({
      data: {
        title: testData.title,
        description: testData.description,
        duration: testData.duration,
        sections: {
          create: testData.sections.map((section) => ({
            name: section.name,
            order: section.order,
            duration: section.duration,
            questions: {
              create: section.questions.map((q) => ({
                blocks: q.blocks,
                questionText: q.questionText || "Question content missing",
                correctAnswer: q.correctAnswer,
                choices: q.choices 
              }))
            }
          }))
        }
      }
    });

    // 👇 Log tên đề thi vừa tạo xong (dùng biến createdTest)
    console.log(`✅ Đã nạp thành công: ${createdTest.title}`);
  }

  console.log(`🎉 Hoàn tất! Đã nạp tổng cộng ${files.length} đề thi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });