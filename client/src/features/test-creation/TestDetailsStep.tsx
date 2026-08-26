import { Controller, type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TestDetailsValues } from './create-test.types';

interface TestDetailsStepProps {
  form: UseFormReturn<TestDetailsValues>;
  isAdmin: boolean;
}

export function TestDetailsStep({ form, isAdmin }: TestDetailsStepProps) {
  const { control, register, formState: { errors } } = form;
  const category = form.watch('category');

  return (
    <div className="min-h-0 overflow-y-auto pr-1">
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
              <Select value={field.value} onValueChange={field.onChange}>
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
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="test-publication" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" align="start">
                    <SelectItem value="PRACTICE">Practice test</SelectItem>
                    <SelectItem value="REAL">Official test</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>Official tests require a scheduled date.</FieldDescription>
              </Field>
            )} />
            {category === 'REAL' && <Controller control={control} name="testDate" render={({ field }) => (
              <Field data-invalid={Boolean(errors.testDate)}>
                <FieldLabel>Official test date</FieldLabel>
                <DateTimePicker mode="date" value={field.value} onChange={field.onChange} placeholder="Choose a date" ariaLabel="Official test date" className="w-full" />
                <FieldError errors={[errors.testDate]} />
              </Field>
            )} />}
          </div>
        )}
      </FieldGroup>
    </div>
  );
}
