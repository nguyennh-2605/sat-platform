import { type RefObject } from "react";

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  leftWidth: number
  handleMouseDown: (e: React.MouseEvent) => void;
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
}

const ResizableSplitLayout = ({ containerRef, leftWidth, handleMouseDown, leftContent, rightContent }: Props) => {
  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden w-full h-full relative">
            
      {/* --- CỘT TRÁI (BÀI ĐỌC) --- */}
      {/* Thay w-1/2 bằng style width động */}
      <div 
        style={{ width: `${leftWidth}%` }} 
        className="h-full bg-white border-r border-gray-200 flex flex-col min-w-[200px]"
      >
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 md:px-8 md:py-8">
          <div className="
            font-['Source_Serif_4',_'Georgia',_serif] lining-nums tabular-nums
            font-normal text-[#1a1a1a] leading-relaxed tracking-normal
            text-[16px]           /* Set cho h3 */
            [&_*]:text-[16px]     /* ÉP BUỘC các thẻ con bên trong cũng phải 13px */
            [&_p]:text-[16px]     /* Cẩn thận hơn: Ép thẻ p bên trong (nếu có) */
          ">
            {leftContent}
            <div className="h-40 w-full shrink-0"></div>
          </div>
        </div>
      </div>

      {/* --- THANH KÉO (RESIZER) --- */}
      <div
        onMouseDown={handleMouseDown}
        className="
          w-6 -ml-3 h-full cursor-col-resize 
          flex justify-center items-center 
          absolute z-20 transition-colors
          
          /* Hiệu ứng khi di chuột vào vùng kéo: Xanh nhạt */
          hover:bg-blue-500/10 
          active:bg-blue-500/20
        "
        style={{ left: `${leftWidth}%` }}
      >
        {/* 1. Đường kẻ dọc chạy suốt chiều cao (Divider Line) */}
        <div className="w-[2px] h-full bg-gray-500 group-hover:bg-blue-200/50 absolute"></div>
      </div>

      {/* --- CỘT PHẢI (CÂU HỎI) --- */}
      {/* Chiếm phần còn lại (flex-1) */}
      <div className="flex-1 h-full bg-white flex flex-col min-w-[300px] overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {rightContent}
          <div className="h-40 w-full shrink-0"></div>
        </div>
      </div>

    </div>
  );
};

export default ResizableSplitLayout;