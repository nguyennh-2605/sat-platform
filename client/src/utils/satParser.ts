import { type ContentBlock } from "../types/quiz";

export interface SATQuestion {
  id?: string;
  module: number;
  index: number;
  subject: 'RW' | 'MATH';
  type: 'MCQ' | 'SPR';
  blocks: ContentBlock[];
  questionText: string;
  correctAnswer: string;
  choices: { id: string; text: string }[];
  explanation?: string;
}

// BƯỚC MỚI: Hàm xử lý gạch chân bằng ==...==
const applyUnderline = (text: string): string => {
  // Regex tìm mọi thứ nằm giữa hai cặp dấu == và bọc thẻ <u>
  // Dùng [\s\S]*? để cho phép gạch chân nội dung có chứa cả dấu xuống dòng
  return text.replace(/==([\s\S]*?)==/g, '<u>$1</u>');
};

const parseTableData = (rawText: string) => {
  const lines = rawText.trim().split('\n').filter(r => r.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split('\t').map(h => h.trim());
  const rows = lines.slice(1).map(line => line.split('\t').map(c => c.trim()));
  return { headers, rows };
};

const smartFormatText = (rawText: string): string => {
  if (rawText.includes('$') || rawText.includes('\\')) {
    // Nếu đã có sẵn latex thì bỏ qua format gộp dòng, nhưng VẪN áp dụng gạch chân
    return applyUnderline(rawText); 
  }
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
  // Áp dụng gạch chân cho RW
  return applyUnderline(result);
};

// Hàm định dạng Toán Học (Đã nâng cấp Mũ, Phân số & Auto-LaTeX)
const formatSATMath = (rawText: string): string => {
  if (!rawText) return "";
  let text = rawText;

  // 🛠 BÍ QUYẾT: Đưa Bước 1, 2, 3 vào một hàm chuẩn hóa nội bộ.
  // Hàm này CHỈ định dạng lại LaTeX (đổi dấu /, ^), KHÔNG bọc $
  const normalizeMathSyntax = (mathStr: string): string => {
    let m = mathStr;
    // 1. Xử lý Số mũ
    m = m.replace(/(\w+|\([^)]+\))\^\(([^)]+)\)/g, "$1^{$2}"); 
    m = m.replace(/(\([^)]+\))\^(\w+)/g, "$1^{$2}");        
    m = m.replace(/\b([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)\b/g, "$1^{$2}"); 

    // 2. Xử lý Phân số
    m = m.replace(/\(([^)]+)\)\s*\/\s*\(([^)]+)\)/g, "\\frac{$1}{$2}"); 
    m = m.replace(/\(([^)]+)\)\s*\/\s*(\w+)/g, "\\frac{$1}{$2}");       
    m = m.replace(/(\w+)\s*\/\s*\(([^)]+)\)/g, "\\frac{$1}{$2}");       
    m = m.replace(/(?<!http:|https:|\]\()(\b[a-zA-Z0-9]+)\s*\/\s*([a-zA-Z0-9]+)\b/g, "\\frac{$1}{$2}");

    // 3. Các ký hiệu khác
    m = m.replace(/sqrt\((.*?)\)/gi, "\\sqrt{$1}");
    m = m.replace(/\b(tri|tg)\s+([A-Z]{3})\b/gi, "\\triangle $2");
    m = m.replace(/(\/_|goc\s+)([A-Z]{3})/gi, "\\angle $2");
    m = m.replace(/(\d+)(deg|o)\b/gi, "$1^{\\circ}");
    m = m.replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/!=/g, '≠');
    m = m.replace(/(\d+)pi\b/gi, "$1\\pi");
    m = m.replace(/(?<!\\)\bpi\b/gi, "\\pi");

    return m;
  };

  // 🛠 HÀM WRAP MỚI: Chuẩn hóa syntax XONG mới bọc $
  const wrap = (latex: string) => {
    // Gọi hàm chuẩn hóa trước, sau đó bọc $ một lần duy nhất
    return `$${normalizeMathSyntax(latex)}$`;
  };

  // HÀM BẢO VỆ CHUỖI (Giữ nguyên của bạn - rất tốt)
  const safeReplace = (
    currentText: string, 
    regex: RegExp, 
    replacer: (match: string, ...args: any[]) => string
  ): string => {
    const latexBlockRegex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;
    
    return currentText.split(latexBlockRegex).map((part: string) => {
      if (!part) return part;
      if (
        (part.startsWith('$$') && part.endsWith('$$')) ||
        (part.startsWith('$') && part.endsWith('$')) ||
        (part.startsWith('\\[') && part.endsWith('\\]')) ||
        (part.startsWith('\\(') && part.endsWith('\\)'))
      ) {
        return part;
      }
      return part.replace(regex, replacer);
    }).join('');
  };

  let processedText = text;

  // BƯỚC 4: AUTO-LATEX THEO THỨ TỰ ƯU TIÊN
  // 4.1. Bắt đa thức nhân nhau: (x-2)(x+5) = 0
  const polyRegex = /((?:\([a-zA-Z0-9+\-*/^.,\s]+\)\s*){2,})(?:([=<>]\s*[-+]?\d+))?/g;
  processedText = safeReplace(processedText, polyRegex, (match: string) => wrap(match.trim()));

  // 4.2. Bắt hàm mũ (Exponential): y = 80(1.40)^x
  const expRegex = /(?:^|\s)((?:[a-zA-Z]{1,2}(?:\([a-zA-Z]\))?\s*=\s*)?-?\d+(?:\.\d+)?\s*(?:\*|\\times)?\s*(?:\(\s*-?\d+(?:\.\d+)?\s*\)|-?\d+(?:\.\d+)?)\s*\^\s*(?:[a-zA-Z0-9{}]+|\([^)]+\)))(?=$|\s|[.,?!])/g;
  processedText = safeReplace(processedText, expRegex, (match: string, p1: string) => match.replace(p1, wrap(p1.trim())));

  const generalMathEqRegex = /(?:^|\s)((?:(?:\d*[a-zA-Z]?)\([^)]+\)|[a-zA-Z0-9]+)(?:\s*[+\-*/=<>^]\s*(?:(?:\d*[a-zA-Z]?)\([^)]+\)|[a-zA-Z0-9]+))+)(?=$|\s|[.,?])/g;
  processedText = safeReplace(processedText, generalMathEqRegex, (match: string, p1: string) => match.replace(p1, wrap(p1.trim())));

  // 4.5. Bắt hàm số: f(x), g(x)...
  const funcRegex = /\b([a-zA-Z])\(([a-zA-Z0-9])\)/g;
  processedText = safeReplace(processedText, funcRegex, (_, func: string, vr: string) => wrap(`${func}(${vr})`));

  // 4.6. Vét các phân số hoặc số mũ lẻ chưa được bọc (THÊM MỚI ĐỂ TRÁNH SÓT)
  // Vì Bước 1, 2 bị ẩn vào trong wrap, ta cần lệnh này để bắt các cụm "x/7" hay "x^2" đứng một mình
  const fracExpRegex = /(?<!['a-zA-Z])\b([a-zA-Z0-9]+)\s*[\/^]\s*([a-zA-Z0-9{}]+|\([^)]+\))(?!['a-zA-Z])/g;
  processedText = safeReplace(processedText, fracExpRegex, (match: string) => wrap(match.trim()));

  // 4.7. Auto-LaTeX cho biến số đơn lẻ (Lưới vét cuối cùng)
  const singleVarRegex = /(?<!['a-zA-Z])\b(\d+[a-zA-Z]|[a-zA-Z]\d+|[b-hj-zB-HJ-Z])\b(?!['a-zA-Z])/g;
  processedText = safeReplace(processedText, singleVarRegex, (match: string) => wrap(match));

  // Bước 5: Áp dụng gạch chân cuối cùng (nếu có ==...==)
  return applyUnderline(processedText);
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

    const rwKeywords = [
        "The student wants to", "Which choice", "Which finding", 
        "The main idea", "Based on the text", "According to the text", 
        "Which quotation", "Which conclusion"
    ];
    const isRW = new RegExp(`(?:^|\\n)(${rwKeywords.join('|')})`, 'i').test(contentAndQuestion);
    const subject: 'RW' | 'MATH' = isRW ? 'RW' : 'MATH';

    const choices: { id: string; text: string }[] = [];
    if (optionsRaw) {
        const choiceRegex = /(?:\n|^)\s*(\(?[A-D]\)?)(?:[\.\:\)]+)\s+([\s\S]*?)(?=(?:\n\s*\(?[A-D]\)?(?:[\.\:\)]+)\s+)|$)/gi;
        let cMatch;
        while ((cMatch = choiceRegex.exec(optionsRaw)) !== null) {
            let choiceText = cMatch[2].trim();
            if (subject === 'MATH') choiceText = formatSATMath(choiceText);
            choices.push({
                id: cMatch[1].replace(/[\(\)]/g, '').toUpperCase(),
                text: choiceText
            });
        }
    }
    
    const type: 'MCQ' | 'SPR' = choices.length > 0 ? 'MCQ' : 'SPR';

    let rawPassage = '';
    let questionText = '';
    const qSplitRegex = new RegExp(`(?:^|\\n)(${rwKeywords.join('|')})`, 'i');
    const qMatch = contentAndQuestion.match(qSplitRegex);

    if (qMatch && qMatch.index !== undefined) {
        const splitIndex = qMatch.index + (qMatch[0].startsWith('\n') ? 1 : 0);
        rawPassage = contentAndQuestion.substring(0, splitIndex).trim();
        questionText = contentAndQuestion.substring(splitIndex).trim();
    } else {
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

    let finalBlocks = parsePassageToBlocks(rawPassage);

    const applyFormatToBlock = (b: ContentBlock, formatFn: (txt: string) => string): ContentBlock => {
        if (b.type === 'text') return { ...b, content: formatFn(b.content) };
        if (b.type === 'poem' || b.type === 'note') return { ...b, lines: b.lines.map(l => formatFn(l)) };
        if (b.type === 'table') {
            return {
                ...b,
                headers: b.headers.map(h => formatFn(h)),
                rows: b.rows.map(row => row.map(cell => formatFn(cell)))
            };
        }
        return b;
    };

    if (subject === 'RW') {
        questionText = smartFormatText(questionText);
        finalBlocks = finalBlocks.map(b => applyFormatToBlock(b, smartFormatText));
    } else {
        questionText = formatSATMath(questionText);
        finalBlocks = finalBlocks.map(b => applyFormatToBlock(b, formatSATMath));
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