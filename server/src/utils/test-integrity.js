const INTEGRITY_FILTERS = {
  NO_SECTIONS: {
    scope: 'SYSTEM',
    status: 'PUBLISHED',
    sections: { none: {} },
  },
  NO_QUESTIONS: {
    scope: 'SYSTEM',
    status: 'PUBLISHED',
    sections: {
      some: {},
      none: { questions: { some: {} } },
    },
  },
  EMPTY_SECTION: {
    scope: 'SYSTEM',
    status: 'PUBLISHED',
    AND: [
      { sections: { some: { questions: { none: {} } } } },
      { sections: { some: { questions: { some: {} } } } },
    ],
  },
};

const normalizeIntegrityFilter = value => {
  const normalized = String(value || '').trim().toUpperCase();
  return INTEGRITY_FILTERS[normalized] ? normalized : '';
};

module.exports = { INTEGRITY_FILTERS, normalizeIntegrityFilter };
