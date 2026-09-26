// pdf-extraction 1.0.2 bundles PDF.js 1.10.100. These operator ids are stable
// for that bundled version and let us retain short vector rules used as blanks.
const PDF_OPS = Object.freeze({
  save: 10,
  restore: 11,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  rectangle: 19,
  stroke: 20,
  closeStroke: 21,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  endPath: 28,
  constructPath: 91,
});
const PDF_BLANK_CANDIDATE = '\uE000PDF_BLANK\uE001';

const IDENTITY_MATRIX = Object.freeze([1, 0, 0, 1, 0, 0]);

const multiplyMatrices = (left, right) => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5],
];

const transformPoint = (matrix, x, y) => ({
  x: matrix[0] * x + matrix[2] * y + matrix[4],
  y: matrix[1] * x + matrix[3] * y + matrix[5],
});

const horizontalSegment = (start, end) => {
  const length = Math.abs(end.x - start.x);
  if (Math.abs(end.y - start.y) > 1.5 || length < 8 || length > 240) return null;
  return {
    x1: Math.min(start.x, end.x),
    x2: Math.max(start.x, end.x),
    y: (start.y + end.y) / 2,
  };
};

const readConstructedPath = (args, matrix) => {
  const [pathOperators = [], coordinates = []] = args || [];
  const segments = [];
  let coordinateIndex = 0;
  let currentPoint = null;

  for (const operator of pathOperators) {
    if (operator === PDF_OPS.moveTo) {
      currentPoint = transformPoint(matrix, coordinates[coordinateIndex], coordinates[coordinateIndex + 1]);
      coordinateIndex += 2;
    } else if (operator === PDF_OPS.lineTo) {
      const nextPoint = transformPoint(matrix, coordinates[coordinateIndex], coordinates[coordinateIndex + 1]);
      coordinateIndex += 2;
      if (currentPoint) {
        const segment = horizontalSegment(currentPoint, nextPoint);
        if (segment) segments.push(segment);
      }
      currentPoint = nextPoint;
    } else if (operator === PDF_OPS.rectangle) {
      const x = coordinates[coordinateIndex];
      const y = coordinates[coordinateIndex + 1];
      const width = coordinates[coordinateIndex + 2];
      const height = coordinates[coordinateIndex + 3];
      coordinateIndex += 4;
      const bottomLeft = transformPoint(matrix, x, y);
      const bottomRight = transformPoint(matrix, x + width, y);
      const topLeft = transformPoint(matrix, x, y + height);
      const topRight = transformPoint(matrix, x + width, y + height);
      const transformedHeight = Math.hypot(topLeft.x - bottomLeft.x, topLeft.y - bottomLeft.y);
      if (transformedHeight <= 3) {
        const bottom = horizontalSegment(bottomLeft, bottomRight);
        const top = horizontalSegment(topLeft, topRight);
        if (bottom) segments.push(bottom);
        if (top) segments.push(top);
      }
    }
  }
  return segments;
};

const extractHorizontalRules = ({ fnArray = [], argsArray = [] } = {}) => {
  const rules = [];
  const matrixStack = [];
  let matrix = [...IDENTITY_MATRIX];
  let pendingSegments = [];

  for (let index = 0; index < fnArray.length; index += 1) {
    const operator = fnArray[index];
    const args = argsArray[index] || [];
    if (operator === PDF_OPS.save) {
      matrixStack.push([...matrix]);
    } else if (operator === PDF_OPS.restore) {
      matrix = matrixStack.pop() || [...IDENTITY_MATRIX];
    } else if (operator === PDF_OPS.transform) {
      matrix = multiplyMatrices(matrix, args);
    } else if (operator === PDF_OPS.constructPath) {
      pendingSegments.push(...readConstructedPath(args, matrix));
    } else if ([PDF_OPS.stroke, PDF_OPS.closeStroke, PDF_OPS.fill, PDF_OPS.eoFill,
      PDF_OPS.fillStroke, PDF_OPS.eoFillStroke, PDF_OPS.closeFillStroke,
      PDF_OPS.closeEOFillStroke].includes(operator)) {
      rules.push(...pendingSegments);
      pendingSegments = [];
    } else if (operator === PDF_OPS.endPath) {
      pendingSegments = [];
    }
  }
  return rules;
};

const itemHeight = (item) => Number(item.height)
  || Math.hypot(Number(item.transform?.[2]) || 0, Number(item.transform?.[3]) || 0)
  || 10;

const blankRuleBetween = (previous, current, rules) => {
  const previousEnd = Number(previous.transform?.[4]) + Number(previous.width || 0);
  const currentStart = Number(current.transform?.[4]);
  const baseline = (Number(previous.transform?.[5]) + Number(current.transform?.[5])) / 2;
  const height = Math.max(itemHeight(previous), itemHeight(current));
  if (!Number.isFinite(previousEnd) || !Number.isFinite(currentStart) || currentStart <= previousEnd) return false;

  return rules.some(rule => {
    const horizontalOverlap = Math.min(rule.x2, currentStart + 2) - Math.max(rule.x1, previousEnd - 2);
    const ruleLength = rule.x2 - rule.x1;
    return Math.abs(rule.y - baseline) <= Math.max(4, height * 0.55)
      && horizontalOverlap >= Math.min(8, ruleLength * 0.5)
      && rule.x1 >= previousEnd - 8
      && rule.x2 <= currentStart + 8;
  });
};

const injectInternalBlankRules = (item, rules) => {
  const value = item.str;
  if (!value || /_{3,}/.test(value) || !/\s/.test(value)) return value;
  const start = Number(item.transform?.[4]);
  const width = Number(item.width || 0);
  const baseline = Number(item.transform?.[5]);
  const height = itemHeight(item);
  if (!Number.isFinite(start) || !Number.isFinite(width) || width <= 0 || !Number.isFinite(baseline)) return value;

  const averageCharacterWidth = width / Math.max(1, value.length);
  const whitespaceIndexes = [...value.matchAll(/\s+/g)].map(match => match.index + (match[0].length / 2));
  const insertions = [];

  for (const rule of rules) {
    const ruleLength = rule.x2 - rule.x1;
    const center = (rule.x1 + rule.x2) / 2;
    if (ruleLength < Math.max(12, height * 1.25)
      || ruleLength > Math.min(240, width * 0.45)
      || Math.abs(rule.y - baseline) > Math.max(4, height * 0.55)
      || rule.x1 < start - 2
      || rule.x2 > start + width + 2) continue;

    const estimatedIndex = ((center - start) / width) * value.length;
    const nearestWhitespace = whitespaceIndexes
      .map(index => ({ index, distance: Math.abs(index - estimatedIndex) }))
      .sort((left, right) => left.distance - right.distance)[0];
    if (!nearestWhitespace || nearestWhitespace.distance * averageCharacterWidth > Math.max(12, height * 1.5)) continue;
    insertions.push(Math.round(nearestWhitespace.index));
  }

  return [...new Set(insertions)]
    .sort((left, right) => right - left)
    .reduce((result, index) => `${result.slice(0, index).trimEnd()}${PDF_BLANK_CANDIDATE}${result.slice(index).trimStart()}`, value);
};

const renderLayoutText = (items = [], operatorList = {}) => {
  const rules = extractHorizontalRules(operatorList);
  let previous = null;
  let text = '';

  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const sameLine = previous
      && Math.abs(Number(previous.transform?.[5]) - Number(item.transform?.[5])) <= 2;
    let followsBlank = false;
    if (!sameLine && previous) {
      text += '\n';
    } else if (sameLine && blankRuleBetween(previous, item, rules)) {
      text = `${text.trimEnd()}${PDF_BLANK_CANDIDATE}`;
      followsBlank = true;
    }
    const itemText = injectInternalBlankRules(item, rules);
    text += followsBlank ? itemText.trimStart() : itemText;
    previous = item;
  }
  return text;
};

const restorePdfBlankCandidates = (value) => String(value || '').replaceAll(PDF_BLANK_CANDIDATE, (candidate, offset, source) => {
  const followingText = source.slice(offset + candidate.length);
  const completionPrompt = followingText.match(/\bWhich choice(?:\s+most logically)?\s+completes the text\b/i);
  if (!completionPrompt || completionPrompt.index > 1800) return ' ';
  const betweenCandidateAndPrompt = followingText.slice(0, completionPrompt.index);
  if (/(?:^|\n)\s*[A-D][.)]\s+/m.test(betweenCandidateAndPrompt)) return ' ';
  return ' _____ ';
});

const renderPdfPageWithBlankLines = async (pageData) => {
  const textContent = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
  let operatorList = {};
  if (typeof pageData.getOperatorList === 'function') {
    try {
      operatorList = await pageData.getOperatorList();
    } catch {
      // Text extraction should remain available even if a malformed page has an unreadable vector layer.
    }
  }
  return renderLayoutText(textContent.items, operatorList);
};

module.exports = {
  PDF_BLANK_CANDIDATE,
  extractHorizontalRules,
  renderLayoutText,
  renderPdfPageWithBlankLines,
  restorePdfBlankCandidates,
};
