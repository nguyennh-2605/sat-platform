import { useState, useLayoutEffect, type MouseEvent, memo } from 'react';

interface RippleProps {
  color?: string;
  duration?: number;
}

// Bọc toàn bộ component vào memo()
const Ripple = memo(function Ripple({ 
  color = 'rgba(148, 163, 184, 0.3)', 
  duration = 600 
}: RippleProps) {
  
  const [ripples, setRipples] = useState<{ x: number; y: number; size: number; id: number }[]>([]);

  // Tự động dọn rác cực kỳ an toàn
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
    
    // Tính toán tọa độ chính xác để tâm sóng nằm đúng mũi tên chuột
    const x = e.clientX - container.left - size / 2;
    const y = e.clientY - container.top - size / 2;

    setRipples((prev) => [...prev, { x, y, size, id: Date.now() }]);
  };

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden"
      style={{ borderRadius: 'inherit' }} 
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
            animation: `ripple-spin ${duration}ms ease-out forwards`, // Đổi sang ease-out cho mượt
          }}
        />
      ))}
      <style>{`
        @keyframes ripple-spin {
          0% { transform: scale(0); opacity: 0.5; }
          100% { transform: scale(4); opacity: 0; }
        }
      `}</style>
    </div>
  );
});

export default Ripple;