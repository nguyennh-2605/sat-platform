import React, { useState, useRef, useEffect } from 'react';
import parse from 'html-react-parser';
import { useQuizTool } from '../context/QuizToolContext';
import toast from 'react-hot-toast';
import FormattedTextRenderer from '../utlis/TextRenderer'; // Nhớ sửa lại đường dẫn nếu cần

interface Props {
  content: string;
  isMath?: boolean;
  readOnly?: boolean;
}

const InteractiveText: React.FC<Props> = ({ content, isMath = false, readOnly = false }) => {
  const { isHighlightMode } = useQuizTool();
  const contentRef = useRef<HTMLDivElement>(null);

  // 1. STATE QUẢN LÝ
  const [htmlContent, setHtmlContent] = useState(content);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [renderKey, setRenderKey] = useState(0);
  
  // UI States
  const [toolbar, setToolbar] = useState<{ x: number; y: number; show: boolean } | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // 2. RESET KHI CHUYỂN CÂU HỎI
  useEffect(() => {
    setHtmlContent(content);
    setNotes({});
    setToolbar(null);
    setActiveNoteId(null);
  }, [content]);

  // --- FIX LỖI "NHIỀU MODAL": Tự động ẩn toolbar nếu mất vùng chọn hoặc chọn chỗ khác ---
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      // Nếu không có vùng chọn, hoặc vùng chọn biến mất, hoặc vùng chọn KHÔNG nằm trong component này -> Tắt toolbar
      if (!selection || selection.isCollapsed || !contentRef.current?.contains(selection.anchorNode)) {
        setToolbar(null);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // 3. HÀM ĐỒNG BỘ DOM -> REACT STATE
  const syncDomToState = () => {
    if (contentRef.current) {
      const newHtml = contentRef.current.innerHTML;
      setHtmlContent(newHtml);
      setRenderKey(prev => prev + 1);
    }
  };

  // 4. XỬ LÝ CLICK VÀO CÁC NOTE / HIGHLIGHT CŨ
  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('sat-note')) {
      e.stopPropagation();
      const id = target.getAttribute('data-note-id');
      if (id) setActiveNoteId(id);
      setToolbar(null); 
      return;
    }
    if (target.classList.contains('sat-highlight')) {
      setToolbar(null);
    }
  };

  // 5. HIỆN TOOLBAR KHI BÔI ĐEN XONG
  const handleMouseUp = () => {
    if (!isHighlightMode) {
      setToolbar(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !contentRef.current?.contains(selection.anchorNode)) {
      setToolbar(null);
      return;
    }

    // Lấy vị trí để hiện toolbar (căn giữa vùng bôi đen, đẩy lên trên một chút)
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    setToolbar({
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY - 15, // Đẩy lên cao hơn chút cho đẹp
      show: true
    });
  };

  // 6. THỰC THI HIGHLIGHT / NOTE / UNDERLINE (HỖ TRỢ NHIỀU MÀU)
  const applyFormat = (
    type: 'highlight' | 'note' | 'underline', 
    colorClass: string = 'bg-[rgba(253,224,71,0.5)]' // Mặc định Vàng nhạt
  ) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    
    // Chặn highlight qua các thẻ Block
    if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
      const walker = document.createTreeWalker(range.cloneContents(), NodeFilter.SHOW_ELEMENT, null);
      let hasBlock = false;
      while(walker.nextNode()) {
        const node = walker.currentNode as HTMLElement;
        const display = window.getComputedStyle(node).display;
        if (display === 'block' || node.tagName === 'P' || node.tagName === 'DIV') {
          hasBlock = true; 
          break;
        }
      }
      if (hasBlock) {
        toast.error("Vui lòng không highlight qua nhiều đoạn văn (xuống dòng).");
        setToolbar(null);
        return;
      }
    }

    const span = document.createElement('span');
    const noteId = Date.now().toString();

    // Áp dụng CSS tùy theo công cụ được chọn
    if (type === 'highlight') {
      span.className = `${colorClass} cursor-pointer rounded-[2px] px-[1px] sat-highlight transition-colors`;
    } else if (type === 'underline') {
      span.className = `underline decoration-2 underline-offset-4 cursor-pointer sat-highlight`;
    } else if (type === 'note') {
      span.className = "bg-yellow-100/70 border-b-2 border-dashed border-yellow-600 cursor-pointer sat-note sat-highlight";
      span.setAttribute('data-note-id', noteId);
    }

    try {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
      selection.removeAllRanges();
      setToolbar(null);
      
      syncDomToState();

      if (type === 'note') {
        setNotes(prev => ({ ...prev, [noteId]: '' }));
        setActiveNoteId(noteId);
      }
    } catch (e) {
      console.error("Highlight Error:", e);
      toast.error("Không thể highlight vùng này do cấu trúc HTML quá phức tạp.");
      setToolbar(null);
    }
  };

  // 7. XÓA HIGHLIGHT (Giữ nguyên logic cực kỳ chuẩn của bạn)
  const handleRemoveHighlight = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    let hasRemoved = false;

    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE && container.parentElement) {
      container = container.parentElement;
    }
    
    if ((container as HTMLElement).classList?.contains('sat-highlight')) {
       const span = container as HTMLElement;
       const parent = span.parentNode;
       if (parent) {
         while (span.firstChild) parent.insertBefore(span.firstChild, span);
         parent.removeChild(span);
         hasRemoved = true;
       }
    }

    if (contentRef.current) {
        const highlights = contentRef.current.querySelectorAll('.sat-highlight');
        highlights.forEach((span) => {
            if (selection.containsNode(span, true)) {
                const parent = span.parentNode;
                if (parent) {
                    while (span.firstChild) parent.insertBefore(span.firstChild, span);
                    parent.removeChild(span);
                    hasRemoved = true;
                }
            }
        });
    }

    if (hasRemoved) {
        selection.removeAllRanges();
        setToolbar(null);
        syncDomToState();
    } else {
        toast.error("Vùng chọn không chứa Highlight nào để xóa.");
        setToolbar(null);
    }
  };

  // 8. XÓA NOTE
  const deleteActiveNote = () => {
    if (!activeNoteId) return;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent; 
    const noteToDelete = tempDiv.querySelector(`span[data-note-id="${activeNoteId}"]`);

    if (noteToDelete) {
      const parent = noteToDelete.parentNode;
      if (parent) {
        while (noteToDelete.firstChild) parent.insertBefore(noteToDelete.firstChild, noteToDelete);
        parent.removeChild(noteToDelete);
      }
      setHtmlContent(tempDiv.innerHTML);
      const newNotes = { ...notes };
      delete newNotes[activeNoteId];
      setNotes(newNotes);
    }
    setActiveNoteId(null);
  };

  // 9. XỬ LÝ CÚ PHÁP ==gạch chân== TỪ DỮ LIỆU ĐỀ BÀI
  const processUnderline = (text: string) => {
    if (!text) return "";
    return text.replace(/==([^=]+)==/g, '<u>$1</u>');
  };

  if (isMath) return <FormattedTextRenderer text={content} />;
  
  if (readOnly) {
    return (
      <div className="leading-relaxed text-gray-800 text-[16px]">
        {parse(processUnderline(content))}
      </div>
    );
  }

  const cursorClass = isHighlightMode ? "cursor-text" : "cursor-default";

  return (
    <div className="relative group">
      {/* VÙNG CHỨA NỘI DUNG */}
      <div 
        key={renderKey}
        ref={contentRef}
        onMouseUp={handleMouseUp}
        onClick={handleContainerClick}
        className={`leading-relaxed text-gray-800 select-text text-[16px] ${cursorClass}`}
      >
        {parse(processUnderline(htmlContent))}
      </div>

      {/* --- TOOLBAR MỚI (THIẾT KẾ DẠNG PILL THEO ẢNH 2) --- */}
      {toolbar?.show && (
        <div 
          className="fixed z-50 flex items-center bg-white rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-gray-200 p-1.5 gap-2 transform -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-95 duration-150"
          style={{ top: toolbar.y, left: toolbar.x }}
          onMouseDown={(e) => e.preventDefault()} // Ngăn mất focus làm mất selection
        >
          {/* Nút Vàng */}
          <button 
            onClick={() => applyFormat('highlight', 'bg-[rgba(253,224,71,0.6)]')} // Vàng
            className="w-6 h-6 rounded-full bg-[#fce074] border-[2px] border-gray-800 hover:scale-110 transition-transform shadow-sm flex-shrink-0"
            title="Highlight Vàng"
          />
          {/* Nút Xanh */}
          <button 
            onClick={() => applyFormat('highlight', 'bg-[rgba(147,197,253,0.6)]')} // Xanh blue
            className="w-6 h-6 rounded-full bg-[#bde0fe] border border-transparent hover:border-gray-400 hover:scale-110 transition-all shadow-sm flex-shrink-0"
            title="Highlight Xanh"
          />
          {/* Nút Hồng */}
          <button 
            onClick={() => applyFormat('highlight', 'bg-[rgba(249,168,212,0.6)]')} // Hồng pink
            className="w-6 h-6 rounded-full bg-[#ffc8dd] border border-transparent hover:border-gray-400 hover:scale-110 transition-all shadow-sm flex-shrink-0"
            title="Highlight Hồng"
          />

          <div className="w-[1px] h-5 bg-gray-300 mx-0.5"></div>

          {/* Nút Gạch Chân (Underline) */}
          <button 
            onClick={() => applyFormat('underline')} 
            className="w-7 h-7 rounded-full flex items-center border-2 border-slate-200 justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            title="Gạch chân"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4v6a6 6 0 0 0 12 0V4"></path>
              <line x1="4" y1="20" x2="20" y2="20"></line>
            </svg>
          </button>

          {/* Nút Thêm Note */}
          <button 
            onClick={() => applyFormat('note')} 
            className="w-7 h-7 rounded-full flex items-center border-2 border-slate-200 justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            title="Thêm Ghi Chú"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
            </svg>
          </button>

          <div className="w-[1px] h-5 bg-gray-300 mx-0.5"></div>

          {/* Nút Xóa (Remove) */}
          <button 
            onClick={handleRemoveHighlight} 
            className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-slate-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            title="Xóa định dạng"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      )}

      {/* --- MODAL EDIT NOTE (Giữ nguyên) --- */}
      {activeNoteId && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/5" 
          onClick={() => setActiveNoteId(null)}
        >
          <div 
            className="bg-white p-5 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] w-[360px] border border-gray-200 animate-in zoom-in-95 duration-200 font-sans" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <h3 className="font-semibold text-[16px] tracking-tight">
                  Ghi chú
                </h3>
              </div>
              
              {/* Nút Xóa (Dạng Icon tinh tế) */}
              <button 
                onClick={deleteActiveNote} 
                className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-all duration-200"
                title="Xóa ghi chú này"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
              </button>
            </div>
            
            {/* Textarea */}
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3.5 text-[15px] text-gray-800 leading-relaxed focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none bg-gray-50/50 hover:bg-white transition-all placeholder:text-gray-400"
              rows={4}
              placeholder="Nhập nội dung ghi chú..."
              value={notes[activeNoteId] || ''}
              onChange={(e) => setNotes(prev => ({ ...prev, [activeNoteId]: e.target.value }))}
              autoFocus
            />

            {/* Footer Buttons */}
            <div className="mt-5 flex justify-end gap-2.5">
              <button 
                onClick={() => setActiveNoteId(null)}
                className="px-4 py-2 text-[14px] font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-800 rounded-full transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={() => setActiveNoteId(null)}
                className="px-5 py-2 text-[14px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-sm transition-colors"
              >
                Lưu lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveText;