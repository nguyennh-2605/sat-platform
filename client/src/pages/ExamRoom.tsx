import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Maximize } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
// import cac component
import QuestionHeader from '../components/QuestionHeader';
import AnswerOption from '../components/AnswerOption';
import BlockRenderer from '../components/BlockRenderer';
import ToolsHeader from '../components/ToolsHeader';
import InteractiveText from '../components/InteractiveText';
import ReviewScreen from '../components/ReviewModule';
import ScoreReport from '../ScoreReport';
import type { QuestionData } from '../types/quiz';
import type { QuestionResult } from '../ScoreReport';
import FormattedTextRenderer from '../utlis/TextRenderer';
import ResizableSplitLayout from '../components/layouts/ResizableSplitLayout';
import SingleColumnLayout from '../components/layouts/SingleColumnLayout';
import SPRInstructions from '../components/SPRInstructions';
import { useQuizTool } from '../context/QuizToolContext';
import Calculator from '../components/Calculator';

function ExamRoom() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- STATE QUẢN LÝ ---
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  
  // State cho tính năng Đánh dấu (Mark for Review)
  const [markedQuestions, setMarkedQuestions] = useState<number[]>([]);

  // State Modal & Sidebar
  const [showStartModal, setShowStartModal] = useState(true);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // State kết quả
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Timer & Anticheat
  const [timeLeft, setTimeLeft] = useState(32 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [violationCount, setViolationCount] = useState(0);

  // Thêm state để lưu Submission ID
  const [submissionId, setSubmissionId] = useState<number | null>(null);

  // State lưu thời điểm bài thi kết thúc
  const [endTime, setEndTime] = useState<number | null>(null);

  // 1. State quản lý giai đoạn hiện tại
  type ExamPhase = 'MODULE_1' | 'REVIEW_1' | 'MODULE_2' | 'REVIEW_2';
  const [phase, setPhase] = useState<ExamPhase>('MODULE_1');

  // state để quyết định khi nào hiện cửa sổ xác nhận
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // State lưu cấu hình thời gian (tính bằng PHÚT để dễ hiển thị)
  const [examConfig, setExamConfig] = useState({
    mod1Duration: 0,
    mod2Duration: 0,
    totalModules: 1
  })

  const [isTransitioning, setIsTransitioning] = useState(false);

  // STATE BẬT/TẮT CHẾ ĐỘ GẠCH
  const [isStrikeMode, setIsStrikeMode] = useState(false);

  // STATE LƯU NHỮNG CÂU BỊ GẠCH
  // Cấu trúc: { 0: [0, 2], 1: [1] } -> Câu 0 gạch đáp án A, C; Câu 1 gạch đáp án B
  const [eliminatedMap, setEliminatedMap] = useState<Record<number, number[]>>({});

  // State lưu thông tin bài thi từ Dashboard gửi qua
  const [TestInfo, setTestInfo] = useState({
    title: '',
    description: '',
    duration: 0,
    subject: ''
  }) 

  // State lưu độ dài module 1
  const [firstModuleLength, setFirstModuleLength] = useState(0);

  // State lưu mode của Test
  const [testMode, setTestMode] = useState<'PRACTICE' | 'EXAM'>('PRACTICE');

  // State để hiển thị màn hình chặn khi thoát fullscreen
  const [isFullscreenBlocked, setIsFullscreenBlocked] = useState(false);

  const [isBackAnimating, setIsBackAnimating] = useState(false);
  const [isNextAnimating, setIsNextAnimating] = useState(false);

  const [isTimeVisible, setIsTimeVisible] = useState(true); // State quan li hien thoi gian

  // --- STATE QUẢN LÝ RESIZE ---
  const [leftWidth, setLeftWidth] = useState(50); // Mặc định 50%
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const hasFetched = useRef(false);

  // State quan li calculator
  const { isCalculatorOpen, toggleCalculator } = useQuizTool();

  // Dữ liệu Backend trả về sau khi nộp bài
  interface BackendResult {
    score: number;
    totalQuestions: number;
    details: {
      questionId: number | string;
      isCorrect: boolean;
      correctOption: string; // Backend nói câu này đáp án là gì
      userSelected: string | null; // Backend xác nhận user đã chọn gì
    }[];
  }

  const [apiResult, setApiResult] = useState<BackendResult | null>(null);

  // --- 1. GỌI API LẤY ĐỀ THI ---
  useEffect(() => {
    if (!id) return;

    const userId = localStorage.getItem('userId');
    if (!userId) {
      toast.error("Bạn chưa đăng nhập!");
      navigate('/login');
      return;
    }

    if (hasFetched.current) {
      return;
    }
    hasFetched.current = true;

    const getAuthHeader = () => {
      const token = localStorage.getItem('token');
      return { headers: { Authorization: `Bearer ${token}` } };
    };

    const fetchExamData = async () => {
      try {
        setIsLoading(true);

        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/test/${id}?userId=${userId}`, getAuthHeader());

        if (!response) throw new Error("Không có dữ liệu");

        const data = response.data;

        if (data.sections) {
          let allQuestions: QuestionData[] = [];
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
                  moduleIndex: section.order,
                  type: q.type || 'MCQ'
                } as QuestionData; 
              });
              allQuestions = [...allQuestions, ...qs];
            }
          });
          setQuestions(allQuestions);

          setExamConfig({
            mod1Duration: data.sections[0]?.duration || 0,
            mod2Duration: data.sections[1]?.duration || 0,
            totalModules: data.sections.length
          });
          
          if (data.sections.length > 0) {
            setFirstModuleLength(data.sections[0].questions.length);
          }
        }

        setTestInfo({
          title: data.title,
          description: data.description,
          duration: data.duration,
          subject: data.subject
        });

        console.log("subject hien tai", data.subject);

        const mode = data.mode || 'PRACTICE';
        setTestMode(mode);
        if (mode === 'PRACTICE') {
          setShowStartModal(false); // Vào làm luôn ko cần confirm
        }

        if (data.session) {
          const {
            submissionId, 
            startedAt, 
            timeLeft: dbTimeLeft, 
            savedAnswers: dbSavedAnswers, 
            currentQuestionIndex: dbCurrentQuestionIndex,
            violationCount: dbViolationCount
          } = data.session;

          setSubmissionId(submissionId);

         let currentPhase = 'MODULE_1';
          if (data.sections.length > 1 && dbCurrentQuestionIndex >= data.sections[0].questions.length) {
            currentPhase = 'MODULE_2';
            setPhase('MODULE_2');
          } else {
            setPhase('MODULE_1');
          }

          const mod1DurationMinutes = data.sections[0].duration;
          const totalDurationMinutes = data.duration; 

          let targetEndTime = 0;
          let secondsRemaining = 0;

          if (mode === 'PRACTICE') {
            const totalTimeLeft = dbTimeLeft !== null ? dbTimeLeft : (totalDurationMinutes * 60);
            targetEndTime = Date.now() + (totalTimeLeft * 1000);
            secondsRemaining = totalTimeLeft;
          } else {
              // Thời gian trôi không ngừng nghỉ
              const startMs = new Date(startedAt).getTime();

              if (currentPhase === 'MODULE_1') {
                  // Deadline Mod 1 = Bắt đầu + Duration Mod 1
                  targetEndTime = startMs + (mod1DurationMinutes * 60 * 1000);
              } else {
                  // Deadline Mod 2 = Bắt đầu + Tổng thời gian (Vì Mod 2 nối đuôi Mod 1)
                  targetEndTime = startMs + (totalDurationMinutes * 60 * 1000);
              }
              
              secondsRemaining = Math.max(0, Math.floor((targetEndTime - Date.now()) / 1000));
          }

          setEndTime(targetEndTime);
          setTimeLeft(secondsRemaining);

          // Logic chạy timer
          if (secondsRemaining <= 0) {
              if (currentPhase === 'MODULE_1') {
                  // Nếu vừa load trang mà đã thấy hết giờ Mod 1 -> Tự chuyển
                  startModule2(); 
              } else {
                  finishTest(submissionId);
              }
          } else {
              setIsTimerRunning(true);
          }

          setCurrentQuestionIndex(dbCurrentQuestionIndex);

          // Uu tien khoi phuc dap an tu db hon
          if (dbSavedAnswers && Object.keys(dbSavedAnswers).length > 0) {
            setAnswers(dbSavedAnswers)
          } else {
            // KHÔI PHỤC ĐÁP ÁN TỪ LOCAL STORAGE (Nếu user refresh trang)
            const localSavedAnswers = localStorage.getItem(`answers_${userId}_${id}`);
            if (localSavedAnswers) {
              const parsedAnswers = JSON.parse(localSavedAnswers);
              setAnswers(parsedAnswers);
            }
          }
          if (data.mode === 'EXAM') {
            if (dbViolationCount > 0) {
              setViolationCount(dbViolationCount);
            } else {
              const savedViolations = localStorage.getItem(`violations_${userId}_${id}`);
              if (savedViolations) {
                setViolationCount(parseInt(savedViolations, 10));
              } else {
                setViolationCount(0);
              }
            }
          } else {
            setViolationCount(0);
          }
        }
      } catch (error) {
      console.error("Lỗi tải đề:", error);
      toast.error("Không thể tải bài thi. Vui lòng thử lại.");
      navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExamData();
  }, [id]);

  // --- HÀM HỖ TRỢ ---
  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    }
  };

  // --- 2. LOGIC NỘP BÀI ---
  const finishTest = useCallback(async (passedSubmissionId?: number) => {
    setIsTimerRunning(false);
    setIsReviewOpen(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

    setIsSubmitting(true);

    try {
        const storedUserId = localStorage.getItem('userId');
        const userId = storedUserId ? parseInt(storedUserId) : null;

        if (!userId) {
            toast.error("Lỗi: Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại!");
            return;
        }

        const idToSubmit = passedSubmissionId || submissionId; 

        if (!idToSubmit) {
             console.error("Lỗi: Không có submissionId để nộp");
             return;
        }

        const getAuthHeader = () => {
          const token = localStorage.getItem('token');
          return { headers: { Authorization: `Bearer ${token}` } };
        };

        const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/test/${id}/submit`, {
          submissionId: idToSubmit,
          answers,
          violationCount
        }, getAuthHeader());

        localStorage.removeItem(`answers_${userId}_${id}`);
        localStorage.removeItem(`violations_${userId}_${id}`);
        setApiResult(response.data);
        setIsSubmitted(true);
        toast.success("Nộp bài thành công!");
    } catch (error) {
        console.error("Lỗi mạng:", error);
        toast.error("Không thể kết nối đến server để nộp bài!");
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
        const secondsRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(secondsRemaining);

        if (secondsRemaining <= 0) {
          clearInterval(timer);
          if (phase === 'MODULE_2') {
            finishTest();
          }
          else {
            startModule2();
            toast("Hết giờ Module 1, chuyển sang Module 2.");
          }
        }
      }, 1000);
    }
    // Clear interval khi unmount hoặc khi dependency thay đổi
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTimerRunning, endTime, phase]);

  useEffect(() => {
    if (violationCount > 3 && !isSubmitted) {
      finishTest();
    }
  }, [violationCount, isSubmitted, finishTest]);

  // --- LOGIC ANTICHEAT ---
  useEffect(() => {    
    if (!isTimerRunning || isSubmitted || testMode !== 'EXAM') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolationCount(prev => prev + 1);
        toast(`⚠️ CẢNH BÁO: Đừng rời khỏi màn hình!`);
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isTimerRunning) {
        setViolationCount(prev => prev + 1);
        setIsFullscreenBlocked(true);
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
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener('copy', handleCopyCutPaste);
      document.removeEventListener('cut', handleCopyCutPaste);
      document.removeEventListener('paste', handleCopyCutPaste);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTimerRunning, isSubmitted, testMode]);

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
    let displaySeconds = seconds;
    if (testMode === 'PRACTICE' && (phase === 'MODULE_1' || phase === 'REVIEW_1')) {
      displaySeconds = Math.max(0, seconds - (examConfig.mod2Duration * 60));
    }
    const m = Math.floor(displaySeconds / 60);
    const s = displaySeconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStartTest = () => {
    if (testMode === 'EXAM') {
      enterFullscreen();
    }
    setShowStartModal(false);
    setIsTimerRunning(true);
  };

  const handleSelectOption = (optionId: string) => {
    setAnswers(prev => {
        const newAnswers = { ...prev, [currentQ.id]: optionId };
        
        // Lưu ngay vào localStorage
        const userId = localStorage.getItem('userId');
        localStorage.setItem(`answers_${userId}_${id}`, JSON.stringify(newAnswers));
        
        return newAnswers;
    });
  };

  const handleSprChange = (value: string) => {
    // Tùy chọn: Lọc bỏ các ký tự không hợp lệ (chỉ giữ lại số, dấu chấm, dấu /, và dấu -)
    const sanitizedValue = value.replace(/[^0-9./-]/g, '');

    // Cập nhật vào state answers chung (Giả sử bạn đang dùng setAnswers)
    // Thay setAnswers bằng hàm update state thực tế của bạn nếu tên khác nhé
    setAnswers((prevAnswers: any) => ({
      ...prevAnswers,
      [currentQ.id]: sanitizedValue // Lưu chuỗi học sinh vừa nhập theo ID câu hỏi
    }));
  };

  const splitIndex = useMemo(() => {
    if (questions.length === 0) return 0;
    if (examConfig.totalModules == 1) {
      return questions.length;
    }
    return firstModuleLength // Cắt đôi: Ví dụ 20 câu -> split tại 10
  }, [questions.length, examConfig.totalModules, firstModuleLength]);


  const jumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    setIsReviewOpen(false); // Đóng sidebar sau khi chọn
  };

  const startModule2 = () => {
    if (phase !== 'REVIEW_1' && phase !== 'MODULE_1') return;
    // BẬT MÀN HÌNH LOADING NGAY LẬP TỨC
    setIsTransitioning(true);
    const now  = Date.now();
    const mod1UsedSecond = Math.max(0, examConfig.mod1Duration * 60 - timeLeft);
    const userId = localStorage.getItem('userId');
    localStorage.setItem(`mod1TimeUsed_${userId}_${id}`, mod1UsedSecond.toString());
    // Tính toán lại endTime mới
    const mod2Duration = examConfig.mod2Duration * 60;
    const newEndTime = now + mod2Duration * 1000;
    setEndTime(newEndTime);
    setTimeLeft(mod2Duration);
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

  const getResults = (): QuestionResult[] => {
    if (!apiResult) return [];
    // Mapping dữ liệu sang dạng của Score Report
    return questions.map((q, index) => {
      const moduleName = index < splitIndex ? "Module 1" : "Module 2";
      const questionNumber = moduleName === 'Module 1' ? index + 1 : index - splitIndex + 1;
      // Backend tra ve mang detail => Ta tim theo id
      const gradedInfo = apiResult.details.find(d => d.questionId === q.id);
      return  {
        id: q.id,
        module: moduleName,
        questionNumber: questionNumber,
        blocks: q.blocks,
        questionText: q.questionText,
        choices: q.choices.map((c, i) => ({
          id: c.id,
          text: c.text,
          label: String.fromCharCode(65 + i)
        })),
        correctAnswer: gradedInfo?.correctOption || "",
        userAnswer: gradedInfo?.userSelected || null,
        isCorrect: gradedInfo?.isCorrect || false
      };
    });
  };

  // Hàm bắt đầu kéo
  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize'; // Đổi con trỏ chuột toàn trang
    document.body.style.userSelect = 'none';   // Chặn bôi đen văn bản khi đang kéo
  };

  // Hàm xử lý khi di chuột (được gắn vào document)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      // Tính % độ rộng mới dựa trên vị trí chuột trong container
      let newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Giới hạn không cho kéo quá nhỏ hoặc quá to (VD: min 20%, max 80%)
      if (newLeftWidth < 20) newLeftWidth = 20;
      if (newLeftWidth > 80) newLeftWidth = 80;

      setLeftWidth(newLeftWidth);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';      // Trả lại con trỏ chuột
        document.body.style.userSelect = '';  // Trả lại khả năng bôi đen
      }
    };

    // Gắn sự kiện vào document để khi kéo chuột ra ngoài khung vẫn nhận
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleReturnToFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      // Nếu thành công thì tắt màn hình chặn đi
      setIsFullscreenBlocked(false);
    } catch (err) {
      console.error("Lỗi fullscreen:", err);
      toast.error("Vui lòng cho phép Fullscreen để tiếp tục làm bài!");
    }
  };

  const handleSaveExamData = useCallback(async () => {
    if (!id) return;

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    if (!userId || !token) {
      toast.error("Vui lòng đăng nhập lại!");
      return;
    }

    setIsLoading(true);

    try {
      localStorage.setItem(`answers_${userId}_${id}`, JSON.stringify(answers));
      if (violationCount > 0) {
        localStorage.setItem(`violations_${userId}_${id}`, violationCount.toString());
      }
      localStorage.setItem(`lastQuestionIndex_${userId}_${id}`, currentQuestionIndex.toString());
      // URL API save (Thường là POST hoặc PUT)
      // Dựa trên URL fetch của bạn: `${import.meta.env.VITE_API_URL}/api/test/${id}`
      const saveUrl = `${import.meta.env.VITE_API_URL}/api/test/${id}/save-progress`; 

      const payload = {
        submissionId: Number(submissionId), // Lấy từ state (đã set trong useEffect)
        answers: answers,           // Object đáp án hiện tại
        timeLeft: timeLeft,         // Thời gian còn lại  
        violationCount: violationCount,
        currentQuestionIndex: currentQuestionIndex
      };

      console.log("payload gui ve backend", payload);

      const getAuthHeader = () => {
        const token = localStorage.getItem('token');
        return { headers: { Authorization: `Bearer ${token}` } };
      };

      await axios.post(saveUrl, payload, getAuthHeader());

      console.log("Đã đồng bộ dữ liệu lên Server thành công");
      toast.success("Lưu bài làm thành công!");
      navigate('/dashboard'); // Hoặc trang danh sách bài thi

    } catch (error) {
      console.error("Lỗi save:", error);
      navigate('/dashboard');
    }

  }, [id, answers, violationCount, currentQuestionIndex, submissionId, phase, timeLeft, navigate]);

  const handleQuestionJump = (realIndex: number) => {
    // Xác định xem câu hỏi đó thuộc Module nào để chuyển phase cho đúng
    if (realIndex < splitIndex) {
        setPhase('MODULE_1');
    } else {
        setPhase('MODULE_2');
    }
    setCurrentQuestionIndex(realIndex);
  };

  const formatSprPreview = (value: string | undefined) => {
    if (!value) return '';
    
    // Nếu chuỗi có dấu gạch chéo -> Chuyển thành phân số LaTeX
    if (value.includes('/')) {
      const [numerator, denominator] = value.split('/');
      
      // Chỉ render phân số khi học sinh đã gõ cả tử và mẫu (tránh vỡ UI khi mới gõ "3/")
      if (numerator !== undefined && denominator !== undefined && denominator !== '') {
        return `$\\frac{${numerator}}{${denominator}}$`;
      }
    }
    
    // Nếu là số bình thường, số âm, hoặc thập phân -> Bọc $ để dùng font Toán học
    return `$${value}$`;
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
    return <div className="h-screen flex items-center justify-center text-blue-600 font-bold"> Đang chấm điểm...</div>;
  }

  if (questions.length === 0) {
      return <div className="min-h-screen flex items-center justify-center">Không tìm thấy câu hỏi nào!</div>;
  }

  // --- RENDER KẾT QUẢ ---
  if (isSubmitted && apiResult) {
    const formatDuration = (totalSeconds: number) => {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      // Nếu có giờ thì hiện H:MM:SS, không thì hiện MM:SS
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const userId = localStorage.getItem('userId');
    const savedMod1TimeUsed = localStorage.getItem(`mod1TimeUsed_${userId}_${id}`);
    const mod1TimeUsed = parseInt(savedMod1TimeUsed || "0", 10);
    console.log("Tong thoi gian lam bai mod 1", mod1TimeUsed);
    const savedMod2Start = localStorage.getItem(`mod2Start_${userId}_${id}`);
    let mod2TimeUsed = 0
    if (savedMod2Start) {
      mod2TimeUsed = Math.max(0, examConfig.mod2Duration - timeLeft);
    }
    const secondsUsed = mod1TimeUsed + mod2TimeUsed;

    const reportData = {
      examTitle: TestInfo.title,
      subject: TestInfo.description,
      date: new Date().toLocaleString(),
      duration: formatDuration(secondsUsed <= 0 ? TestInfo.duration * 60 : secondsUsed), // Thời gian làm bài thực tế
      questions: getResults()
    }

    return (
      <ScoreReport 
        initialData={reportData}
        onBackToHome={() => {
          localStorage.removeItem(`mod2Start_${userId}_${id}`);
          localStorage.removeItem(`mod1TimeUsed_${userId}_${id}`);
          localStorage.removeItem('current_exam_info');
          window.location.href = '/dashboard';
        }}
      />
    );
  }

  // 1. KIỂM TRA DỮ LIỆU TRƯỚC (Thêm đoạn này vào đầu hàm return hoặc trước khi khai báo currentQ)
  if (!questions || questions.length === 0 || !questions[currentQuestionIndex]) {
    return <div className="p-10 text-center">Đang tải đề thi...</div>;
  }

  // --- BIẾN CHO CÂU HỎI HIỆN TẠI ---
  const currentQ = questions[currentQuestionIndex]; 
  console.log("type cau hien tai", currentQ.type);
  const sidebarOffset = phase === 'MODULE_2' ? splitIndex : 0;

  // --- RENDER PHÒNG THI ---

  const renderLeftContent = () => {
    if (TestInfo.subject === 'MATH' && currentQ.type != 'MCQ') {
      return (
        <div className="h-full overflow-y-auto custom-scrollbar">
          <SPRInstructions />
        </div>
      );
    } 
    if (currentQ.blocks && currentQ.blocks.length > 0) {
      return <BlockRenderer blocks={currentQ.blocks} subject={TestInfo.subject}/>
    }
    return null;
  };

  const renderRightContent = () => {
    return (
      <>
        <QuestionHeader 
          currentPhase={phase}
          splitIndex={splitIndex}
          currentIndex={currentQuestionIndex}
          isMarked={markedQuestions.includes(currentQuestionIndex)}
          onToggleMark={toggleMarkQuestion}
          isStrikeMode={isStrikeMode}
          onToggleStrikeMode={() => setIsStrikeMode(!isStrikeMode)}
        />
        {TestInfo.subject === 'MATH' && currentQ.type !== 'SPR' && (
          <div className="my-0"> {/* Thêm margin y-6 để tạo khoảng cách trên dưới */}
            {renderLeftContent()}
          </div>
        )} 
        {TestInfo.subject === 'MATH' && currentQ.type !== 'MCQ' && currentQ.blocks && currentQ.blocks.length > 0 && (
          <div className="my-0"> 
            <BlockRenderer blocks={currentQ.blocks} subject={TestInfo.subject}/>
          </div>
        )}
        <h3 className="
          font-['Source_Serif_4',_'Georgia',_serif] 
          lining-nums tabular-nums 
          font-normal text-[#1a1a1a] 
          leading-relaxed tracking-normal mb-3
          
          text-[16px]           /* Set cho h3 */
          [&_*]:text-[16px]     /* ÉP BUỘC các thẻ con bên trong cũng phải 13px */
          [&_p]:text-[16px]     /* Cẩn thận hơn: Ép thẻ p bên trong (nếu có) */
        ">
          {TestInfo.subject === 'MATH' 
            ? <FormattedTextRenderer text={currentQ.questionText}/>
            : <InteractiveText content={currentQ.questionText}/>
          }
        </h3>
        <div className="space-y-3 mt-6">
          {currentQ.type === 'SPR' ? (
            <div className="mt-4">
             <div className="flex flex-col items-start"> {/* Căn lề trái cho khối nhập */}
                <div className="relative w-36 font-mono"> {/* Tăng w-36 cho rộng rãi chút */}
                  <input
                    type="text"
                    // 3. pb-1: Giảm padding bottom một chút để chữ nằm sát đường kẻ hơn
                    className="w-full p-3 pb-3 text-xl border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center bg-transparent relative z-10"
                    value={answers[currentQ.id] || ''}
                    onChange={(e) => handleSprChange(e.target.value)}
                    maxLength={5}
                    placeholder=" "
                  />
                  
                  <div className="absolute bottom-3 left-4 right-4 border-b border-gray-400 z-0 pointer-events-none"></div>
                </div>
              </div>
              
              {/* Khu vực Answer Preview */}
              <div className="mt-8 flex items-center space-x-3">
                <span className="font-bold text-[18px] font-['Source_Serif_4',_'Georgia',_serif] text-[#1a1a1a]">
                  Answer Preview:
                </span>
                
                {/* Render kết quả Preview bằng LaTeX */}
                <div className="text-[18px] min-h-[30px] flex items-center justify-center">
                  {answers[currentQ.id] && (
                    <FormattedTextRenderer text={formatSprPreview(answers[currentQ.id])} />
                  )}
                </div>
              </div>
            </div>
          ) : (
            currentQ.choices.map((opt: any, index: number) => {
              const isEliminated = eliminatedMap[currentQuestionIndex]?.includes(index);
              const charLabel = String.fromCharCode(65 + index);
              return (
                <AnswerOption
                  key={index}
                  label={charLabel}
                  content={opt.text}
                  isSelected={answers[currentQ.id] === charLabel}
                  isEliminated={!!isEliminated}
                  isStrikeMode={isStrikeMode}
                  onSelect={() => handleSelectOption(charLabel)}
                  onEliminate={(e) => handleEliminate(currentQuestionIndex, index, e)}
                  currentSubject={TestInfo.subject}
                />
              );
            })
          )}
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans relative overflow-hidden">
      {/* COMPONENT LOADING */}
      {isTransitioning && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
          {/* Icon Spinner xoay xoay */}
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          
          <h2 className="text-2xl font-bold text-slate-800">Đang chuẩn bị Module 2...</h2>
          <p className="text-slate-500 mt-2">Vui lòng đợi trong giây lát</p>
        </div>
      )}

      {/* HEADER */}
      <div className="relative z-20">
          {/* HEADER CHÍNH */}
          <header className="bg-blue-50 h-auto py-3 px-6 flex items-center justify-between relative">
            
            {/* --- PHẦN TRÁI: Tiêu đề Module --- */}
            <div className="flex items-center gap-4 w-1/3"> {/* Đặt w-1/3 để cân bằng layout */}
              <span className="font-bold text-lg text-slate-800 truncate">
                Section {TestInfo.subject === 'RW' ? 1 : 2}, {phase === 'MODULE_2' ? "Module 2" : "Module 1"}: {TestInfo.description}
              </span>
            </div>

            {/* --- PHẦN GIỮA: Đồng hồ (Canh giữa tuyệt đối) --- */}
           <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center">
              {isTimeVisible ? (
                <>
                  {/* Hiển thị giờ */}
                  <div className={`font-mono text-xl font-bold mb-1 ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
                    {formatTime(timeLeft)}
                  </div>
                  
                  {/* Nút Hide: Có viền + Hiệu ứng nảy */}
                  <button 
                    onClick={() => setIsTimeVisible(false)}
                    className="
                      text-xs font-medium text-slate-700
                      border border-gray-500 bg-white rounded-full px-3 py-0.5 shadow-sm
                      active:scale-90 transition-transform duration-100 ease-in-out
                      hover:ring-1 hover:ring-black
                    "
                  >
                    Hide
                  </button>
                </>
              ) : (
                <>
                  {/* Khi ẩn: Gom Icon và nút Show thành 1 khối click được cho tiện */}
                  <button 
                    onClick={() => setIsTimeVisible(true)}
                    className="
                      flex flex-col items-center gap-1 group
                      active:scale-90 transition-transform duration-100 ease-in-out
                    "
                    title="Show Timer"
                  >
                    {/* Icon Đồng hồ */}
                    <div className="text-slate-500 group-hover:text-gray-700 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                    </div>
                    
                    {/* Nút Show: Style giống nút Hide */}
                    <span className="
                      text-xs font-medium text-slate-700
                      border border-gray-500 bg-white rounded-full px-3 py-0.5 shadow-sm
                      active:scale-90 transition-transform duration-100 ease-in-out
                      hover:ring-1 hover:ring-black
                    ">
                      Show
                    </span>
                  </button>
                </>
              )}
            </div>

            {/* --- PHẦN PHẢI: Công cụ (Tools) --- */}
            <div className="flex items-center justify-end gap-6 w-1/3">
              <ToolsHeader 
                onSaveAction={handleSaveExamData}
                currentMode={testMode}
                currentSubject={TestInfo.subject}
              />
            </div>
          </header>

          {/* ĐƯỜNG KẺ NÉT ĐỨT (Gradient Style) */}
          {/* Nằm ngay dưới header, dùng chung wrapper div */}
          <div className="w-full h-[2px] bg-[linear-gradient(90deg,#374151_90%,transparent_90%)] bg-[length:25px_2px]"></div>
        </div>
      
      {/* === TRƯỜNG HỢP 1: GIAO DIỆN REVIEW (FULL SCREEN) === */}
      
      {(phase === 'REVIEW_1' || phase === 'REVIEW_2') ? (
        <ReviewScreen
          phase={phase}
          questions={questions}
          answers={answers}
          markedQuestions={markedQuestions}
          splitIndex={splitIndex}
          onQuestionClick={handleQuestionJump}
          description={TestInfo.description}
        />
      ) : (
        <>
         {/* --- MODAL REVIEW (Theo phong cách Bluebook) --- */}
        {isReviewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-end pb-24">
          {/* Overlay nền tối (Click để đóng) */}
          <div 
            className="absolute inset-0" 
            onClick={() => setIsReviewOpen(false)}
          />
          
          {/* MODAL CONTAINER */}
          <div className="relative bg-white w-[520px] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-300 animate-in slide-in-from-bottom-4 duration-200">
            
            {/* 1. HEADER */}
            <div className="py-3 px-4 flex items-start justify-between">
              <div className="flex-1 text-center mt-1">
                <h3 className="font-bold text-base text-gray-900">
                  Review Page
                </h3>
              </div>
              <button 
                onClick={() => setIsReviewOpen(false)} 
                className="
                  text-gray-400 hover:text-gray-600 
                  p-1 
                  border border-transparent      /* 1. Viền trong suốt mặc định */
                  hover:border-gray-300          /* 2. Hiện viền khi hover */
                  hover:bg-gray-50               /* (Tùy chọn) Thêm nền nhẹ cho đẹp */
                  active:scale-95 active:bg-gray-100 /* 3. Hiệu ứng nhún và đổi màu khi ấn */
                  transition-all duration-200    /* Làm mượt chuyển động */
                  rounded-md
                "
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mx-6 border-b border-gray-400"></div>

            {/* 2. LEGEND (CHÚ THÍCH) - Clean style */}
            <div className="flex justify-center items-center gap-8 py-4 text-sm font-medium text-gray-700">
              {/* Current */}
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-800 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                <span>Current</span>
              </div>

              {/* Unanswered */}
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border border-dashed border-gray-600 rounded-sm"></div>
                <span>Unanswered</span>
              </div>

              {/* For Review */}
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-700 fill-current" viewBox="0 0 24 24">
                  <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                </svg>
                <span>For Review</span>
              </div>
            </div>

            <div className="mx-6 border-b border-gray-400"></div>
            
            {/* 3. GRID CÂU HỎI */}
            <div className="p-6">
              {/* Grid 10 cột giống ảnh */}
              <div className="grid grid-cols-10 gap-y-6 gap-x-2"> 
                {sidebarQuestions.map((q, index) => {
                  const realIndex = index + sidebarOffset;
                  const isAnswered = answers[q.id] !== undefined; // Logic check đã trả lời
                  const isMarked = markedQuestions.includes(realIndex);
                  const isCurrent = currentQuestionIndex === realIndex;
                  
                  return (
                    <div key={q.id} className="flex items-center justify-center">
                      <div className="relative w-8 h-8">
                        {isCurrent && (
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                            <svg className="w-5 h-5 text-gray-800 fill-current drop-shadow-sm" viewBox="0 0 24 24">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                          </div>
                        )}

                        {isMarked && (
                          <div className="absolute -top-1.5 -right-1.5 z-20 pointer-events-none">
                            <svg className="w-4 h-4 text-red-700 fill-current drop-shadow-md" viewBox="0 0 24 24">
                              <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                            </svg>
                          </div>
                        )}

                        {/* Ô SỐ (BUTTON) */}
                        <button
                          onClick={() => {
                            jumpToQuestion(realIndex);
                            setIsReviewOpen(false);
                          }}
                          className={`
                            w-full h-full flex items-center justify-center text-sm font-semibold transition-all
                            rounded-sm
                            ${/* Style cho câu HIỆN TẠI (viền xanh đậm) */
                              isCurrent
                              ? isAnswered
                              ? 'text-white underline underline-offset-2 decoration-2 text-xl font-bold hover:border-gray-600 bg-blue-700 hover:bg-blue-800' 
                              : 'border border-dashed border-gray-600 text-blue-700 underline underline-offset-2 decoration-2 text-xl font-bold hover:bg-gray-100'
                              : ''
                            }
                            ${/* Style cho câu CHƯA TRẢ LỜI (nét đứt, màu xanh) */
                              !isCurrent && !isAnswered 
                              ? 'border border-dashed border-gray-600 text-blue-700 text-xl font-bold hover:bg-gray-100' 
                              : ''
                            }
                            ${/* Style cho câu ĐÃ TRẢ LỜI (nét liền, màu đen) */
                              !isCurrent && isAnswered 
                              ? 'text-white text-xl font-bold hover:border-gray-600 bg-blue-700 hover:bg-blue-800' 
                              : ''
                            }
                          `}
                        >
                          {index + 1}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. FOOTER */}
            <div className="pb-6 pt-2 flex justify-center">
              <button 
                onClick={() => {
                  setIsReviewOpen(false)
                  if (phase === 'MODULE_1') {
                    setPhase('REVIEW_1');
                  } else {
                    setPhase('REVIEW_2');
                  }
                }}
                className="px-8 py-2 border-[1.5px] border-blue-700 text-blue-700 text-sm font-bold rounded-full hover:bg-blue-50 transition-colors"
              >
                Go to Review Page
              </button>
            </div>

            {/* 5. CÁI ĐUÔI (ARROW) - BIG & SEAMLESS */}
            {/* Sử dụng một hình vuông xoay 45 độ, cùng màu nền với modal để che viền */}
            <div className="
              absolute 
              -bottom-4        /* Đẩy lên một chút (-2 thay vì -3) để khớp nền */
              left-1/2 
              -translate-x-1/2 
              w-8 h-8     
              bg-white 
              border-r border-b border-gray-300 /* Giữ nguyên viền phải/dưới */
              rotate-45
            "></div>
            </div>
          </div>
        )}

          {/* --- NỘI DUNG CHÍNH (BODY) --- */}
          {(TestInfo.subject === 'MATH' && currentQ.type !== 'SPR') ? (
            <SingleColumnLayout>
              {renderRightContent()}
            </SingleColumnLayout>
          ) : (
            <ResizableSplitLayout
              containerRef={containerRef}
              leftWidth={leftWidth}
              handleMouseDown={handleMouseDown}
              leftContent={renderLeftContent()}
              rightContent={renderRightContent()}
            />
          )}
        </>
      )}

      {/* FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="w-full h-[2px] bg-[linear-gradient(90deg,#374151_90%,transparent_90%)] bg-[length:25px_2px]"></div>

        <footer className="bg-blue-50 h-auto py-3 px-8 flex items-center justify-between z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 text-slate-600">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold">HV</div>
            <div className="font-bold">{localStorage.getItem('userName') || 'Học viên'}</div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
            {phase != 'REVIEW_1' && phase != 'REVIEW_2' && (
              <button
                onClick={() => {
                  isReviewOpen ? setIsReviewOpen(false) : setIsReviewOpen(true);
                }} // Mở sidebar khi click
                className="bg-black text-white px-4 py-1.5 rounded-lg flex items-center gap-2 hover:bg-slate-800 transition-all font-medium text-base group"
              >
                <span>
                  Question { phase === 'MODULE_2' ? currentQuestionIndex - splitIndex + 1 : currentQuestionIndex + 1 } of {
                    phase === 'MODULE_2' ? questions.length - splitIndex : splitIndex
                  }
                </span>
                <svg 
                  className={`w-4 h-4 transition-transform duration-300 ${isReviewOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex gap-4">
            <button 
              // 1. Logic xử lý Click
              onClick={() => {
                if (isBackAnimating || currentQuestionIndex === (phase === 'MODULE_2' ? splitIndex : 0)) return;
                setIsBackAnimating(true);
                if (phase === 'REVIEW_1') {
                  setPhase('MODULE_1');
                  setCurrentQuestionIndex(splitIndex - 1);
                }
                else if (phase === 'REVIEW_2') {
                  setPhase('MODULE_2');
                  setCurrentQuestionIndex(questions.length - 1);
                }
                else {
                  setCurrentQuestionIndex(p => Math.max(phase === 'MODULE_2' ? splitIndex : 0, p - 1));
                } 
                setTimeout(() => {
                  setIsBackAnimating(false);
                }, 300);
              }}

              // 2. Logic Disable (Gộp cả điều kiện cũ + điều kiện đang animation)
              disabled={
                currentQuestionIndex === (phase === 'MODULE_2' ? splitIndex : 0) || 
                isBackAnimating
              }

              // 3. Class Styling
              className={`
                px-6 py-2.5 rounded-full font-bold flex items-center gap-2 shadow-lg
                transition-all duration-200 ease-in-out  /* Quan trọng: Tạo độ mượt khi đổi màu */

                ${currentQuestionIndex === (phase === 'MODULE_2' ? splitIndex : 0) 
                  ? 'invisible pointer-events-none'  // Tàng hình + không click được
                  : 'visible' 
                }

                ${isBackAnimating 
                  ? 'bg-white text-gray-700 ring-2 ring-gray-600 scale-95' // Trạng thái NHÁY: Nền trắng, chữ xanh, co lại xíu
                  : 'bg-blue-700 text-white hover:bg-blue-800' // Trạng thái THƯỜNG: Nền xanh, chữ trắng
                }

                /* Style cho nút khi bị Disable thực sự (đầu trang) */
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              Back
            </button>
            <button 
              onClick={() => {
                if (isNextAnimating) return;
                setIsNextAnimating(true);
                if (phase === 'REVIEW_2') {
                  setShowSubmitModal(true);
                }
                else if (phase === 'REVIEW_1') {
                  if (examConfig.totalModules == 1) {
                    setShowSubmitModal(true);
                  }
                  else startModule2();
                }
                else if (phase === 'MODULE_2' && currentQuestionIndex == questions.length - 1) {
                  setIsReviewOpen(false);
                  setPhase('REVIEW_2');
                }
                else if (phase === 'MODULE_1' && currentQuestionIndex == splitIndex - 1) {
                  setIsReviewOpen(false);
                  setPhase('REVIEW_1');
                }
                else {
                  setCurrentQuestionIndex(p => Math.min(questions.length - 1, p + 1))
                }
                setTimeout(() => {
                  setIsNextAnimating(false);
                }, 300);
              }}

              disabled={isNextAnimating}

              className={`
                px-6 py-2.5 rounded-full font-bold flex items-center gap-2 shadow-lg
                transition-all duration-200 ease-in-out  /* Quan trọng: Tạo độ mượt khi đổi màu */

                ${isNextAnimating 
                  ? 'bg-white text-gray-700 ring-2 ring-gray-600 scale-95' // Trạng thái NHÁY: Nền trắng, chữ xanh, co lại xíu
                  : 'bg-blue-700 text-white hover:bg-blue-800' // Trạng thái THƯỜNG: Nền xanh, chữ trắng
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {
                // Nếu là câu cuối cùng của toàn bộ bài thi (Mod 2 HOẶC Mod 1 nếu chỉ có 1 mod)
                (phase === 'REVIEW_2') || (phase === 'REVIEW_1' && examConfig.totalModules === 1)
                  ? "Submit" 
                  : "Next"
                }
            </button>
          </div>
        </footer>
      </div>

      {/* --- MODAL XÁC NHẬN NỘP BÀI --- */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
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
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-slate-700 font-bold rounded-full hover:bg-gray-200 transition"
                >
                  Hủy bỏ
                </button>
                <button 
                  onClick={() => {
                    setShowSubmitModal(false); // Tắt modal
                    finishTest(); // Gọi hàm nộp thật
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-full hover:bg-red-700 transition shadow-lg shadow-red-500/30"
                >
                  Nộp bài
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

      {/* --- MODAL CHẶN MÀN HÌNH KHI THOÁT FULLSCREEN --- */}
     {isFullscreenBlocked && (
      <div className="fixed inset-0 z-50 bg-white/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-rose-500"></div>
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6 text-orange-600">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Gián đoạn chế độ toàn màn hình
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Hệ thống phát hiện bạn đã rời khỏi màn hình thi. 
            Vui lòng quay lại ngay để tránh bị ghi nhận vi phạm.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-8 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Số lần cảnh báo ({violationCount}/3)
            </p>
            <div className="flex justify-center gap-3">
              {[1, 2, 3].map((index) => (
                <div 
                  key={index}
                  className={`h-3 w-3 rounded-full transition-all duration-300 ${
                    index <= violationCount 
                      ? 'bg-rose-500 scale-110 shadow-sm' // Đã vi phạm
                      : 'bg-gray-200' // Chưa vi phạm
                  }`}
                />
              ))}
            </div>
            {violationCount >= 2 && (
              <p className="text-xs text-rose-500 mt-2 font-medium italic">
                Cảnh báo: Bài thi sẽ tự động nộp nếu vi phạm lần 3.
              </p>
            )}
          </div>
          <button 
            onClick={handleReturnToFullscreen}
            className="w-full bg-gray-900 text-white font-bold py-3.5 px-6 rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
          >
            <Maximize size={18} />
            Quay lại làm bài
          </button>

        </div>
      </div>
    )}
    {TestInfo.subject === 'MATH' && (
      <Calculator 
        isOpen={isCalculatorOpen}
        onClose={toggleCalculator}
      />
    )}
    </div>
  );
}

export default ExamRoom;