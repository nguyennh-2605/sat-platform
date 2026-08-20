const MCQ_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const normalizeText = (value) => String(value ?? '').trim();

const parseNumericAnswer = (value) => {
  const normalized = normalizeText(value).replace(/\s+/g, '');
  if (!normalized) return null;

  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const fraction = normalized.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (!fraction) return null;

  const denominator = Number(fraction[2]);
  if (denominator === 0) return null;
  return Number(fraction[1]) / denominator;
};

const resolveChoiceIndex = (answer, choices) => {
  const normalized = normalizeText(answer).toUpperCase();
  if (!normalized) return -1;

  const byId = choices.findIndex(
    (choice) => normalizeText(choice?.id).toUpperCase() === normalized
  );
  if (byId >= 0) return byId;

  const byText = choices.findIndex(
    (choice) => normalizeText(choice?.text).toUpperCase() === normalized
  );
  if (byText >= 0) return byText;

  if (normalized.length === 1) {
    const labelIndex = MCQ_LABELS.indexOf(normalized);
    if (labelIndex >= 0 && labelIndex < choices.length) return labelIndex;
  }

  return -1;
};

const isAnswerCorrect = ({ type, choices = [], correctAnswer, userAnswer }) => {
  const expected = normalizeText(correctAnswer);
  const actual = normalizeText(userAnswer);
  if (!expected || !actual) return false;

  if (type === 'SPR') {
    if (expected === actual) return true;
    const expectedNumber = parseNumericAnswer(expected);
    const actualNumber = parseNumericAnswer(actual);
    if (expectedNumber === null || actualNumber === null) return false;

    // SAT accepts an equivalent fraction/decimal and answers rounded or truncated
    // to four decimal places. A small absolute tolerance covers both forms.
    return Math.abs(expectedNumber - actualNumber) <= 0.0001 + Number.EPSILON;
  }

  const expectedIndex = resolveChoiceIndex(expected, choices);
  const actualIndex = resolveChoiceIndex(actual, choices);
  if (expectedIndex >= 0 && actualIndex >= 0) return expectedIndex === actualIndex;

  return expected.toUpperCase() === actual.toUpperCase();
};

const gradeQuestions = (questions, rawAnswers) => {
  const answers = rawAnswers && typeof rawAnswers === 'object' && !Array.isArray(rawAnswers)
    ? rawAnswers
    : {};

  let correctCount = 0;
  const answerRows = [];
  const details = [];

  for (const question of questions) {
    const selectedChoice = normalizeText(answers[String(question.id)]) || null;
    const isCorrect = isAnswerCorrect({
      type: question.type,
      choices: Array.isArray(question.choices) ? question.choices : [],
      correctAnswer: question.correctAnswer,
      userAnswer: selectedChoice
    });

    if (isCorrect) correctCount += 1;
    answerRows.push({ questionId: question.id, selectedChoice, isCorrect });
    details.push({
      questionId: question.id,
      isCorrect,
      userSelected: selectedChoice,
      correctOption: question.correctAnswer
    });
  }

  return { correctCount, totalQuestions: questions.length, answerRows, details };
};

module.exports = { gradeQuestions, isAnswerCorrect, parseNumericAnswer, resolveChoiceIndex };
