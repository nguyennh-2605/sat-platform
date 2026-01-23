// src/utils/satParser.ts

// --- 1. ĐỊNH NGHĨA TYPE (Giữ nguyên) ---
export interface TextBlock { type: 'text'; content: string; }
export interface ImageBlock { type: 'image'; src: string; }
export interface TableBlock { type: 'table'; headers: string[]; rows: string[][]; }
export interface PoemBlock { type: 'poem'; lines: string[]; }
export type ContentBlock = TextBlock | ImageBlock | TableBlock | PoemBlock;

export interface SATQuestion {
  id?: string;
  module: number;
  index: number;
  blocks: ContentBlock[];
  questionText: string;
  correctAnswer: string;
  choices: { id: string; text: string }[];
  explanation?: string;
}

// --- 2. CÁC HÀM HELPER PARSE BLOCKS (Giữ nguyên) ---
const parseTableData = (rawText: string) => {
  const lines = rawText.trim().split('\n').filter(r => r.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split('\t').map(h => h.trim());
  const rows = lines.slice(1).map(line => line.split('\t').map(c => c.trim()));
  return { headers, rows };
};

const smartFormatText = (rawText: string): string => {
  const lines = rawText.split('\n');
  let result = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (result === '') {
      result = line;
    } else {
      const isListItem = line.startsWith('-') || line.startsWith('•');
      const prevEndsWithColon = result.trim().endsWith(':');
      if (isListItem || prevEndsWithColon) {
        result += '\n' + line;
      } else {
        result += ' ' + line;
      }
    }
  }
  return result;
};

const parsePassageToBlocks = (rawPassage: string): ContentBlock[] => {
  if (!rawPassage) return [];
  const parts = rawPassage.split(/(\[(?:TEXT|TABLE|IMG|POEM)\])/i);
  const blocks: ContentBlock[] = [];
  let currentType = 'TEXT'; 

  for (let part of parts) {
    part = part.trim();
    if (!part) continue;
    const matchType = part.match(/^\[(TEXT|TABLE|IMG|POEM)\]$/i);
    if (matchType) {
      currentType = matchType[1].toUpperCase();
    } else {
      if (currentType === 'TABLE') {
        const tableData = parseTableData(part);
        blocks.push({ type: 'table', headers: tableData.headers, rows: tableData.rows });
      } else if (currentType === 'POEM') {
        blocks.push({ type: 'poem', lines: part.split('\n').map(l => l.trim()).filter(Boolean) });
      } else if (currentType === 'IMG') {
        blocks.push({ type: 'image', src: part }); // Fix: Giữ src nếu có
      } else {
        blocks.push({ type: 'text', content: smartFormatText(part) });
      }
    }
  }
  if (rawPassage.trim().match(/\[IMG\]$/i)) blocks.push({ type: 'image', src: '' });
  return blocks;
};

// --- 3. HÀM XỬ LÝ CHÍNH TỪNG CÂU HỎI (Logic Mới: Strict Punctuation) ---

const parseSingleQuestion = (rawQText: string, modIndex: number, qIndex: number): SATQuestion => {
    let textToProcess = rawQText;
    
    // A. Tách Metadata (Answer/Explanation) trước
    let correctAnswer = '';
    let explanation = '';
    
    const explMatch = textToProcess.match(/Explanation:\s*([\s\S]*)$/i);
    if (explMatch) {
        explanation = explMatch[1].trim();
        textToProcess = textToProcess.substring(0, explMatch.index).trim();
    }
    const ansMatch = textToProcess.match(/Answer:\s*([A-D])/i);
    if (ansMatch) {
        correctAnswer = ansMatch[1].toUpperCase();
        textToProcess = textToProcess.replace(/Answer:\s*[A-D].*/i, '').trim();
    }
    // Xóa header QUESTION X
    textToProcess = textToProcess.replace(/^QUESTION\s+\d+/i, '').trim();

    // B. TÁCH OPTIONS VÀ CONTENT (Strict Mode)
    // Regex này tìm vị trí bắt đầu của Options.
    // Điều kiện bắt buộc: Phải là A kèm theo dấu chấm (.), ngoặc ( : )) hoặc đóng ngoặc ())
    // Ví dụ khớp: "A.", "A)", "(A)", "A:"
    // Ví dụ KHÔNG khớp: "A beautiful flower" (vì sau A là dấu cách)
    
    // Giải thích Regex:
    // (?:\n|^)\s* : Đầu dòng
    // (\(?[A]\)?)     : Chữ A (có thể có ngoặc bao quanh)
    // (?:[\.\:\)]+)   : BẮT BUỘC phải có dấu chấm/hai chấm/đóng ngoặc theo sau
    // \s+             : Sau đó mới đến khoảng trắng
    // .*?             : Nội dung đáp án A
    // (?=\n\s*...)    : Dừng lại khi gặp B với cấu trúc tương tự
    const splitRegex = /(?:\n|^)\s*(\(?[A]\)?(?:[\.\:\)]+)\s+.*?)(?=\n\s*\(?[B]\)?(?:[\.\:\)]+)\s+)/s;
    
    const match = textToProcess.match(splitRegex);
    
    let contentAndQuestion = textToProcess;
    let optionsRaw = '';

    if (match && match.index !== undefined) {
        // Tìm thấy đáp án A chuẩn -> Cắt
        contentAndQuestion = textToProcess.substring(0, match.index).trim();
        optionsRaw = textToProcess.substring(match.index).trim();
    } else {
        // Fallback: Nếu không tìm thấy cấu trúc A...B, thử tìm A nằm ở cuối cùng văn bản
        // Vẫn bắt buộc phải có dấu chấm/ngoặc
        const lastARegex = /(?:\n|^)\s*(\(?[A]\)?(?:[\.\:\)]+)\s+.*)$/s;
        const fallbackMatch = textToProcess.match(lastARegex);
        if (fallbackMatch && fallbackMatch.index !== undefined) {
             contentAndQuestion = textToProcess.substring(0, fallbackMatch.index).trim();
             optionsRaw = textToProcess.substring(fallbackMatch.index).trim();
        }
    }

    // C. PARSE CÁC LỰA CHỌN (A, B, C, D)
    const choices: { id: string; text: string }[] = [];
    if (optionsRaw) {
        // Regex quét tìm A, B, C, D đầu dòng có dấu ngắt
        const choiceRegex = /(?:\n|^)\s*(\(?[A-D]\)?)(?:[\.\:\)]+)\s+([\s\S]*?)(?=(?:\n\s*\(?[A-D]\)?(?:[\.\:\)]+)\s+)|$)/gi;
        let cMatch;
        while ((cMatch = choiceRegex.exec(optionsRaw)) !== null) {
            choices.push({
                // Xóa các dấu ngoặc thừa để lấy ID sạch (ví dụ "(A)" -> "A")
                id: cMatch[1].replace(/[\(\)]/g, '').toUpperCase(),
                text: cMatch[2].trim()
            });
        }
    }

    // D. TÁCH PASSAGE VÀ QUESTION TEXT
    let rawPassage = '';
    let questionText = '';

    // Dùng Regex tìm các câu hỏi kinh điển
    const questionKeywords = [
        "The student wants to", "Which choice", "Which finding", 
        "The main idea", "Based on the text", "According to the text", 
        "Which quotation"
    ];
    
    const qSplitRegex = new RegExp(`(?:^|\\n)(${questionKeywords.join('|')})`, 'i');
    const qMatch = contentAndQuestion.match(qSplitRegex);

    if (qMatch && qMatch.index !== undefined) {
        const splitIndex = qMatch.index + (qMatch[0].startsWith('\n') ? 1 : 0);
        rawPassage = contentAndQuestion.substring(0, splitIndex).trim();
        questionText = contentAndQuestion.substring(splitIndex).trim();
    } else {
        // Fallback: Tách bằng 2 dòng trống
        const parts = contentAndQuestion.split(/\n\s*\n/);
        if (parts.length >= 2) {
            questionText = parts.pop()?.trim() || '';
            rawPassage = parts.join('\n\n').trim();
        } else {
            // Nếu không tách được thì coi như toàn bộ là câu hỏi (hoặc passage tùy ngữ cảnh)
            questionText = contentAndQuestion;
        }
    }

    return {
        module: modIndex + 1,
        index: qIndex + 1,
        blocks: parsePassageToBlocks(rawPassage),
        questionText: questionText,
        choices: Array.from(choices),
        correctAnswer: correctAnswer,
        explanation: explanation
    };
};

// --- 4. EXPORT MAIN FUNCTION ---

export const parseSATInput = (fullText: string): SATQuestion[] => {
  if (!fullText) return [];
  const modulesRaw = fullText.split(/={3,}\s*MODULE\s+\d+\s*={3,}/i).filter(Boolean);
  const validModules = modulesRaw.length > 0 ? modulesRaw : [fullText];
  const result: SATQuestion[] = [];
  let globalIndex = 0;

  validModules.forEach((modText, modIndex) => {
    let questionsRaw = modText.split(/(?=\nQUESTION\s+\d+)/i).map(q => q.trim()).filter(Boolean);
    // Support input không có chữ QUESTION X
    if (questionsRaw.length === 1 && !questionsRaw[0].match(/QUESTION\s+\d+/i)) {
        questionsRaw = modText.split(/\n\s*\n\s*\n/).map(q => q.trim()).filter(Boolean);
    }
    
    questionsRaw.forEach((qRaw) => {
        globalIndex++;
        result.push(parseSingleQuestion(qRaw, modIndex, globalIndex));
    });
  });
  return result
};