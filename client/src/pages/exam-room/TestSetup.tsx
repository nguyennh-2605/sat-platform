import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Gauge, LockKeyhole, Save, ShieldCheck, TimerReset } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

export type AttemptMode = 'PRACTICE' | 'EXAM';
export type TimingPreset = 'STANDARD' | 'HALF_TIME' | 'EXTENDED_50' | 'EXTENDED_100' | 'CUSTOM' | 'UNTIMED';

export interface TestSetupData {
  id: number;
  title: string;
  description?: string;
  subject: string;
  questionCount: number;
  standardDurationSeconds: number;
  standardModuleDurationSeconds: number[];
  defaultMode: AttemptMode;
  canCustomize: boolean;
  activeAttempt: null | {
    submissionId: number;
    attemptMode: AttemptMode;
    timingPreset: TimingPreset;
    allowedDurationSeconds: number | null;
  };
}

interface TestSetupProps {
  data: TestSetupData;
  isStarting: boolean;
  onBack: () => void;
  onStart: (configuration: {
    attemptMode: AttemptMode;
    timingPreset: TimingPreset;
    customDurationMinutes?: number;
  }) => void;
}

const presetLabels: Record<TimingPreset, string> = {
  STANDARD: 'Standard time',
  HALF_TIME: 'Half time',
  EXTENDED_50: '50% extra time',
  EXTENDED_100: 'Double time',
  CUSTOM: 'Custom time',
  UNTIMED: 'Untimed',
};

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return 'No countdown';
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
};

const subjectLabel = (subject: string) => subject === 'RW'
  ? 'Reading and Writing'
  : subject === 'MATH'
    ? 'Math'
    : subject;

export default function TestSetup({ data, isStarting, onBack, onStart }: TestSetupProps) {
  const [attemptMode, setAttemptMode] = useState<AttemptMode>(data.defaultMode);
  const [timingPreset, setTimingPreset] = useState<TimingPreset>('STANDARD');
  const [customMinutes, setCustomMinutes] = useState(Math.max(1, Math.round(data.standardDurationSeconds / 60)));
  const availablePresets = attemptMode === 'EXAM'
    ? (['STANDARD', 'EXTENDED_50', 'EXTENDED_100'] as TimingPreset[])
    : (['STANDARD', 'HALF_TIME', 'EXTENDED_50', 'EXTENDED_100', 'CUSTOM', 'UNTIMED'] as TimingPreset[]);

  const previewSeconds = useMemo(() => {
    if (timingPreset === 'UNTIMED') return null;
    if (timingPreset === 'CUSTOM') return customMinutes * 60;
    const multiplier = timingPreset === 'HALF_TIME' ? 0.5
      : timingPreset === 'EXTENDED_50' ? 1.5
        : timingPreset === 'EXTENDED_100' ? 2 : 1;
    return Math.round(data.standardDurationSeconds * multiplier);
  }, [customMinutes, data.standardDurationSeconds, timingPreset]);

  const active = data.activeAttempt;
  const selectedMode = active?.attemptMode || attemptMode;
  const selectedPreset = active?.timingPreset || timingPreset;
  const selectedDuration = active ? active.allowedDurationSeconds : previewSeconds;
  const instructions = selectedMode === 'PRACTICE'
    ? [
        {
          icon: selectedPreset === 'UNTIMED' ? TimerReset : Clock3,
          title: selectedPreset === 'UNTIMED' ? 'No countdown' : 'Your timer starts immediately',
          description: selectedPreset === 'UNTIMED'
            ? 'Untimed practice records your progress without advancing or submitting because of time.'
            : `The ${formatDuration(selectedDuration)} countdown begins as soon as you continue. Each module has its own timer.`,
        },
        {
          icon: Save,
          title: 'Save and exit when needed',
          description: 'Answers are saved automatically. Save & Exit pauses a timed practice attempt so you can resume later.',
        },
        {
          icon: CheckCircle2,
          title: 'Low-pressure practice',
          description: 'Full-screen monitoring and exit warnings are off. You can focus on pacing, tools, and question strategy.',
        },
      ]
    : [
        {
          icon: LockKeyhole,
          title: 'Full screen is required',
          description: 'Continuing opens the test in full screen. Leaving full screen or switching away records a warning.',
        },
        {
          icon: AlertTriangle,
          title: 'The attempt cannot be paused',
          description: 'Answers still save automatically, but there is no Save & Exit. Three warnings submit the attempt.',
        },
        {
          icon: Clock3,
          title: 'Test-day timing rules',
          description: `The ${formatDuration(selectedDuration)} countdown starts immediately. A module advances automatically when its time expires.`,
        },
      ];

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <Button variant="ghost" className="w-fit" onClick={onBack}>
          <ArrowLeft /> Back to Practice Center
        </Button>

        <Card>
          <CardHeader className="border-b sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <CardTitle className="text-xl sm:text-2xl">{data.title}</CardTitle>
            <CardDescription>{data.description || 'Review your settings before the test begins.'}</CardDescription>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0">
              <div><span className="text-muted-foreground">Subject</span><p className="font-medium">{subjectLabel(data.subject)}</p></div>
              <div><span className="text-muted-foreground">Questions</span><p className="font-medium">{data.questionCount}</p></div>
              <div><span className="text-muted-foreground">Standard</span><p className="font-medium">{formatDuration(data.standardDurationSeconds)}</p></div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{active ? 'Continue your attempt' : 'Choose your test experience'}</CardTitle>
              <CardDescription>
                {active
                  ? 'Mode and timing are locked after an attempt is created.'
                  : data.canCustomize
                    ? 'Choose how closely this attempt should match test day.'
                    : 'This assigned test uses the settings selected by your teacher.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-2" aria-labelledby="mode-heading">
                <h2 id="mode-heading" className="text-sm font-medium">Mode</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['PRACTICE', 'EXAM'] as AttemptMode[]).map(mode => (
                    <Button
                      key={mode}
                      type="button"
                      variant={selectedMode === mode ? 'secondary' : 'outline'}
                      className={selectedMode === mode
                        ? 'h-auto justify-start px-3 py-3 ring-1 ring-foreground/15'
                        : 'h-auto justify-start px-3 py-3'}
                      disabled={Boolean(active) || !data.canCustomize}
                      aria-pressed={selectedMode === mode}
                      onClick={() => {
                        setAttemptMode(mode);
                        if (mode === 'EXAM' && !['STANDARD', 'EXTENDED_50', 'EXTENDED_100'].includes(timingPreset)) {
                          setTimingPreset('STANDARD');
                        }
                      }}
                    >
                      {mode === 'PRACTICE' ? <Gauge /> : <ShieldCheck />}
                      {mode === 'PRACTICE' ? 'Practice' : 'Exam simulation'}
                    </Button>
                  ))}
                </div>
              </section>

              <section className="space-y-2" aria-labelledby="timing-heading">
                <h2 id="timing-heading" className="text-sm font-medium">Timing</h2>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {(active ? [selectedPreset] : availablePresets).map(preset => (
                    <Button
                      key={preset}
                      type="button"
                      variant={selectedPreset === preset ? 'secondary' : 'outline'}
                      className="justify-start"
                      disabled={Boolean(active) || !data.canCustomize}
                      aria-pressed={selectedPreset === preset}
                      onClick={() => setTimingPreset(preset)}
                    >
                      <Clock3 /> {presetLabels[preset]}
                    </Button>
                  ))}
                </div>
                {timingPreset === 'CUSTOM' && !active && (
                  <label className="block max-w-xs space-y-1.5 pt-2 text-sm">
                    <span className="font-medium">Total minutes</span>
                    <Input
                      type="number"
                      min={1}
                      max={300}
                      value={customMinutes}
                      onChange={event => setCustomMinutes(Math.min(300, Math.max(1, Number(event.target.value) || 1)))}
                    />
                  </label>
                )}
              </section>

              <div className="rounded-lg border bg-muted/40 p-4 text-sm" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{selectedMode === 'PRACTICE' ? 'Practice mode' : 'Exam simulation'}</p>
                  <span className="font-medium">{formatDuration(selectedDuration)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {selectedMode === 'PRACTICE'
                    ? 'Flexible practice with automatic saving and the option to exit and resume.'
                    : 'A stricter, full-screen attempt designed to reproduce test-day conditions.'}
                </p>
              </div>

              <Button
                size="lg"
                className="w-full"
                disabled={isStarting}
                onClick={() => onStart({
                  attemptMode: selectedMode,
                  timingPreset: selectedPreset,
                  ...(selectedPreset === 'CUSTOM' ? { customDurationMinutes: customMinutes } : {}),
                })}
              >
                {isStarting ? 'Starting test…' : 'Continue'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Continuing starts or resumes the attempt immediately.</p>
            </CardContent>
          </Card>

          <Card className="lg:sticky lg:top-6">
            <CardHeader className="border-b">
              <CardTitle>Before you start</CardTitle>
              <CardDescription>These rules apply to the mode and timing selected on the left.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {instructions.map(item => (
                <div key={item.title} className="flex gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <item.icon className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-medium">{item.title}</h3>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Use the built-in calculator and annotation tools where available. Submit only when you are ready to finalize your score.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
