const pdfParse = require('pdf-extraction');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// HÀM TIỆN ÍCH 1: CHIA NHỎ VĂN BẢN (SMART CHUNKING)
const splitTextIntoChunks = (text, maxChars = 8000) => {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += paragraph + "\n\n";
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

// HÀM TIỆN ÍCH 2: GỌI GEMINI CHO 1 CHUNK
const processChunkWithAI = async (chunkText, chunkIndex) => {
  const systemPrompt = `Bạn là một hệ thống chuyên gia bóc tách và định dạng đề thi SAT (Reading & Writing, Math). 
  Nhiệm vụ của bạn là đọc văn bản thô trích xuất từ PDF/Word và định dạng lại cấu trúc CHÍNH XÁC theo các quy tắc ngặt nghèo dưới đây. Tuyệt đối KHÔNG sử dụng Markdown (như **, ##) trừ khi được yêu cầu rõ.

  ### 1. CẤU TRÚC TỔNG THỂ (BẮT BUỘC)
  Nếu có phân chia module, bắt đầu bằng: === MODULE 1 === (hoặc 2).
  Mỗi câu hỏi phải theo đúng thứ tự cấu trúc sau:
  QUESTION [Số thứ tự]
  [Nội dung đoạn văn / Context / Hình ảnh / Bảng biểu]

  [Câu hỏi chính (Prompt)]
  A. [Đáp án A]
  B. [Đáp án B]
  C. [Đáp án C]
  D. [Đáp án D]
  Answer: [A/B/C/D hoặc số đối với câu SPR]
  Explanation: [Nội dung giải thích chi tiết. TUYỆT ĐỐI CHỈ trích xuất nếu văn bản gốc có sẵn giải thích. KHÔNG tự ý sáng tạo hay thêm bớt phần Explanation. Nếu gốc không có, hãy BỎ QUA hoàn toàn dòng này]

  *LƯU Ý KHOẢNG TRẮNG: LUÔN LUÔN phải có đúng 1 dòng trống (blank line) ngăn cách giữa [Nội dung đoạn văn] và [Câu hỏi chính].

  ---

  ### 2. QUY TẮC ĐỊNH DẠNG NỘI DUNG (BLOCKS)
  Phần nội dung (Passage) trước câu hỏi phải được gắn thẻ (tag) nếu thuộc các dạng đặc biệt:
  - BẢNG BIỂU: Phải bắt đầu bằng tag [TABLE] trên một dòng riêng. Các cột trong bảng PHẢI được cách nhau bằng dấu Tab (\\t), KHÔNG dùng dấu cách hay dấu |. Dòng đầu tiên là Header.
  - THƠ / TRÍCH DẪN: Bắt đầu bằng tag [POEM] trên một dòng riêng. Mỗi câu thơ nằm trên một dòng.
  - GHI CHÚ / BULLET POINTS: Nếu đoạn văn bản có dạng ghi chú, LUÔN LUÔN đặt thẻ [NOTE] lên DÒNG ĐẦU TIÊN của phần nội dung đó. Các ý gạch đầu dòng bắt đầu bằng dấu "-" hoặc "•".
  - HÌNH ẢNH: Nếu có ảnh/đồ thị không hiển thị được, hãy đặt tag [IMG] tại vị trí đó.
  - GẠCH CHÂN VÀ CHỖ TRỐNG (BLANK): 
    + Chỉ những từ/cụm từ thực sự BỊ GẠCH CHÂN mới được bọc trong cặp dấu == (Ví dụ: ==từ bị gạch chân==).
    + Đối với những câu có chỗ trống (blank) để điền từ (Ví dụ: "_________"), hãy giữ nguyên ký tự gạch dưới đó, TUYỆT ĐỐI KHÔNG bọc bằng cặp dấu ==.

  ---

  ### 3. QUY TẮC CHO MÔN MATH (TOÁN HỌC)
  Hệ thống Frontend đã có trình biên dịch Math riêng, bạn có thể xuất công thức Toán theo 1 trong 2 cách:
  - Cách 1 (Khuyên dùng): Bọc tất cả công thức, biến số, biểu thức toán học trong ký hiệu LaTeX chuẩn bằng dấu $ (Ví dụ: $x^2 + y^2 = r^2$, $\\frac{a}{b}$, $\\sqrt{x}$).
  - Cách 2 (Dùng cú pháp thô): 
    + Phân số: (a)/(b)
    + Số mũ: a^(b)
    + Căn bậc hai: sqrt(x)
    + Góc/Tam giác: /_ ABC, tri ABC
    + Độ: 45deg
    + Số Pi: pi

  ---

  ### 4. QUY TẮC CHO MÔN READING & WRITING (RW)
  Tuyệt đối KHÔNG thay đổi các từ khóa nhận diện câu hỏi như: "The student wants to", "Which choice", "Which finding", "The main idea", "Based on the text", "According to the text", "Which quotation", "Which conclusion". Hệ thống dùng chúng để phân loại môn học tự động.

  ---

  ### 5. VÍ DỤ ĐẦU RA KỲ VỌNG (OUTPUT EXAMPLE)

  QUESTION 1
  [TABLE]
  X\tY
  1\t2
  3\t4
  5\t6

  Based on the table above, what is the value of $Y$ when $X = 7$?
  A. $7$
  B. $8$
  C. $9$
  D. $10$
  Answer: B
  Explanation: Because the pattern increases by 2.

  QUESTION 2
  [NOTE]
  - Bird populations have been decreasing.
  - Urban noise is a primary suspect.

  While researching the effects of urban noise, scientists noticed a ==significant decrease== in bird populations. However, the exact cause remains ________.

  Which choice best summarizes the main idea of the text?
  A. Urban noise helps birds.
  B. Urban noise reduces bird populations.
  C. Scientists like urban noise.
  D. Birds are unaffected.
  Answer: B
  `;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
      }
    });

    const result = await model.generateContent([
      systemPrompt,
      `Đây là phần văn bản số ${chunkIndex + 1} cần định dạng:\n\n${chunkText}`
    ]);

    return result.response.text();
  } catch (error) {
    console.error(`Lỗi ở chunk ${chunkIndex}:`, error);
    return `\n\n--- [LỖI AI KHI ĐỊNH DẠNG ĐOẠN NÀY, VUI LÒNG KIỂM TRA LẠI] ---\n${chunkText}\n\n`;
  }
};

// MAIN CONTROLLER: XỬ LÝ UPLOAD VÀ PARSE FILE
exports.parseDocumentController = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Không tìm thấy file.' });

    let rawText = "";

    // 1. BÓC TÁCH TEXT TỪ FILE
    if (file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(file.buffer);
      rawText = pdfData.text;
    } 
    else if (file.originalname.endsWith('.docx') || file.originalname.endsWith('.doc')) {
      const docData = await mammoth.extractRawText({ buffer: file.buffer });
      rawText = docData.value;
    } 
    else {
      return res.status(400).json({ error: 'Chỉ hỗ trợ file PDF hoặc Word (.docx, .doc).' });
    }

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: 'File rỗng hoặc không thể đọc được chữ từ file này.' });
    }
    const chunks = splitTextIntoChunks(rawText, 8000);
    // 3. XỬ LÝ SONG SONG
    // const aiPromises = chunks.map((chunk, index) => processChunkWithAI(chunk, index));
    // const formattedChunks = await Promise.all(aiPromises);
    const formattedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`🤖 Đang nhờ AI xử lý chunk ${i + 1}/${chunks.length}...`);
      const chunkResult = await processChunkWithAI(chunks[i], i);
      formattedChunks.push(chunkResult);
      if (i < chunks.length - 1) {
        console.log(`⏳ Tạm nghỉ 8 giây để không bị Google block API...`);
        await sleep(8000);
      }
    }
    // 4. GHÉP NỐI VÀ TRẢ VỀ
    const finalResult = formattedChunks.join('\n\n').trim();
    return res.status(200).json({
      success: true,
      text: finalResult
    });
  } catch (error) {
    console.error("Lỗi hệ thống Parse Document:", error);
    return res.status(500).json({ 
      success: false, 
      error: 'Có lỗi xảy ra trong quá trình xử lý file. Vui lòng thử lại.' 
    });
  }
};