const pdfExtract = require('pdf-extraction');
const mammoth = require('mammoth');
const ApiError = require('../utils/ApiError');
const { findDomain, findSkill } = require('../utils/question-taxonomy');

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const normalizeText = (value) => String(value || '')
  .replace(/\r\n?/g, '\n')
  .replace(/\u00a0/g, ' ')
  .replace(/[–—]/g, '-')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const issue = (severity, code, message) => ({ severity, code, message });

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
  if (!text) return [];

  const parts = text.split(/(?=^\[(?:TEXT|TABLE|POEM|NOTE|IMG)\]\s*$)/gim);
  const blocks = [];

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;
    const tagged = part.match(/^\[(TEXT|TABLE|POEM|NOTE|IMG)\]\s*\n?([\s\S]*)$/i);
    const tag = tagged?.[1]?.toUpperCase();
    const content = (tagged?.[2] ?? part).trim();

    if (tag === 'TABLE') {
      const rows = content.split('\n').filter(Boolean).map(line => line.split('\t').map(cell => cell.trim()));
      if (rows.length > 0) blocks.push({ type: 'table', headers: rows[0], rows: rows.slice(1) });
    } else if (tag === 'POEM') {
      blocks.push({ type: 'poem', lines: content.split('\n').map(line => line.trim()).filter(Boolean) });
    } else if (tag === 'NOTE') {
      blocks.push({ type: 'note', lines: content.split('\n').map(line => line.replace(/^[-*•]\s*/, '').trim()).filter(Boolean) });
    } else if (tag === 'IMG') {
      blocks.push({ type: 'image', src: content });
    } else if (content) {
      blocks.push({ type: 'text', content });
    }
  }

  return blocks;
};

const splitPassageAndQuestion = (content) => {
  const paragraphs = normalizeText(content).split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  if (paragraphs.length <= 1) return { blocks: [], questionText: paragraphs[0] || '' };
  const questionText = paragraphs.pop();
  return { blocks: parseBlocks(paragraphs.join('\n\n')), questionText };
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

  return { choices: choices.filter(choice => choice.text), content: remaining.join('\n').trim() };
};

const parseQuestion = ({ text, moduleOrder, questionOrder, subject }) => {
  let workingText = normalizeText(text);
  const issues = [];

  const explanation = extractTailField(workingText, 'Explanation');
  workingText = explanation.text;
  const answer = extractLineField(workingText, 'Answer');
  workingText = answer.text;
  const skill = extractLineField(workingText, 'Skill');
  workingText = skill.text;
  const domain = extractLineField(workingText, 'Domain');
  workingText = domain.text;

  const parsedChoices = parseChoices(workingText);
  const content = splitPassageAndQuestion(parsedChoices.content);
  const type = parsedChoices.choices.length ? 'MCQ' : 'SPR';
  const domainMatch = findDomain(domain.value, subject);
  const skillMatch = domainMatch && findSkill(skill.value, domainMatch.code);
  const correctAnswer = answer.value.toUpperCase();

  if (!content.questionText) issues.push(issue('error', 'MISSING_QUESTION_TEXT', 'Question text is missing.'));
  if (!correctAnswer) issues.push(issue('error', 'MISSING_ANSWER', 'Correct answer is missing.'));
  if (!domainMatch) issues.push(issue('error', 'MISSING_DOMAIN', domain.value ? 'The selected content domain is not valid for this subject.' : 'Choose a content domain.'));
  if (!skillMatch) issues.push(issue('error', 'MISSING_SKILL', skill.value ? 'The selected skill does not belong to the content domain.' : 'Choose a skill.'));
  if (type === 'MCQ' && parsedChoices.choices.length < 2) issues.push(issue('error', 'MISSING_CHOICES', 'Multiple-choice questions need answer choices.'));
  if (type === 'MCQ' && correctAnswer && !parsedChoices.choices.some(choice => choice.id === correctAnswer)) {
    issues.push(issue('error', 'ANSWER_NOT_IN_CHOICES', 'Correct answer does not match any answer choice.'));
  }
  if (content.blocks.some(block => block.type === 'image' && !block.src)) {
    issues.push(issue('warning', 'IMAGE_REQUIRED', 'This question contains an image placeholder that still needs an image.'));
  }

  return {
    clientId: `m${moduleOrder}-q${questionOrder}`,
    module: moduleOrder,
    order: questionOrder,
    type,
    blocks: content.blocks,
    questionText: content.questionText,
    choices: parsedChoices.choices,
    correctAnswer,
    explanation: explanation.value,
    domainCode: domainMatch?.code || '',
    skillCode: skillMatch?.code || '',
    issues,
  };
};

const parseText = ({ text, subject, expectedModuleCount }) => {
  const normalized = normalizeText(text);
  if (!normalized) throw new ApiError(422, { error: 'This document does not contain readable text.' });

  const moduleMarkers = splitUsingMarkers(normalized, /^\s*={3,}\s*MODULE\s+(\d+)\s*={3,}\s*$/gim);
  const rawModules = moduleMarkers.length > 0
    ? moduleMarkers.map((item, index) => ({ order: Number(item.marker[1]) || index + 1, text: item.text }))
    : [{ order: 1, text: normalized }];

  const modules = rawModules.map((rawModule, index) => {
    const rawQuestions = splitUsingMarkers(rawModule.text, /^\s*QUESTION\s+(\d+)\b.*$/gim);
    const questions = rawQuestions.map((rawQuestion, questionIndex) => parseQuestion({
      text: rawQuestion.text,
      moduleOrder: rawModule.order,
      questionOrder: Number(rawQuestion.marker[1]) || questionIndex + 1,
      subject,
    }));
    return { order: rawModule.order || index + 1, name: `Module ${rawModule.order || index + 1}`, questions };
  });

  const issues = [];
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

exports.previewImport = async ({ file, subject, moduleCount }) => {
  if (!file) throw new ApiError(400, { error: 'Choose a PDF, DOCX, or TXT file.' });
  if (!['RW', 'MATH'].includes(subject)) throw new ApiError(400, { error: 'Choose Reading & Writing or Math before importing.' });

  const text = await extractText(file);
  const preview = parseText({ text, subject, expectedModuleCount: moduleCount });
  return { fileName: file.originalname, ...preview };
};

exports.previewText = ({ text, subject, moduleCount }) => parseText({ text, subject, expectedModuleCount: moduleCount });
