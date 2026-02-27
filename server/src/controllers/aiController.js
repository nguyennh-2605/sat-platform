const axios = require('axios');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// Khởi tạo Gemini API (Lưu ý: process.env.GEMINI_API_KEY phải được load ở index.js)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- HELPER: Tải và chuyển đổi ảnh sang Base64 ---
async function fetchImagePart(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return {
      inlineData: {
        data: Buffer.from(response.data).toString("base64"),
        mimeType: response.headers['content-type'] || 'image/jpeg'
      },
    };
  } catch (e) {
    console.error(`Không thể tải ảnh từ URL: ${url}`, e.message);
    return null;
  }
}

// --- CONTROLLER 1: CHATBOT GIẢI THÍCH (Toán, Thơ, Bảng, Ảnh) ---
exports.chatExplain = async (req, res) => {
  try {
    const { message, history, context } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const systemInstruction = `Bạn là một gia sư AI chuyên nghiệp và tận tâm.
    Môn học: ${context.subject || 'Không rõ'}.

    --- DỮ LIỆU ---
    Đề bài: ${context.questionText || ''}
    Đáp án đúng: ${context.correctAnswer || ''}
    Lựa chọn: ${context.choices ? context.choices.join(', ') : ''}

    --- YÊU CẦU GIẢI THÍCH ---
    Hãy trình bày lời giải theo cấu trúc 3 phần sau đây:
    1. **Phân tích nhanh**: Giải thích ngắn gọn từ khóa hoặc logic của câu hỏi.
    2. **Tại sao chọn ${context.correctAnswer}**: Chỉ ra lý do đáp án này đúng dựa trên ngữ cảnh.
    3. **Loại trừ**: Giải thích nhanh 1-2 lỗi sai điển hình của các phương án khác.

    --- QUY TẮC ĐỊNH DẠNG ---
    - Dùng Markdown (in đậm từ khóa).
    - Công thức toán học dùng LaTeX: $inline$ hoặc $$display$$.
    - Tuyệt đối không nhắc lại toàn bộ đề bài.`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction
    });

    // Xử lý ảnh đính kèm (nếu có)
    let imageParts = [];
    if (context.imageUrls && context.imageUrls.length > 0) {
      const parts = await Promise.all(context.imageUrls.map(fetchImagePart));
      imageParts = parts.filter(p => p !== null);
    }

    // Format lại lịch sử chat
    const formattedHistory = history ? history.map(h => ({ 
      role: h.role === 'ai' ? 'model' : 'user', // Đảm bảo đúng role của Gemini
      parts: [{ text: h.content }] 
    })) : [];

    const chat = model.startChat({ 
      history: formattedHistory,
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7
      },
      safetySettings
    });
    const result = await chat.sendMessageStream([message, ...imageParts]);

    for await (const chunk of result.stream) {
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