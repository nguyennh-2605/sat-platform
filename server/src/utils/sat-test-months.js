const SAT_TEST_MONTHS = Object.freeze(['03', '05', '06', '08', '10', '11', '12']);

const normalizeSatTestMonth = value => {
  const raw = String(value || '').trim();
  if (SAT_TEST_MONTHS.includes(raw)) return raw;
  const match = raw.match(/^\d{4}-(\d{2})(?:-\d{2})?/);
  return SAT_TEST_MONTHS.includes(match?.[1]) ? match[1] : '';
};

const testMonthWhere = value => {
  const month = normalizeSatTestMonth(value);
  if (!month) return null;
  return {
    category: 'REAL',
    OR: [
      { testDate: month },
      { testDate: { startsWith: `${month}-` } },
      { testDate: { contains: `-${month}-` } },
      { testDate: { endsWith: `-${month}` } },
    ],
  };
};

module.exports = { SAT_TEST_MONTHS, normalizeSatTestMonth, testMonthWhere };
