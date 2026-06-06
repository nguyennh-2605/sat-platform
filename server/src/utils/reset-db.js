const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.user.create({
      data: {
        name: "ADMIN",
        email: "admin@gmail.com",
        password: "$2b$10$RQff/o92ttm/VBos26c7..3/DpqniEH6HmwPcGDf/6D1hyM92Kwue",
        role: "ADMIN"
      }
    })

    console.log("✅ Tạo admin thành công")
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