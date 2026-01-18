const axios = require('axios');

// Cấu hình an toàn & Model
const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

const callGeminiAPI = async (prompt) => {
  const API_KEY = process.env.GEMINI_API_KEY;
  const MODEL = "gemini-flash-latest"; // Bản ổn định nhất

  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.9, // Tăng sáng tạo để đề đa dạng
      maxOutputTokens: 2000,
      responseMimeType: "application/json"
    }
  };

  try {
    const response = await axios.post(URL, payload, { headers: { 'Content-Type': 'application/json' } });
    if (response.data.candidates && response.data.candidates[0].content) {
      return response.data.candidates[0].content.parts[0].text;
    }
    throw new Error("API không trả về dữ liệu.");
  } catch (error) {
    console.error("🔥 Gemini Error:", error.response?.data || error.message);
    throw error;
  }
};

const safeJSONParse = (text, defaultVal) => {
  try {
    let clean = text.replace(/```json|```/g, "").trim();
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) clean = clean.substring(firstBrace, lastBrace + 1);
    return JSON.parse(clean);
  } catch (e) {
    console.error("❌ JSON Parse Error:", e.message);
    return defaultVal;
  }
};

// --- CONTROLLERS ---

// 1. Tạo câu hỏi SAT
exports.getSATQuestion = async (req, res) => {
  try {
    const { difficulty = "Medium", type = "Command of Evidence" } = req.body;
    console.log(`🚀 Tạo đề SAT: [${difficulty}] - [${type}]`);

    const prompt = `
      Create a realistic Digital SAT Reading & Writing question.
      - Topic: Academic (Science, Literature, History, or Social Studies).
      - Type: ${type}
      - Difficulty: ${difficulty}
      
      Output STRICT JSON format:
      {
        "passage": "The text content (approx 50-150 words)...",
        "question": "The actual question text...",
        "options": {
          "A": "Option A text",
          "B": "Option B text",
          "C": "Option C text",
          "D": "Option D text"
        },
        "correct_answer": "A", 
        "correct_explanation": "Brief explanation why A is right."
      }
    `;

    const text = await callGeminiAPI(prompt);
    
    const result = safeJSONParse(text, {
      passage: "Error generating passage.",
      question: "Error generating question.",
      options: { A: "Error", B: "Error", C: "Error", D: "Error" },
      correct_answer: "A",
      correct_explanation: "System error."
    });

    // Để bảo mật, có thể xóa correct_answer trước khi gửi về client nếu muốn,
    // nhưng ở đây ta gửi luôn để client dễ xử lý (frontend sẽ ẩn nó đi).
    res.json(result);

  } catch (error) {
    res.status(500).json({ error: "Lỗi tạo đề", details: error.message });
  }
};

exports.evaluateSATResponse = async (req, res) => {
  try {
    const { questionData, userChoice, userExplanations } = req.body;
    
    // Log để kiểm tra xem client có gửi đúng dữ liệu lên không
    console.log("📥 User Data:", { userChoice, userExplanations });

    const prompt = `
      You are an elite SAT Tutor. Evaluate the student's reasoning skills.
      
      CONTEXT:
      - Passage: "${questionData.passage}"
      - Question: "${questionData.question}"
      - Correct Answer: ${questionData.correct_answer} (${questionData.options[questionData.correct_answer]})
      
      STUDENT'S ANSWER:
      - Choice: ${userChoice}
      - Reasoning for A: "${userExplanations.A || 'No explanation provided'}"
      - Reasoning for B: "${userExplanations.B || 'No explanation provided'}"
      - Reasoning for C: "${userExplanations.C || 'No explanation provided'}"
      - Reasoning for D: "${userExplanations.D || 'No explanation provided'}"
      
      TASK:
      1. Verify if the student's Choice matches the Correct Answer.
      2. Analyze their reasoning for EACH option (A, B, C, D). 
         - Did they correctly identify why the wrong answers are wrong?
         - Did they correctly identify why the right answer is right?
         - If they wrote "No explanation provided", criticize them gently.
      
      IMPORTANT: Output MUST be valid JSON with NO markdown. Use this EXACT structure:
      {
        "is_correct": boolean,
        "score": number, 
        "feedback": "General feedback summary (max 2 sentences)",
        "detailed_analysis": {
           "A": "Specific feedback on student's logic for A",
           "B": "Specific feedback on student's logic for B",
           "C": "Specific feedback on student's logic for C",
           "D": "Specific feedback on student's logic for D"
        },
        "better_explanation": "A model explanation explaining why correct is right and others are wrong."
      }
    `;

    const text = await callGeminiAPI(prompt);
    
    // Log ra xem AI trả về cái gì để debug nếu vẫn lỗi
    console.log("🤖 Raw Gemini Response:", text.substring(0, 200) + "..."); 

    const result = safeJSONParse(text, {
      is_correct: false,
      score: 0,
      feedback: "Hệ thống không đọc được phản hồi của AI.",
      detailed_analysis: { 
        A: "Không có dữ liệu", 
        B: "Không có dữ liệu", 
        C: "Không có dữ liệu", 
        D: "Không có dữ liệu" 
      },
      better_explanation: "Lỗi kết nối."
    });

    // Fallback: Nếu AI trả về thiếu key nào đó, tự lấp đầy để Frontend không bị lỗi
    if (!result.detailed_analysis) result.detailed_analysis = {};
    ['A', 'B', 'C', 'D'].forEach(key => {
        if (!result.detailed_analysis[key]) {
            result.detailed_analysis[key] = "AI không đưa ra nhận xét cho mục này.";
        }
    });

    res.json(result);

  } catch (error) {
    console.error("🔥 Error evaluating:", error);
    res.status(500).json({ error: "Lỗi chấm bài", details: error.message });
  }
};