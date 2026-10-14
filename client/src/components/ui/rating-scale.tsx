import type { ComponentProps, ReactNode } from 'react';
import { RadioGroup } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RatingScaleOption {
  value: string;
  label: string;
  accessibleLabel?: string;
  icon: ReactNode;
}

interface RatingScaleProps extends Omit<ComponentProps<typeof RadioGroup.Root>, 'children' | 'defaultValue' | 'value' | 'onValueChange'> {
  options: readonly RatingScaleOption[];
  value: string;
  onValueChange: (value: string) => void;
}

export function RatingScale({ options, value, className, disabled, ...props }: RatingScaleProps) {
  return <RadioGroup.Root
    {...props}
    value={value}
    disabled={disabled}
    orientation="horizontal"
    data-slot="rating-scale"
    className={cn('flex w-full gap-1.5 sm:gap-2', className)}
  >
    {options.map(option => <RadioGroup.Item key={option.value} value={option.value} asChild aria-label={option.accessibleLabel || option.label}>
      <Button
        type="button"
        variant={value === option.value ? 'default' : 'outline'}
        disabled={disabled}
        className="h-auto min-h-20 min-w-0 flex-1 flex-col gap-2 px-1 py-3 text-xs whitespace-normal sm:text-sm"
      >
        <span aria-hidden="true">{option.icon}</span>
        <span className="w-full break-words text-center leading-4">{option.label}</span>
      </Button>
    </RadioGroup.Item>)}
  </RadioGroup.Root>;
}
