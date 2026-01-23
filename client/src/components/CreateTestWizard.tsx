import { useState, memo } from 'react';
import { Play, Save, ArrowLeft, X, FileText } from 'lucide-react';
import { parseSATInput, type SATQuestion } from '../utlis/satParser';
import { createPortal } from "react-dom";
import InputGuideModal from './InputGuideModal';
import toast from 'react-hot-toast';

interface Section {
  name: string;      // Vd: "Reading and Writing - Module 1"
  order: number;     // Vd: 1
  duration: number;  // Vd: 27 (phút)
  questions: any[];  // Mảng câu hỏi đã parse
}

interface FinalTestStructure {
  title: string;
  description: string;
  type: string;
  duration: number; // Tổng thời gian (vd: 64)
  sections: Section[];
}

interface FormattedTextRendererProps {
  text: string;       // Bắt buộc phải là chuỗi
  className?: string; // Có thể có hoặc không (optional)
}

const CreateTestWizard = ({ onClose }: any) => {
  // --- STATE QUẢN LÝ ---
  const [step, setStep] = useState(1); // 1: Info, 2: Content
  
  // Dữ liệu Bước 1: Metadata
  const [testInfo, setTestInfo] = useState({
    title: '',
    description: '',
    type: 'RW', // RW (Reading Writing) hoặc MATH
    moduleCount: 2, // 1 hoặc 2
    duration: 64, // Phút
  });

  // Dữ liệu Bước 2: Nội dung raw và json parsed
  const [rawText, setRawText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<SATQuestion[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const handleCreateTest = async () => {
    // 1. Nhóm các câu hỏi theo Module (1, 2, ...)
    setIsSubmitting(true);
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
      name: `Reading and Writing - Module ${modNum}`, // Tự sinh tên
      order: modNum,
      duration: durationPerModule, // (Ví dụ: chia đều hoặc hardcode 32 phút/module chuẩn SAT)
      questions: (modulesMap.get(modNum) || []).map(q => ({
        ...q,
        choices: Array.isArray(q.choices) ? q.choices : Object.values(q.choices || {})
      }))
    }));

    // 3. Tạo Object cuối cùng
    const finalPayload: FinalTestStructure = {
      title: testInfo.title,
      description: testInfo.description || "Reading and Writing - Full Test",
      duration: parseInt(testInfo.duration.toString()),
      type: testInfo.type,
      sections: sections
    };

    // --- LOG RA KẾT QUẢ HOẶC GỌI API TẠI ĐÂY ---
    console.log("JSON chuẩn DB:", JSON.stringify(finalPayload, null, 2));
    console.log("Kiểm tra mảng trước khi gửi:", Array.isArray(finalPayload.sections[0].questions[0].choices));

    // --- GỌI API ---
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/tests/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        toast.error("❌ Lỗi khi lưu vào Database");
        setIsSubmitting(false);
      }
    } catch (error) {
      setIsSubmitting(false);
      console.error(error);
    }
  };

  const FormattedTextRenderer: React.FC<FormattedTextRendererProps> = ({ text, className = "" }) => {
    if (!text) return null;

    // Tách dòng để xử lý từng dòng một
    const lines = text.split('\n');

    return (
      <div className={`font-sans text-gray-800 ${className}`}>
        {lines.map((line, index) => {
          const trimmedLine = line.trim();
          if (!trimmedLine) return <div key={index} className="h-2"></div>;

          // Xử lý Bullet points (Rhetorical Synthesis)
          if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
            const contentText = trimmedLine.replace(/^[-•]\s*/, '');
            return (
              <div key={index} className="flex items-start gap-3 ml-4 mb-2">
                <span className="mt-2 w-1.5 h-1.5 bg-black rounded-full shrink-0"></span>
                <span className="leading-relaxed">{contentText}</span>
              </div>
            );
          }

          // Text bình thường
          return (
            <p key={index} className="mb-2 leading-relaxed text-[15px]">
              {trimmedLine}
            </p>
          );
        })}
      </div>
    );
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
        <div className="flex-1 overflow-hidden">
          
          {/* === GIAO DIỆN BƯỚC 1: FORM NHẬP INFO === */}
          {step === 1 && (
            <div className="p-8 max-w-2xl mx-auto">
              <form onSubmit={handleInfoSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Tên bài kiểm tra</label>
                  <input 
                    type="text" 
                    className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="VD: SAT Practice Test #1"
                    value={testInfo.title}
                    onChange={e => setTestInfo({...testInfo, title: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Mô tả</label>
                  <input
                    type="text"
                    className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={testInfo.description}
                    onChange={(e) => setTestInfo({ ...testInfo, description: e.target.value })}
                    placeholder="VD: Reading and Writing - Full Test"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Môn thi</label>
                    <select 
                      className="w-full border p-3 rounded-lg"
                      value={testInfo.type}
                      onChange={e => setTestInfo({...testInfo, type: e.target.value})}
                    >
                      <option value="RW">Reading & Writing</option>
                      <option value="MATH">Math</option>
                    </select>
                  </div>

                  <div>
                     <label className="block text-sm font-bold text-gray-700 mb-2">Thời gian (phút)</label>
                     <input 
                        type="number" 
                        className="w-full border p-3 rounded-lg"
                        value={testInfo.duration}
                        onChange={e => setTestInfo({...testInfo, duration: parseInt(e.target.value)})}
                     />
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">Số lượng Module</label>
                   <div className="flex gap-4">
                      <label className={`flex-1 border p-4 rounded-lg cursor-pointer flex items-center gap-3 transition ${testInfo.moduleCount === 1 ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'hover:bg-gray-50'}`}>
                         <input type="radio" name="mod" checked={testInfo.moduleCount === 1} onChange={() => setTestInfo({...testInfo, moduleCount: 1})} />
                         <span className="font-medium">1 Module (Mini Test)</span>
                      </label>
                      <label className={`flex-1 border p-4 rounded-lg cursor-pointer flex items-center gap-3 transition ${testInfo.moduleCount === 2 ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'hover:bg-gray-50'}`}>
                         <input type="radio" name="mod" checked={testInfo.moduleCount === 2} onChange={() => setTestInfo({...testInfo, moduleCount: 2})} />
                         <span className="font-medium">2 Modules (Full Test)</span>
                      </label>
                   </div>
                </div>

                <div className="pt-4 text-right">
                   <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 transition">
                      Tiếp tục &rarr;
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
                <button
                  type="button"
                  onClick={() => setShowGuide(true)}
                  className="w-full text-left flex items-center justify-between bg-indigo-50 border border-indigo-200 p-4 rounded-lg mb-4 hover:bg-indigo-100 transition focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-indigo-900"> Chưa biết cách nhập? </p>
                      <p className="text-sm text-indigo-700"> Xem hướng dẫn cú pháp dấu gạch đầu dòng, bảng biểu, hình ảnh. </p>
                    </div>
                  </div>
                  <div className="text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                <textarea
                  className="flex-1 w-full p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-gray-50"
                  placeholder={`Paste nội dung đề thi vào đây...`}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />

                <div className="mt-4 flex gap-3">
                  <button onClick={() => setStep(1)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 transition">
                    <ArrowLeft size={16} /> Quay lại
                  </button>
                  <button onClick={handleParse} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2 transition">
                    <Play size={16} /> Phân tích & Xem trước
                  </button>
                </div>
              </div>

              {/* CỘT PHẢI: PREVIEW (Đã nâng cấp) */}
              <div className="w-1/2 p-4 flex flex-col bg-gray-50 h-full border-l">
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-50 z-10 py-2">
                  <span className="font-bold text-gray-700 text-lg">Kết quả ({parsedQuestions.length} câu)</span>
                  <button
                    onClick={handleCreateTest}
                    disabled={parsedQuestions.length === 0 || isSubmitting}
                    className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Save size={18} /> {isSubmitting ? "Saving..." : "Save"}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-2 pb-20 scrollbar-thin scrollbar-thumb-gray-300">
                  {parsedQuestions.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                      <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>Paste nội dung và nhấn "Phân tích" để xem trước.</p>
                    </div>
                  )}

                  {/* VÒNG LẶP CÂU HỎI */}
                  {parsedQuestions.map((q, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 text-sm hover:shadow-md transition-shadow">
                      {/* Header câu hỏi */}
                      <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white bg-indigo-600 px-2 py-0.5 rounded text-xs">Câu {q.index}</span>
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
                              <div className="h-40 bg-gray-50 rounded-lg flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 select-none">
                                <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs font-medium text-gray-500">Khu vực hiển thị ảnh</span>
                                <span className="text-[10px] text-gray-400 mt-1 font-mono bg-gray-100 px-1 rounded">{block.src || "SRC_NOT_FOUND"}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* KHUNG DƯỚI/PHẢI CỦA SAT (QUESTION & CHOICES) */}
                      <div className="space-y-3">
                          {/* Câu hỏi dẫn nhập */}
                          <div className="font-sans font-bold text-gray-900 text-[15px]">
                              {q.questionText}
                          </div>

                          {/* Các đáp án */}
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
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                                          choice.id === q.correctAnswer
                                              ? 'bg-emerald-600 text-white border-emerald-600'
                                              : 'bg-white text-gray-500 border-gray-300'
                                      }`}>
                                          {choice.id}
                                      </div>
                                      <span className={`pt-0.5 ${choice.id === q.correctAnswer ? 'text-emerald-800 font-medium' : 'text-gray-700'}`}>
                                          {choice.text}
                                      </span>
                                  </div>
                              ))}
                          </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <InputGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
      {isSubmitting && (
      // <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
      //   <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
      //   <p className="mt-4 font-medium text-white">Đang tải đề thi lên hệ thống, vui lòng đợi...</p>
      // </div>
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
          {/* Icon Spinner xoay xoay */}
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 mt-2">Đang tải đề thi lên hệ thống...</p>
        </div>
      )}
    </div>,
    document.body
  );
};

export default CreateTestWizard;