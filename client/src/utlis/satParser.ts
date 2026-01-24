import { type ContentBlock } from "../types/quiz";

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

// --- 2. CÁC HÀM HELPER ---
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

// --- [QUAN TRỌNG] HÀM PARSER BẤT TỬ (SCAN MODE) ---
const parsePassageToBlocks = (rawPassage: string): ContentBlock[] => {
  if (!rawPassage) return [];

  const parts = rawPassage.split(/(\[(?:TEXT|TABLE|IMG|POEM|NOTE)\])/i);
  const blocks: ContentBlock[] = [];
  let currentType = 'TEXT'; 

  for (let part of parts) {
    let cleanPart = part.trim();
    if (!cleanPart) continue;

    const matchType = cleanPart.match(/^\[(TEXT|TABLE|IMG|POEM|NOTE)\]$/i);
    if (matchType) {
      currentType = matchType[1].toUpperCase();
      continue;
    }

    // --- XỬ LÝ CÁC LOẠI BLOCK ---

    if (currentType === 'TABLE') {
      const tableData = parseTableData(cleanPart);
      blocks.push({ type: 'table', headers: tableData.headers, rows: tableData.rows });
    } 
    else if (currentType === 'POEM') {
      blocks.push({ type: 'poem', lines: cleanPart.split('\n').map(l => l.trim()).filter(Boolean) });
    } 
    // === 3. LOGIC MỚI CHO NOTES ===
    else if (currentType === 'NOTE') {
      const lines = cleanPart
        .split('\n')
        .map(line => {
             // Trim và xóa các ký tự gạch đầu dòng có sẵn (-, *, •) để tránh trùng lặp
             return line.trim().replace(/^[-*•]\s*/, '');
        })
        .filter(Boolean); // Lọc dòng trống

      if (lines.length > 0) {
          // Lưu ý: Bạn cần chắc chắn Interface ContentBlock đã có type 'notes'
          blocks.push({ type: 'note', lines: lines }); 
      }
    }
    else if (currentType === 'IMG') {
      blocks.push({ type: 'image', src: cleanPart }); 
    } 
    else {
      // === LOGIC CŨ: TEXT & QUÉT TÌM ẢNH (SCAN MODE) ===
      const imgRegex = /!\[([\s\S]*?)\]\s*\(([\s\S]*?)\)/g;
      
      let lastIndex = 0;
      let match;

      while ((match = imgRegex.exec(cleanPart)) !== null) {
        // Lấy text trước ảnh
        const textBefore = cleanPart.slice(lastIndex, match.index);
        if (textBefore.trim()) {
          blocks.push({ type: 'text', content: smartFormatText(textBefore) });
        }
        // Lấy URL ảnh
        blocks.push({ type: 'image', src: match[2].trim() });
        lastIndex = imgRegex.lastIndex;
      }

      // Lấy text sau ảnh cuối cùng
      const textAfter = cleanPart.slice(lastIndex);
      if (textAfter.trim()) {
        blocks.push({ type: 'text', content: smartFormatText(textAfter) });
      }
    }
  }
  
  if (rawPassage.trim().match(/\[IMG\]$/i)) blocks.push({ type: 'image', src: '' });
  
  return blocks;
};

const parseSingleQuestion = (rawQText: string, modIndex: number, qIndex: number): SATQuestion => {
    let textToProcess = rawQText;
    
    // A. Tách Metadata (Answer/Explanation)
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
    textToProcess = textToProcess.replace(/^QUESTION\s+\d+/i, '').trim();

    // B. TÁCH OPTIONS (A, B, C, D)
    const splitRegex = /(?:\n|^)\s*(\(?[A]\)?(?:[\.\:\)]+)\s+.*?)(?=\n\s*\(?[B]\)?(?:[\.\:\)]+)\s+)/s;
    const match = textToProcess.match(splitRegex);
    let contentAndQuestion = textToProcess;
    let optionsRaw = '';

    if (match && match.index !== undefined) {
        contentAndQuestion = textToProcess.substring(0, match.index).trim();
        optionsRaw = textToProcess.substring(match.index).trim();
    } else {
        const lastARegex = /(?:\n|^)\s*(\(?[A]\)?(?:[\.\:\)]+)\s+.*)$/s;
        const fallbackMatch = textToProcess.match(lastARegex);
        if (fallbackMatch && fallbackMatch.index !== undefined) {
             contentAndQuestion = textToProcess.substring(0, fallbackMatch.index).trim();
             optionsRaw = textToProcess.substring(fallbackMatch.index).trim();
        }
    }

    // C. PARSE CÁC LỰA CHỌN
    const choices: { id: string; text: string }[] = [];
    if (optionsRaw) {
        const choiceRegex = /(?:\n|^)\s*(\(?[A-D]\)?)(?:[\.\:\)]+)\s+([\s\S]*?)(?=(?:\n\s*\(?[A-D]\)?(?:[\.\:\)]+)\s+)|$)/gi;
        let cMatch;
        while ((cMatch = choiceRegex.exec(optionsRaw)) !== null) {
            choices.push({
                id: cMatch[1].replace(/[\(\)]/g, '').toUpperCase(),
                text: cMatch[2].trim()
            });
        }
    }

    // D. TÁCH PASSAGE VÀ QUESTION TEXT (ĐOẠN QUAN TRỌNG NHẤT ĐÂY RỒI)
    let rawPassage = '';
    let questionText = '';

    const questionKeywords = [
        "The student wants to", "Which choice", "Which finding", 
        "The main idea", "Based on the text", "According to the text", 
        "Which quotation"
    ];
    
    const qSplitRegex = new RegExp(`(?:^|\\n)(${questionKeywords.join('|')})`, 'i');
    const qMatch = contentAndQuestion.match(qSplitRegex);

    if (qMatch && qMatch.index !== undefined) {
        // Trường hợp 1: Tìm thấy từ khóa câu hỏi rõ ràng
        const splitIndex = qMatch.index + (qMatch[0].startsWith('\n') ? 1 : 0);
        rawPassage = contentAndQuestion.substring(0, splitIndex).trim();
        questionText = contentAndQuestion.substring(splitIndex).trim();
    } else {
        // Trường hợp 2: Không thấy từ khóa -> Thử tách bằng 2 dòng trống
        const parts = contentAndQuestion.split(/\n\s*\n/);
        
        if (parts.length >= 2) {
            questionText = parts.pop()?.trim() || '';
            rawPassage = parts.join('\n\n').trim();
        } else {
            // Trường hợp 3: Không tách được gì cả (Input chỉ có mỗi 1 đoạn text/ảnh)
            
            // === LOGIC MỚI Ở ĐÂY ===
            // Kiểm tra xem nội dung có chứa Ảnh (![) hoặc Bảng ([TABLE]) không?
            const hasMedia = /!\[|\[TABLE\]|\[IMG\]/i.test(contentAndQuestion);
            
            if (hasMedia) {
                // Nếu có ảnh -> Chắc chắn nó là Passage (để được render thành Block)
                rawPassage = contentAndQuestion;
                questionText = ''; // Không có câu hỏi text
            } else {
                // Nếu chỉ là text thường -> Coi như là câu hỏi
                questionText = contentAndQuestion;
                rawPassage = '';
            }
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

export const parseSATInput = (fullText: string): SATQuestion[] => {
  if (!fullText) return [];
  const modulesRaw = fullText.split(/={3,}\s*MODULE\s+\d+\s*={3,}/i).filter(Boolean);
  const validModules = modulesRaw.length > 0 ? modulesRaw : [fullText];
  const result: SATQuestion[] = [];
  let globalIndex = 0;

  validModules.forEach((modText, modIndex) => {
    let questionsRaw = modText.split(/(?=\nQUESTION\s+\d+)/i).map(q => q.trim()).filter(Boolean);
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