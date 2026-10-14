import React, { useState, useRef, useEffect, useContext } from 'react';
import parse from 'html-react-parser';
import { useQuizTool } from '../../context/quiz-tool-context';
import toast from 'react-hot-toast';
import FormattedTextRenderer from '../../components/content/TextRenderer';
import ReadingText from '../../components/content/ReadingText';
import { readingTextToHtml } from '../../components/content/readingTextFormat';
import { DictionaryContext } from '../dictionary/dictionary-context';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/AppUI';
import { Textarea } from '@/components/ui/textarea';
import { Search, Trash2 } from 'lucide-react';

interface Props {
  content: string;
  isMath?: boolean;
  readOnly?: boolean;
  inheritTypography?: boolean;
  annotationKey?: string;
}

const contentHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const annotationStorageKey = (content: string, key?: string) => (
  `exam-annotation:${window.location.pathname}${window.location.search}:${key || contentHash(content)}`
);

const readAnnotation = (content: string, key?: string) => {
  try {
    const stored = sessionStorage.getItem(annotationStorageKey(content, key));
    if (!stored) return { htmlContent: readingTextToHtml(content), notes: {} as Record<string, string> };
    const parsed = JSON.parse(stored) as { htmlContent?: string; notes?: Record<string, string> };
    return { htmlContent: parsed.htmlContent || readingTextToHtml(content), notes: parsed.notes || {} };
  } catch {
    return { htmlContent: readingTextToHtml(content), notes: {} as Record<string, string> };
  }
};

const InteractiveTextContent: React.FC<Props> = ({ content, isMath = false, readOnly = false, inheritTypography = false, annotationKey }) => {
  const { isHighlightMode } = useQuizTool();
  const dictionary = useContext(DictionaryContext);
  const contentRef = useRef<HTMLDivElement>(null);
  const initialAnnotation = readAnnotation(content, annotationKey);

  // 1. STATE QUẢN LÝ
  const [htmlContent, setHtmlContent] = useState(initialAnnotation.htmlContent);
  const [notes, setNotes] = useState<Record<string, string>>(initialAnnotation.notes);
  const [renderKey, setRenderKey] = useState(0);
  
  // UI States
  const [toolbar, setToolbar] = useState<{ x: number; y: number; show: boolean } | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const persistAnnotation = (nextHtml: string, nextNotes: Record<string, string>) => {
    sessionStorage.setItem(annotationStorageKey(content, annotationKey), JSON.stringify({ htmlContent: nextHtml, notes: nextNotes }));
  };

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
      persistAnnotation(newHtml, notes);
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
        toast.error("Do not highlight across multiple paragraphs.");
        setToolbar(null);
        return;
      }
    }

    const span = document.createElement('span');
    const noteId = Date.now().toString();

    // Áp dụng CSS tùy theo công cụ được chọn
    if (type === 'highlight') {
      span.className = `${colorClass} cursor-pointer rounded-[2px] px-px sat-highlight transition-colors`;
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
        setNotes(prev => {
          const next = { ...prev, [noteId]: '' };
          persistAnnotation(contentRef.current?.innerHTML || htmlContent, next);
          return next;
        });
        setActiveNoteId(noteId);
      }
    } catch (e) {
      console.error("Highlight Error:", e);
      toast.error("This area cannot be highlighted because its HTML structure is too complex.");
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
      persistAnnotation(tempDiv.innerHTML, newNotes);
    }
    setActiveNoteId(null);
  };

  if (isMath) return <FormattedTextRenderer text={content} inheritTypography={inheritTypography} latexOnly />;
  
  if (readOnly) {
    return (
      <div data-dictionary-text className={`whitespace-pre-wrap select-text text-inherit ${inheritTypography ? '' : 'text-[16px] leading-relaxed'}`}>
        <ReadingText content={content} />
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
        data-dictionary-text
        data-dictionary-annotations="true"
        onMouseUp={handleMouseUp}
        onClick={handleContainerClick}
        className={`${inheritTypography ? '' : 'text-[16px] leading-relaxed'} whitespace-pre-wrap select-text text-inherit ${cursorClass}`}
      >
        {parse(htmlContent)}
      </div>

      {/* --- TOOLBAR MỚI (THIẾT KẾ DẠNG PILL THEO ẢNH 2) --- */}
      {toolbar?.show && (
        <div 
          className="fixed z-50 flex items-center bg-white rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-gray-200 p-1.5 gap-2 transform -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-95 duration-150"
          style={{ top: toolbar.y, left: toolbar.x }}
          onMouseDown={(e) => e.preventDefault()} // Ngăn mất focus làm mất selection
        >
          {dictionary?.selectedWord && <Button variant="ghost" size="sm" onClick={() => { dictionary.lookUp(); setToolbar(null); }}><Search aria-hidden="true" />Look up</Button>}
          {/* Nút Vàng */}
          <button 
            onClick={() => applyFormat('highlight', 'bg-[rgba(253,224,71,0.6)]')} // Vàng
            className="w-6 h-6 rounded-full bg-[#fce074] border-2 border-gray-800 hover:scale-110 transition-transform shadow-xs shrink-0"
            title="Highlight yellow"
            aria-label="Highlight yellow"
          />
          {/* Nút Xanh */}
          <button 
            onClick={() => applyFormat('highlight', 'bg-[rgba(147,197,253,0.6)]')} // Xanh blue
            className="w-6 h-6 rounded-full bg-[#bde0fe] border border-transparent hover:border-gray-400 hover:scale-110 transition-all shadow-xs shrink-0"
            title="Highlight blue"
            aria-label="Highlight blue"
          />
          {/* Nút Hồng */}
          <button 
            onClick={() => applyFormat('highlight', 'bg-[rgba(249,168,212,0.6)]')} // Hồng pink
            className="w-6 h-6 rounded-full bg-[#ffc8dd] border border-transparent hover:border-gray-400 hover:scale-110 transition-all shadow-xs shrink-0"
            title="Highlight pink"
            aria-label="Highlight pink"
          />

          <div className="w-px h-5 bg-gray-300 mx-0.5"></div>

          {/* Nút Gạch Chân (Underline) */}
          <button 
            onClick={() => applyFormat('underline')} 
            className="w-7 h-7 rounded-full flex items-center border-2 border-slate-200 justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            title="Underline"
            aria-label="Underline"
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
            title="Add note"
            aria-label="Add note"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
            </svg>
          </button>

          <div className="w-px h-5 bg-gray-300 mx-0.5"></div>

          {/* Nút Xóa (Remove) */}
          <button 
            onClick={handleRemoveHighlight} 
            className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-slate-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            title="Remove formatting"
            aria-label="Remove formatting"
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

      {activeNoteId && (
        <Modal open title="Note" presentation="content-dialog" className="max-w-sm!" initialFocusRef={noteInputRef} onClose={() => setActiveNoteId(null)} footer={<>
          <Button variant="ghost" size="icon" className="mr-auto text-destructive" onClick={deleteActiveNote} aria-label="Delete note"><Trash2 /></Button>
          <Button variant="outline" onClick={() => setActiveNoteId(null)}>Cancel</Button>
          <Button onClick={() => setActiveNoteId(null)}>Save</Button>
        </>}>
          <Textarea ref={noteInputRef} aria-label="Note" rows={4} placeholder="Write a note…" value={notes[activeNoteId] || ''} onChange={event => setNotes(previous => {
            const next = { ...previous, [activeNoteId]: event.target.value };
            persistAnnotation(htmlContent, next);
            return next;
          })} />
        </Modal>
      )}
    </div>
  );
};

const InteractiveText: React.FC<Props> = props => (
  <InteractiveTextContent key={`${props.annotationKey || contentHash(props.content)}-${props.isMath ? 'math' : 'text'}`} {...props} />
);

export default InteractiveText;
