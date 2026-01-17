import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QuestionHeader from './components/QuestionHeader';
import AnswerOption from './components/AnswerOption';
import BlockRenderer from './components/BlockRenderer';
import ToolsHeader from './components/ToolsHeader';
import InteractiveText from './components/InteractiveText';

// 2. Import Type
import type { QuestionData } from './types/quiz';

function ExamRoom() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- STATE QUẢN LÝ ---
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  
  // 👇 State cho tính năng Đánh dấu (Mark for Review)
  const [markedQuestions, setMarkedQuestions] = useState<number[]>([]);

  // State Modal & Sidebar
  const [showStartModal, setShowStartModal] = useState(true);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // State kết quả
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [scoreData, setScoreData] = useState<{ score: number, total: number } | null>(null);
  const [submitReason, setSubmitReason] = useState("");

  // Timer & Anticheat
  const [timeLeft, setTimeLeft] = useState(32 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [violationCount, setViolationCount] = useState(0);

  // Thêm state để lưu Submission ID
  const [submissionId, setSubmissionId] = useState<number | null>(null);

  // State lưu thời điểm bài thi kết thúc
  const [endTime, setEndTime] = useState<number | null>(null);

  // 1. State quản lý giai đoạn hiện tại
  type ExamPhase = 'MODULE_1' | 'REVIEW_1' | 'MODULE_2';
  const [phase, setPhase] = useState<ExamPhase>('MODULE_1');

  // state để quyết định khi nào hiện cửa sổ xác nhận
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // State lưu cấu hình thời gian (tính bằng PHÚT để dễ hiển thị)
  const [examConfig, setExamConfig] = useState({
    mod1Duration: 0,
    mod2Duration: 0
  })

  const [isTransitioning, setIsTransitioning] = useState(false);

  // 👇 1. STATE BẬT/TẮT CHẾ ĐỘ GẠCH
  const [isStrikeMode, setIsStrikeMode] = useState(false);

  // 👇 2. STATE LƯU NHỮNG CÂU BỊ GẠCH
  // Cấu trúc: { 0: [0, 2], 1: [1] } -> Câu 0 gạch đáp án A, C; Câu 1 gạch đáp án B
  const [eliminatedMap, setEliminatedMap] = useState<Record<number, number[]>>({});

  // --- 1. GỌI API LẤY ĐỀ THI ---
  useEffect(() => {
    if (!id) return;

    const userId = localStorage.getItem('userId');
    if (!userId) {
      alert("Bạn chưa đăng nhập!");
      navigate('/login');
      return;
    }

    // Gửi kèm thêm cả userId để tìm bài làm dở
    fetch(`http://localhost:5000/api/test/${id}?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.sections) {
          let allQuestions: QuestionData[] = [];
          
          // Làm phẳng dữ liệu
          data.sections.forEach((section: any) => {
            if (section.questions) {
              const qs = section.questions.map((q: any) => {
                let formattedChoices = [];
                if (Array.isArray(q.choices)) {
                    formattedChoices = q.choices.map((c: any) => ({
                      id: c.id,
                      text: c.text
                    }));
                }
                return {
                  id: q.id,
                  blocks: q.blocks,
                  questionText: q.questionText,
                  choices: formattedChoices,
                } as QuestionData; 
              });
              allQuestions = [...allQuestions, ...qs];
            }
          });

          setQuestions(allQuestions);
        }

        if (data.session) {
          const currentSubmissionId = data.session.submissionId;
          // Lấy ID của lượt làm bài lần trước đã lưu (nếu có)
          const savedSubmissionId = localStorage.getItem(`lastSubmissionId_${userId}_${id}`);
          if (savedSubmissionId && savedSubmissionId !== currentSubmissionId.toString()) {
            console.log("Phát hiện lượt làm bài mới! Đang dọn dẹp dữ liệu cũ...");
            // XÓA SẠCH DỮ LIỆU CŨ CỦA BÀI THI NÀY
            localStorage.removeItem(`mod2Start_${userId}_${id}`);
            localStorage.removeItem(`answers_${userId}_${id}`);
            localStorage.removeItem(`violations_${userId}_${id}`);
            // Cập nhật lại ID mới để lần sau so sánh
            localStorage.setItem(`lastSubmissionId_${userId}_${id}`, currentSubmissionId);
          }
          else {
            // Nếu chưa có, lưu lại để dùng cho lần sau
            if (!savedSubmissionId) {
                localStorage.setItem(`lastSubmissionId_${userId}_${id}`, currentSubmissionId);
            }
          }
        }

        let durationMod1 = 0;
        let durationMod2 = 0;

        if (data.sections && data.sections.length > 1) {
          durationMod1 = data.sections[0].duration;
          durationMod2 = data.sections[1].duration;

          console.log('thời gian cho mod 1 là ', durationMod1)
          console.log('thời gian cho mod 2 là ', durationMod2)

          setExamConfig({
            mod1Duration: durationMod1,
            mod2Duration: durationMod2
          });
        }

        const savedMod2Start = localStorage.getItem(`mod2Start_${userId}_${id}`);
        console.log("Thời gian mod 2 bắt đầu", savedMod2Start);
        let currentPhase = 'MODULE_1'; // Mặc định
        let mod2StartVal = null;

        if (savedMod2Start) {
          currentPhase = 'MODULE_2';
          mod2StartVal = parseInt(savedMod2Start, 10);
          setPhase('MODULE_2'); // Cập nhật state phase
          setCurrentQuestionIndex(data.sections[0].questions.length);
        }

        if (data.session) {
          const currentSubmissionId = data.session.submissionId;
          setSubmissionId(currentSubmissionId);
          let startMs = 0;
          let durationMs = 0;
          if (currentPhase === 'MODULE_2' && mod2StartVal != null) {
            startMs = mod2StartVal;
            durationMs = durationMod2 * 60 * 1000;
          } else {
            startMs = new Date(data.session.startedAt).getTime();
            durationMs = durationMod1 * 60 * 1000;
          }
          const endMs = startMs + durationMs;
          setEndTime(endMs);

          const now = Date.now();
          const remaining = Math.max(0, Math.floor((endMs - now) / 1000));
          setTimeLeft(remaining);

          if (remaining <= 0) {
            if (currentPhase === 'MODULE_2') {
              finishTest("Hết thời gian làm bài phiên này", currentSubmissionId);
            }
            else {
              setPhase('MODULE_2'); // Hoặc logic chuyển tiếp
              alert("Hết giờ Module 1, chuyển sang module tiếp theo.");
            }
          }
          else {
            setIsTimerRunning(true);
          }
        }

        // KHÔI PHỤC ĐÁP ÁN TỪ LOCAL STORAGE (Nếu user refresh trang)
        const savedAnswers = localStorage.getItem(`answers_${userId}_${id}`);
        if (savedAnswers) {
          const parsedAnswers = JSON.parse(savedAnswers);
          setAnswers(parsedAnswers);
          console.log("Đã khôi phục đáp án cũ:", parsedAnswers);
        }

        const savedViolations = localStorage.getItem(`violations_${userId}_${id}`);
        if (savedViolations) {
          setViolationCount(parseInt(savedViolations, 10));
          console.log("Đã khôi phục số lỗi vi phạm:", savedViolations);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Lỗi tải đề:", err);
        setIsLoading(false);
      });
  }, [id]);

  // --- HÀM HỖ TRỢ ---
  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    }
  };

  // --- 2. LOGIC NỘP BÀI ---
  const finishTest = useCallback(async (reason: string, passedSubmissionId?: number) => {
    setIsTimerRunning(false);
    setIsReviewOpen(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

    setIsSubmitting(true);

    try {
        const storedUserId = localStorage.getItem('userId');
        const userId = storedUserId ? parseInt(storedUserId) : null;

        if (!userId) {
            alert("Lỗi: Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại!");
            return;
        }

        const idToSubmit = passedSubmissionId || submissionId; 

        if (!idToSubmit) {
             console.error("Lỗi: Không có submissionId để nộp");
             return;
        }

        const res = await fetch(`http://localhost:5000/api/test/${id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              submissionId: idToSubmit, // Gửi cái này để backend biết update bài nào
              answers,
              userId: userId,
              violationCount: violationCount,
            })
        });

        const data = await res.json();

        if (res.ok) {
          // Nộp thành công mới xóa localStorage
          localStorage.removeItem(`mod2Start_${userId}_${id}`);
          localStorage.removeItem(`answers_${userId}_${id}`);
          localStorage.removeItem(`violations_${userId}_${id}`);
          setScoreData({ score: data.score, total: data.total });
          setSubmitReason(reason);
          setIsSubmitted(true);
        } else {
            alert("Lỗi khi nộp bài: " + (data.error || data.message));
        }
    } catch (error) {
        console.error("Lỗi mạng:", error);
        alert("Không thể kết nối đến server để nộp bài!");
    } finally {
        setIsSubmitting(false);
    }
  }, [answers, id, submissionId, violationCount]);

  // --- LOGIC TIMER ---
  useEffect(() => {
    let timer: any;
    // Chỉ chạy timer khi đã xác định được endTime và trạng thái đang chạy
    if (isTimerRunning && endTime) {
      timer = setInterval(() => {
        const now = Date.now();
        // 👇 LOGIC CHUẨN: Lấy (Mốc kết thúc - Giờ hiện tại)
        const secondsRemaining = Math.floor((endTime - now) / 1000);
        setTimeLeft(secondsRemaining);

        if (secondsRemaining <= 0) {
          clearInterval(timer);
          if (phase === 'MODULE_2') {
            finishTest("Hết thời gian làm bài");
          }
          else {
            startModule2();
          }
        }
      }, 1000);
    }
    // Clear interval khi unmount hoặc khi dependency thay đổi
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTimerRunning, endTime, phase, finishTest]);

  // --- LOGIC ANTICHEAT ---
  useEffect(() => {    
    if (!isTimerRunning || isSubmitted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolationCount(prev => {
          const newCount = prev + 1;
          if (newCount > 3) finishTest("Vi phạm quy chế (rời màn hình) quá 3 lần.");
          else alert(`⚠️ CẢNH BÁO (${newCount}/3): Đừng rời khỏi màn hình!`);
          return newCount;
        });
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isTimerRunning) {
        setViolationCount(prev => {
          const newCount = prev + 1;
          if (newCount > 3) {
            finishTest("Vi phạm quy chế (thoát fullscreen) quá 3 lần.");
            return newCount;
          } else {
            alert(`⚠️ CẢNH BÁO (${newCount}/3): Quay lại fullscreen ngay!`);
            enterFullscreen(); 
            return newCount;
          }
        });
      }
    };

    const handleContextMenu = (e: Event) => e.preventDefault();

    // 2. Chặn Copy, Cut, Paste
    const handleCopyCutPaste = (e: ClipboardEvent) => e.preventDefault();

    // 3. Chặn phím tắt (Ctrl+C, Ctrl+V, Ctrl+A, F12, Ctrl+Shift+I)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Chặn F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
      // Chặn các tổ hợp phím Ctrl/Command
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        // c=copy, v=paste, x=cut, a=select all, u=view source, i=inspect
        if (['c', 'v', 'x', 'a', 'u', 'i'].includes(key)) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener('copy', handleCopyCutPaste);
    document.addEventListener('cut', handleCopyCutPaste);
    document.addEventListener('paste', handleCopyCutPaste);
    document.addEventListener('keydown', handleKeyDown);


    return () => {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener("contextmenu", handleContextMenu);
      document.addEventListener('copy', handleCopyCutPaste);
      document.addEventListener('cut', handleCopyCutPaste);
      document.addEventListener('paste', handleCopyCutPaste);
      document.addEventListener('keydown', handleKeyDown);
    };
  }, [isTimerRunning, finishTest, isSubmitted]);

  useEffect(() => {
    if (isLoading) return;

    const userId = localStorage.getItem('userId');
    if (userId && id) {
      // Chỉ lưu nếu có vi phạm (để tránh ghi số 0 liên tục lúc mới vào)
      // Hoặc cứ lưu luôn cũng được để đảm bảo đồng bộ
      localStorage.setItem(`violations_${userId}_${id}`, violationCount.toString());
      console.log("Đã lưu Violation vào LocalStorage", violationCount);
    }
  }, [violationCount, id, isLoading]); // Chạy lại mỗi khi violationCount thay đổi

  // --- CÁC HÀM SỰ KIỆN ---
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStartTest = () => {
    enterFullscreen();
    setShowStartModal(false);
    setIsTimerRunning(true);
  };

  const handleSelectOption = (optionId: string) => {
    setAnswers(prev => {
        const newAnswers = { ...prev, [questions[currentQuestionIndex].id]: optionId };
        
        // Lưu ngay vào localStorage
        const userId = localStorage.getItem('userId');
        localStorage.setItem(`answers_${userId}_${id}`, JSON.stringify(newAnswers));
        
        return newAnswers;
    });
  };

  const splitIndex = useMemo(() => {
    if (questions.length === 0) return 0;
    return Math.floor(questions.length / 2); // Cắt đôi: Ví dụ 20 câu -> split tại 10
  }, [questions.length]);


  const jumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    setIsReviewOpen(false); // Đóng sidebar sau khi chọn
  };

  const startModule2 = () => {
    if (phase !== 'REVIEW_1' && phase !== 'MODULE_1') return;
    // BẬT MÀN HÌNH LOADING NGAY LẬP TỨC
    setIsTransitioning(true);
    const now  = Date.now();
    const userId = localStorage.getItem('userId');
    localStorage.setItem(`mod2Start_${userId}_${id}`, now.toString());
    // Xóa LocalStorage answer mod 1
    localStorage.removeItem(`answers_${userId}_${id}`);
    // Tính toán lại endTime mới
    const durationMs = examConfig.mod2Duration * 60 * 1000;
    const newEndTime = now + durationMs;
    setEndTime(newEndTime);
    // Nhảy ngay tới câu đầu tiên của Mod 2 (splitIndex)
    setCurrentQuestionIndex(splitIndex);
    window.scrollTo(0, 0);
    setTimeout(() => {
      // Chuyển sang Module 2
      setPhase('MODULE_2');
      // Tắt màn hình loading -> Lúc này Timer đã ổn định ở số 32:00
      setIsTransitioning(false);
    }, 1000);
  };

// Lọc câu hỏi hiển thị cho Sidebar (Chỉ hiện câu thuộc Phase hiện tại)
  const sidebarQuestions = useMemo(() => {
    if (phase === 'MODULE_1') return questions.slice(0, splitIndex);
    if (phase === 'MODULE_2') return questions.slice(splitIndex);
    return [];
  }, [questions, phase, splitIndex]);

  // Logic Toggle Mark
  const toggleMarkQuestion = () => {
      setMarkedQuestions(prev => {
          if (prev.includes(currentQuestionIndex)) {
              return prev.filter(id => id !== currentQuestionIndex);
          } else {
              return [...prev, currentQuestionIndex];
          }
      });
  };

  // 👇 3. HÀM XỬ LÝ KHI BẤM NÚT GẠCH TRÊN ĐÁP ÁN
  const handleEliminate = (questionIdx: number, optionIdx: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Chặn click lan ra ngoài (để không bị tính là chọn đáp án)
    
    setEliminatedMap(prev => {
      const currentList = prev[questionIdx] || [];
      if (currentList.includes(optionIdx)) {
        // Nếu đã gạch rồi -> Bỏ gạch (Undo)
        return { ...prev, [questionIdx]: currentList.filter(id => id !== optionIdx) };
      } else {
        // Nếu chưa gạch -> Thêm vào danh sách gạch
        return { ...prev, [questionIdx]: [...currentList, optionIdx] };
      }
    });
  };

  // --- RENDER LOADING ---
  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-xl font-bold text-blue-600 animate-pulse">⏳ Đang tải đề thi...</div>
        </div>
    );
  }

  if (isSubmitting) {
    return <div className="h-screen flex items-center justify-center text-blue-600 font-bold">🚀 Đang chấm điểm...</div>;
  }

  if (questions.length === 0) {
      return <div className="min-h-screen flex items-center justify-center">Không tìm thấy câu hỏi nào!</div>;
  }

  // --- RENDER KẾT QUẢ ---
  if (isSubmitted && scoreData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Kết quả bài thi</h2>
          <p className="text-slate-600 mb-6">{submitReason}</p>
          <div className="flex justify-center items-end gap-2 mb-8">
             <span className="text-6xl font-bold text-blue-600">{scoreData.score}</span>
             <span className="text-2xl text-gray-400 font-medium mb-2">/ {scoreData.total}</span>
          </div>
          <button onClick={() => navigate('/dashboard')} className="bg-slate-800 text-white px-6 py-3 rounded-lg hover:bg-slate-700 transition">
            Về Dashboard
          </button>
        </div>
      </div>
    );
  }

  // 1. KIỂM TRA DỮ LIỆU TRƯỚC (Thêm đoạn này vào đầu hàm return hoặc trước khi khai báo currentQ)
  if (!questions || questions.length === 0 || !questions[currentQuestionIndex]) {
    return <div className="p-10 text-center">Đang tải đề thi...</div>;
  }

  // --- BIẾN CHO CÂU HỎI HIỆN TẠI ---
  const currentQ = questions[currentQuestionIndex]; 
  // Offset index để sidebar luôn hiển thị đúng số thứ tự
  const sidebarOffset = phase === 'MODULE_2' ? splitIndex : 0;

  // --- RENDER PHÒNG THI ---

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans relative overflow-hidden">
      {/* 👇 COMPONENT LOADING 👇 */}
      {isTransitioning && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
          {/* Icon Spinner xoay xoay */}
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          
          <h2 className="text-2xl font-bold text-slate-800">Đang chuẩn bị Module 2...</h2>
          <p className="text-slate-500 mt-2">Vui lòng đợi trong giây lát</p>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm z-20 relative">
        <div className="flex items-center gap-4">
          <span className="font-bold text-lg text-slate-800">
            Section 1, {phase === 'MODULE_2' ? "Module 2" : "Module 1"}: Reading and Writing
          </span>
          {violationCount > 0 && (
             <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
               ⚠️ {violationCount}/3
             </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          {/* Nút bật tắt Highlight & Notes */}
          <ToolsHeader />
          <div className={`font-mono text-xl font-bold ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>
            {formatTime(timeLeft)}
          </div>
          <button 
            onClick={() => setIsReviewOpen(true)}
            className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Review 
          </button>

          {/* <button onClick={() => finishTest("Nộp bài tự nguyện")} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 transition">
            Nộp bài
          </button> */}
        </div>
      </header>
      
      {/* === TRƯỜNG HỢP 1: GIAO DIỆN REVIEW (FULL SCREEN) === */}
      
      {phase === 'REVIEW_1' ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-center mb-2">Review Module 1</h2>
              <p className="text-center text-gray-500 mb-8">
                Hãy kiểm tra kỹ các câu hỏi bên dưới. <br/>
                <span className="text-red-500 font-bold">Lưu ý:</span> Khi bấm "Bắt đầu Module 2", bạn sẽ không thể quay lại sửa bài phần này.
              </p>

              <div className="grid grid-cols-5 md:grid-cols-8 gap-4 mb-10">
                {questions.slice(0, splitIndex).map((q, idx) => {
                  const isAnswered = answers[q.id] !== undefined;
                  const isMarked = markedQuestions.includes(q.id);
                  return (
                    <div key={q.id} className={`p-3 rounded-lg border text-center relative ${
                      isMarked ? 'bg-yellow-100 border-yellow-500' : 
                      isAnswered ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-300'
                    }`}>
                      <div className="font-bold text-gray-700">{idx + 1}</div>
                      <div className="text-xs mt-1 text-gray-500">{isAnswered ? 'Đã làm' : 'Chưa làm'}</div>
                      {isMarked && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-center gap-6">
                <button 
                  onClick={() => setPhase('MODULE_1')} 
                  className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition"
                >
                  Quay lại sửa bài
                </button>
                <button 
                  onClick={startModule2} 
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition transform hover:scale-105"
                >
                  Bắt đầu Module 2
                </button>
              </div>
          </div>
        </div>
      ) : (
        <>
          {/* --- SIDEBAR REVIEW (Đã sửa logic màu) --- */}
          {isReviewOpen && (
            <div 
              className="fixed inset-0 bg-black/30 z-30 transition-opacity" 
              onClick={() => setIsReviewOpen(false)}
            />
          )}
      
          <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${isReviewOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-lg text-slate-800">Question Palette</h3>
              <button onClick={() => setIsReviewOpen(false)} className="text-gray-500 hover:text-red-500">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto h-[calc(100%-140px)]">
              <div className="grid grid-cols-5 gap-3">
                {sidebarQuestions.map((q, index) => {
                  const realIndex = index + sidebarOffset
                  const isAnswered = answers[q.id] !== undefined;
                  const isMarked = markedQuestions.includes(realIndex);
                  const isCurrent = currentQuestionIndex === realIndex;
                  
                  // 👇 LOGIC MÀU SẮC CHUẨN: Ưu tiên Marked -> Answered -> Default
                  let btnClass = "bg-white text-gray-700 border-gray-200 hover:bg-gray-100";
                  
                  if (isMarked) {
                      btnClass = "bg-yellow-400 text-white border-yellow-600 shadow-sm"; // Vàng
                  } else if (isAnswered) {
                      btnClass = "bg-blue-600 text-white border-blue-700 shadow-sm"; // Xanh
                  }

                  if (isCurrent) {
                      btnClass += " ring-2 ring-offset-1 ring-blue-500 border-blue-600"; // Viền highlight
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => jumpToQuestion(realIndex)}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-bold border transition-all relative ${btnClass}`}
                    >
                      {index + 1}
                      {/* Icon cờ nhỏ xíu nếu vừa làm vừa mark */}
                      {isMarked && isAnswered && (
                          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Chú thích màu sắc */}
            <div className="absolute bottom-0 w-full p-4 bg-gray-50 border-t border-gray-200 text-xs text-slate-600 space-y-2">
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-600 rounded"></div> Đã trả lời</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-400 rounded"></div> Đã đánh dấu (Mark)</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white border border-gray-300 rounded"></div> Chưa làm</div>
            </div>
          </div>

          {/* --- NỘI DUNG CHÍNH (BODY) --- */}
          <div className="flex-1 flex overflow-hidden">
          {/* 👈 CỘT TRÁI: CHỈ HIỆN BLOCKS (Bài đọc, Graph...) */}
            <div className="w-1/2 p-8 border-r border-gray-200 overflow-y-auto bg-white custom-scrollbar">
              <div   className=" font-['Georgia','Times_New_Roman', serif] text-[1.05rem] font-normal text-slate-800 leading-[1.45] tracking-[-0.01em] whitespace-pre-line">
                {/* Nếu không có block nào (ví dụ câu hỏi ngắn) thì ẩn hoặc hiện placeholder */}
                {currentQ.blocks && currentQ.blocks.length > 0 ? (
                    <BlockRenderer blocks={currentQ.blocks} />
                ) : (
                    <div className="text-gray-400 italic flex items-center justify-center h-40">
                      No passage or data provided.
                    </div>
                )}
              </div>
            </div>

        {/* Cột phải: CÂU HỎI */}
          <div className="w-1/2 p-8 overflow-y-auto bg-gray-50 custom-scrollbar">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                
                <QuestionHeader 
                  currentPhase={phase}
                  splitIndex={splitIndex}
                  currentIndex={currentQuestionIndex}
                  isMarked={markedQuestions.includes(currentQuestionIndex)}
                  onToggleMark={toggleMarkQuestion}
                  isStrikeMode={isStrikeMode}
                  onToggleStrikeMode={() => setIsStrikeMode(!isStrikeMode)}
                />

                <h3
                  className="
                    font-sans text-[1.125rem] font-normal text-slate-800 leading-[1.5]
                    tracking-[-0.01em]
                    mb-8
                  "
                >
                  <InteractiveText content={currentQ.questionText} />
                </h3>
                
                <div className="space-y-3">
                  {currentQ.choices.map((opt: any, index: number) => {
                      const isEliminated = eliminatedMap[currentQuestionIndex]?.includes(index);
                      const charLabel = String.fromCharCode(65 + index); // 0->A, 1->B

                      return (
                        <AnswerOption
                        key={index}
                        label={charLabel} // Tự động sinh A, B, C, D
                        content={opt.text}
                        // Logic hiển thị
                        isSelected={answers[currentQ.id] === charLabel}
                        isEliminated={!!isEliminated}
                        isStrikeMode={isStrikeMode}
                        
                        // Logic hành động
                        onSelect={() => handleSelectOption(charLabel)} // Hàm chọn đáp án cũ của bạn
                        onEliminate={(e) => handleEliminate(currentQuestionIndex, index, e)}
                        />
                      );
                  })}
                </div>
                
              </div>
            </div>
          </div>
        </div>

          {/* FOOTER */}
          <footer className="bg-white border-t h-20 px-8 flex items-center justify-between z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2 text-slate-600">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold">HV</div>
                <div className="font-bold">{localStorage.getItem('userName') || 'Học viên'}</div>
            </div>
            <div className="flex gap-4">
                <button 
                  onClick={() => setCurrentQuestionIndex(p => Math.max(phase === 'MODULE_2' ? splitIndex : 0, p - 1))}
                  disabled={currentQuestionIndex === (phase === 'MODULE_2' ? splitIndex : 0)}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-slate-700 rounded-lg font-semibold disabled:opacity-50 hover:bg-gray-50 transition"
                >
                    Back
                </button>
                <button 
                  onClick={() => {
                    if (phase === 'MODULE_2' && currentQuestionIndex == questions.length - 1) {
                      setShowSubmitModal(true);
                    }
                    else {
                      if (phase === 'MODULE_1' && currentQuestionIndex == splitIndex - 1) {
                        setPhase('REVIEW_1');
                      }
                      else {
                        setCurrentQuestionIndex(p => Math.min(questions.length - 1, p + 1))
                      }
                    }
                  }}
                  className={`px-6 py-2.5 text-white rounded-lg font-bold flex items-center gap-2 transition shadow-lg
                    ${
                      // Đổi màu nút bấm để cảnh báo sự thay đổi trạng thái
                      (phase === 'MODULE_1' && currentQuestionIndex === splitIndex - 1)
                      ? "bg-indigo-600 hover:bg-indigo-700" // Màu tím: Báo hiệu chuyển sang Review
                      : "bg-blue-600 hover:bg-blue-700"     // Màu xanh: Next bình thường
                    }
                  `}
                >
                  {/* Logic đổi tên nút bấm */}
                  {phase === 'MODULE_1' && currentQuestionIndex === splitIndex - 1 
                      ? "Review Module 1" 
                      : phase === 'MODULE_2' && currentQuestionIndex === questions.length - 1 
                      ? "Submit" 
                      : "Next"}
                </button>
            </div>
          </footer>
        </>
      )}

      {/* --- MODAL XÁC NHẬN NỘP BÀI --- */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Xác nhận nộp bài?</h3>
              <p className="text-slate-500 mb-6">
                Bạn có chắc chắn muốn kết thúc bài thi tại đây? <br/>
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowSubmitModal(false)} // Tắt modal
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-slate-700 font-bold rounded-lg hover:bg-gray-200 transition"
                >
                  Hủy bỏ
                </button>
                <button 
                  onClick={() => {
                    setShowSubmitModal(false); // Tắt modal
                    finishTest("Nộp bài thành công"); // Gọi hàm nộp thật
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition shadow-lg shadow-red-500/30"
                >
                  Nộp bài ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* MODAL START */}
      {showStartModal && (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-slate-800">Sẵn sàng làm bài?</h2>
            <p className="text-slate-600 mb-6 text-sm">
                Bài thi sẽ diễn ra ở chế độ toàn màn hình. 
                <br/>⚠️ Mỗi lần thoát màn hình tính là 1 lần vi phạm.
            </p>
            <button onClick={handleStartTest} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition shadow-lg hover:shadow-blue-500/30">
              Bắt đầu làm bài
            </button>
          </div>
        </div>
      )}  
      </div>
  );
}

export default ExamRoom;