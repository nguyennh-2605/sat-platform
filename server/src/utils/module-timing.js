const MAX_TEST_MODULES = 2;

const allocateModuleDurations = (totalDuration, moduleCount) => {
  const total = Number.parseInt(totalDuration, 10);
  const count = Number.parseInt(moduleCount, 10);
  if (!Number.isInteger(total) || total < 1) throw new TypeError('Total duration must be a positive integer.');
  if (!Number.isInteger(count) || count < 1 || count > MAX_TEST_MODULES) {
    throw new TypeError(`Module count must be between 1 and ${MAX_TEST_MODULES}.`);
  }
  if (total < count) throw new TypeError('Total duration must allow at least one minute per module.');

  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, index) => (
    index === count - 1 ? total - (base * (count - 1)) : base
  ));
};

const moduleTiming = ({ totalDuration, sections, moduleNumber }) => {
  const orderedSections = [...(sections || [])].sort((a, b) => a.order - b.order);
  const durations = allocateModuleDurations(totalDuration, orderedSections.length);
  const index = Number(moduleNumber) - 1;
  if (index < 0 || index >= durations.length) throw new RangeError('Unknown test module.');
  return {
    durationMinutes: durations[index],
    firstQuestionIndex: orderedSections
      .slice(0, index)
      .reduce((total, section) => total + (section.questions?.length || section._count?.questions || 0), 0),
    moduleCount: durations.length,
  };
};

module.exports = { MAX_TEST_MODULES, allocateModuleDurations, moduleTiming };
