import { useState, useEffect } from 'react';
import axios from 'axios';

// Định nghĩa kiểu dữ liệu cho kết quả AI trả về
interface AnalysisResult {
  score: number;
  feedback: string;
  missing_points: string[];
  misunderstood: string[];
  better_version: string;
}

const RecallChallenge = () => {
  const [step, setStep] = useState<'IDLE' | 'READING' | 'WRITING' | 'RESULT'>('IDLE');
  const [passage, setPassage] = useState<{content: string} | null>(null);
  const [timeLeft, setTimeLeft] = useState(60); // 60 giây đọc
  const [userText, setUserText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Hàm bắt đầu game
  const startGame = async () => {
    setIsLoading(true);
    setResult(null);
    setUserText("");
    setPassage(null);
    try {
      // Gọi API lấy đề ngẫu nhiên từ server
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/challenge/random`);
      console.log("Lấy passage từ gemini");
      setPassage(res.data);
      setStep('READING');
      setTimeLeft(60);
    } catch (error) {
      alert("Lỗi kết nối!");
    } finally {
      setIsLoading(false);
    }
  };

  // Logic đếm ngược
  useEffect(() => {
    if (step === 'READING' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (step === 'READING' && timeLeft === 0) {
      setStep('WRITING'); // Hết giờ tự chuyển sang viết
    }
  }, [step, timeLeft]);

  // Hàm gửi bài chấm
  const submitText = async () => {
    if (!passage) return;
    setIsLoading(true);
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/challenge/verify`, {
        originalText: passage.content,
        userSummary: userText
      });
      setResult(res.data);
      setStep('RESULT');
    } catch (error) {
      alert("Lỗi khi chấm điểm");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* GIAI ĐOẠN 1: MÀN HÌNH CHỜ */}
      {step === 'IDLE' && (
        <div className="text-center mt-20">
          <h1 className="text-4xl font-bold text-blue-600 mb-4">Active Recall Challenge</h1>
          <p className="text-gray-600 mb-8">Đọc đoạn văn trong 60s, sau đó viết lại những gì bạn nhớ.</p>
            <button 
              onClick={startGame}
              disabled={isLoading}
              className={`px-8 py-3 rounded-lg text-lg text-white transition font-bold
                ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
              `}
            >
              {/* Hiển thị text thay đổi theo trạng thái */}
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  AI đang viết đề...
                </span>
              ) : (
                "Bắt đầu ngay"
              )}
            </button>
        </div>
      )}

      {/* GIAI ĐOẠN 2: ĐỌC (READING) */}
      {step === 'READING' && passage && (
        <div className="max-w-2xl w-full">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-500">Ghi nhớ nội dung...</span>
            <span className="text-red-500 font-bold text-xl">{timeLeft}s</span>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-lg text-lg leading-relaxed border-l-4 border-blue-500">
            {passage.content}
          </div>
          <button onClick={() => setStep('WRITING')} className="mt-6 w-full py-3 bg-gray-200 rounded hover:bg-gray-300">
            Tôi đã thuộc, chuyển sang viết ngay
          </button>
        </div>
      )}

      {/* GIAI ĐOẠN 3: VIẾT (WRITING) */}
      {step === 'WRITING' && (
        <div className="max-w-2xl w-full animate-fade-in">
          <h2 className="text-2xl font-bold mb-4">Viết lại những gì bạn nhớ:</h2>
          <textarea
            className="w-full h-64 p-4 border rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Gõ nội dung vào đây..."
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
          />
          <button 
            onClick={submitText}
            disabled={isLoading}
            className="mt-6 w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition"
          >
            {isLoading ? "AI đang chấm..." : "Nộp bài"}
          </button>
        </div>
      )}

      {/* GIAI ĐOẠN 4: KẾT QUẢ (RESULT) */}
      {step === 'RESULT' && result && (
        <div className="max-w-3xl w-full bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="bg-blue-600 p-6 text-white text-center">
            <div className="text-6xl font-black mb-2">{result.score}</div>
            <div className="text-blue-100">{result.feedback}</div>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-red-600 font-bold mb-2">❌ Ý bị thiếu:</h3>
              <ul className="list-disc ml-5 space-y-1 text-gray-700">
                {result.missing_points.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
            
            <div>
               <h3 className="text-yellow-600 font-bold mb-2">⚠️ Hiểu sai:</h3>
               {(result.misunderstood || []).length > 0 ? (
                 <ul className="list-disc ml-5 space-y-1 text-gray-700">
                   {result.misunderstood?.map((p, i) => <li key={i}>{p}</li>)}
                 </ul>
               ) : <p className="text-gray-400 italic">Không có lỗi hiểu sai nào!</p>}
            </div>
          </div>

          <div className="bg-gray-50 p-6 border-t">
            <h3 className="font-bold text-gray-800 mb-2">💡 Tóm tắt mẫu (AI):</h3>
            <p className="text-gray-600 italic">"{result.better_version}"</p>
          </div>

          <div className="p-6 border-t text-center">
             <button onClick={() => window.location.reload()} className="bg-black text-white px-6 py-2 rounded">
               Làm bài khác
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecallChallenge;