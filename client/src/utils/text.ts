export const capitalizeFirstLetter = (value?: string | null) => {
  const text = String(value || '').trim();
  if (!text) return text;
  return `${text.charAt(0).toLocaleUpperCase()}${text.slice(1)}`;
};
