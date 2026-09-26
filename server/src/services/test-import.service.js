const pdfExtract = require('pdf-extraction');
const mammoth = require('mammoth');
const ApiError = require('../utils/ApiError');
const { findDomain, findSkill } = require('../utils/question-taxonomy');
const { firstMathContentError, isValidSprAnswer } = require('../utils/math-content-validation');

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_SIZE = 1536 * 1024;

const normalizeText = (value) => String(value || '')
  .replace(/\r\n?/g, '\n')
  .replace(/\u00a0/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const unwrapParagraph = (paragraph) => paragraph
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .reduce((result, line) => `${result}${result && !result.endsWith('-') ? ' ' : ''}${line}`, '');

const normalizeProse = (value) => normalizeText(value)
  .split(/\n\s*\n/)
  .map(unwrapParagraph)
  .filter(Boolean)
  .reduce((paragraphs, paragraph) => {
    const previous = paragraphs.at(-1);
    const previousSentenceIsOpen = previous && !/[.!?]["'’”\)\]]*$/.test(previous);
    const continuesWithLowercase = /^[^A-Za-z]*[a-z]/.test(paragraph);

    if (previousSentenceIsOpen && continuesWithLowercase) {
      paragraphs[paragraphs.length - 1] = `${previous}${previous.endsWith('-') ? '' : ' '}${paragraph}`;
    } else {
      paragraphs.push(paragraph);
    }
    return paragraphs;
  }, [])
  .join('\n\n');

const issue = (severity, code, message) => ({ severity, code, message });

const parseBlockMetadata = (content) => {
  const lines = content.split('\n');
  if (!/^\s*@meta\s+/i.test(lines[0] || '')) return { metadata: {}, content, issues: [] };
  try {
    const metadata = JSON.parse(lines[0].replace(/^\s*@meta\s+/i, ''));
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw new TypeError();
    return { metadata, content: lines.slice(1).join('\n').trim(), issues: [] };
  } catch {
    return {
      metadata: {},
      content: lines.slice(1).join('\n').trim(),
      issues: [issue('error', 'INVALID_BLOCK_METADATA', 'A block has invalid @meta JSON.')],
    };
  }
};

const stringMetadata = (metadata, key) => typeof metadata?.[key] === 'string' && metadata[key].trim()
  ? metadata[key].trim()
  : undefined;

const splitUsingMarkers = (text, expression) => {
  const matches = [...text.matchAll(expression)];
  if (matches.length === 0) return [];
  return matches.map((match, index) => ({
    marker: match,
    text: text.slice(match.index + match[0].length, matches[index + 1]?.index || text.length).trim(),
  }));
};

const parseBlocks = (rawPassage) => {
  const text = normalizeText(rawPassage);
  if (!text) return { blocks: [], issues: [] };

  const parts = text.split(/(?=^\[(?:TEXT|TABLE|POEM|NOTE|IMG)\]\s*$)/gim);
  const blocks = [];
  const issues = [];

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;
    const tagged = part.match(/^\[(TEXT|TABLE|POEM|NOTE|IMG)\]\s*\n?([\s\S]*)$/i);
    const tag = tagged?.[1]?.toUpperCase();
    const parsedMetadata = parseBlockMetadata((tagged?.[2] ?? part).trim());
    const content = parsedMetadata.content;
    const metadata = parsedMetadata.metadata;
    issues.push(...parsedMetadata.issues);

    if (tag === 'TABLE') {
      const rows = content.split('\n').filter(Boolean).map(line => line.split('\t').map(cell => cell.trim()));
      const block = {
        type: 'table',
        ...(stringMetadata(metadata, 'title') ? { title: stringMetadata(metadata, 'title') } : {}),
        headers: rows[0] || [],
        rows: rows.slice(1),
        ...(stringMetadata(metadata, 'note') ? { note: stringMetadata(metadata, 'note') } : {}),
      };
      blocks.push(block);
      if (block.headers.length === 0) issues.push(issue('error', 'EMPTY_TABLE', 'A table is missing its header row.'));
      if (block.rows.some(row => row.length !== block.headers.length)) {
        issues.push(issue('error', 'INVALID_TABLE_SHAPE', 'Every table row must have the same number of tab-separated cells as the header.'));
      }
    } else if (tag === 'POEM') {
      blocks.push({
        type: 'poem',
        ...(stringMetadata(metadata, 'title') ? { title: stringMetadata(metadata, 'title') } : {}),
        lines: content.split('\n').map(line => line.trim()).filter(Boolean),
        ...(stringMetadata(metadata, 'author') ? { author: stringMetadata(metadata, 'author') } : {}),
      });
    } else if (tag === 'NOTE') {
      blocks.push({ type: 'note', lines: content.split('\n').map(line => line.replace(/^[-*•]\s*/, '').trim()).filter(Boolean) });
    } else if (tag === 'IMG') {
      const [source = ''] = content.split('\n').map(line => line.trim()).filter(Boolean);
      const managed = source.match(/^asset:([0-9a-f-]{36})$/i);
      blocks.push({
        type: 'image',
        ...(managed ? { assetId: managed[1] } : { src: source }),
        ...(stringMetadata(metadata, 'alt') ? { alt: stringMetadata(metadata, 'alt') } : {}),
        ...(stringMetadata(metadata, 'caption') ? { caption: stringMetadata(metadata, 'caption') } : {}),
      });
    } else if (content) {
      blocks.push({ type: 'text', content: normalizeProse(content) });
    }
  }

  return { blocks, issues };
};

const splitPassageAndQuestion = (content) => {
  const paragraphs = normalizeText(content).split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  if (paragraphs.length <= 1) return { blocks: [], questionText: normalizeProse(paragraphs[0]), issues: [] };
  const questionText = normalizeProse(paragraphs.pop());
  const parsed = parseBlocks(paragraphs.join('\n\n'));
  return { blocks: parsed.blocks, questionText, issues: parsed.issues };
};

const extractLineField = (text, field) => {
  const expression = new RegExp(`^\\s*${field}\\s*:\\s*(.+?)\\s*$`, 'im');
  const match = text.match(expression);
  if (!match) return { value: '', text };
  return { value: match[1].trim(), text: text.replace(expression, '').trim() };
};

const extractTailField = (text, field) => {
  const expression = new RegExp(`(?:^|\\n)\\s*${field}\\s*:\\s*([\\s\\S]*)$`, 'i');
  const match = text.match(expression);
  if (!match || match.index === undefined) return { value: '', text };
  return { value: match[1].trim(), text: text.slice(0, match.index).trim() };
};

const parseChoices = (text) => {
  const lines = text.split('\n');
  const choices = [];
  const remaining = [];
  let current = null;

  for (const rawLine of lines) {
    const match = rawLine.match(/^\s*\(?([A-D])\)?[.):]\s*(.*)$/i);
    if (match) {
      current = { id: match[1].toUpperCase(), text: match[2].trim() };
      choices.push(current);
    } else if (current) {
      current.text = `${current.text}${current.text ? '\n' : ''}${rawLine.trim()}`.trim();
    } else {
      remaining.push(rawLine);
    }
  }

  return {
    choices: choices
      .map(choice => ({ ...choice, text: normalizeProse(choice.text) }))
      .filter(choice => choice.text),
    content: remaining.join('\n').trim(),
  };
};

const parseQuestion = ({ text, moduleOrder, questionOrder, moduleIndex, questionIndex, subject }) => {
  let workingText = normalizeText(text);
  const issues = [];
  const explicitMarkers = [...workingText.matchAll(/^[ \t]*\[QUESTION\][ \t]*$/gim)];
  if (explicitMarkers.length > 1) {
    issues.push(issue('error', 'MULTIPLE_QUESTION_MARKERS', 'Use [QUESTION] once per question.'));
  }

  const domain = extractLineField(workingText, 'Domain');
  workingText = domain.text;
  const skill = extractLineField(workingText, 'Skill');
  workingText = skill.text;

  let passage = '';
  if (explicitMarkers.length) {
    const marker = workingText.match(/^[ \t]*\[QUESTION\][ \t]*$/im);
    passage = workingText.slice(0, marker.index).trim();
    workingText = workingText.slice(marker.index + marker[0].length).trim();
  }

  const explanation = extractTailField(workingText, 'Explanation');
  workingText = explanation.text;
  const answer = extractLineField(workingText, 'Answer');
  workingText = answer.text;

  const parsedChoices = parseChoices(workingText);
  const parsedPassage = explicitMarkers.length ? parseBlocks(passage) : null;
  const content = explicitMarkers.length
    ? { blocks: parsedPassage.blocks, questionText: normalizeProse(parsedChoices.content), issues: parsedPassage.issues }
    : splitPassageAndQuestion(parsedChoices.content);
  const type = parsedChoices.choices.length ? 'MCQ' : 'SPR';
  const domainMatch = findDomain(domain.value, subject);
  const skillMatch = domainMatch && findSkill(skill.value, domainMatch.code);
  const correctAnswer = answer.value.toUpperCase();

  if (!content.questionText) issues.push(issue('error', 'MISSING_QUESTION_TEXT', 'Question text is missing.'));
  if (!correctAnswer) issues.push(issue('error', 'MISSING_ANSWER', 'Correct answer is missing.'));
  if (!domainMatch) issues.push(issue('error', 'MISSING_DOMAIN', domain.value ? 'The selected content domain is not valid for this subject.' : 'Choose a content domain.'));
  if (!skillMatch) issues.push(issue('error', 'MISSING_SKILL', skill.value ? 'The selected skill does not belong to the content domain.' : 'Choose a skill.'));
  issues.push(...content.issues);
  if (type === 'MCQ' && parsedChoices.choices.map(choice => choice.id).join('') !== 'ABCD') {
    issues.push(issue('error', 'INVALID_CHOICES', 'Multiple-choice questions must contain exactly one choice each for A, B, C, and D in order.'));
  }
  if (subject === 'RW' && type === 'SPR') {
    issues.push(issue('error', 'RW_REQUIRES_CHOICES', 'Reading & Writing questions must contain choices A, B, C, and D.'));
  }
  if (type === 'MCQ' && correctAnswer && !parsedChoices.choices.some(choice => choice.id === correctAnswer)) {
    issues.push(issue('error', 'ANSWER_NOT_IN_CHOICES', 'Correct answer does not match any answer choice.'));
  }
  if (content.blocks.some(block => block.type === 'image' && !block.src && !block.assetId)) {
    issues.push(issue('error', 'IMAGE_REQUIRED', 'Add the missing image before publishing this test.'));
  }
  if (content.blocks.some(block => block.type === 'image' && block.src && !block.assetId)) {
    issues.push(issue('error', 'MANAGED_IMAGE_REQUIRED', 'Upload this image to the platform before publishing instead of using an external URL.'));
  }
  const unknownTags = passage.match(/^[ \t]*\[([A-Z][A-Z0-9_-]*)\][ \t]*$/gm) || [];
  if (unknownTags.some(tag => !/^\[(?:TEXT|TABLE|POEM|NOTE|IMG)\]$/.test(tag.trim()))) {
    issues.push(issue('warning', 'UNKNOWN_CONTENT_TAG', 'A content tag is not recognized. Check its spelling.'));
  }
  const readingFields = [content.questionText, ...parsedChoices.choices.map(choice => choice.text), explanation.value,
    ...content.blocks.filter(block => block.type === 'text').map(block => block.content)];
  if (subject === 'RW' && readingFields.some(value => String(value || '').split('\n').some(line =>
    ([...line.matchAll(/(?<!\\)==/g)].length % 2) !== 0,
  ))) {
    issues.push(issue('warning', 'UNMATCHED_UNDERLINE', 'An underline marker == is missing its closing pair.'));
  }

  const parsedQuestion = {
    questionText: content.questionText,
    choices: parsedChoices.choices,
    explanation: normalizeProse(explanation.value),
    blocks: content.blocks,
  };
  if (subject === 'MATH') {
    const latexError = firstMathContentError(parsedQuestion);
    if (latexError) issues.push(issue('error', 'INVALID_LATEX', `Math ${latexError}`));
    if (type === 'SPR' && correctAnswer && !isValidSprAnswer(correctAnswer)) {
      issues.push(issue('error', 'INVALID_SPR_ANSWER', 'A Math student-produced answer must be a valid decimal or fraction.'));
    }
  }

  return {
    clientId: `m${moduleIndex + 1}-q${questionIndex + 1}-${moduleOrder}-${questionOrder}`,
    module: moduleOrder,
    order: questionOrder,
    type,
    blocks: parsedQuestion.blocks,
    questionText: parsedQuestion.questionText,
    choices: parsedChoices.choices,
    correctAnswer,
    explanation: parsedQuestion.explanation,
    domainCode: domainMatch?.code || '',
    skillCode: skillMatch?.code || '',
    issues,
  };
};

const parseText = ({ text, subject, expectedModuleCount }) => {
  const normalized = normalizeText(text);
  if (!normalized) throw new ApiError(422, { error: 'This document does not contain readable text.' });

  const issues = [];
  const moduleMarkers = splitUsingMarkers(normalized, /^\s*={3,}\s*MODULE\s+(\d+)\s*={3,}\s*$/gim);
  if (moduleMarkers.length > 0) {
    const firstModuleMarker = normalized.match(/^\s*={3,}\s*MODULE\s+\d+\s*={3,}\s*$/im);
    if (firstModuleMarker?.index && normalized.slice(0, firstModuleMarker.index).trim()) {
      issues.push(issue('error', 'IGNORED_DOCUMENT_PREAMBLE', 'Remove content before the first module marker; it is not imported.'));
    }
  }
  const rawModules = moduleMarkers.length > 0
    ? moduleMarkers.map((item, index) => ({ order: Number(item.marker[1]) || index + 1, text: item.text }))
    : [{ order: 1, text: normalized }];

  const modules = rawModules.map((rawModule, index) => {
    const firstQuestionMarker = rawModule.text.match(/^\s*QUESTION\s+\d+\s*$/im);
    if (firstQuestionMarker?.index && rawModule.text.slice(0, firstQuestionMarker.index).trim()) {
      issues.push(issue('error', 'IGNORED_MODULE_PREAMBLE', `Remove content before Question 1 in Module ${rawModule.order}; it is not imported.`));
    }
    const rawQuestions = splitUsingMarkers(rawModule.text, /^\s*QUESTION\s+(\d+)\s*$/gim);
    const questions = rawQuestions.map((rawQuestion, questionIndex) => parseQuestion({
      text: rawQuestion.text,
      moduleOrder: rawModule.order,
      questionOrder: Number(rawQuestion.marker[1]) || questionIndex + 1,
      moduleIndex: index,
      questionIndex,
      subject,
    }));
    return { order: rawModule.order || index + 1, name: `Module ${rawModule.order || index + 1}`, questions };
  });

  const moduleOrders = rawModules.map(module => module.order);
  if (moduleOrders.some((order, index) => order !== index + 1)) {
    issues.push(issue('error', 'INVALID_MODULE_ORDER', 'Module numbers must be unique and sequential, starting at 1.'));
  }
  for (const module of modules) {
    if (module.questions.some((question, index) => question.order !== index + 1)) {
      issues.push(issue('error', 'INVALID_QUESTION_ORDER', `Question numbers in Module ${module.order} must be unique and sequential, starting at 1.`));
    }
  }
  const questionCount = modules.reduce((total, module) => total + module.questions.length, 0);
  if (questionCount === 0) issues.push(issue('error', 'NO_QUESTION_MARKERS', 'No questions were found. Start each question with “QUESTION 1”.'));
  if (expectedModuleCount && modules.length !== Number(expectedModuleCount)) {
    issues.push(issue('warning', 'MODULE_COUNT_MISMATCH', `The document contains ${modules.length} module(s), but setup expects ${expectedModuleCount}.`));
  }

  const allQuestions = modules.flatMap(module => module.questions);
  const allIssues = [...issues, ...allQuestions.flatMap(question => question.issues)];
  return {
    modules,
    summary: {
      questionCount,
      classifiedCount: allQuestions.filter(question => question.domainCode && question.skillCode).length,
      errorCount: allIssues.filter(item => item.severity === 'error').length,
      warningCount: allIssues.filter(item => item.severity === 'warning').length,
    },
    issues,
  };
};

const extractText = async (file) => {
  const originalName = String(file.originalname || '').toLowerCase();
  if (file.size > MAX_FILE_SIZE) throw new ApiError(413, { error: 'Files must be 15 MB or smaller.' });

  if (file.mimetype === 'application/pdf' || originalName.endsWith('.pdf')) {
    const result = await pdfExtract(file.buffer);
    return result.text;
  }
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || originalName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }
  if (file.mimetype === 'text/plain' || originalName.endsWith('.txt')) {
    return file.buffer.toString('utf8');
  }
  if (originalName.endsWith('.doc')) {
    throw new ApiError(422, { error: 'Legacy .doc files are not supported. Save the document as .docx and upload it again.' });
  }
  throw new ApiError(415, { error: 'Upload a PDF, DOCX, or TXT file.' });
};

const assertExtractedTextSize = (text) => {
  if (Buffer.byteLength(String(text || ''), 'utf8') > MAX_EXTRACTED_TEXT_SIZE) {
    throw new ApiError(413, { error: 'Extracted test text must be 1.5 MB or smaller.' });
  }
  return text;
};

exports.previewImport = async ({ file, subject, moduleCount }) => {
  if (!file) throw new ApiError(400, { error: 'Choose a PDF, DOCX, or TXT file.' });
  if (!['RW', 'MATH'].includes(subject)) throw new ApiError(400, { error: 'Choose Reading & Writing or Math before importing.' });

  const text = assertExtractedTextSize(await extractText(file));
  const preview = parseText({ text, subject, expectedModuleCount: moduleCount });
  return { fileName: file.originalname, ...preview };
};

exports.extractImportFile = async ({ file }) => {
  if (!file) throw new ApiError(400, { error: 'Choose a PDF, DOCX, or TXT file.' });
  return {
    fileName: file.originalname,
    text: assertExtractedTextSize(await extractText(file)),
  };
};

exports.previewText = ({ text, subject, moduleCount }) => {
  if (!['RW', 'MATH'].includes(subject)) throw new ApiError(400, { error: 'Choose Reading & Writing or Math before importing.' });
  return parseText({ text: assertExtractedTextSize(text), subject, expectedModuleCount: moduleCount });
};
