import { Controller, type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SAT_TEST_MONTHS } from '@/lib/satTestMonths';
import type { TestDetailsValues } from './create-test.types';

interface TestDetailsStepProps {
  form: UseFormReturn<TestDetailsValues>;
  isAdmin: boolean;
}

export function TestDetailsStep({ form, isAdmin }: TestDetailsStepProps) {
  const { control, register, formState: { errors } } = form;
  const category = form.watch('category');
  const officialDurations = { RW: 64, MATH: 70 } as const;

  return (
    <div className="min-h-0 overflow-y-auto px-1">
      <FieldGroup>
        <Field data-invalid={Boolean(errors.title)}>
          <FieldLabel htmlFor="test-title">Test name</FieldLabel>
          <Input id="test-title" className="w-full" placeholder="e.g. SAT Reading Practice Test 1" autoFocus aria-invalid={Boolean(errors.title)} {...register('title')} />
          <FieldError errors={[errors.title]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller control={control} name="subject" render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="test-subject">Subject</FieldLabel>
              <Select value={field.value} onValueChange={value => {
                const nextSubject = value as keyof typeof officialDurations;
                const currentDuration = form.getValues('duration');
                const shouldUseSubjectDefault = category === 'REAL' || currentDuration === officialDurations[field.value];
                field.onChange(nextSubject);
                if (shouldUseSubjectDefault) form.setValue('duration', officialDurations[nextSubject], { shouldDirty: true, shouldValidate: true });
              }}>
                <SelectTrigger id="test-subject" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectItem value="RW">Reading & Writing</SelectItem>
                  <SelectItem value="MATH">Math</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )} />
          <Controller control={control} name="mode" render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="test-mode">Test mode</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="test-mode" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectItem value="PRACTICE">Practice</SelectItem>
                  <SelectItem value="EXAM">Secure exam</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(errors.duration)}>
            <FieldLabel htmlFor="test-duration">Duration</FieldLabel>
            <div className="relative">
              <Input id="test-duration" type="number" min={1} className="w-full pr-20" aria-invalid={Boolean(errors.duration)} {...register('duration', { valueAsNumber: true })} />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">minutes</span>
            </div>
            <FieldError errors={[errors.duration]} />
          </Field>
          <Controller control={control} name="moduleCount" render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="test-modules">Modules</FieldLabel>
              <Select value={String(field.value)} onValueChange={value => field.onChange(Number(value))}>
                <SelectTrigger id="test-modules" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectItem value="1">1 module</SelectItem>
                  <SelectItem value="2">2 modules</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )} />
        </div>

        {isAdmin && (
          <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <Controller control={control} name="category" render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="test-publication">Publication</FieldLabel>
                <Select value={field.value} onValueChange={value => {
                  field.onChange(value);
                  if (value === 'REAL') {
                    form.setValue('moduleCount', 2, { shouldDirty: true, shouldValidate: true });
                    form.setValue('duration', officialDurations[form.getValues('subject')], { shouldDirty: true, shouldValidate: true });
                  }
                }}>
                  <SelectTrigger id="test-publication" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" align="start">
                    <SelectItem value="PRACTICE">Practice test</SelectItem>
                    <SelectItem value="REAL">Official test</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>Official tests are grouped by the fixed SAT testing months.</FieldDescription>
              </Field>
            )} />
            {category === 'REAL' && <Controller control={control} name="testDate" render={({ field }) => (
              <Field data-invalid={Boolean(errors.testDate)}>
                <FieldLabel htmlFor="official-test-month">Official test month</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="official-test-month" className="w-full" aria-invalid={Boolean(errors.testDate)}><SelectValue placeholder="Choose a month" /></SelectTrigger>
                  <SelectContent position="popper" align="start">
                    {SAT_TEST_MONTHS.map(month => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError errors={[errors.testDate]} />
              </Field>
            )} />}
          </div>
        )}
      </FieldGroup>
    </div>
  );
}
