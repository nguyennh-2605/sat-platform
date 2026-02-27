import React, { useState, useRef, useEffect } from 'react';
import { type QuestionResult } from '../ScoreReport';
import BlockRenderer from './BlockRenderer';
import type { ContentBlock } from '../types/quiz';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface ReviewModalProps {
  data: QuestionResult;
  onClose: () => void;
  examTitle?: string;
  examSubject: string;
}

// Kiểu dữ liệu cho tin nhắn Chat
interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

const TypewriterMarkdown = ({ content, onTyping }: { content: string, onTyping?: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    // Nếu chữ trên màn hình vẫn ngắn hơn tổng số chữ AI đã gửi về kho
    if (displayedText.length < content.length) {
      const timeout = setTimeout(() => {
        // Bắt đầu nhả chữ.
        // Mẹo: Nếu mạng tải chữ về quá nhanh (kho dồn nhiều), ta cho gõ 2-3 chữ/lần để đuổi kịp
        const diff = content.length - displayedText.length;
        const charsToAdd = diff > 50 ? 3 : 1; 
        setDisplayedText(content.slice(0, displayedText.length + charsToAdd));
        if (onTyping) onTyping();
      }, 40); // Tốc độ gõ

      return () => clearTimeout(timeout);
    }
  }, [content, displayedText, onTyping]);

  return (
    <div className="markdown-content prose prose-sm max-w-none prose-table:border-collapse">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {displayedText}
      </ReactMarkdown>
    </div>
  );
};

const ReviewModal: React.FC<ReviewModalProps> = ({ data, onClose, examTitle, examSubject }) => {
  // --- STATE CHO AI CHAT ---
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', content: 'Chào bạn! Mình là trợ lý AI. Mình có thể giúp bạn giải thích đáp án hoặc dịch đề bài này.' }
  ]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isScrollingUp = scrollTop < lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    if (isScrollingUp && distanceToBottom > 5) {
    // NGƯỜI DÙNG CUỘN LÊN: Cắt auto-scroll ngay lập tức!
      isAtBottomRef.current = false;
    } else if (distanceToBottom <= 10) {
      // CHẠM ĐÁY: Bật lại auto-scroll
      isAtBottomRef.current = true;
    }
    setShowScrollButton(!isAtBottomRef.current);
  };

  const scrollToBottom = () => {
    if (isAtBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'auto' 
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Logic tô màu đáp án
  const getOptionStyle = (optText: string, optId: string) => {
    const isCorrect = optId === data.correctAnswer || optText === data.correctAnswer;
    const isUserSelected = optId === data.userAnswer || optText === data.userAnswer;

    if (isCorrect) return "border-green-600 bg-green-100 text-gray-900 font-medium ring-1 ring-green-600"; 
    if (isUserSelected) return "border-red-300 bg-red-50 text-gray-700 dashed-border"; 
    return "border-gray-300 bg-white hover:bg-gray-50 text-gray-700";
  };

  const parseQuestionData = () => {
    let textContent = "";
    const imageUrls: string[] = [];

    if (data.blocks && Array.isArray(data.blocks)) {
      data.blocks.forEach((block: ContentBlock) => {
        switch (block.type) {
          case 'text':
            textContent += `${block.content}\n\n`;
            break;
            
          case 'note':
            textContent += `[Ghi chú]:\n${block.lines.join('\n')}\n\n`;
            break;
            
          case 'poem':
            if (block.title) textContent += `**Tác phẩm: ${block.title}**\n`;
            if (block.author) textContent += `*Tác giả: ${block.author}*\n`;
            // Nối các dòng thơ bằng ký tự xuống dòng
            textContent += `${block.lines.join('\n')}\n\n`;
            break;
            
          case 'table':
            if (block.title) textContent += `**Bảng dữ liệu: ${block.title}**\n`;
            
            // Vẽ bảng chuẩn Markdown cho AI đọc
            if (block.headers && block.headers.length > 0) {
              textContent += `| ${block.headers.join(' | ')} |\n`;
              // Dòng gạch ngang ngăn cách header và rows
              textContent += `| ${block.headers.map(() => '---').join(' | ')} |\n`; 
            }
            if (block.rows && block.rows.length > 0) {
              block.rows.forEach(row => {
                textContent += `| ${row.join(' | ')} |\n`;
              });
            }
            if (block.note) textContent += `*Chú thích bảng: ${block.note}*\n`;
            textContent += `\n`;
            break;
            
          case 'image':
            textContent += `[Hệ thống có đính kèm một hình ảnh`;
            if (block.alt) textContent += ` minh họa cho: ${block.alt}`;
            if (block.caption) textContent += ` (${block.caption})`;
            textContent += `]\n\n`;
            
            if (block.src) imageUrls.push(block.src);
            break;
            
          default:
            break;
        }
      });
    }

    // Gom Context (từ blocks) và Câu hỏi chính lại với nhau
    const combinedText = textContent.trim() 
      ? `NGỮ CẢNH / ĐOẠN VĂN:\n${textContent}\nCÂU HỎI:\n${data.questionText}`
      : data.questionText;

    return {
      subject: examSubject, // Biến này bạn lấy từ props hoặc state nhé
      questionText: combinedText,
      imageUrls: imageUrls,
      choices: data.choices ? data.choices.map((c: any) => `${c.id}: ${c.text}`) : [],
      correctAnswer: data.correctAnswer
    };
  };

  // --- HÀM XỬ LÝ GỬI TIN NHẮN CHO AI ---
  const handleSendMessage = async (text: string, isHiddenPrompt: boolean = false) => {
    if (!text.trim()) return;

    // 1. Thêm tin nhắn của User vào UI
    const userMessage = { role: 'user' as const, content: text };
    const updatedMessages = isHiddenPrompt ? [...messages] : [...messages, userMessage];

    setMessages([...updatedMessages, { role: 'ai', content: '' }]);
    setChatInput('');
    setIsTyping(true);

    try {
    const chatHistory = messages
      .filter((_, index) => index !== 0) // Bỏ câu chào đầu tiên
      .map(msg => ({
        role: msg.role === 'ai' ? 'model' : 'user',
        content: msg.content
      }));

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message: text,
          history: chatHistory,
          context: parseQuestionData()
        })
      });

      if (!response.ok) throw new Error('Network response was not ok');

      // 3. Xử lý đọc Stream từng dòng
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Giải mã chunk nhận được
          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;

          let displayText = accumulatedContent;

          // Kiểm tra xem chuỗi có bị bọc trong {"answer":"... không
          if (displayText.trim().startsWith('{"answer":"')) {
            displayText = displayText.replace(/^\{"answer":"/, '');
            displayText = displayText.replace(/"\}$/, ''); 
            displayText = displayText.replace(/\\n/g, '\n');
            displayText = displayText.replace(/\\"/g, '"');
          }

          // Cập nhật tin nhắn AI cuối cùng liên tục
          setMessages(prev => {
            const newMsgList = [...prev];
            const lastMsgIndex = newMsgList.length - 1;
            if (newMsgList[lastMsgIndex].role === 'ai') {
              newMsgList[lastMsgIndex] = { ...newMsgList[lastMsgIndex], content: displayText };
            }
            return newMsgList;
          });
        }
      }
    } catch (error) {
      console.error("Lỗi gọi AI Stream:", error);
      setMessages(prev => [
        ...prev.slice(0, -1), // Bỏ tin nhắn AI trống đang lỗi
        { role: 'ai', content: 'Xin lỗi, đã có lỗi kết nối đến AI. Vui lòng thử lại.' }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- NÚT HÀNH ĐỘNG NHANH ---
  const handleTranslateQuestion = () => {
    if (!isAiOpen) setIsAiOpen(true);
    setMessages(prev => [...prev, { role: 'user', content: 'Dịch đề bài này giúp mình nhé.' }]);
    handleSendMessage("Nhiệm vụ của bạn CHỈ LÀ DỊCH đoạn văn và các đáp án sang tiếng Việt. Tuyệt đối không giải thích tại sao đúng/sai, không phân tích đáp án", true);
  };

  const handleExplainAnswer = () => {
    if (!isAiOpen) setIsAiOpen(true);
    setMessages(prev => [...prev, { role: 'user', content: 'Giải thích giúp mình đáp án câu này.' }]);
    handleSendMessage("Hãy giải thích chi tiết tại sao đáp án đúng lại là đáp án được cung cấp trong context, và tại sao các phương án khác lại sai.", true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      
      {/* Container chính: Mở rộng max-w khi mở AI (từ 5xl lên 7xl) */}
      <div className={`bg-white rounded-2xl shadow-2xl flex flex-row h-[90vh] overflow-hidden ring-1 ring-gray-900/5 transition-all duration-300 ease-in-out w-full ${isAiOpen ? 'max-w-7xl' : 'max-w-5xl'}`}>
        
        {/* ================= PHẦN TRÁI: NỘI DUNG BÀI THI (GIỮ NGUYÊN) ================= */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          
          {/* HEADER */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-300 bg-gray-50 z-10 flex-shrink-0">
            <div className="flex items-center gap-3">
               <h2 className="text-lg font-bold text-gray-800 tracking-tight">
                 {examTitle}, {examSubject === 'RW' ? 'Reading and Writing' : 'Math'}, Question {data.questionNumber}
               </h2>
            </div>
            
            <div className="flex items-center gap-2">
              {/* NÚT TOGGLE AI */}
              <button 
                onClick={() => setIsAiOpen(!isAiOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${isAiOpen ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-md hover:-translate-y-0.5'}`}
              >
                {/* Sparkles Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                  <path d="M5 3v4M3 5h4"/>
                </svg>
              </button>

              {/* Nút đóng */}
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-800">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* BODY (Scrollable) */}
          <div className="flex-1 overflow-y-auto bg-white scroll-smooth relative">
            <div className="p-8 md:px-12 pb-4">
               <div className="max-w-3xl mx-auto">
                  <div className="font-['Source_Serif_4','Georgia',serif] text-[16px] text-[#1a1a1a] leading-relaxed lining-nums tracking-normal">
                    <BlockRenderer blocks={data.blocks} subject={examSubject} />
                    <div className="mt-5 mb-6">
                      {data.questionText}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {data.choices.map((opt, index) => {
                      const label = String.fromCharCode(65 + index);
                      const styleClass = getOptionStyle(opt.text, opt.id);
                      const isCorrect = opt.id === data.correctAnswer || opt.text === data.correctAnswer;
                      
                      return (
                        <div key={index} className={`relative flex items-center p-3 border rounded-xl shadow-sm ${isCorrect ? 'bg-green-50 border-green-500' : 'bg-white border-gray-500'} ${styleClass}`}>
                          <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-[1.5px] text-sm font-bold mr-4 transition-colors ${isCorrect ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white border-gray-500 text-gray-500'}`}>
                            {label}
                          </div>
                          <div className="font-['Source_Serif_4',_'Georgia',_serif] text-[16px] text-[#1a1a1a] lining-nums leading-relaxed">
                              {opt.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* ================= PHẦN PHẢI: KHUNG CHAT AI ================= */}
        <div 
          className={`relative flex flex-col bg-slate-50 border-l border-gray-200 transition-all duration-300 ease-in-out ${isAiOpen ? 'w-[450px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'}`}
        >
          {/* AI Header */}
          <div className="px-5 py-4 bg-white flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Trợ lý AI</h3>
              <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Sẵn sàng
              </p>
            </div>
          </div>

          {/* Quick Actions (Gợi ý lệnh) */}
          <div className="px-4 py-3 bg-white border-b border-gray-100 flex gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
             <button onClick={handleTranslateQuestion} disabled={isTyping} className="whitespace-nowrap px-3 py-1.5 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-xs font-semibold text-gray-600 rounded-lg transition-colors border border-transparent hover:border-indigo-200 disabled:opacity-50">
               🌐 Dịch đề bài
             </button>
             <button onClick={handleExplainAnswer} disabled={isTyping} className="whitespace-nowrap px-3 py-1.5 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-xs font-semibold text-gray-600 rounded-lg transition-colors border border-transparent hover:border-indigo-200 disabled:opacity-50">
               💡 Giải thích đáp án
             </button>
          </div>

          {/* Khu vực hiển thị tin nhắn */}
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            onWheel={(e) => {
              if (e.deltaY < 0) { // deltaY < 0 nghĩa là lăn chuột hướng lên trên
                isAtBottomRef.current = false;
                setShowScrollButton(true);
              }
            }}
            onTouchMove={() => {
              // Chỉ cần người dùng chạm vuốt là ưu tiên quyền điều khiển cho họ
              isAtBottomRef.current = false; 
              setShowScrollButton(true);
            }}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm shadow-sm' 
                    : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm'
                }`}>
                  {/* SỬA LẠI ĐOẠN NÀY ĐỂ RENDER MARKDOWN */}
                  <div className="leading-relaxed">
                    {msg.role === 'user' ? (
                      // Tin nhắn của User thường là text thuần, không cần Markdown
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <TypewriterMarkdown 
                        content={msg.content} 
                        onTyping={() => {
                          if (isAtBottomRef.current) scrollToBottom();  
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}
          </div>

          {showScrollButton && (
            <button 
              onClick={() => {
                isAtBottomRef.current = true;
                scrollToBottom();
              }}
              className="absolute left-1/2 -translate-x-1/2 bottom-[80px] z-20 bg-white border border-gray-200 shadow-lg rounded-full w-9 h-9 flex items-center justify-center hover:bg-gray-50 transition-all text-gray-500 hover:text-indigo-600"
            >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
            </button>
          )}

          {/* Khung nhập text */}
          <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(chatInput);
              }}
              className="relative flex items-center"
            >
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isTyping}
                placeholder="Hỏi AI về câu này..." 
                className="w-full bg-gray-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-full pl-4 pr-12 py-2.5 text-sm outline-none transition-all disabled:opacity-60"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim() || isTyping}
                className="absolute right-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ReviewModal;