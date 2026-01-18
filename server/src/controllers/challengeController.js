const axios = require('axios');

// 1. Cấu hình Safety để Google không chặn oan (Quan trọng)
const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

// 2. Hàm gọi API
const callGeminiAPI = async (prompt, temperature = 0.7) => {
  const API_KEY = process.env.GEMINI_API_KEY;
  const MODEL = "gemini-flash-latest"; // Model ổn định nhất hiện tại

  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    safetySettings: SAFETY_SETTINGS, // Thêm dòng này để tắt bộ lọc
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: 2000, // Tăng lên để không bị cắt cụt giữa chừng
      responseMimeType: "application/json" // Yêu cầu Google trả về JSON chuẩn
    }
  };

  try {
    const response = await axios.post(URL, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data && response.data.candidates && response.data.candidates.length > 0) {
      const candidate = response.data.candidates[0];
      // Kiểm tra xem có bị chặn không
      if (candidate.finishReason === "SAFETY") {
        throw new Error("Bị Google chặn vì lý do an toàn (Safety Filter)");
      }
      return candidate.content.parts[0].text;
    } else {
      throw new Error("API Google không trả về dữ liệu nào.");
    }
  } catch (error) {
    console.error(`🔥 Lỗi gọi API:`, error.response?.data || error.message);
    throw error;
  }
};

// 3. Hàm Parse JSON an toàn (Không bao giờ crash)
const safeJSONParse = (text, defaultVal) => {
  try {
    // 1. Loại bỏ markdown ```json ... ```
    let clean = text.replace(/```json|```/g, "").trim();
    
    // 2. Tìm điểm bắt đầu { và kết thúc }
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }
    
    return JSON.parse(clean);
  } catch (e) {
    console.error("❌ Lỗi Parse JSON:", e.message);
    console.log("Raw Text gây lỗi:", text); // Log ra để soi xem nó là cái gì
    return defaultVal; // Trả về giá trị mặc định để app không chết
  }
};

// --- CONTROLLERS ---

exports.getRandomPassage = async (req, res) => {
  try {
    console.log("🚀 Đang lấy đề...");
    const prompt = `
      You are an SAT Exam Writer.
      Generate a short reading passage (150 words) about Science.
      Output STRICT JSON format:
      {
        "title": "Title Here",
        "content": "Content Here...",
        "difficulty": "Medium"
      }
    `;

    const text = await callGeminiAPI(prompt);
    
    // Parse an toàn
    const result = safeJSONParse(text, {
      title: "Error Generating Passage",
      content: "Could not generate passage due to AI error. Please try again.",
      difficulty: "N/A"
    });

    res.json(result);

  } catch (error) {
    res.status(500).json({ error: "Lỗi Server", details: error.message });
  }
};

exports.verifyRecall = async (req, res) => {
  try {
    const { originalText, userSummary } = req.body;
    console.log("🚀 Đang chấm điểm...");

    const prompt = `
      Act as a teacher. Compare Original vs Student Summary.
      Original: "${originalText?.substring(0, 1000).replace(/"/g, "'")}"
      Student: "${userSummary?.substring(0, 1000).replace(/"/g, "'")}"
      
      Output STRICT JSON:
      {
        "score": 0,
        "feedback": "Short feedback",
        "missing_points": ["point 1"],
        "misunderstood": ["concept 1", "concept 2"],
        "better_version": "Better summary here"
      }
    `;

    const text = await callGeminiAPI(prompt, 0.2);
    
    // Parse an toàn
    const result = safeJSONParse(text, {
      score: 0,
      feedback: "Lỗi hệ thống khi chấm bài. Vui lòng thử lại.",
      missing_points: [],
      misunderstood: [],
      better_version: ""
    });

    res.json(result);

  } catch (error) {
    res.status(500).json({ error: "Lỗi chấm bài", details: error.message });
  }
};