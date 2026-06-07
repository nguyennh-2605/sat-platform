const chatbotService = require('../services/ai-chatbot.service');

// --- CONTROLLER 1: CHATBOT GIẢI THÍCH (Toán, Thơ, Bảng, Ảnh) ---
exports.chatExplain = async (req, res) => {
  try {
    const { message, history, context } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = await chatbotService.createChatStream({ message, history, context });

    for await (const chunk of stream) {
      const chunkText = chunk.text();
      res.write(chunkText);
    }

    res.end();
  } catch (error) {
    console.error("Stream Error:", error);
    if (!res.writableEnded) {
      res.write("\n[Lỗi kết nối AI hoặc hết phiên làm việc]");
      res.end();
    }
  }
};
