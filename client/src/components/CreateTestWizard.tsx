import { useState, memo, useRef, useCallback, useEffect } from 'react';
import { Play, Save, ArrowLeft, X, FileText, ImageIcon, Loader2,
  BookOpen, Clock, Layers, ShieldCheck, ShieldAlert, ArrowRight, FileType, AlignLeft,
  AlertCircle,
  Users
 } from 'lucide-react';
import { parseSATInput, type SATQuestion } from '../utlis/satParser';
import { createPortal } from "react-dom";
import InputGuideModal from './InputGuideModal';
import FormattedTextRenderer from '../utlis/TextRenderer';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';

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
}

interface ClassOption {
  id: string; // Hoặc string, tùy vào database bạn dùng Int hay UUID
  name: string;
}

const CreateTestWizard = ({ onClose, userRole }: any) => {
  // --- STATE QUẢN LÝ ---
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

  // Dữ liệu Bước 2: Nội dung raw và json parsed
  const [rawText, setRawText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<SATQuestion[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [myClasses, setMyClasses] = useState<ClassOption[]>([]);

  const [isLoading, setIsLoading] = useState(false); // Trạng thái đang loading
  const fileInputRef = useRef<HTMLInputElement>(null);   // Để kích hoạt input file
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Để thao tác con trỏ trong textarea

  useEffect(() => {
    if (userRole !== 'TEACHER') return;
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
    if (userRole !== 'TEACHER') return;
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
    console.log("DEBUG RAW TEXT:", JSON.stringify(rawText));
    const data = parseSATInput(rawText);
    console.log("DEBUG PARSED RESULT:", data);
    
    // Validate số lượng module
    const modulesFound = new Set(data.map((q: any) => q.module)).size;
    if (modulesFound > testInfo.moduleCount) {
        toast.error(`Cảnh báo: Bạn chọn ${testInfo.moduleCount} module nhưng nội dung lại có ${modulesFound} module.`);
    }

    setParsedQuestions(data);
  };

  // --- BƯỚC CUỐI: GỬI API ---
  const handleCreateTest = useCallback(async () => {
    // 1. Nhóm các câu hỏi theo Module (1, 2, ...)
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

    console.log("CLass Id", testInfo.assignClassId);

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

    // --- LOG RA KẾT QUẢ HOẶC GỌI API TẠI ĐÂY ---
    console.log("JSON chuẩn DB:", JSON.stringify(finalPayload, null, 2));

    // --- GỌI API ---
    try {
      await axiosClient.post('/api/tests/create', finalPayload);
      window.location.reload();
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
        <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs ${currentStep === 1 ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}`}>1</span>
        Thông tin
      </div>
      
      {/* Dùng border-t thay vì div rỗng để render nhẹ hơn */}
      <div className="w-8 border-t border-gray-300"></div>
      
      <div className={`flex items-center gap-2 transition-colors duration-300 ${currentStep === 2 ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
        <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs ${currentStep === 2 ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}`}>2</span>
        Nội dung
      </div>
    </div>
  ));

  const PreviewSection = memo(({ questions, onSave, isSubmitting } : PreviewSectionProps) => {
    console.log("Render Preview Section");

    return (
      <div className="w-1/2 p-4 flex flex-col bg-gray-50 h-full border-l">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-50 z-10 py-2">
          <span className="font-bold text-gray-700 text-lg">Kết quả ({questions.length} câu)</span>
          <button
            onClick={onSave}
            disabled={questions.length === 0 || isSubmitting}
            className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Save size={18} /> {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2 pb-20 scrollbar-thin scrollbar-thumb-gray-300">
          {questions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Paste nội dung và nhấn "Phân tích" để xem trước.</p>
            </div>
          )}

          {/* VÒNG LẶP CÂU HỎI */}
          {questions.map((q, idx) => (
            <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 text-sm hover:shadow-md transition-shadow">
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
                {q.blocks.map((block, i) => (
                  <div key={i} className="mb-4 last:mb-0">
                    
                    {/* 1. TEXT BLOCK (Dùng Component mới để render Bullet points) */}
                    {block.type === 'text' && (
                      <FormattedTextRenderer text={block.content} />
                    )}

                    {block.type === 'note' && (
                      <div className="my-3 font-sans text-[15px] leading-relaxed text-gray-800">
                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                          
                          {/* 1. Hiển thị dòng đầu tiên (Intro text) - Không có bullet */}
                          {block.lines.length > 0 && (
                            <p className="mb-2 text-gray-900 font-medium">
                              {block.lines[0]}
                            </p>
                          )}

                          {/* 2. Hiển thị các dòng còn lại (Bullet points) */}
                          {block.lines.length > 1 && (
                            <ul className="list-disc pl-5 space-y-1.5 text-gray-900">
                              {/* @ts-ignore */}
                              {/* Dùng slice(1) để bỏ qua phần tử đầu tiên, lấy từ phần tử thứ 2 trở đi */}
                              {block.lines.slice(1).map((line, idx) => (
                                <li key={idx} className="pl-1">
                                  {line}
                                </li>
                              ))}
                            </ul>
                          )}
                          
                        </div>
                      </div>
                    )}

                    {/* 2. TABLE BLOCK */}
                    {block.type === 'table' && (
                      <div className="overflow-x-auto border rounded bg-white shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 font-semibold text-gray-700">
                            <tr>
                              {block.headers.map((h, idx) => (
                                <th key={idx} className="px-3 py-2 text-left text-xs uppercase tracking-wider font-bold border-b">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {block.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-gray-50">
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 border-r last:border-r-0">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 3. POEM BLOCK */}
                    {block.type === 'poem' && (
                      <div className="pl-8 text-center italic text-gray-800 font-sans leading-8">
                        {block.lines.map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                      </div>
                    )}

                    {/* 4. IMAGE BLOCK */}
                    {block.type === 'image' && (
                      <div className="my-4 flex justify-center">
                        {block.src ? (
                          <img 
                            src={block.src} 
                            alt="Question Image" 
                            className="max-h-64 rounded-lg border border-gray-200 shadow-sm object-contain"
                            loading="lazy"
                          />
                        ) : (
                          // Fallback nếu không parse được src
                          <div className="h-20 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                            [Ảnh lỗi: Không tìm thấy link]
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* KHUNG DƯỚI/PHẢI CỦA SAT (QUESTION & CHOICES) */}
              <div className="space-y-4">
                  {/* 1. Câu hỏi dẫn nhập */}
                  <div className="font-sans font-bold text-gray-900 text-[15px]">
                      {/* Dùng FormattedTextRenderer để lỡ có Math LaTeX thì nó render được */}
                      {q.questionText ? <FormattedTextRenderer text={q.questionText} /> : null}
                  </div>

                  {/* 2. Các đáp án (Phân nhánh MCQ và SPR) */}
                  {q.type === 'SPR' ? (
                      // Hiển thị cho dạng điền khuyết (SPR)
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                          <span className="font-semibold text-amber-800">Đáp án điền (SPR):</span>
                          <span className="bg-white border border-amber-300 font-mono font-bold text-amber-900 px-3 py-1.5 rounded shadow-sm">
                              {q.correctAnswer}
                          </span>
                      </div>
                  ) : (
                      // Hiển thị cho dạng trắc nghiệm (MCQ)
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
                                      {/* Tương tự, dùng FormattedTextRenderer để render Toán trong đáp án */}
                                      <FormattedTextRenderer text={choice.text} />
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}

                  {/* 3. Hiển thị Giải thích (Explanation) nếu có */}
                  {q.explanation && (
                      <div className="mt-4 p-3 bg-gray-50 border-l-4 border-indigo-400 rounded-r-lg text-sm text-gray-600">
                          <span className="font-bold text-indigo-600 block mb-1">Giải thích:</span>
                          <FormattedTextRenderer text={q.explanation} />
                      </div>
                  )}
              </div>

            </div>
          ))}
        </div>
      </div>
    );
  });

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 z-[50] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* HEADER MODAL */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
        <div className="flex items-center gap-4">
           {/* Nút đóng giả lập icon app */}
           <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-200">
              <FileText size={20} />
           </div>
           <div>
              <h2 className="text-lg font-bold text-gray-800">Tạo đề thi mới</h2>
              <Stepper currentStep={step} />
           </div>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>

        {/* BODY MODAL */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/30">
          
          {/* === GIAO DIỆN BƯỚC 1: FORM NHẬP INFO === */}
          {step === 1 && (
            <div className="p-6 max-w-3xl mx-auto">
              <form onSubmit={handleInfoSubmit} className="space-y-8">
                {/* === PHẦN 1: THÔNG TIN CƠ BẢN === */}
                <div className="space-y-4">
                  <div className="grid gap-5">
                    {/* Tên bài thi */}
                    <div className="relative group">
                      <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                        <BookOpen size={16} className="text-indigo-600"/> Tên bài kiểm tra
                      </label>
                      <input 
                        type="text" 
                        className="w-full border-gray-300 border bg-gray-50/50 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-sm"
                        placeholder="Ví dụ: SAT Practice Test #1"
                        value={testInfo.title}
                        onChange={e => setTestInfo({...testInfo, title: e.target.value})}
                      />
                    </div>

                    {/* Mô tả (Dùng Textarea thay vì Input) */}
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                        <AlignLeft size={16} className="text-indigo-600"/> Mô tả ngắn
                      </label>
                      <textarea
                        rows={2}
                        className="w-full border-gray-300 border bg-gray-50/50 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-sm resize-none"
                        value={testInfo.description}
                        onChange={(e) => setTestInfo({ ...testInfo, description: e.target.value })}
                        placeholder="Ví dụ: Bài thi thử kỹ năng Reading & Writing..."
                      />
                    </div>
                  </div>
                </div>

                {/* === PHẦN 2: CẤU HÌNH BÀI THI (Grid 3 cột) === */}
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Môn thi */}
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                        <FileType size={16} className="text-indigo-600"/> Môn thi
                      </label>
                      <div className="relative">
                        <select 
                          className="w-full appearance-none border-gray-300 border bg-white p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                          value={testInfo.subject}
                          onChange={e => setTestInfo({...testInfo, subject: e.target.value})}
                        >
                          <option value="RW">Reading & Writing</option>
                          <option value="MATH">Mathematics</option>
                        </select>
                        <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                        </div>
                      </div>
                    </div>

                    {/* Thời gian */}
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                        <Clock size={16} className="text-indigo-600"/> Thời gian
                      </label>
                      <div className="relative">
                          <input 
                            type="number" 
                            className="w-full border-gray-300 border p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm pr-12"
                            value={testInfo.duration}
                            onChange={e => setTestInfo({...testInfo, duration: parseInt(e.target.value)})}
                          />
                          <span className="absolute right-4 top-3 text-gray-400 text-sm font-medium">phút</span>
                      </div>
                    </div>

                    {/* Số lượng Module (Dạng Toggle) */}
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                        <Layers size={16} className="text-indigo-600"/> Modules
                      </label>
                      <div className="flex bg-gray-100 p-1 rounded-xl">
                        {[1, 2].map((num) => (
                          <button
                              key={num}
                              type="button"
                              onClick={() => setTestInfo({...testInfo, moduleCount: num})}
                              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                                testInfo.moduleCount === num 
                                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                                : 'text-gray-500 hover:text-gray-700'
                              }`}
                          >
                              {num} Mod
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* DÒNG MỚI: CHỌN LỚP HỌC (Full Width) */}
                {userRole === 'ADMIN' ? (
                // --- GIAO DIỆN CHO ADMIN ---
                  <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl space-y-4">
                    
                    {/* 1. Chọn loại đề thi */}
                    <div>
                      <label className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Loại đề thi (Category)
                      </label>
                      
                      <div className="flex items-center gap-4">
                        {/* Option: PRACTICE */}
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-blue-100 shadow-sm hover:border-blue-300 transition-all">
                          <input 
                            type="radio" 
                            name="category" 
                            value="PRACTICE"
                            className="text-blue-600 focus:ring-blue-500"
                            checked={testInfo.category !== 'REAL'} // Mặc định hoặc chọn Practice
                            onChange={() => setTestInfo({ ...testInfo, category: 'PRACTICE', testDate: '' })} 
                          />
                          <span className="text-sm font-medium text-gray-700">Luyện tập (Practice)</span>
                        </label>

                        {/* Option: REAL TEST */}
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-blue-100 shadow-sm hover:border-blue-300 transition-all">
                          <input 
                            type="radio" 
                            name="category" 
                            value="REAL"
                            className="text-blue-600 focus:ring-blue-500"
                            checked={testInfo.category === 'REAL'}
                            onChange={() => setTestInfo({ ...testInfo, category: 'REAL' })} 
                          />
                          <span className="text-sm font-medium text-gray-700">Đề thi thật (Real Test)</span>
                        </label>
                      </div>
                    </div>

                    {/* 2. Chọn ngày thi (Chỉ hiện khi chọn REAL) */}
                    {testInfo.category === 'REAL' && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="text-sm font-bold text-blue-900 mb-1.5 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          Ngày thi (Test Date)
                        </label>
                        <input
                          type="date"
                          className="w-full border-gray-300 border bg-white p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm"
                          value={testInfo.testDate || ''}
                          onChange={(e) => setTestInfo({ ...testInfo, testDate: e.target.value })}
                        />
                        <p className="text-xs text-blue-600 mt-1 italic">* Ngày này sẽ hiển thị để học sinh biết đợt thi.</p>
                      </div>
                    )}
                  </div>
                ) : (
                 <div className="mt-5">
                  {isLoading ? (
                    <div className="text-sm text-gray-500 italic">Đang tải danh sách lớp...</div>
                  ) : myClasses.length > 0 ? (
                    // TRƯỜNG HỢP 1: CÓ LỚP -> HIỆN DROPDOWN
                    <div className="mt-5">
                      <>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                          <Users size={16} className="text-indigo-600"/> Giao cho lớp (Tùy chọn)
                        </label>
                        
                        {/* Logic Dropdown chọn lớp của Teacher */}
                        <div className="relative">
                          <select 
                            className="w-full appearance-none border-gray-300 border bg-white p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                            value={testInfo.assignClassId}
                            onChange={e => setTestInfo({...testInfo, assignClassId: e.target.value})}
                          >
                            {myClasses.map((cls) => (
                              <option key={cls.id} value={cls.id}>
                                {cls.name}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                          </div>
                        </div>
                      </>
                    </div>
                  ) : (
                    // TRƯỜNG HỢP 2: KHÔNG CÓ LỚP -> CẢNH BÁO & YÊU CẦU TẠO
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800">
                      <AlertCircle size={24} className="text-amber-600 shrink-0" />
                      <div className="flex-1 text-sm">
                        <span className="font-bold">Bạn chưa quản lý lớp nào.</span>
                        <br/>
                        Để giao bài tập này cho học sinh, bạn cần tạo lớp trước.
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* === PHẦN 3: CHẾ ĐỘ THI (Highlight) === */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-indigo-600"/> Chọn chế độ thi
                  </label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Option: PRACTICE */}
                    <div 
                      onClick={() => setTestInfo({...testInfo, mode: 'PRACTICE'})}
                      className={`cursor-pointer relative overflow-hidden border-2 rounded-2xl p-4 transition-all duration-200 flex flex-col gap-2
                      ${testInfo.mode === 'PRACTICE' 
                        ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500 shadow-md' 
                        : 'border-gray-200 hover:border-emerald-200 hover:bg-gray-50'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${testInfo.mode === 'PRACTICE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            <BookOpen size={20} />
                          </div>
                          <span className={`font-bold text-lg ${testInfo.mode === 'PRACTICE' ? 'text-emerald-800' : 'text-gray-700'}`}>
                            Luyện tập
                          </span>
                        </div>
                        {testInfo.mode === 'PRACTICE' && <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-white ring-2 ring-emerald-200"></div>}
                      </div>
                      <p className="text-sm text-gray-500 pl-[3.25rem]">
                        Thoải mái ôn tập. Cho phép rời màn hình, copy/paste và xem đáp án ngay.
                      </p>
                    </div>

                    {/* Option: EXAM */}
                    <div 
                      onClick={() => setTestInfo({...testInfo, mode: 'EXAM'})}
                      className={`cursor-pointer relative overflow-hidden border-2 rounded-2xl p-4 transition-all duration-200 flex flex-col gap-2
                      ${testInfo.mode === 'EXAM' 
                        ? 'border-rose-500 bg-rose-50/50 ring-1 ring-rose-500 shadow-md' 
                        : 'border-gray-200 hover:border-rose-200 hover:bg-gray-50'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${testInfo.mode === 'EXAM' ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-500'}`}>
                            <ShieldAlert size={20} />
                          </div>
                          <span className={`font-bold text-lg ${testInfo.mode === 'EXAM' ? 'text-rose-800' : 'text-gray-700'}`}>
                            Kiểm tra
                          </span>
                        </div>
                        {testInfo.mode === 'EXAM' && <div className="w-4 h-4 bg-rose-500 rounded-full border-2 border-white ring-2 ring-rose-200"></div>}
                      </div>
                      <p className="text-sm text-gray-500 pl-[3.25rem]">
                        Chống gian lận (Anti-Cheat). Chặn chuột phải, bắt buộc Fullscreen, cảnh báo rời tab.
                      </p>
                    </div>

                  </div>
                </div>

                {/* FOOTER BUTTON */}
                <div className="pt-2 flex justify-end border-t border-gray-100 mt-8">
                  <button 
                    disabled={userRole !== 'ADMIN' && myClasses.length === 0}
    
                    type="submit" 
                    className="
                      group flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold transition-all duration-200
                      
                      text-white
                      bg-indigo-600 
                      hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5
                      
                      disabled:bg-gray-400 
                      disabled:cursor-not-allowed 
                      disabled:shadow-none 
                      disabled:transform-none
                    "
                  >
                    Tiếp tục
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* === GIAO DIỆN BƯỚC 2: EDITOR (SPLIT SCREEN) === */}
          {step === 2 && (
            <div className="flex h-full">
              {/* CỘT TRÁI: EDITOR (Giữ nguyên logic của bạn) */}
              <div className="w-1/2 p-4 flex flex-col border-r bg-white h-full">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-300 border-b-0 rounded-t-lg select-none">
                  
                  {/* Nhóm bên trái: Các công cụ nhập liệu */}
                  <div className="flex items-center gap-2">
                    {/* Input file ẩn */}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleImageUpload}
                    />

                    {/* Nút Upload Ảnh */}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className={`p-2 rounded-md transition-all flex items-center gap-2 text-sm font-medium
                        ${isLoading 
                          ? 'bg-gray-100 text-gray-400 cursor-wait' 
                          : 'text-gray-600 hover:text-indigo-600 hover:bg-white hover:shadow-sm active:scale-95'
                        }`}
                      title="Tải ảnh lên (Max 5MB)"
                    >
                      {isLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <ImageIcon size={18} />
                      )}
                      <span className="hidden xl:inline">Chèn ảnh</span>
                    </button>

                    {/* Dấu gạch ngăn cách */}
                    <div className="w-[1px] h-5 bg-gray-300 mx-1"></div>
                  </div>

                  <button
                    onClick={() => setShowGuide(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 transition-colors border border-indigo-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Hướng dẫn & Cú pháp
                  </button>
                </div>

                {/* 2. KHUNG SOẠN THẢO (TEXTAREA) */}
                {/* Lưu ý: rounded-t-none để dính liền với toolbar bên trên */}
                <textarea
                  ref={textareaRef}
                  className="flex-1 w-full p-4 border border-gray-300 rounded-b-lg rounded-t-none font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none bg-white leading-relaxed"
                  placeholder={`Nhập nội dung đề thi vào đây...\n\n- Bấm nút "Chèn ảnh" ở trên để upload hình.\n- Bấm nút "Hướng dẫn" để xem cách nhập bảng biểu, đoạn văn.`}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />

                {/* 3. CÁC NÚT ĐIỀU HƯỚNG DƯỚI CÙNG */}
                <div className="mt-4 flex gap-3">
                  <button onClick={() => setStep(1)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 transition font-medium">
                    <ArrowLeft size={18} /> Quay lại
                  </button>
                  
                  <button onClick={handleParse} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                    <Play size={18} /> Phân tích & Xem trước
                  </button>
                </div>
              </div>
            <PreviewSection
              questions={parsedQuestions}
              onSave={handleCreateTest}
              isSubmitting={isLoading}
            />
            </div>
          )}
        </div>
      </div>
      <InputGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
      {isLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
          {/* Icon Spinner xoay xoay */}
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default CreateTestWizard;

