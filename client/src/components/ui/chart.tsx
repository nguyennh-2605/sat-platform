import * as React from 'react';
import { ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<string, { label: React.ReactNode; color: string }>;

const ChartContext = React.createContext<ChartConfig | null>(null);

export function ChartContainer({
  id,
  config,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  id?: string;
  config: ChartConfig;
  children: React.ComponentProps<typeof ResponsiveContainer>['children'];
}) {
  const generatedId = React.useId().replace(/:/g, '');
  const chartId = `chart-${id || generatedId}`;
  const colorRules = Object.entries(config)
    .map(([key, item]) => `--color-${key}: ${item.color};`)
    .join('');

  return (
    <ChartContext.Provider value={config}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          'flex justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/60 [&_.recharts-layer]:outline-hidden [&_.recharts-surface]:outline-hidden',
          className,
        )}
        {...props}
      >
        <style>{`[data-chart="${chartId}"]{${colorRules}}`}</style>
        <ResponsiveContainer initialDimension={{ width: 640, height: 288 }}>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsTooltip;

interface ChartTooltipItem {
  type?: string;
  dataKey?: string | number;
  name?: string | number;
  value?: string | number | readonly (string | number)[];
  color?: string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  className,
}: {
  active?: boolean;
  payload?: readonly ChartTooltipItem[];
  label?: React.ReactNode;
  className?: string;
  labelFormatter?: (value: React.ReactNode) => React.ReactNode;
}) {
  const config = React.useContext(ChartContext);
  if (!active || !payload?.length || !config) return null;

  return (
    <div className={cn('grid min-w-36 gap-1.5 rounded-control border border-ui-border bg-background px-2.5 py-2 text-xs shadow-raised', className)}>
      <div className="font-medium text-foreground">{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.filter(item => item.type !== 'none').map(item => {
        const key = String(item.dataKey || item.name || 'value');
        const itemConfig = config[key];
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="size-2 rounded-sm" style={{ backgroundColor: item.color || itemConfig?.color }} aria-hidden="true" />
            <span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
            <span className="ml-auto font-mono font-medium tabular-nums text-foreground">{Number(Array.isArray(item.value) ? item.value[0] : item.value || 0).toLocaleString('en-US')}</span>
          </div>
        );
      })}
    </div>
  );
}
