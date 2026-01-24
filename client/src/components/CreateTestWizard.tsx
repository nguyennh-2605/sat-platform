import { useState, memo, useRef } from 'react';
import { Play, Save, ArrowLeft, X, FileText, ImageIcon, Loader2 } from 'lucide-react';
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

  const [isUploading, setIsUploading] = useState(false); // Trạng thái đang upload
  const fileInputRef = useRef<HTMLInputElement>(null);   // Để kích hoạt input file
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Để thao tác con trỏ trong textarea

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

    const lines = text.split('\n');

    return (
      <div className={`font-sans text-gray-800 ${className}`}>
        {lines.map((line, index) => {
          const trimmedLine = line.trim();

          if (!trimmedLine) {
            return <div key={index} className="h-4"></div>; 
          }
          // Render mọi thứ dưới dạng đoạn văn thường (Paragraph)
          return (
            <p key={index} className="mb-2 leading-relaxed text-[15px] whitespace-pre-wrap">
              {trimmedLine}
            </p>
          );
        })}
      </div>
    );
  };

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

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    // --- CẤU HÌNH CLOUDINARY ---
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME; 
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_PRESET;
    // ------------------------------------

    if (!cloudName || !uploadPreset) {
        toast.error("Thiếu cấu hình Cloudinary trong .env");
        setIsUploading(false);
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
      setIsUploading(false);
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
                      disabled={isUploading}
                      className={`p-2 rounded-md transition-all flex items-center gap-2 text-sm font-medium
                        ${isUploading 
                          ? 'bg-gray-100 text-gray-400 cursor-wait' 
                          : 'text-gray-600 hover:text-indigo-600 hover:bg-white hover:shadow-sm active:scale-95'
                        }`}
                      title="Tải ảnh lên (Max 5MB)"
                    >
                      {isUploading ? (
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
                          {/* Box: Viền mỏng hơn (gray-200), padding vừa đủ (p-4), bo góc mềm (rounded-lg) */}
                          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                            <ul className="list-disc pl-5 space-y-1.5 text-gray-900">
                              {/* @ts-ignore */}
                              {block.lines.map((line, idx) => (
                                <li key={idx} className="pl-1">
                                  {line}
                                </li>
                              ))}
                            </ul>
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