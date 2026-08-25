import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { type QuestionResult } from '../../pages/score-report/ScoreReport';
import BlockRenderer from '../../components/content/BlockRenderer';
import type { ContentBlock } from '../../types/quiz';
import ReactMarkdown from 'react-markdown';
import { authenticatedFetch } from '../../lib/authSession';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import FormattedTextRenderer from '../../components/content/TextRenderer';
import InteractiveText from './InteractiveText';

interface ReviewModalProps {
  data: QuestionResult;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
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
      <div className={`max-w-[85%] rounded-xl px-5 py-3 text-sm ${
        msg.role === 'user' 
          ? 'bg-primary text-white rounded-tr-sm shadow-card'
          : 'bg-surface text-foreground border border-ui-border rounded-tl-sm shadow-card'
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

const ReviewModal: React.FC<ReviewModalProps> = ({ data, onClose, onPrevious, onNext, examTitle, examSubject }) => {
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

  const getOptionStyles = useCallback((optText: string, optId: string) => {
    const isActualCorrect = optId === data.correctAnswer || optText === data.correctAnswer;
    const isUserSelected = optId === data.userAnswer || optText === data.userAnswer;
    // Trạng thái 1: ĐANG HIỆN ĐÁP ÁN
    if (showCorrectAnswer) {
      if (isActualCorrect) {
        return {
          wrapper: "bg-green-50 border-green-500 ring-1 ring-green-500 shadow-xs",
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
  }, [data.correctAnswer, data.userAnswer, showCorrectAnswer]);

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
      choices: data.choices ? data.choices.map(c => `${c.id}: ${c.text}`) : [],
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

      const response = await authenticatedFetch(`${import.meta.env.VITE_API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
        { role: 'ai', content: 'The AI connection failed. Try again.' }
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
              <BlockRenderer blocks={data.blocks} subject={examSubject} readOnly={true}/>
              <div className="mt-5 mb-6">
                {examSubject === 'MATH' 
                  ? <FormattedTextRenderer text={data.questionText} latexOnly />
                  : <InteractiveText content={data.questionText} readOnly={true}/>
                }
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {data.choices.map((opt, index) => {
                const label = String.fromCharCode(65 + index);
                const styleClass = getOptionStyles(opt.text, opt.id);
                
                return (
                  <div key={index} className={`relative flex items-center p-3 border rounded-xl ${styleClass.wrapper}`}>
                    <div className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-[1.5px] text-sm font-bold mr-4 ${styleClass.circle}`}>
                      {label}
                    </div>
                    <div className="font-['Source_Serif_4','Georgia',serif] text-[16px] text-[#1a1a1a] lining-nums leading-relaxed">
                      {examSubject === 'MATH' 
                        ? <FormattedTextRenderer text={opt.text} latexOnly />
                        : <InteractiveText content={opt.text} readOnly={true}/>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }, [data, examSubject, getOptionStyles]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const closeModal = useCallback(() => {
    abortControllerRef.current?.abort();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeModal(); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [closeModal]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Review question ${data.questionNumber}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--ui-overlay) px-2 py-2 animate-in fade-in duration-200 sm:px-14 sm:py-4"
      onMouseDown={event => { if (event.target === event.currentTarget) closeModal(); }}
    >
      <div className={`relative h-[90vh] w-full transition-[max-width] duration-300 ease-in-out ${isAiOpen ? 'max-w-7xl' : 'max-w-5xl'}`}>
      <button
        type="button"
        onClick={onPrevious}
        disabled={!onPrevious}
        aria-label="Previous question"
        className="absolute -left-14 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-surface text-primary shadow-elevated transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-35 sm:flex"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div className="flex h-full w-full flex-row overflow-hidden rounded-card bg-surface shadow-elevated ring-1 ring-ui-border">
        
        {/* ================= CỘT TRÁI ================= */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-ui-border bg-surface-subtle px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-3">
               <h2 className="line-clamp-2 text-body font-semibold tracking-tight text-foreground sm:text-heading">
                 {examTitle}, {examSubject === 'RW' ? 'Reading and Writing' : 'Math'}, Question {data.questionNumber}
               </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCorrectAnswer(prev => !prev)}
                title={showCorrectAnswer ? 'Hide correct answer' : 'Show correct answer'}
                aria-label={showCorrectAnswer ? 'Hide correct answer' : 'Show correct answer'}
                className="flex h-10 w-10 items-center justify-center rounded-control text-subtle-foreground hover:bg-muted"
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
                aria-label={isAiOpen ? 'Close AI tutor' : 'Open AI tutor'}
                aria-expanded={isAiOpen}
                className={`flex min-h-10 items-center gap-2 rounded-control px-3 text-body font-semibold transition-colors sm:px-4 ${isAiOpen ? 'bg-primary-soft text-primary ring-1 ring-primary/30' : 'bg-primary text-white hover:bg-primary-hover'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4M3 5h4"/></svg>
              </button>
              <button 
                onClick={closeModal}
                aria-label="Close review"
                className="flex h-10 w-10 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
          {questionBody}
        </div>

        {/* ================= CỘT PHẢI ================= */}
        <div className={`absolute inset-0 z-20 flex h-full flex-col bg-surface-subtle transition-all duration-300 ease-in-out sm:relative sm:inset-auto sm:z-auto ${isAiOpen ? 'w-full opacity-100 sm:w-[450px] sm:border-l sm:border-ui-border' : 'w-0 overflow-hidden opacity-0'}`}>
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-ui-border bg-surface/90 px-5 py-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-control bg-primary text-white shadow-xs">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              </div>
              <div>
                <h3 className="text-body font-semibold tracking-tight text-foreground">AI Tutor</h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Ready to help
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setIsAiOpen(false)} aria-label="Close AI tutor" className="flex h-10 w-10 items-center justify-center rounded-control text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="overflow-y-auto p-4 space-y-6"
            style={{ flex: '1 1 0', minHeight: 0 }}
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full px-2 mt-8">
                <h2 className="mb-6 text-heading font-semibold text-foreground">Ask about this question</h2>
                <div className="flex w-full flex-col gap-3">
                  <button onClick={handleTranslateQuestion} disabled={isTyping || !!streamingContent} className="group flex min-h-16 w-full items-center justify-between rounded-card border border-ui-border bg-surface p-4 transition-colors hover:bg-primary-soft disabled:opacity-50">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-control bg-info-soft text-info">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                      </div>
                      <div className="text-left text-[15px]">
                        <span className="font-semibold text-foreground">Translate</span>
                        <span className="ml-1 text-muted-foreground">into clear Vietnamese</span>
                      </div>
                    </div>
                    <svg className="text-gray-400 group-hover:text-gray-600 transition-colors" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>

                  <button onClick={handleExplainAnswer} disabled={isTyping || !!streamingContent} className="group flex min-h-16 w-full items-center justify-between rounded-card border border-ui-border bg-surface p-4 transition-colors hover:bg-primary-soft disabled:opacity-50">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-control bg-accent-soft text-warning">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                      </div>
                      <div className="text-left text-[15px]">
                        <span className="font-semibold text-foreground">Explain</span>
                        <span className="ml-1 text-muted-foreground">the solution step by step</span>
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
                <div className="max-w-[85%] rounded-card rounded-tl-sm border border-ui-border bg-surface px-5 py-3 text-body text-foreground shadow-card">
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
                  <span className="text-sm font-medium bg-clip-text text-transparent bg-linear-to-r from-gray-400 via-gray-800 to-gray-400 bg-size-[200%_100%] animate-[shimmer_2s_infinite]">
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
              aria-label="Scroll to latest message"
              className="absolute bottom-[85px] left-1/2 z-20 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-ui-border bg-surface/90 text-muted-foreground shadow-elevated transition-colors hover:bg-primary-soft hover:text-primary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
            </button>
          )}

          <div className="z-10 shrink-0 border-t border-ui-border bg-surface/90 p-4">
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
                placeholder="Ask AI about this question..."
                aria-label="Message AI tutor"
                className="w-full rounded-card border border-ui-border bg-surface-subtle py-3.5 pl-4 pr-12 text-body text-foreground outline-hidden transition-all placeholder:text-muted-foreground focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim() || isTyping || !!streamingContent}
                aria-label="Send message"
                className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-control bg-primary text-white shadow-xs transition-colors hover:bg-primary-hover disabled:bg-muted disabled:text-muted-foreground"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </button>
            </form>
          </div>

        </div>
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={!onNext}
        aria-label="Next question"
        className="absolute -right-14 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-surface text-primary shadow-elevated transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-35 sm:flex"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </button>
      </div>
    </div>
  );
};

export default ReviewModal;
