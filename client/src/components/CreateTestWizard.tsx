import { useState, memo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Save, ArrowLeft, ImageIcon, Loader2,
  BookOpen, Clock, Layers, ShieldCheck, ShieldAlert, ArrowRight, FileType, AlignLeft,
  Users
 } from 'lucide-react';
import { parseSATInput, type SATQuestion } from '../utlis/satParser';
import InputGuideModal from './InputGuideModal';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import { Virtuoso } from 'react-virtuoso';
import BlockRenderer from './BlockRenderer';
import InteractiveText from './InteractiveText';

interface Section {
  name: string;      // Vd: "Reading and Writing - Module 1"
  order: number;     // Vd: 1
  duration: number;  // Vd: 27 (phút)
  questions: any[];  // Mảng câu hỏi đã parse
}

interface FinalTestStructure {
  title: string;
  description: string;
  subject: string;
  duration: number; // Tổng thời gian (vd: 64)
  mode: string;
  sections: Section[];
  assignClassId?: string;
  category: string;
  testDate?: string;
}

interface PreviewSectionProps {
  questions: SATQuestion[];
  onSave: () => void;
  isSubmitting: boolean;
  subject: string;
}

interface ClassOption {
  id: string; // Hoặc string, tùy vào database bạn dùng Int hay UUID
  name: string;
}

const PreviewSection = memo(({ questions, onSave, isSubmitting, subject }: PreviewSectionProps) => {
  return (
    <div className="flex flex-col h-full p-4 overflow-hidden relative">
      
      {/* 1. HEADER CỐ ĐỊNH (shrink-0 để không bao giờ bị bóp nhỏ) */}
      <div className="flex justify-between items-center mb-4 shrink-0 bg-gray-50 z-10 pb-2 border-b border-gray-200/50">
        <span className="font-bold text-gray-700 text-lg">
          Kết quả ({questions.length} câu)
        </span>
        <button
          onClick={onSave}
          disabled={questions.length === 0 || isSubmitting}
          className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Save size={18} /> {isSubmitting ? "Saving..." : "Save"}
        </button>
      </div>

      {/* 2. KHU VỰC CUỘN (Scrollable Area) */}
      <div className="flex-1 min-h-0">
        {/* TRẠNG THÁI TRỐNG */}
        {questions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-gray-400">
            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>Paste nội dung và nhấn "Phân tích" để xem trước.</p>
          </div>
        )}

        {/* DANH SÁCH CÂU HỎI */}
        <Virtuoso 
          style={{ height: '100%' }}
          className='scrollbar-thin scrollbar-thumb-gray-300 pr-2'
          data={questions}
          itemContent={(idx, q) => {
            const isMath = subject === 'MATH';
            return (
              <div className="pb-6"> 
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 text-sm hover:shadow-md transition-shadow">
                  {/* Header câu hỏi */}
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white bg-indigo-600 px-2 py-0.5 rounded text-xs">Câu {idx + 1}</span>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Module {q.module}</span>
                    </div>
                    <span className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-400 font-mono">ID: {idx + 1}</span>
                  </div>

                  {/* KHUNG TRÁI/TRÊN CỦA SAT (PASSAGE) */}
                  <div className="bg-[#fcfcfc] p-4 rounded border border-gray-100 text-gray-800 mb-4">
                    <BlockRenderer blocks={q.blocks} subject={subject} readOnly={true} />
                  </div>

                  {/* KHUNG DƯỚI/PHẢI CỦA SAT (QUESTION & CHOICES) */}
                  <div className="space-y-4">
                    
                    {/* 1. Câu hỏi dẫn nhập */}
                    <div className="font-sans font-bold text-gray-900 text-[15px]">
                      {q.questionText && (
                        <InteractiveText content={q.questionText} isMath={isMath} />
                      )}
                    </div>

                    {/* 2. Các đáp án (Phân nhánh MCQ và SPR) */}
                    {q.type === 'SPR' ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                        <span className="font-semibold text-amber-800">Đáp án điền (SPR):</span>
                        <span className="bg-white border border-amber-300 font-mono font-bold text-amber-900 px-3 py-1.5 rounded shadow-sm">
                          {q.correctAnswer}
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5">
                        {q.choices.map((choice) => (
                          <div
                            key={choice.id}
                            className={`p-3 border rounded-lg text-sm transition-all flex items-start gap-3 ${
                              choice.id === q.correctAnswer
                                ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border mt-0.5 ${
                              choice.id === q.correctAnswer
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-gray-500 border-gray-300'
                            }`}>
                              {choice.id}
                            </div>
                            <div className={`flex-1 pt-0.5 ${choice.id === q.correctAnswer ? 'text-emerald-800 font-medium' : 'text-gray-700'}`}>
                              <InteractiveText content={choice.text} isMath={isMath}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 3. Hiển thị Giải thích (Explanation) nếu có */}
                    {q.explanation && (
                      <div className="mt-4 p-3 bg-gray-50 border-l-4 border-indigo-400 rounded-r-lg text-sm text-gray-600">
                        <span className="font-bold text-indigo-600 block mb-1">Giải thích:</span>
                        <InteractiveText content={q.explanation} isMath={isMath}/>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }}  
        />
      </div>
    </div>
  );
});

const CreateTestWizard = () => {
  // --- STATE QUẢN LÝ ---
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Info, 2: Content
  
  // Dữ liệu Bước 1: Metadata
  const [testInfo, setTestInfo] = useState({
    title: '',
    description: '',
    subject: 'RW', // RW (Reading Writing) hoặc MATH
    moduleCount: 2, // 1 hoặc 2
    duration: 64, // Phút
    mode: 'PRACTICE',
    assignClassId: '',
    category: 'PRACTICE',
    testDate: ''
  });
  const userRole = localStorage.getItem('userRole');

  // Dữ liệu Bước 2: Nội dung raw và json parsed
  const [rawText, setRawText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<SATQuestion[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [myClasses, setMyClasses] = useState<ClassOption[]>([]);

  const [isLoading, setIsLoading] = useState(false); // Trạng thái đang loading
  const fileInputRef = useRef<HTMLInputElement>(null);   // Để kích hoạt input file
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Để thao tác con trỏ trong textarea

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const data = await axiosClient.get<ClassOption[], ClassOption[]>(`/api/tests/classes`);
        setMyClasses(data);
      } catch (error) {
        console.error("Lỗi tải lớp:", error);
      } finally {
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (myClasses.length > 0 && !testInfo.assignClassId) {
      setTestInfo(prev => ({
        ...prev,
        assignClassId: myClasses[0].id
      }));
    }
  }, [myClasses]);


  // --- XỬ LÝ BƯỚC 1 ---
  const handleInfoSubmit = (e: any) => {
    e.preventDefault();
    if (!testInfo.title) return toast.error("Vui lòng nhập tên bài test");
    setStep(2); // Chuyển sang bước nhập liệu
  };

  // --- XỬ LÝ BƯỚC 2 ---
  const handleParse = () => {
    const data = parseSATInput(rawText);
    
    // Validate số lượng module
    const modulesFound = new Set(data.map((q: any) => q.module)).size;
    if (modulesFound > testInfo.moduleCount) {
        toast.error(`Cảnh báo: Bạn chọn ${testInfo.moduleCount} module nhưng nội dung lại có ${modulesFound} module.`);
    }

    setParsedQuestions(data);
  };

  // --- BƯỚC CUỐI: GỬI API ---
  const handleCreateTest = useCallback(async () => {
    setIsLoading(true);
    const modulesMap = new Map<number, any[]>();

    parsedQuestions.forEach((q) => {
      const modNum = q.module || 1; // Mặc định module 1 nếu ko tìm thấy
      if (!modulesMap.has(modNum)) {
        modulesMap.set(modNum, []);
      }
      // Xóa trường module thừa đi vì đã gom vào section rồi (tuỳ bạn)
      const { module, ...cleanQuestion } = q; 
      modulesMap.get(modNum)?.push(cleanQuestion);
    });

    const durationPerModule = Math.floor(testInfo.duration / (modulesMap.size || 1));

    // 2. Tạo mảng sections theo đúng cấu trúc JSON
    const sections: Section[] = Array.from(modulesMap.keys()).sort().map((modNum) => ({
      name: `Module ${modNum}`, // Tự sinh tên
      order: modNum,
      duration: durationPerModule, // (Ví dụ: chia đều hoặc hardcode 32 phút/module chuẩn SAT)
      questions: (modulesMap.get(modNum) || []).map(q => ({
        ...q,
        choices: Array.isArray(q.choices) ? q.choices : Object.values(q.choices || {})
      }))
    }));

    let finalCategory = 'PRACTICE';
    if (userRole === 'ADMIN') {
      finalCategory = testInfo.category;
    } else {
      finalCategory = 'CLASS';
    }

    // 3. Tạo Object cuối cùng
    const finalPayload: FinalTestStructure = {
      title: testInfo.title,
      description: testInfo.description || "Reading and Writing - Full Test",
      duration: parseInt(testInfo.duration.toString()),
      mode: testInfo.mode,
      subject: testInfo.subject,
      sections: sections,
      assignClassId: testInfo.assignClassId === '' ? undefined : testInfo.assignClassId,
      category: finalCategory,
      testDate: testInfo.testDate == '' ? undefined : testInfo.testDate
    };

    // --- GỌI API ---
    try {
      await axiosClient.post('/api/tests/create', finalPayload);
      navigate(-1);
    } catch (error) {
      toast.error("❌ Lỗi khi lưu vào Database");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [parsedQuestions]);

  // === 2. HÀM CHÈN TEXT VÀO VỊ TRÍ CON TRỎ ===
  const insertAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const originalText = textarea.value;
    
    // Chèn text vào giữa
    const newText = originalText.substring(0, start) + textToInsert + originalText.substring(end);
    setRawText(newText);
    
    // Focus lại và đưa con trỏ ra sau đoạn vừa chèn
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 0);
  };

  // === 3. HÀM UPLOAD LÊN CLOUDINARY ===
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // Giới hạn 5MB
      toast.error("File quá lớn! Vui lòng chọn ảnh dưới 5MB");
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    // --- CẤU HÌNH CLOUDINARY ---
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME; 
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_PRESET;
    // ------------------------------------

    if (!cloudName || !uploadPreset) {
        toast.error("Thiếu cấu hình Cloudinary trong .env");
        setIsLoading(false);
        return;
    }

    formData.append('upload_preset', uploadPreset);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();

      if (data.secure_url) {
        // Tạo cú pháp Markdown ảnh
        const markdown = `![Image](${data.secure_url})\n`;
        insertAtCursor(markdown);
      } else {
        toast.error("Lỗi upload ảnh (Sai cấu hình Cloudinary?)");
      }
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi upload");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
    }
  };

  // Component con: Stepper (Thanh tiến trình)
  const Stepper = memo(({ currentStep }: { currentStep: number }) => (
    <div className="flex items-center gap-2 text-sm select-none"> {/* Thêm select-none để ko bị bôi đen nhầm */}
      <div className={`flex items-center gap-2 transition-colors duration-300 ${currentStep === 1 ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
        <span className={`w-10 h-10 rounded-full flex items-center justify-center border text-base ${currentStep === 1 ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}`}>1</span>
        Thông tin
      </div>
      
      {/* Dùng border-t thay vì div rỗng để render nhẹ hơn */}
      <div className="w-8 border-t border-gray-300"></div>
      
      <div className={`flex items-center gap-2 transition-colors duration-300 ${currentStep === 2 ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
        <span className={`w-10 h-10 rounded-full flex items-center justify-center border text-base ${currentStep === 2 ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}`}>2</span>
        Nội dung
      </div>
    </div>
  ));

  return (
    // KHUNG CONTAINER CHÍNH (Vừa vặn với Content Area bên phải Sidebar)
    <div className="h-full flex flex-col p-4 sm:p-0 overflow-hidden relative">
      {/* HEADER TRANG (Giữ cố định ở trên) */}
      <div className="flex items-center justify-between shrink-0 mb-4 z-20">
        <div className="flex-1 flex items-center">
          <button 
            onClick={() => {
              if (step === 2) setStep(1);
              else navigate(-1);
            }} 
            className="flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:bg-slate-100 font-medium rounded-full"
            title="Go back"
          >
            <ArrowLeft size={20} />
          </button>
        </div>
        
        <div className="shrink-0">
          <Stepper currentStep={step} />
        </div>

        <div className="flex-1"></div>
      </div>

      {/* BODY CONTENT (Thay đổi tùy theo Step) */}
      <div className="flex-1 min-h-0 w-full max-w-6xl mx-auto flex flex-col">
        
        {/* ========================================== */}
        {/* === BƯỚC 1: FORM NHẬP THÔNG TIN (STEP 1) === */}
        {/* ========================================== */}
        {step === 1 && (
          <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-0">
            <form onSubmit={handleInfoSubmit} className="flex flex-col h-full">
              {/* Header của form */}
              <div className="px-6 py-4 border-b border-gray-100 shrink-0">
                <h2 className="text-xl font-bold text-gray-800">Cấu hình bài thi</h2>
                <p className="text-sm text-gray-500 mt-1">Vui lòng điền các thông tin cơ bản trước khi nhập nội dung.</p>
              </div>

              {/* Vùng chứa form (Sẽ scroll nếu màn hình QUÁ nhỏ, nhưng mặc định sẽ cố gắng vừa khít) */}
              <div className="flex-1 p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                  
                  {/* CỘT 1: Thông tin cơ bản & Phân loại */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                          <BookOpen size={16} className="text-indigo-600"/> Tên bài kiểm tra
                        </label>
                        <input 
                          type="text" 
                          className="w-full border-gray-300 border bg-gray-50/50 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                          placeholder="Ví dụ: SAT Practice Test #1"
                          value={testInfo.title}
                          onChange={e => setTestInfo({...testInfo, title: e.target.value})}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                          <AlignLeft size={16} className="text-indigo-600"/> Mô tả ngắn
                        </label>
                        <textarea
                          rows={2}
                          className="w-full border-gray-300 border bg-gray-50/50 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm resize-none"
                          value={testInfo.description}
                          onChange={(e) => setTestInfo({ ...testInfo, description: e.target.value })}
                          placeholder="Ví dụ: Bài thi thử kỹ năng Reading & Writing..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-2">
                          <FileType size={14} className="text-indigo-600"/> Môn thi
                        </label>
                        <select 
                          className="w-full border-gray-300 border bg-white p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm"
                          value={testInfo.subject}
                          onChange={e => setTestInfo({...testInfo, subject: e.target.value})}
                        >
                          <option value="RW">Reading & Writing</option>
                          <option value="MATH">Mathematics</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-2">
                          <Clock size={14} className="text-indigo-600"/> Thời gian (phút)
                        </label>
                        <input 
                          type="number" 
                          className="w-full border-gray-300 border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm"
                          value={testInfo.duration}
                          onChange={e => setTestInfo({...testInfo, duration: parseInt(e.target.value)})}
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-2">
                          <Layers size={14} className="text-indigo-600"/> Số lượng Modules
                        </label>
                        <div className="flex bg-gray-200/60 p-1 rounded-lg">
                          {[1, 2].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setTestInfo({...testInfo, moduleCount: num})}
                              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                testInfo.moduleCount === num 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              {num} Module
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CỘT 2: Phân quyền & Chế độ thi */}
                  <div className="space-y-6">
                    {userRole === 'ADMIN' ? (
                      <div className="p-4 bg-blue-50/80 border border-blue-100 rounded-xl space-y-3">
                        <label className="text-sm font-bold text-blue-900 flex items-center gap-2">
                          Phân loại đề thi
                        </label>
                        <div className="flex items-center gap-3">
                          <label className="flex-1 flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-blue-100 shadow-sm hover:border-blue-300">
                            <input type="radio" name="category" value="PRACTICE" checked={testInfo.category !== 'REAL'} onChange={() => setTestInfo({ ...testInfo, category: 'PRACTICE', testDate: '' })} className="text-blue-600" />
                            <span className="text-sm font-medium">Luyện tập</span>
                          </label>
                          <label className="flex-1 flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-blue-100 shadow-sm hover:border-blue-300">
                            <input type="radio" name="category" value="REAL" checked={testInfo.category === 'REAL'} onChange={() => setTestInfo({ ...testInfo, category: 'REAL' })} className="text-blue-600" />
                            <span className="text-sm font-medium">Thi thật</span>
                          </label>
                        </div>
                        {testInfo.category === 'REAL' && (
                          <div className="mt-2">
                            <input type="date" className="w-full border-gray-300 border p-2 rounded-lg text-sm" value={testInfo.testDate || ''} onChange={(e) => setTestInfo({ ...testInfo, testDate: e.target.value })}/>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Users size={16} className="text-indigo-600"/> Giao cho lớp (Tùy chọn)
                          </label>
                          {isLoading ? (
                            <div className="text-sm text-gray-500">Đang tải...</div>
                          ) : myClasses.length > 0 ? (
                            <select className="w-full border-gray-300 border bg-white p-2.5 rounded-lg text-sm" value={testInfo.assignClassId} onChange={e => setTestInfo({...testInfo, assignClassId: e.target.value})}>
                              {myClasses.map((cls) => (<option key={cls.id} value={cls.id}>{cls.name}</option>))}
                            </select>
                          ) : (
                            <div className="text-xs bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200">
                              Chưa có lớp nào. Hãy tạo lớp trước.
                            </div>
                          )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-indigo-600"/> Chế độ bảo mật
                      </label>
                      <div className="grid grid-cols-1 gap-3">
                        <div onClick={() => setTestInfo({...testInfo, mode: 'PRACTICE'})} className={`cursor-pointer border rounded-xl p-3 flex gap-3 ${testInfo.mode === 'PRACTICE' ? 'border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500' : 'border-gray-200'}`}>
                          <div className={`shrink-0 p-2 rounded-lg h-fit ${testInfo.mode === 'PRACTICE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}><BookOpen size={18} /></div>
                          <div>
                            <div className={`font-bold text-sm ${testInfo.mode === 'PRACTICE' ? 'text-emerald-800' : 'text-gray-700'}`}>Luyện tập tự do</div>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Cho phép rời tab, copy/paste, xem đáp án.</p>
                          </div>
                        </div>
                        <div onClick={() => setTestInfo({...testInfo, mode: 'EXAM'})} className={`cursor-pointer border rounded-xl p-3 flex gap-3 ${testInfo.mode === 'EXAM' ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-500' : 'border-gray-200'}`}>
                          <div className={`shrink-0 p-2 rounded-lg h-fit ${testInfo.mode === 'EXAM' ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-500'}`}><ShieldAlert size={18} /></div>
                          <div>
                            <div className={`font-bold text-sm ${testInfo.mode === 'EXAM' ? 'text-rose-800' : 'text-gray-700'}`}>Kiểm tra nghiêm ngặt</div>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Chống gian lận: Khóa copy, bắt buộc toàn màn hình.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Footer form - Nút bấm luôn cố định ở dưới */}
              <div className="p-4 border-t border-gray-100 bg-gray-50/50 shrink-0 flex justify-end">
                <button 
                  disabled={userRole !== 'ADMIN' && myClasses.length === 0}
                  type="submit" 
                  className="flex items-center gap-2 px-8 py-2.5 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  Next
                  <ArrowRight size={18} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================== */}
        {/* === BƯỚC 2: EDITOR & PREVIEW (STEP 2) === */}
        {/* ========================================== */}
        {step === 2 && (
          <div className="flex w-full overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200 h-[calc(100vh-120px)]">
            
            {/* CỘT TRÁI: EDITOR */}
            {/* Thêm flex-1, min-w-0 và min-h-0 cực kỳ quan trọng */}
            <div className="flex-1 min-w-0 flex flex-col border-r border-gray-200 bg-white min-h-0 p-4">
              
              {/* Toolbar nhỏ gọn */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-gray-300 border-b-0 rounded-t-lg shrink-0">
                <div className="flex items-center gap-2">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="p-1.5 rounded hover:bg-white hover:text-indigo-600 text-gray-600 flex items-center gap-1.5 text-sm font-medium transition-colors"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                    <span>Chèn ảnh</span>
                  </button>
                </div>
                <button
                  onClick={() => setShowGuide(true)}
                  className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                >
                  Hướng dẫn cú pháp
                </button>
              </div>

              {/* Vùng Textarea chiếm toàn bộ không gian còn lại */}
              <div className="flex-1 min-h-0 relative overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full h-full p-6 border-none focus:ring-0 outline-none font-mono text-sm leading-relaxed custom-scrollbar overflow-y-auto resize-none shadow-inner bg-white"
                  placeholder="Nhập nội dung đề thi vào đây..."
                />
              </div>

              {/* Cụm nút được cố định ở đáy cột trái */}
              <div className="mt-4 shrink-0 flex">
                <button onClick={handleParse} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]">
                  <Play size={18} /> Phân tích & Xem trước
                </button>
              </div>
            </div>

            {/* CỘT PHẢI: PREVIEW SECTION */}
            <div className="flex-1 min-w-0 min-h-0 bg-gray-50 flex flex-col relative">
              <div className="absolute inset-0">
                <PreviewSection
                  questions={parsedQuestions}
                  onSave={handleCreateTest}
                  isSubmitting={isLoading}
                  subject={testInfo.subject}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    
      {showGuide && (
        <InputGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
      )}
      
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          <span className="text-indigo-800 font-medium">Đang xử lý dữ liệu...</span>
        </div>
      )}
      
    </div>
  );
};

export default CreateTestWizard;

