import React, { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';

interface CalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

const Calculator: React.FC<CalculatorProps> = ({ isOpen, onClose }) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<HTMLDivElement>(null);
  const calculatorInstance = useRef<any>(null);
  
  const [isMaximized, setIsMaximized] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 1. BƯỚC 1: Chỉ tải script ngầm, tuyệt đối chưa khởi tạo Desmos
  useEffect(() => {
    if ((window as any).Desmos) {
      setIsScriptLoaded(true);
      return;
    }

    const scriptId = 'desmos-api-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.desmos.com/api/v1.9/calculator.js?apiKey=${import.meta.env.VITE_DESMOS_API}`;
      script.async = true;
      script.onload = () => setIsScriptLoaded(true); // Đánh dấu là đã tải xong
      document.body.appendChild(script);
    }
  }, []);

  // 2. BƯỚC 2: Chỉ khởi tạo khi Cửa sổ được MỞ LẦN ĐẦU TIÊN
  useEffect(() => {
    // Nếu script đã tải + cửa sổ ĐANG MỞ + chưa khởi tạo lần nào
    if (isOpen && isScriptLoaded && calcRef.current && !calculatorInstance.current) {
      calculatorInstance.current = (window as any).Desmos.GraphingCalculator(calcRef.current, {
        keypad: true,
        expressions: true,
        settingsMenu: false, // Tắt menu cài đặt thừa
        zoomButtons: true,   // Nút + - của đồ thị
      });
    }

    // Nếu đã khởi tạo rồi, mỗi lần Mở lại hoặc Phóng to/Thu nhỏ -> Ép resize lại để tránh lỗi trắng màn
    if (isOpen && calculatorInstance.current) {
      setTimeout(() => {
        calculatorInstance.current.resize();
      }, 50); // Chờ 50ms cho CSS bung ra hết rồi mới resize
    }
  }, [isOpen, isScriptLoaded, isMaximized]); // Bắt sự kiện Mở và Phóng to

  // 3. KHUNG GIAO DIỆN MÁY TÍNH
  const calculatorWindow = (
    <div
      ref={nodeRef}
      className={`bg-white flex flex-col overflow-hidden pointer-events-auto transition-all duration-200 gpu-boost
        ${isMaximized 
          ? 'maximized-calculator shadow-[0_0_50px_rgba(0,0,0,0.5)] z-[10000]' // Phóng to Full màn
          : 'absolute top-24 right-10 w-[550px] h-[600px] rounded-lg shadow-2xl border border-gray-400 z-[9999]'
        }
      `}
    >
      <style>{`
        .maximized-calculator {
          position: absolute !important;
          top: 16px !important;
          left: 16px !important;
          width: calc(100% - 32px) !important;
          height: calc(100% - 32px) !important;
          transform: none !important; 
          border-radius: 12px !important;
          margin: 0 !important;
        }
        .gpu-boost {
          will-change: transform;
          transform: translateZ(0); 
        }
      `}</style>
      {/* THANH HEADER (Giống hệt SAT Bluebook) */}
      <div className="drag-header flex justify-between items-center px-4 py-2 bg-[#2d3e50] text-white select-none cursor-move">
        <div className="flex items-center gap-2">
           <span className="text-gray-400">⋮⋮</span>
           <span className="font-bold text-[15px]">Calculator</span>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Nút Phóng to / Thu nhỏ */}
          <button 
            onClick={() => setIsMaximized(!isMaximized)}
            className="hover:text-blue-300 transition-colors"
          >
            {isMaximized ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v5H3M16 3v5h5M16 21v-5h5M8 21v-5H3"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            )}
          </button>
          
          {/* Nút Đóng */}
          <button onClick={onClose} className="hover:text-red-400 transition-colors font-bold text-lg leading-none cursor-pointer">
            ✕
          </button>
        </div>
      </div>

      {/* RUỘT DESMOS SẼ RENDER VÀO ĐÂY */}
      <div 
        ref={calcRef} 
        className={`flex-1 w-full h-full bg-white ${isDragging ? 'pointer-events-none' : ''}`} 
      />
    </div>
  );

  // 4. Lớp bọc ngoài cùng: Dùng class hidden như bình thường cho an toàn
  return (
    <div className={`${isOpen ? 'block' : 'hidden'} absolute inset-0 z-[9999] pointer-events-none`}>
      <Draggable 
        nodeRef={nodeRef} 
        handle=".drag-header" 
        bounds="parent"
        disabled={isMaximized} // Khóa chức năng kéo thả khi đang phóng to
        onStart={() => setIsDragging(true)} // Khi bắt đầu kéo
        onStop={() => setIsDragging(false)}  // Khi thả tay
      >
        {calculatorWindow}
      </Draggable>
    </div>
  );
};

export default React.memo(Calculator);