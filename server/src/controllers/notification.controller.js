const notificationService = require('../services/notification.service');

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

  notificationService.addClient(userId, res);

  // Gửi một tín hiệu rỗng đầu tiên để xác lập kết nối thành công
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);

  // Khi user đóng tab hoặc mất mạng -> Xóa kết nối khỏi bộ nhớ để tránh tràn RAM
  req.on('close', () => {
    notificationService.removeClient(userId, res);
  });
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const notifications = await notificationService.getNotifications(userId);
    return res.status(200).json(notifications);
  } catch (error) {
    console.error("❌ Lỗi lấy lịch sử thông báo:", error);
    return res.status(500).json({ error: "Lỗi server khi lấy thông báo" });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    await notificationService.markAllAsRead(userId);
    return res.status(200).json({ message: "Đã đánh dấu đọc tất cả" });
  } catch (error) {
    console.error("❌ Lỗi update trạng thái đọc:", error);
    return res.status(500).json({ error: "Lỗi server" });
  }
};

module.exports = {
  connectStream,
  // Re-export để code cũ import từ controller vẫn hoạt động
  sendNotificationToUser: notificationService.sendNotificationToUser,
  getNotifications,
  markAllAsRead
};
