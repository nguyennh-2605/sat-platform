import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

// 1. HIỆU ỨNG GÕ CHỮ THÔNG MINH (TYPEWRITER) ĐÃ TRỞ LẠI!
const TypewriterMarkdown = ({ 
  content, 
  isStreamDone, 
  onComplete,
  isAtBottomRef,
  scrollToBottom
}: { 
  content: string;
  isStreamDone: boolean;
  onComplete: (text: string) => void;
  isAtBottomRef: React.MutableRefObject<boolean>;
  scrollToBottom: (smooth?: boolean) => void;
}) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    // Nếu chữ trên màn hình vẫn chưa hiển thị kịp với chữ tải từ mạng về
    if (displayedText.length < content.length) {
      const timeout = setTimeout(() => {
        const diff = content.length - displayedText.length;
        
        // LOGIC TĂNG TỐC: Mạng tải càng lẹ, gõ càng nhanh (để đuổi kịp)
        const charsToAdd = diff > 300 ? 15 : diff > 100 ? 8 : diff > 30 ? 3 : 1; 
        
        setDisplayedText(content.slice(0, displayedText.length + charsToAdd));
        
        // Tự động cuộn mượt mà nương theo từng chữ rớt xuống
        if (isAtBottomRef.current) scrollToBottom(false);

      }, 40); // ~40 khung hình/giây, rất mượt

      return () => clearTimeout(timeout);
    } 
    // Khi ĐÃ GÕ XONG HẾT CHỮ trên màn hình + MẠNG CŨNG ĐÃ TẢI XONG
    else if (isStreamDone && content.length > 0 && displayedText.length === content.length) {
      const timeout = setTimeout(() => {
        onComplete(content); // Báo cáo cho thằng cha biết là đã gõ xong để chốt tin nhắn
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [content, displayedText, isStreamDone, onComplete, isAtBottomRef, scrollToBottom]);

  return (
    <div className="markdown-content prose prose-sm max-w-none 
    marker:text-black marker:font-bold
    prose-p:leading-relaxed prose-p:mb-3 
    prose-ul:list-disc prose-ul:pl-5 
    prose-ol:list-decimal prose-ol:pl-5
    prose-li:my-1 prose-table:border-collapse">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {displayedText}
      </ReactMarkdown>
    </div>
  );
};

// 2. CÁC TIN NHẮN CŨ VẪN ĐƯỢC ĐÓNG BĂNG ĐỂ CHỐNG LAG (QUAN TRỌNG)
const StaticMessage = React.memo(({ msg }: { msg: ChatMessage }) => {
  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm ${
        msg.role === 'user' 
          ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-sm shadow-md' 
          : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm shadow-sm'
      }`}>
        <div className="leading-relaxed">
          {msg.role === 'user' ? (
            <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
          ) : (
            <div className="markdown-content prose prose-sm max-w-none marker:text-black marker:font-bold prose-p:leading-relaxed prose-p:mb-3 prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5 prose-li:my-1 prose-table:border-collapse">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const ReviewModal: React.FC<ReviewModalProps> = ({ data, onClose, examTitle, examSubject }) => {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isStreamDone, setIsStreamDone] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    // Khoảng cách nhận diện đáy là 80px
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    isAtBottomRef.current = distanceToBottom <= 150;
    
    setShowScrollButton(!isAtBottomRef.current);
    lastScrollTopRef.current = scrollTop;
  };

  const scrollToBottom = useCallback((isSmooth = false) => {
    if (!scrollRef.current) return;
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: isSmooth ? 'smooth' : 'auto'
        });
      }
    }, 10);
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [messages.length, isTyping, scrollToBottom]);

  const getOptionStyles = (optText: string, optId: string) => {
    const isActualCorrect = optId === data.correctAnswer || optText === data.correctAnswer;
    const isUserSelected = optId === data.userAnswer || optText === data.userAnswer;
    // Trạng thái 1: ĐANG HIỆN ĐÁP ÁN
    if (showCorrectAnswer) {
      if (isActualCorrect) {
        return {
          wrapper: "bg-green-50 border-green-500 ring-1 ring-green-500 shadow-sm",
          circle: "bg-green-600 text-white border-green-600",
        };
      }
      if (isUserSelected) {
        return {
          wrapper: "bg-red-50 border-red-300 border-dashed",
          circle: "bg-white border-red-400 text-red-500",
        };
      }
    } 
    // Trạng thái 2: Mặc định (Không chọn, không đúng)
    return {
      wrapper: "bg-white border-gray-500",
      circle: "bg-white border-gray-400 text-gray-500",
    };
  };

  const parseQuestionData = useCallback(() => {
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
            textContent += `${block.lines.join('\n')}\n\n`;
            break;
          case 'table':
            if (block.title) textContent += `**Bảng dữ liệu: ${block.title}**\n`;
            if (block.headers && block.headers.length > 0) {
              textContent += `| ${block.headers.join(' | ')} |\n`;
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

    const combinedText = textContent.trim() 
      ? `ĐOẠN VĂN:\n${textContent}\nCÂU HỎI:\n${data.questionText}`
      : data.questionText;

    return {
      subject: examSubject,
      questionText: combinedText,
      imageUrls: imageUrls,
      choices: data.choices ? data.choices.map((c: any) => `${c.id}: ${c.text}`) : [],
      correctAnswer: data.correctAnswer
    };
  }, [data, examSubject]);

  const handleSendMessage = useCallback(async (text: string, isHiddenPrompt: boolean = false, displayContent?: string) => {
    if (!text.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    isAtBottomRef.current = true; 
    setShowScrollButton(false);
    scrollToBottom();

    const textToShow = displayContent || text;
    const shouldShowUserMsg = !isHiddenPrompt || displayContent;

    if (shouldShowUserMsg) {
      setMessages(prev => [...prev, { role: 'user' as const, content: textToShow }]);
    }

    setChatInput('');
    setIsTyping(true);
    setStreamingContent('');
    setIsStreamDone(false);

    try {
      const chatHistory = messagesRef.current.map(msg => ({
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
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      let accumulatedContent = '';
      let lastUpdateTime = Date.now();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // Mạng tải xong: Ép format cục text lần cuối cùng
            let finalText = accumulatedContent;
            if (finalText.trim().startsWith('{"answer":"')) {
              finalText = finalText.replace(/^\{"answer":"/, '').replace(/"\}$/, '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }
            
            setStreamingContent(finalText); // Chốt nội dung mục tiêu cho Typewriter gõ
            setIsStreamDone(true); // Báo hiệu đã tải xong mạng
            setIsTyping(false); 
            abortControllerRef.current = null;
            break; 
          }

          const chunk = decoder.decode(value, { stream: true });
          if (chunk) setIsTyping(false); 
          accumulatedContent += chunk;

          // Cứ 50ms mới update cái "đích đến" của Typewriter 1 lần cho đỡ lag
          const now = Date.now();
          if (now - lastUpdateTime > 50) {
            let displayText = accumulatedContent;
            if (displayText.trim().startsWith('{"answer":"')) {
              displayText = displayText.replace(/^\{"answer":"/, '').replace(/"\}$/, '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }
            setStreamingContent(displayText);
            lastUpdateTime = now;
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error("Lỗi gọi AI Stream:", error);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'ai', content: 'Xin lỗi, đã có lỗi kết nối đến AI. Vui lòng thử lại.' }
      ]);
      setIsTyping(false);
    }
  }, [parseQuestionData, scrollToBottom]);

  const handleTranslateQuestion = () => {
    if (!isAiOpen) setIsAiOpen(true);
    const promptText = "Nhiệm vụ của bạn CHỈ LÀ DỊCH đoạn văn và các đáp án sang tiếng Việt. Tuyệt đối không giải thích tại sao đúng/sai, không phân tích đáp án";
    const displayText = "Dịch đề bài này giúp mình nhé.";
    handleSendMessage(promptText, true, displayText);
  };

  const handleExplainAnswer = () => {
    if (!isAiOpen) setIsAiOpen(true);
    const promptText = "Hãy giải thích tại sao đáp án đúng lại là đáp án được cung cấp trong context, và tại sao các phương án khác lại sai.";
    const displayText = "Giải thích chi tiết câu này giúp mình.";
    handleSendMessage(promptText, true, displayText);
  };

  const questionBody = useMemo(() => {
    if (!data) return null;

    return (
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
                const styleClass = getOptionStyles(opt.text, opt.id);
                
                return (
                  <div key={index} className={`relative flex items-center p-3 border rounded-xl ${styleClass.wrapper}`}>
                    <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-[1.5px] text-sm font-bold mr-4 ${styleClass.circle}`}>
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
    );
  }, [data, examSubject, showCorrectAnswer]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className={`bg-white rounded-2xl shadow-2xl flex flex-row h-[90vh] overflow-hidden ring-1 ring-gray-900/5 transition-all duration-300 ease-in-out w-full ${isAiOpen ? 'max-w-7xl' : 'max-w-5xl'}`}>
        
        {/* ================= CỘT TRÁI ================= */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-300 bg-gray-100 z-10 flex-shrink-0">
            <div className="flex items-center gap-3">
               <h2 className="text-lg font-bold text-gray-800 tracking-tight">
                 {examTitle}, {examSubject === 'RW' ? 'Reading and Writing' : 'Math'}, Question {data.questionNumber}
               </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCorrectAnswer(prev => !prev)}
                title={showCorrectAnswer ? "Ẩn đáp án đúng" : "Hiện đáp án đúng"}
                className="p-2.5 rounded-full text-gray-800"
              >
                {showCorrectAnswer ? (
                  // Icon Mắt mở (Chuẩn)
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  // Icon Mắt nhắm (Đường gạch chéo cắt mượt qua tâm)
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                )}
              </button>
              <button 
                onClick={() => setIsAiOpen(!isAiOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${isAiOpen ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-md hover:-translate-y-0.5'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4M3 5h4"/></svg>
              </button>
              <button 
                onClick={() => {
                  abortControllerRef.current?.abort();
                  onClose();
                }} 
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-800">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
          {questionBody}
        </div>

        {/* ================= CỘT PHẢI ================= */}
        <div className={`relative flex flex-col h-full bg-slate-50 border-l border-gray-200 transition-all duration-300 ease-in-out ${isAiOpen ? 'w-[450px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'}`}>
          <div className="px-5 py-4 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 tracking-tight">Trợ lý AI</h3>
                <p className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Luôn sẵn sàng
                </p>
              </div>
            </div>
          </div>

          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="overflow-y-auto p-4 space-y-6"
            style={{ flex: '1 1 0', minHeight: 0 }}
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full px-2 mt-8">
                <h2 className="text-lg font-bold text-gray-700 mb-6">Hỏi AI bất cứ điều gì về câu này</h2>
                <div className="flex flex-col gap-3 w-full">
                  <button onClick={handleTranslateQuestion} disabled={isTyping || !!streamingContent} className="flex items-center justify-between w-full p-4 bg-[#F7F7F9] hover:bg-[#F0F0F4] rounded-2xl transition-colors group disabled:opacity-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#E1F3FB] flex items-center justify-center text-[#007EE5]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                      </div>
                      <div className="text-left text-[15px]">
                        <span className="font-bold text-gray-900">Dịch đề bài</span>
                        <span className="text-gray-500 ml-1">sang tiếng Việt dễ hiểu</span>
                      </div>
                    </div>
                    <svg className="text-gray-400 group-hover:text-gray-600 transition-colors" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>

                  <button onClick={handleExplainAnswer} disabled={isTyping || !!streamingContent} className="flex items-center justify-between w-full p-4 bg-[#F7F7F9] hover:bg-[#F0F0F4] rounded-2xl transition-colors group disabled:opacity-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#FFF4CE] flex items-center justify-center text-[#D97706]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                      </div>
                      <div className="text-left text-[15px]">
                        <span className="font-bold text-gray-900">Giải thích</span>
                        <span className="text-gray-500 ml-1">chi tiết cách làm bài này</span>
                      </div>
                    </div>
                    <svg className="text-gray-400 group-hover:text-gray-600 transition-colors" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <StaticMessage key={idx} msg={msg} />
            ))}

            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-5 py-3 text-sm bg-white text-gray-800 border border-gray-100 rounded-tl-sm shadow-sm">
                  <div className="leading-relaxed">
                    <TypewriterMarkdown 
                      content={streamingContent}
                      isStreamDone={isStreamDone}
                      isAtBottomRef={isAtBottomRef}
                      scrollToBottom={scrollToBottom}
                      onComplete={(finalText) => {
                        // KHI ĐÃ GÕ XONG, ĐẨY VÀO MẢNG MESSAGES ĐỂ ĐÓNG BĂNG, RESET STREAM
                        setMessages(prev => [...prev, { role: 'ai', content: finalText }]);
                        setStreamingContent('');
                        setIsStreamDone(false);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {isTyping && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-transparent px-2 py-1 flex items-center gap-2">
                  <svg className="animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <span className="text-sm font-medium bg-clip-text text-transparent bg-gradient-to-r from-gray-400 via-gray-800 to-gray-400 bg-[length:200%_100%] animate-[shimmer_2s_infinite]">
                    Thinking...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-1" />
          </div>

          {showScrollButton && (
            <button 
              onClick={() => {
                isAtBottomRef.current = true;
                scrollToBottom(true);
                setShowScrollButton(false);
              }}
              className="absolute left-1/2 -translate-x-1/2 bottom-[85px] z-20 bg-white/90 border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.1)] rounded-full w-9 h-9 flex items-center justify-center hover:bg-gray-50 transition-all text-gray-500 hover:text-indigo-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
            </button>
          )}

          <div className="p-4 bg-white/80 border-t border-gray-100 flex-shrink-0 z-10">
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
                disabled={isTyping || !!streamingContent} // Khóa gõ chữ lúc AI đang trả lời
                placeholder="Hỏi AI về câu này..." 
                className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-2xl pl-5 pr-12 py-3.5 text-sm outline-none transition-all disabled:opacity-60 placeholder:text-gray-400"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim() || isTyping || !!streamingContent}
                className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl transition-all shadow-sm"
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