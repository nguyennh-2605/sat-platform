export const questionIdLabel = (id: string) => {
  const normalized = id.startsWith('eqb-') ? id.slice(4) : id;
  return normalized.slice(0, 8).toUpperCase();
};
