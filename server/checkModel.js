require('dotenv').config();
const axios = require('axios');

async function listMyModels() {
  const API_KEY = process.env.GEMINI_API_KEY;
  // Endpoint để lấy danh sách model
  const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

  console.log("📡 Đang kết nối tới Google để lấy danh sách...");

  try {
    const response = await axios.get(URL);
    const models = response.data.models;

    console.log("\n✅ THÀNH CÔNG! Dưới đây là các model bạn ĐƯỢC PHÉP dùng:");
    console.log("-------------------------------------------------------");
    
    // Lọc ra các model dùng để chat/tạo text
    const availableModels = models.filter(m => 
      m.supportedGenerationMethods.includes("generateContent")
    );

    if (availableModels.length === 0) {
      console.log("⚠️ Tài khoản này không có model nào hỗ trợ tạo văn bản (generateContent).");
    } else {
      availableModels.forEach(m => {
        // In ra tên chuẩn để copy
        console.log(`👉 TÊN MODEL: ${m.name.replace("models/", "")}`);
      });
    }
    console.log("-------------------------------------------------------");

  } catch (error) {
    console.log("❌ LỖI RỒI:");
    if (error.response) {
      console.log("Code:", error.response.status);
      console.log("Message:", error.response.data);
    } else {
      console.log(error.message);
    }
  }
}

listMyModels();