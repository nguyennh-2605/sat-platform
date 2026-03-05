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

    --- CÁCH THỨC HOẠT ĐỘNG ---
    1. NẾU người dùng yêu cầu giải thích câu hỏi chung chung: Hãy trình bày lời giải theo cấu trúc 3 phần sau đây. TUYỆT ĐỐI KHÔNG giải thích dông dài, đi thẳng vào trọng tâm. Tổng độ dài không vượt quá 200 từ:
    - **Phân tích nhanh**: Viết TỐI ĐA 3 câu tóm tắt logic của câu hỏi.
    - **Tại sao chọn ${context.correctAnswer}**: Giải thích trực diện lý do đúng trong 2-3 câu ngắn gọn.
    - **Loại trừ**: Giải thích nhanh lỗi sai điển hình của các phương án khác. Mỗi đáp án TỐI ĐA 2 câu

    2. NẾU người dùng hỏi cụ thể (Ví dụ: "Tại sao B sai?", "Dịch đề bài"):
    - BỎ QUA cấu trúc 3 phần ở trên. 
    - Trả lời TRỰC TIẾP, chính xác vào yêu cầu của họ một cách ngắn gọn nhất.
    
    3. Luôn ưu tiên thông tin trong tin nhắn mới nhất của người dùng hơn là dữ liệu đề bài mặc định.

    --- LƯU Ý QUAN TRỌNG VỀ TRÌNH BÀY (MARKDOWN) ---
    1. TUYỆT ĐỐI KHÔNG dùng dấu sao (*) để làm danh sách. Hãy luôn dùng dấu gạch ngang (-).
    2. LUÔN LUÔN cách 1 dòng trắng (Enter) trước khi bắt đầu một danh sách gạch đầu dòng.
    3. Không thụt lề lộn xộn trước các dấu gạch ngang. Hãy viết sát lề trái.`;

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
      role: h.role,
      parts: [{ text: h.content }] 
    })) : [];

    const chat = model.startChat({ 
      history: formattedHistory,
      generationConfig: {
        maxOutputTokens: 1500,
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