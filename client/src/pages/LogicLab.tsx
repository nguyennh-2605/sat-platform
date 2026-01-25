import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

// --- TYPES ---
interface SATQuestion {
  passage: string;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: string;
}

interface EvaluationResult {
  is_correct: boolean;
  score: number;
  feedback: string;
  detailed_analysis: { A: string; B: string; C: string; D: string };
  better_explanation: string;
}

// --- CONSTANTS ---
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const QUESTION_TYPES = [
  "Command of Evidence", "Central Ideas", "Inferences", 
  "Words in Context", "Text Structure", "Cross-Text Connections"
];

const LogicLab = () => {
  const [step, setStep] = useState<'SETUP' | 'DOING' | 'RESULT'>('SETUP');
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState({ difficulty: "Medium", type: QUESTION_TYPES[0] });
  
  const [questionData, setQuestionData] = useState<SATQuestion | null>(null);
  const [userChoice, setUserChoice] = useState<string>("");
  
  // State mới: Lưu 4 lời giải thích riêng biệt
  const [userExplanations, setUserExplanations] = useState<{ [key: string]: string }>({
    A: "", B: "", C: "", D: ""
  });
  
  const [result, setResult] = useState<EvaluationResult | null>(null);

  // --- HANDLERS ---
  const handleStart = async () => {
    setIsLoading(true);
    setResult(null);
    setUserChoice("");
    setUserExplanations({ A: "", B: "", C: "", D: "" }); // Reset input
    
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/challenge/generate`, config);
      setQuestionData(res.data);
      setStep('DOING');
    } catch (error) {
      toast.error("Lỗi server: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!userChoice) return toast("Bạn chưa chọn đáp án!");
    
    // Kiểm tra xem đã điền đủ 4 ô chưa
    const emptyExpl = Object.values(userExplanations).some(val => val.trim().length < 5);
    if (emptyExpl) return toast("Hãy giải thích ngắn gọn cho CẢ 4 đáp án (tại sao đúng/sai)!");

    setIsLoading(true);
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/challenge/evaluate`, {
        questionData,
        userChoice,
        userExplanations // Gửi cả cục object đi
      });
      setResult(res.data);
      setStep('RESULT');
    } catch (error) {
      toast.error("Lỗi chấm bài: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  // Hàm update text cho từng ô input
  const handleExplanationChange = (key: string, text: string) => {
    setUserExplanations(prev => ({ ...prev, [key]: text }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 font-sans text-gray-800">
      
      {/* HEADER */}
      <header className="w-full max-w-6xl flex justify-end items-center mb-8">
        {step !== 'SETUP' && (
           <button onClick={() => setStep('SETUP')} className="text-sm font-bold text-gray-500 hover:text-indigo-600">
             Quit Session ✕
           </button>
        )}
      </header>

      {/* --- STEP 1: SETUP SCREEN --- */}
      {step === 'SETUP' && (
        <div className="relative w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[80vh]">
          
          {/* 1. BACKGROUND DECORATION (Trang trí nền) */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            {/* Lưới chấm bi mờ */}
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50"></div>
            {/* Gradient phát sáng phía sau */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          </div>

          {/* 2. MAIN CARD */}
          <div className="relative bg-white/80 backdrop-blur-xl border border-white/50 p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-lg text-center transition-all hover:shadow-[0_20px_40px_rgb(79,70,229,0.1)]">
            
            {/* Icon & Title */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-indigo-50 to-purple-50 rounded-2xl mb-4 shadow-inner border border-white animate-[float_6s_ease-in-out_infinite]">
                <span className="text-4xl filter drop-shadow-md">🧠</span>
              </div>
              <h2 className="text-3xl font-serif font-bold text-gray-800 tracking-tight">
                SAT Logic Lab
              </h2>
              <p className="text-gray-500 mt-3 text-sm font-medium leading-relaxed max-w-xs mx-auto">
                Identify the correct answer and justify why the other options are incorrect.
              </p>
            </div>

            {/* Form Controls */}
            <div className="space-y-6 text-left">
              
              {/* Difficulty Selector */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">
                  Độ khó (Difficulty)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {DIFFICULTIES.map(d => (
                    <button 
                      key={d}
                      onClick={() => setConfig({ ...config, difficulty: d })}
                      className={`
                        py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 border
                        ${config.difficulty === d 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 transform scale-105' 
                          : 'bg-white text-gray-600 border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                        }
                      `}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type Selector */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">
                  Dạng bài (Question Type)
                </label>
                <div className="relative">
                  <select 
                    className="w-full appearance-none p-4 pl-5 bg-gray-50 border border-gray-100 rounded-xl font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                    value={config.type}
                    onChange={(e) => setConfig({ ...config, type: e.target.value })}
                  >
                    {QUESTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {/* Custom Arrow Icon */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button 
                onClick={handleStart}
                disabled={isLoading}
                className="group relative w-full overflow-hidden bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-indigo-100 transition-all hover:shadow-indigo-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>Đang khởi tạo <span className="animate-pulse">...</span></>
                  ) : (
                    <>Bắt đầu thử thách <span className="group-hover:translate-x-1 transition-transform"></span></>
                  )}
                </span>
                {/* Hiệu ứng bóng lướt qua khi hover */}
                <div className="absolute inset-0 h-full w-full scale-0 rounded-xl transition-all duration-300 group-hover:scale-100 group-hover:bg-indigo-500/30"></div>
              </button>

            </div>
          </div>
          
          {/* Footer text */}
          <p className="mt-8 text-gray-400 text-xs font-medium opacity-60">
            Powered by Google Gemini 2.0 Flash
          </p>
        </div>
      )}

      {/* --- STEP 2: DOING SCREEN (SPLIT VIEW) --- */}
      {step === 'DOING' && questionData && (
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8 h-[85vh]">
          
          {/* LEFT: PASSAGE (Scrollable) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 overflow-y-auto h-full custom-scrollbar">
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-500 text-xs font-bold rounded-full mb-4">Reading Passage</span>
            <div className="prose prose-lg text-gray-800 font-serif leading-8">
              {questionData.passage}
            </div>
          </div>

          {/* RIGHT: QUESTIONS & INPUTS (Scrollable) */}
          <div className="flex flex-col h-full overflow-y-auto custom-scrollbar pr-2">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-6 sticky top-0 z-10">
              <span className="text-indigo-600 font-bold text-sm uppercase tracking-wide">Câu hỏi</span>
              <p className="text-lg font-bold text-gray-900 mt-2">{questionData.question}</p>
            </div>

            <div className="space-y-4 pb-10">
              {Object.entries(questionData.options).map(([key, value]) => {
                const isSelected = userChoice === key;
                return (
                  <div 
                    key={key}
                    className={`group relative p-5 rounded-xl border-2 transition-all duration-200 
                      ${isSelected ? 'border-indigo-600 bg-indigo-50/50 shadow-md' : 'border-gray-200 bg-white hover:border-indigo-300'}
                    `}
                  >
                    {/* Header: Radio & Option Text */}
                    <div className="flex items-start gap-3 cursor-pointer" onClick={() => setUserChoice(key)}>
                      <div className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0
                        ${isSelected ? 'border-indigo-600' : 'border-gray-300 group-hover:border-indigo-400'}
                      `}>
                        {isSelected && <div className="w-3 h-3 bg-indigo-600 rounded-full" />}
                      </div>
                      <span className={`text-base font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                        <span className="font-bold mr-1">{key}.</span> {value}
                      </span>
                    </div>

                    {/* Input Field: Always Visible */}
                    <div className="mt-4 pl-9 animate-fade-in-up">
                      <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">
                        {isSelected ? "Tại sao đây là đáp án ĐÚNG?" : "Tại sao đáp án này SAI?"}
                      </label>
                      <input 
                        type="text"
                        placeholder={isSelected ? "Giải thích lý do đúng..." : "Lỗi sai ở đâu? (VD: Sai thông tin, không liên quan...)"}
                        className={`w-full p-3 text-sm rounded-lg border outline-none transition-colors
                          ${isSelected 
                            ? 'bg-white border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200' 
                            : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-400'
                          }
                        `}
                        value={userExplanations[key]}
                        onChange={(e) => handleExplanationChange(key, e.target.value)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Submit Button (Floating at bottom right mobile or fixed) */}
            <div className="mt-auto pt-4">
              <button 
                onClick={handleSubmit} disabled={isLoading}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95"
              >
                {isLoading ? "Đang chấm bài..." : "Gửi bài giải thích"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- STEP 3: RESULT SCREEN --- */}
      {step === 'RESULT' && result && questionData && (
        <div className="w-full max-w-5xl animate-fade-in">
          
          {/* Top Banner */}
          <div className={`p-8 rounded-2xl text-white text-center shadow-xl mb-8 ${result.is_correct ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-pink-600'}`}>
            <h2 className="text-4xl font-black mb-2">{result.is_correct ? "XUẤT SẮC! 🎉" : "TIẾC QUÁ! 😅"}</h2>
            <div className="flex justify-center gap-4 mt-4">
              <div className="bg-white/20 backdrop-blur-sm px-6 py-2 rounded-lg">
                <span className="text-sm opacity-80 block">Điểm tư duy</span>
                <span className="text-2xl font-bold">{result.score}/100</span>
              </div>
              <div className="bg-white/20 backdrop-blur-sm px-6 py-2 rounded-lg">
                <span className="text-sm opacity-80 block">Đáp án đúng</span>
                <span className="text-2xl font-bold">{questionData.correct_answer}</span>
              </div>
            </div>
            <p className="mt-4 font-medium opacity-90 text-lg">"{result.feedback}"</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Cột trái: Review từng đáp án */}
            <div className="space-y-4">
               <h3 className="font-bold text-gray-700 text-lg">🔍 Phân tích chi tiết của AI:</h3>
               {Object.entries(questionData.options).map(([key, value]) => {
                 const isCorrectKey = key === questionData.correct_answer;
                 const feedback = result.detailed_analysis ? result.detailed_analysis[key as 'A'|'B'|'C'|'D'] : "No feedback";
                 
                 return (
                   <div key={key} className={`p-4 rounded-xl border-l-4 ${isCorrectKey ? 'bg-green-50 border-green-500' : 'bg-white border-gray-300'}`}>
                     <div className="flex justify-between mb-2">
                       <span className={`font-bold ${isCorrectKey ? 'text-green-700' : 'text-gray-700'}`}>{key}. {value}</span>
                     </div>
                     
                     <div className="text-sm space-y-2">
                        <div className="bg-white/50 p-2 rounded border border-dashed border-gray-300">
                          <span className="text-xs font-bold text-gray-400 block">GIẢI THÍCH CỦA BẠN:</span>
                          <span className="text-gray-600 italic">"{userExplanations[key]}"</span>
                        </div>
                        <div className="text-gray-800">
                           <span className="font-bold text-xs text-indigo-600 block">AI NHẬN XÉT:</span>
                           {feedback}
                        </div>
                     </div>
                   </div>
                 )
               })}
            </div>

            {/* Cột phải: Giải thích mẫu */}
            <div>
              <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 sticky top-6">
                <h3 className="font-bold text-indigo-800 text-lg mb-4">💡 Tư duy chuẩn (Sample Logic):</h3>
                <div className="prose prose-sm text-indigo-900 leading-relaxed whitespace-pre-line">
                  {result.better_explanation}
                </div>
                
                <div className="mt-8 flex gap-3">
                  <button onClick={() => setStep('SETUP')} className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50">
                    Chọn lại cấu hình
                  </button>
                  <button onClick={handleStart} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                    Câu tiếp theo
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default LogicLab;