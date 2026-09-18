export const SAT_TEST_MONTHS = [
  { value: '03', label: 'March' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '08', label: 'August' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const;

export type SatTestMonth = typeof SAT_TEST_MONTHS[number]['value'];
export type SatTestMonthFilter = 'ALL' | SatTestMonth;

export const normalizeSatTestMonth = (value?: string | null): SatTestMonth | '' => {
  if (!value) return '';
  const direct = SAT_TEST_MONTHS.find(month => month.value === value)?.value;
  if (direct) return direct;
  const match = value.match(/^\d{4}-(\d{2})(?:-\d{2})?/);
  return SAT_TEST_MONTHS.find(month => month.value === match?.[1])?.value || '';
};

export const satTestMonthLabel = (value?: string | null) => {
  const normalized = normalizeSatTestMonth(value);
  return SAT_TEST_MONTHS.find(month => month.value === normalized)?.label || null;
};
