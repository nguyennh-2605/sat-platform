import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Thiết lập một timer để cập nhật giá trị sau khoảng thời gian delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Xóa timer nếu giá trị thay đổi trước khi hết thời gian delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}