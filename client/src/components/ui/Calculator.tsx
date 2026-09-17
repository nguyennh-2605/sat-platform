import React, { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';

interface DesmosCalculatorInstance { resize: () => void; destroy: () => void }
interface DesmosApi { GraphingCalculator: (element: HTMLDivElement, options: Record<string, boolean>) => DesmosCalculatorInstance }

declare global {
  interface Window { Desmos?: DesmosApi }
}

interface CalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

const Calculator: React.FC<CalculatorProps> = ({ isOpen, onClose }) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<HTMLDivElement>(null);
  const calculatorInstance = useRef<DesmosCalculatorInstance | null>(null);
  
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Load and initialize Desmos only when the student opens the calculator.
  useEffect(() => {
    if (!isOpen) return;

    const initialize = () => {
      if (!window.Desmos || !calcRef.current || calculatorInstance.current) return;
      calculatorInstance.current = window.Desmos.GraphingCalculator(calcRef.current, {
        keypad: true,
        expressions: true,
        settingsMenu: false,
        zoomButtons: true,
      });
      window.setTimeout(() => calculatorInstance.current?.resize(), 50);
    };

    if (window.Desmos) {
      initialize();
      return;
    }

    const scriptId = 'desmos-api-script';
    const script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.desmos.com/api/v1.9/calculator.js?apiKey=${import.meta.env.VITE_DESMOS_API}`;
      script.async = true;
      document.body.appendChild(script);
      script.addEventListener('load', initialize, { once: true });
      script.addEventListener('error', () => setLoadError(true), { once: true });
      return;
    }
    script.addEventListener('load', initialize, { once: true });
    script.addEventListener('error', () => setLoadError(true), { once: true });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !calculatorInstance.current) return;
    const timeout = window.setTimeout(() => calculatorInstance.current?.resize(), 50);
    return () => window.clearTimeout(timeout);
  }, [isMaximized, isOpen]);

  useEffect(() => () => {
    calculatorInstance.current?.destroy();
    calculatorInstance.current = null;
  }, []);

  // 3. KHUNG GIAO DIỆN MÁY TÍNH
  const calculatorWindow = (
    <div
      ref={nodeRef}
      className={`bg-white flex flex-col overflow-hidden pointer-events-auto transition-all duration-200 gpu-boost
        ${isMaximized 
          ? 'maximized-calculator shadow-[0_0_50px_rgba(0,0,0,0.5)] z-10000' // Phóng to Full màn
          : 'absolute top-24 right-10 w-[550px] h-[600px] rounded-lg shadow-2xl border border-gray-400 z-9999'
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
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            aria-label={isMaximized ? 'Restore calculator size' : 'Maximize calculator'}
            className="hover:text-blue-300 transition-colors"
          >
            {isMaximized ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v5H3M16 3v5h5M16 21v-5h5M8 21v-5H3"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            )}
          </button>
          
          {/* Nút Đóng */}
          <button type="button" onClick={onClose} aria-label="Close calculator" className="hover:text-red-400 transition-colors font-bold text-lg leading-none cursor-pointer">
            ✕
          </button>
        </div>
      </div>

      {/* RUỘT DESMOS SẼ RENDER VÀO ĐÂY */}
      <div 
        ref={calcRef} 
        className={`flex-1 w-full h-full bg-white ${isDragging ? 'pointer-events-none' : ''}`} 
      >{loadError && <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-600">Calculator could not be loaded. Check your connection and try again.</div>}</div>
    </div>
  );

  // 4. Lớp bọc ngoài cùng: Dùng class hidden như bình thường cho an toàn
  return (
    <div className={`${isOpen ? 'block' : 'hidden'} absolute inset-0 z-9999 pointer-events-none`}>
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
