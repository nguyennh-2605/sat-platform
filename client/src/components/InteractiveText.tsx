import React, { useState, useRef, useEffect } from 'react';
import parse from 'html-react-parser';
import { useQuizTool } from '../context/QuizToolContext';

interface Props {
  content: string;
}

const InteractiveText: React.FC<Props> = ({ content }) => {
  const { isHighlightMode } = useQuizTool();
  const contentRef = useRef<HTMLDivElement>(null);

  // 1. STATE QUẢN LÝ NỘI DUNG HTML
  // Thay vì render trực tiếp props.content, ta lưu nó vào state để update được
  const [htmlContent, setHtmlContent] = useState(content);

  // Khi chuyển sang câu hỏi khác (props.content thay đổi), ta reset lại state
  useEffect(() => {
    setHtmlContent(content);
  }, [content]);

  // State UI
  const [toolbar, setToolbar] = useState<{ x: number; y: number; show: boolean } | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  // ---------------------------------------------
  // XỬ LÝ CLICK VÀO NOTE (EVENT DELEGATION)
  // ---------------------------------------------
  // Vì nội dung HTML được render lại liên tục, ta không gán onclick vào từng thẻ span.
  // Ta bắt sự kiện ở thẻ cha (div) để tối ưu.
  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Kiểm tra xem cái được click có phải là Note không (có class sat-note)
    // Hoặc click vào Highlight thường nếu bạn muốn xử lý xóa
    if (target.classList.contains('sat-note')) {
      const id = target.getAttribute('data-note-id');
      if (id) {
        e.stopPropagation(); // Không để sự kiện lan ra ngoài
        setActiveNoteId(id); // Mở modal note cũ
      }
    }
  };

  // ---------------------------------------------
  // XỬ LÝ BÔI ĐEN
  // ---------------------------------------------
  const handleMouseUp = () => {
    // Nếu Mode TẮT -> Chỉ return, không làm gì (Không hiện Toolbar)
    // Nhưng các highlight cũ VẪN CÒN vì nó nằm trong state htmlContent
    if (!isHighlightMode) {
      setToolbar(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !contentRef.current?.contains(selection.anchorNode)) {
      setToolbar(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    setToolbar({
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY - 10,
      show: true
    });
  };

  // ---------------------------------------------
  // THỰC THI HIGHLIGHT / NOTE
  // ---------------------------------------------
  const applyFormat = (type: 'highlight' | 'note') => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    const noteId = Date.now().toString();

    // Setup Class
    if (type === 'highlight') {
      span.className = "bg-yellow-200 cursor-pointer hover:bg-yellow-300 transition-colors rounded-sm px-0.5 sat-highlight";
    } else {
      span.className = "bg-yellow-100 border-b-2 border-dashed border-yellow-600 cursor-pointer sat-note";
      span.setAttribute('data-note-id', noteId);
    }

    try {
      // 1. Thay đổi DOM thật
      range.surroundContents(span);
      selection.removeAllRanges();
      setToolbar(null);

      // 2. [QUAN TRỌNG NHẤT] CẬP NHẬT LẠI STATE
      // Lấy toàn bộ HTML mới (đã có thẻ span) lưu vào state.
      // Khi React re-render (do tắt mode), nó sẽ dùng cái HTML mới này.
      if (contentRef.current) {
        setHtmlContent(contentRef.current.innerHTML);
      }

      // Xử lý logic Note
      if (type === 'note') {
        setNotes(prev => ({ ...prev, [noteId]: '' }));
        setActiveNoteId(noteId);
      }

    } catch (e) {
      alert("⚠️ Vui lòng chỉ chọn văn bản trong cùng một đoạn.");
      setToolbar(null);
    }
  };

  // Logic con trỏ chuột
  const cursorClass = isHighlightMode ? "cursor-text" : "cursor-default";

  return (
    <div className="relative">
      <div 
        ref={contentRef}
        onMouseUp={handleMouseUp}
        onClick={handleContainerClick} // Bắt sự kiện click vào Note tại đây
        className={`leading-relaxed text-gray-800 select-text ${cursorClass}`}
      >
        {/* Render từ State chứ không phải từ Props gốc */}
        {parse(htmlContent)}
      </div>

      {/* --- TOOLBAR --- */}
      {toolbar?.show && (
        <div 
          className="fixed z-50 flex items-center bg-gray-800 text-white text-xs rounded shadow-xl transform -translate-x-1/2 -translate-y-full py-1 px-1"
          style={{ top: toolbar.y, left: toolbar.x }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button onClick={() => applyFormat('highlight')} className="px-3 py-1 hover:bg-gray-700 rounded font-semibold">Highlight</button>
          <div className="w-[1px] h-4 bg-gray-600 mx-1"></div>
          <button onClick={() => applyFormat('note')} className="px-3 py-1 hover:bg-gray-700 rounded font-semibold">Note</button>
        </div>
      )}

      {/* --- MODAL NOTE --- */}
      {activeNoteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px]" onClick={() => setActiveNoteId(null)}>
          <div className="bg-white p-4 rounded-lg shadow-2xl w-80 border border-gray-200 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">My Note</h3>
              <button onClick={() => setActiveNoteId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <textarea
              className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              rows={4}
              value={notes[activeNoteId] || ''}
              onChange={(e) => setNotes(prev => ({ ...prev, [activeNoteId]: e.target.value }))}
              autoFocus
            />

            <div className="mt-3 flex justify-end">
              <button 
                onClick={() => setActiveNoteId(null)}
                className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveText;