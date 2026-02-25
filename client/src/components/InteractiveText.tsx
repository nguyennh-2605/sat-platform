import React, { useState, useRef, useEffect } from 'react';
import parse from 'html-react-parser';
import { useQuizTool } from '../context/QuizToolContext';
import toast from 'react-hot-toast';
import FormattedTextRenderer from '../utlis/TextRenderer';

interface Props {
  content: string;
  isMath?: boolean;
}

const InteractiveText: React.FC<Props> = ({ content, isMath = false }) => {
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
    setNotes({}); // Reset notes của câu cũ
    setToolbar(null);
    setActiveNoteId(null);
  }, [content]);

  // 3. HÀM ĐỒNG BỘ DOM -> REACT STATE (FIX LỖI GHOST TEXT)
  // Hàm này lấy innerHTML hiện tại sau khi đã chèn span để cập nhật lại React
  const syncDomToState = () => {
    if (contentRef.current) {
      const newHtml = contentRef.current.innerHTML;
      console.log("HTML SẮP LƯU VÀO STATE:", newHtml);
      setHtmlContent(newHtml);
      // báo hiệu React: "DOM bẩn rồi, vẽ lại cái mới đi"
      setRenderKey(prev => prev + 1);
    }
  };

  // 4. XỬ LÝ CLICK (DELEGATION)
  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // A. Nếu click vào Note đã tồn tại
    if (target.classList.contains('sat-note')) {
      e.stopPropagation();
      const id = target.getAttribute('data-note-id');
      if (id) setActiveNoteId(id);
      setToolbar(null); // Tắt toolbar nếu đang hiện
      return;
    }

    // B. Nếu click vào Highlight thường -> Có thể mở menu để xóa (Tùy chọn)
    if (target.classList.contains('sat-highlight')) {
        // Logic xóa highlight nếu cần (ví dụ: click đúp hoặc menu chuột phải)
        // Hiện tại chỉ tắt toolbar để tránh rối
        setToolbar(null);
    }
  };

  // 5. HIỆN TOOLBAR KHI BÔI ĐEN
  const handleMouseUp = () => {
    if (!isHighlightMode) {
        setToolbar(null);
        return;
    }

    const selection = window.getSelection();
    
    // Kiểm tra kỹ: Có selection không? Có đang bôi đen text không? Có nằm trong vùng content không?
    if (!selection || selection.isCollapsed || !contentRef.current?.contains(selection.anchorNode)) {
      setToolbar(null);
      return;
    }

    // Lấy vị trí để hiện toolbar
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    setToolbar({
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY - 10,
      show: true
    });
  };

// ---------------------------------------------
  // THỰC THI HIGHLIGHT / NOTE (FIXED)
  // ---------------------------------------------
  const applyFormat = (type: 'highlight' | 'note') => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    
    // 1. CHẶN LỖI: Không cho phép highlight qua các thẻ Block (div, p, h1...)
    // Vì thẻ span (inline) không được chứa thẻ p (block) -> Sẽ vỡ layout
    const commonAncestor = range.commonAncestorContainer;
    if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
        // Kiểm tra nếu vùng chọn bao trùm cả một thẻ block
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

    // 2. TẠO THẺ SPAN
    const span = document.createElement('span');
    const noteId = Date.now().toString();

    if (type === 'highlight') {
      span.className = "bg-yellow-200 cursor-pointer hover:bg-yellow-300 transition-colors rounded-sm px-0.5 sat-highlight";
    } else {
      span.className = "bg-yellow-100 border-b-2 border-dashed border-yellow-600 cursor-pointer sat-note";
      span.setAttribute('data-note-id', noteId);
    }

    try {
      // Thay vì bao bọc (surround), ta "nhổ" (extract) nội dung ra.
      // Hàm này tự động đóng/mở lại các thẻ bị cắt ngang (ví dụ: <b>Hel</b> -> <b>Hel</b> và <b>lo</b>)
      const fragment = range.extractContents();
      // Nhét đoạn vừa nhổ vào thẻ span của mình
      span.appendChild(fragment);
      // Chèn thẻ span trở lại vị trí cũ
      range.insertNode(span);
      // Xóa vùng chọn để nhìn cho đỡ rối
      selection.removeAllRanges();
      setToolbar(null);
      // 3. CẬP NHẬT STATE
      // Lúc này DOM đã chuẩn, sync lại state để React không vẽ sai
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

  // 8. XỬ LÝ XÓA HIGHLIGHT
  const handleRemoveHighlight = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    let hasRemoved = false;

    // A. TRƯỜNG HỢP 1: Con trỏ đang nằm LỌT THỎM bên trong 1 highlight
    // (Ví dụ: bôi đen một chữ trong đoạn đã highlight)
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE && container.parentElement) {
      container = container.parentElement;
    }
    
    if ((container as HTMLElement).classList?.contains('sat-highlight')) {
       const span = container as HTMLElement;
       // Unwrap
       const parent = span.parentNode;
       if (parent) {
         while (span.firstChild) parent.insertBefore(span.firstChild, span);
         parent.removeChild(span);
         hasRemoved = true;
       }
    }

    // B. TRƯỜNG HỢP 2: Vùng bôi đen QUÉT QUA nhiều highlight khác
    // (Ví dụ: bôi đen đè lên một đoạn highlight cũ)
    if (contentRef.current) {
        const highlights = contentRef.current.querySelectorAll('.sat-highlight');
        highlights.forEach((span) => {
            // Kiểm tra giao nhau: Nếu vùng chọn chứa highlight HOẶC highlight nằm trong vùng chọn
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
        syncDomToState(); // Quan trọng: Sync để React vẽ lại
    } else {
        toast.error("Vùng chọn không chứa Highlight nào để xóa.");
        setToolbar(null);
    }
  };

  // 7. XÓA NOTE / HIGHLIGHT
  const deleteActiveNote = () => {
    if (!activeNoteId) return;
    // 1. Tạo một thẻ div tạm trong bộ nhớ (không gắn vào trang web)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent; // Lấy HTML từ State hiện tại

    // 2. Tìm note cần xóa trong div tạm đó
    const noteToDelete = tempDiv.querySelector(`span[data-note-id="${activeNoteId}"]`);

    if (noteToDelete) {
      // 3. Unwrap: Lấy nội dung bên trong span ra, rồi xóa vỏ span đi
      // (Kỹ thuật này giữ lại text, chỉ bỏ highlight)
      const parent = noteToDelete.parentNode;
      if (parent) {
        while (noteToDelete.firstChild) {
          parent.insertBefore(noteToDelete.firstChild, noteToDelete);
        }
        parent.removeChild(noteToDelete);
      }

      // 4. Cập nhật lại State HTML (React sẽ tự động vẽ lại UI an toàn)
      setHtmlContent(tempDiv.innerHTML);

      // 5. Xóa dữ liệu ghi chú trong state notes
      const newNotes = { ...notes };
      delete newNotes[activeNoteId];
      setNotes(newNotes);
    }
    // 6. Đóng modal
    setActiveNoteId(null);
  };

  if (isMath) {
    return <FormattedTextRenderer text={content} />;
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
        className={`leading-relaxed text-gray-800 select-text text-lg ${cursorClass}`}
      >
        {/* Sử dụng html-react-parser để render chuỗi HTML an toàn */}
        {parse(htmlContent)}
      </div>

      {/* --- TOOLBAR (Popup nhỏ khi bôi đen) --- */}
      {toolbar?.show && (
        <div 
          className="fixed z-50 flex items-center bg-gray-900 text-white text-xs rounded shadow-xl transform -translate-x-1/2 -translate-y-full py-1.5 px-2 gap-2 animate-in fade-in zoom-in duration-150"
          style={{ top: toolbar.y, left: toolbar.x }}
          onMouseDown={(e) => e.preventDefault()} // Ngăn mất focus làm mất selection
        >
          <button onClick={() => applyFormat('highlight')} className="hover:text-yellow-300 font-semibold flex items-center gap-1">
             Highlight
          </button>
          <div className="w-[1px] h-3 bg-gray-600"></div>
          <button onClick={() => applyFormat('note')} className="hover:text-yellow-300 font-semibold flex items-center gap-1">
             Add Note
          </button>

          <div className="w-[1px] h-4 bg-gray-600"></div>

          {/* NÚT XÓA HIGHLIGHT */}
          <button 
            onClick={handleRemoveHighlight} 
            className="hover:text-red-400 font-semibold flex items-center gap-1 transition-colors group"
            title="Xóa highlight trong vùng chọn"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
             </svg>
             Remove
          </button>
        </div>
      )}

      {/* --- MODAL EDIT NOTE --- */}
      {activeNoteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20" onClick={() => setActiveNoteId(null)}>
          <div 
            className="bg-white p-4 rounded-xl shadow-2xl w-80 border border-gray-200 animate-in zoom-in-95 duration-200" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
                📝 Ghi chú của bạn
              </h3>
              <button onClick={deleteActiveNote} className="text-red-500 text-xs hover:bg-red-50 px-2 py-1 rounded font-medium">
                Xóa Note
              </button>
            </div>
            
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-gray-50 text-gray-800"
              rows={4}
              placeholder="Nhập ghi chú tại đây..."
              value={notes[activeNoteId] || ''}
              onChange={(e) => setNotes(prev => ({ ...prev, [activeNoteId]: e.target.value }))}
              autoFocus
            />

            <div className="mt-3 flex justify-end gap-2">
                <button 
                onClick={() => setActiveNoteId(null)}
                className="px-3 py-1.5 text-gray-600 text-xs font-semibold hover:bg-gray-100 rounded-lg"
              >
                Đóng
              </button>
              <button 
                onClick={() => setActiveNoteId(null)}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-sm"
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