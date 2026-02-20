const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('⏳ Đang tìm các bài thi có status DOING...')

  try {
    // 1. Tìm danh sách các ID của submission đang làm dở
    const submissions = await prisma.submission.findMany({
      where: { status: 'DOING' },
      select: { id: true } // Chỉ lấy cột ID cho nhẹ
    })

    const submissionIds = submissions.map(sub => sub.id)

    if (submissionIds.length === 0) {
      console.log('⚠️ KHÔNG CÓ GÌ ĐỂ XÓA: Không tìm thấy submission nào status DOING.')
      return
    }

    console.log(`🔎 Tìm thấy ${submissionIds.length} bài thi đang làm dở. Đang tiến hành xóa...`)

    // 2. Xóa tất cả các câu trả lời (Answer) thuộc về các submission này TRƯỚC
    // (Đây là bước quan trọng để tránh lỗi Foreign Key)
    const deletedAnswers = await prisma.answer.deleteMany({
      where: {
        submissionId: { in: submissionIds }
      }
    })
    console.log(`✅ Đã dọn dẹp xong ${deletedAnswers.count} câu trả lời (Answer) liên quan.`)

    // 3. Bây giờ mới xóa Submission (Lúc này đã an toàn để xóa)
    const deletedSubmissions = await prisma.submission.deleteMany({
      where: {
        id: { in: submissionIds }
      }
    })
    
    console.log(`🎉 THÀNH CÔNG: Đã xóa vĩnh viễn ${deletedSubmissions.count} bài thi (Submission).`)

  } catch (error) {
    console.error('❌ VẪN CÒN LỖI:', error)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })