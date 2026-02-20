import { type ContentBlock } from "../types/quiz";

// --- 1. INTERFACE ---
export interface SATQuestion {
  id?: string;
  module: number;
  index: number;
  subject: 'RW' | 'MATH'; // Thêm để Frontend dễ phân loại
  type: 'MCQ' | 'SPR';    // Trắc nghiệm hay Điền đáp án
  blocks: ContentBlock[];
  questionText: string;
  correctAnswer: string;
  choices: { id: string; text: string }[];
  explanation?: string;
}

// --- 2. CÁC HÀM HELPER FORMAT ---

const parseTableData = (rawText: string) => {
  const lines = rawText.trim().split('\n').filter(r => r.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split('\t').map(h => h.trim());
  const rows = lines.slice(1).map(line => line.split('\t').map(c => c.trim()));
  return { headers, rows };
};

const smartFormatText = (rawText: string): string => {
  if (rawText.includes('$') || rawText.includes('\\')) return rawText; // Bỏ qua nếu đã có LaTeX
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

// Hàm định dạng Toán Học (Đã nâng cấp Mũ & Phân số phức tạp)
const formatSATMath = (rawText: string): string => {
  if (!rawText) return "";
  let text = rawText;
  const wrap = (latex: string) => `$${latex}$`; 

  // Bước 1: Xử lý Số mũ (Phải chạy trước phân số)
  text = text.replace(/(\w+|\([^)]+\))\^\(([^)]+)\)/g, (_, base, exp) => wrap(`${base}^{${exp}}`)); // Vd: x^(1/2)
  text = text.replace(/(\([^)]+\))\^(\w+)/g, (_, base, exp) => wrap(`${base}^{${exp}}`));         // Vd: (x+1)^2
  text = text.replace(/\b([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)\b/g, (_, base, exp) => wrap(`${base}^{${exp}}`)); // Vd: x^2

  // Bước 2: Xử lý Phân số
  text = text.replace(/\(([^)]+)\)\s*\/\s*\(([^)]+)\)/g, (_, n, d) => wrap(`\\frac{${n}}{${d}}`)); // Vd: (x+1)/(x-2)
  text = text.replace(/\(([^)]+)\)\s*\/\s*(\w+)/g, (_, n, d) => wrap(`\\frac{${n}}{${d}}`));       // Vd: (x+1)/2
  text = text.replace(/(\w+)\s*\/\s*\(([^)]+)\)/g, (_, n, d) => wrap(`\\frac{${n}}{${d}}`));       // Vd: 1/(x+1)
  
  // Phân số đơn giản a/b (Tránh URL của markdown ảnh/link)
  text = text.replace(/(?<!http:|https:|\]\()(\b[a-zA-Z0-9]+)\s*\/\s*([a-zA-Z0-9]+)\b/g, (_, n, d) => wrap(`\\frac{${n}}{${d}}`));

  // Bước 3: Các ký hiệu khác
  text = text.replace(/sqrt\((.*?)\)/gi, (_, inside) => wrap(`\\sqrt{${inside}}`));
  text = text.replace(/\b(tri|tg)\s+([A-Z]{3})\b/gi, (_, _t, ABC) => wrap(`\\triangle ${ABC}`));
  text = text.replace(/(\/_|goc\s+)([A-Z]{3})/gi, (_, _t, ABC) => wrap(`\\angle ${ABC}`));
  text = text.replace(/(\d+)(deg|o)\b/gi, (_, num) => wrap(`${num}^{\\circ}`));
  text = text.replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/!=/g, '≠');
  text = text.replace(/(\d+)pi\b/gi, (_, num) => wrap(`${num}\\pi`));
  // 2. Xử lý chữ pi đứng độc lập (Chặn bắt trùng nếu đã có dấu \ ở trước)
  text = text.replace(/(?<!\\)\bpi\b/gi, () => wrap(`\\pi`));
  return text;
};

// --- 3. HÀM PARSER BLOCKS (SCAN MODE) ---
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

    if (currentType === 'TABLE') {
      const tableData = parseTableData(cleanPart);
      blocks.push({ type: 'table', headers: tableData.headers, rows: tableData.rows });
    } 
    else if (currentType === 'POEM') {
      blocks.push({ type: 'poem', lines: cleanPart.split('\n').map(l => l.trim()).filter(Boolean) });
    } 
    else if (currentType === 'NOTE') {
      const lines = cleanPart.split('\n')
        .map(line => line.trim().replace(/^[-*•]\s*/, ''))
        .filter(Boolean);
      if (lines.length > 0) blocks.push({ type: 'note', lines: lines }); 
    }
    else if (currentType === 'IMG') {
      blocks.push({ type: 'image', src: cleanPart }); 
    } 
    else {
      const imgRegex = /!\[([\s\S]*?)\]\s*\(([\s\S]*?)\)/g;
      let lastIndex = 0;
      let match;
      while ((match = imgRegex.exec(cleanPart)) !== null) {
        const textBefore = cleanPart.slice(lastIndex, match.index);
        if (textBefore.trim()) blocks.push({ type: 'text', content: textBefore.trim() });
        blocks.push({ type: 'image', src: match[2].trim() });
        lastIndex = imgRegex.lastIndex;
      }
      const textAfter = cleanPart.slice(lastIndex);
      if (textAfter.trim()) blocks.push({ type: 'text', content: textAfter.trim() });
    }
  }
  
  if (rawPassage.trim().match(/\[IMG\]$/i)) blocks.push({ type: 'image', src: '' });
  
  return blocks;
};

// --- 4. HÀM PARSER CỐT LÕI ---
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
    const ansMatch = textToProcess.match(/Answer:\s*([A-D0-9\.\/-]+)/i);
    if (ansMatch) {
        correctAnswer = ansMatch[1].toUpperCase();
        textToProcess = textToProcess.replace(/Answer:\s*[A-D0-9\.\/-].*/i, '').trim();
    }
    textToProcess = textToProcess.replace(/^QUESTION\s+\d+/i, '').trim();

    // B. TÁCH OPTIONS
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

    // Xác định Từ khóa Văn học để phân loại Môn học
    const rwKeywords = [
        "The student wants to", "Which choice", "Which finding", 
        "The main idea", "Based on the text", "According to the text", 
        "Which quotation", "Which conclusion"
    ];
    const isRW = new RegExp(`(?:^|\\n)(${rwKeywords.join('|')})`, 'i').test(contentAndQuestion);
    const subject: 'RW' | 'MATH' = isRW ? 'RW' : 'MATH';

    // C. PARSE CÁC LỰA CHỌN
    const choices: { id: string; text: string }[] = [];
    if (optionsRaw) {
        const choiceRegex = /(?:\n|^)\s*(\(?[A-D]\)?)(?:[\.\:\)]+)\s+([\s\S]*?)(?=(?:\n\s*\(?[A-D]\)?(?:[\.\:\)]+)\s+)|$)/gi;
        let cMatch;
        while ((cMatch = choiceRegex.exec(optionsRaw)) !== null) {
            let choiceText = cMatch[2].trim();
            // Nếu là Toán, format toán cho đáp án
            if (subject === 'MATH') choiceText = formatSATMath(choiceText);
            choices.push({
                id: cMatch[1].replace(/[\(\)]/g, '').toUpperCase(),
                text: choiceText
            });
        }
    }
    
    const type: 'MCQ' | 'SPR' = choices.length > 0 ? 'MCQ' : 'SPR';

    // D. TÁCH PASSAGE VÀ QUESTION TEXT (Giữ nguyên logic của bạn)
    let rawPassage = '';
    let questionText = '';

    const qSplitRegex = new RegExp(`(?:^|\\n)(${rwKeywords.join('|')})`, 'i');
    const qMatch = contentAndQuestion.match(qSplitRegex);

    if (qMatch && qMatch.index !== undefined) {
        // Trường hợp 1: Có từ khóa (Thường là RW)
        const splitIndex = qMatch.index + (qMatch[0].startsWith('\n') ? 1 : 0);
        rawPassage = contentAndQuestion.substring(0, splitIndex).trim();
        questionText = contentAndQuestion.substring(splitIndex).trim();
    } else {
        // Trường hợp 2 & 3: Không có từ khóa (Thường là MATH)
        const parts = contentAndQuestion.split(/\n\s*\n/);
        
        if (parts.length >= 2) {
            questionText = parts.pop()?.trim() || '';
            rawPassage = parts.join('\n\n').trim();
        } else {
            const hasMedia = /!\[|\[TABLE\]|\[IMG\]/i.test(contentAndQuestion);
            if (hasMedia) {
                rawPassage = contentAndQuestion;
                questionText = ''; 
            } else {
                questionText = contentAndQuestion;
                rawPassage = '';
            }
        }
    }

    // E. APPLY FORMAT SAU CÙNG DỰA TRÊN MÔN HỌC
    let finalBlocks = parsePassageToBlocks(rawPassage);

    if (subject === 'RW') {
        questionText = smartFormatText(questionText);
        finalBlocks = finalBlocks.map(b => b.type === 'text' ? { ...b, content: smartFormatText(b.content) } : b);
    } else {
        // Nếu là Toán: Áp dụng formatSATMath cho Câu hỏi và các Block Text
        questionText = formatSATMath(questionText);
        finalBlocks = finalBlocks.map(b => b.type === 'text' ? { ...b, content: formatSATMath(b.content) } : b);
    }

    return {
        module: modIndex + 1,
        index: qIndex + 1,
        subject: subject,
        type: type,
        blocks: finalBlocks, 
        questionText: questionText,
        choices: choices,
        correctAnswer: correctAnswer,
        explanation: explanation
    };
};

// --- 5. HÀM MAIN ---
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
  return result;
};