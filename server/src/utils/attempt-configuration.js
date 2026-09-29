const ApiError = require('./ApiError');
const { allocateModuleDurations } = require('./module-timing');

const TIMING_PRESETS = Object.freeze([
  'STANDARD',
  'HALF_TIME',
  'EXTENDED_50',
  'EXTENDED_100',
  'CUSTOM',
  'UNTIMED',
]);

const EXAM_TIMING_PRESETS = new Set(['STANDARD', 'EXTENDED_50', 'EXTENDED_100']);

const standardModuleSeconds = test => {
  const sections = [...(test.sections || [])].sort((first, second) => first.order - second.order);
  const sectionDurations = sections.map(section => Number(section.duration));
  const configuredDuration = Number(test.duration);
  const canUseSectionDurations = sectionDurations.length > 0
    && sectionDurations.every(duration => Number.isInteger(duration) && duration > 0)
    && sectionDurations.reduce((total, duration) => total + duration, 0) === configuredDuration;

  const minutes = canUseSectionDurations
    ? sectionDurations
    : allocateModuleDurations(configuredDuration, sections.length);
  return minutes.map(duration => duration * 60);
};

const allocateSeconds = (totalSeconds, weights) => {
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let allocated = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return totalSeconds - allocated;
    const value = Math.max(1, Math.round((totalSeconds * weight) / totalWeight));
    allocated += value;
    return value;
  });
};

const allowedModuleSeconds = ({ preset, customDurationMinutes, standardSeconds }) => {
  if (preset === 'UNTIMED') return standardSeconds.map(() => null);
  if (preset === 'CUSTOM') {
    const customMinutes = Number(customDurationMinutes);
    if (!Number.isInteger(customMinutes) || customMinutes < 1 || customMinutes > 300) {
      throw new ApiError(400, { error: 'Custom duration must be between 1 and 300 minutes.' });
    }
    return allocateSeconds(customMinutes * 60, standardSeconds);
  }

  const multiplier = preset === 'HALF_TIME'
    ? 0.5
    : preset === 'EXTENDED_50'
      ? 1.5
      : preset === 'EXTENDED_100'
        ? 2
        : 1;
  return standardSeconds.map(seconds => Math.max(1, Math.round(seconds * multiplier)));
};

const resolveAttemptConfiguration = ({ test, requestedMode, requestedTimingPreset, customDurationMinutes, canCustomize }) => {
  const mode = canCustomize && requestedMode === 'EXAM' ? 'EXAM'
    : canCustomize && requestedMode === 'PRACTICE' ? 'PRACTICE'
      : test.mode;
  const requestedPreset = String(requestedTimingPreset || 'STANDARD').toUpperCase();
  const preset = canCustomize && TIMING_PRESETS.includes(requestedPreset) ? requestedPreset : 'STANDARD';

  if (mode === 'EXAM' && !EXAM_TIMING_PRESETS.has(preset)) {
    throw new ApiError(400, { error: 'Exam simulation supports standard, 50% extended, or double time only.' });
  }

  const standardSeconds = standardModuleSeconds(test);
  const allowedSeconds = allowedModuleSeconds({ preset, customDurationMinutes, standardSeconds });
  return {
    attemptMode: mode,
    timingPreset: preset,
    allowedDurationSeconds: preset === 'UNTIMED'
      ? null
      : allowedSeconds.reduce((total, seconds) => total + seconds, 0),
    moduleTimingSnapshot: standardSeconds.map((seconds, index) => ({
      standardSeconds: seconds,
      allowedSeconds: allowedSeconds[index],
    })),
  };
};

const timingSnapshotFor = (submission, test) => {
  const snapshot = submission?.moduleTimingSnapshot;
  if (Array.isArray(snapshot) && snapshot.length === (test.sections || []).length) {
    const normalized = snapshot.map(item => ({
      standardSeconds: Number(item?.standardSeconds),
      allowedSeconds: item?.allowedSeconds === null ? null : Number(item?.allowedSeconds),
    }));
    if (normalized.every(item => Number.isInteger(item.standardSeconds)
      && item.standardSeconds > 0
      && (item.allowedSeconds === null || (Number.isInteger(item.allowedSeconds) && item.allowedSeconds > 0)))) {
      return normalized;
    }
  }

  const standardSeconds = standardModuleSeconds(test);
  return standardSeconds.map(seconds => ({ standardSeconds: seconds, allowedSeconds: seconds }));
};

const attemptModeFor = (submission, test) => submission?.attemptMode || test.mode;
const timingPresetFor = submission => submission?.timingPreset || 'STANDARD';
const isUntimedAttempt = submission => timingPresetFor(submission) === 'UNTIMED';

module.exports = {
  EXAM_TIMING_PRESETS,
  TIMING_PRESETS,
  attemptModeFor,
  isUntimedAttempt,
  resolveAttemptConfiguration,
  standardModuleSeconds,
  timingPresetFor,
  timingSnapshotFor,
};
