const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parsePagination = ({ page, pageSize }, { defaultPageSize = 20, maxPageSize = 50 } = {}) => {
  const normalizedPage = positiveInteger(page, 1);
  const normalizedPageSize = Math.min(positiveInteger(pageSize, defaultPageSize), maxPageSize);
  return { page: normalizedPage, pageSize: normalizedPageSize, skip: (normalizedPage - 1) * normalizedPageSize };
};

const paginationMeta = ({ page, pageSize, total }) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

module.exports = { parsePagination, paginationMeta };
