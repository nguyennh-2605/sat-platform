import { useState, useLayoutEffect, type MouseEvent } from 'react';

interface RippleProps {
  color?: string;
  duration?: number;
}

export default function Ripple({ color = 'rgba(148, 163, 184, 0.3)', duration = 600 }: RippleProps) {
  const [ripples, setRipples] = useState<{ x: number; y: number; size: number; id: number }[]>([]);

  // Tự động dọn rác (xóa sóng) sau khi animation chạy xong để tránh rò rỉ bộ nhớ
  useLayoutEffect(() => {
    let timeout: any;
    if (ripples.length > 0) {
      timeout = setTimeout(() => {
        setRipples([]); 
      }, duration * 2);
    }
    return () => clearTimeout(timeout);
  }, [ripples.length, duration]);

  const addRipple = (e: MouseEvent<HTMLDivElement>) => {
    const container = e.currentTarget.getBoundingClientRect();
    const size = Math.max(container.width, container.height);
    const x = e.clientX - container.left - size / 2;
    const y = e.clientY - container.top - size / 2;

    setRipples((prev) => [...prev, { x, y, size, id: Date.now() }]);
  };

  return (
    // Thẻ div tàng hình này sẽ nằm lót bên dưới nút của bạn
    <div
      className="absolute inset-0 z-0 overflow-hidden"
      style={{ borderRadius: 'inherit' }} // Tự động bo góc theo viền của thẻ cha
      onMouseDown={addRipple}
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            top: ripple.y,
            left: ripple.x,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: color,
            animation: `ripple-spin ${duration}ms linear forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes ripple-spin {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(3); opacity: 0; }
        }
      `}</style>
    </div>
  );
}