const prisma = require('../config/prisma');

// Map lưu trữ kết nối: Key là userId, Value là một Set chứa các response (để hỗ trợ 1 user mở nhiều tab)
const clients = new Map();

const addClient = (userId, res) => {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);
};

const removeClient = (userId, res) => {
  const userClients = clients.get(userId);
  if (userClients) {
    userClients.delete(res);
    // Nếu user tắt hết tất cả các tab, xóa luôn user đó khỏi Map
    if (userClients.size === 0) {
      clients.delete(userId);
    }
  }
};

// HÀM HELPER BẮN THÔNG BÁO (Gọi hàm này ở các logic khác)
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

const getNotifications = (userId) => {
  return prisma.notification.findMany({
    where: { userId: userId },
    orderBy: { createdAt: 'desc' },
    take: 50 // Chỉ lấy 50 thông báo gần nhất để web không bị lag
  });
};

const markAllAsRead = (userId) => {
  return prisma.notification.updateMany({
    where: {
      userId: Number(userId),
      isRead: false // Chỉ update những cái chưa đọc
    },
    data: { isRead: true }
  });
};

module.exports = {
  addClient,
  removeClient,
  sendNotificationToUser,
  getNotifications,
  markAllAsRead
};
