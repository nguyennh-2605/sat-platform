const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Map lưu trữ kết nối: Key là userId, Value là một Set chứa các response (để hỗ trợ 1 user mở nhiều tab)
const clients = new Map();

const connectStream = (req, res) => {
  const userId = req.user.userId || req.user.id;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  // Bắt buộc phải có 3 header này để trình duyệt hiểu đây là luồng SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Lưu kết nối vào Map
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);

  // Gửi một tín hiệu rỗng đầu tiên để xác lập kết nối thành công
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);

  // Khi user đóng tab hoặc mất mạng -> Xóa kết nối khỏi bộ nhớ để tránh tràn RAM
  req.on('close', () => {
    const userClients = clients.get(userId);
    if (userClients) {
      userClients.delete(res);
      // Nếu user tắt hết tất cả các tab, xóa luôn user đó khỏi Map
      if (userClients.size === 0) {
        clients.delete(userId);
      }
    }
  });
};

// [2] HÀM HELPER BẮN THÔNG BÁO (Gọi hàm này ở các logic khác)
const sendNotificationToUser = async (userId, message, link = null) => {
  try {
    console.log("🔔 Đang gửi Notif:", { userId, message, link });
    // 1. Lưu thông báo vào Database (để lúc user F5 vẫn thấy)
    const newNotif = await prisma.notification.create({
      data: {
        userId: userId,
        message: message,
        link: link
      }
    });

    // 2. Bắn Real-time tới các tab đang mở của user đó
    const userClients = clients.get(userId);
    if (userClients) {
      userClients.forEach(clientRes => {
        // Cú pháp chuẩn của SSE là bắt đầu bằng "data: " và kết thúc bằng "\n\n"
        clientRes.write(`data: ${JSON.stringify(newNotif)}\n\n`);
      });
    } else {
      console.log(`💤 Không tìm thấy kết nối. User "${userId}" đang OFFLINE.`);
    }
    
    return newNotif;
  } catch (error) {
    console.error("Lỗi khi gửi thông báo:", error);
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    // 2. Query Prisma lấy thông báo của user này
    const notifications = await prisma.notification.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // Khuyên dùng: Chỉ lấy 50 thông báo gần nhất để web không bị lag
    });

    // 3. Trả về cho Frontend
    return res.status(200).json(notifications);

  } catch (error) {
    console.error("❌ Lỗi lấy lịch sử thông báo:", error);
    return res.status(500).json({ error: "Lỗi server khi lấy thông báo" });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    await prisma.notification.updateMany({
      where: { 
        userId: Number(userId),
        isRead: false // Chỉ update những cái chưa đọc
      },
      data: { 
        isRead: true 
      }
    });

    return res.status(200).json({ message: "Đã đánh dấu đọc tất cả" });
  } catch (error) {
    console.error("❌ Lỗi update trạng thái đọc:", error);
    return res.status(500).json({ error: "Lỗi server" });
  }
};

module.exports = {
  connectStream,
  sendNotificationToUser,
  getNotifications,
  markAllAsRead
};