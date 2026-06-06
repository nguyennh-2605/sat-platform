import React, { useState } from 'react';

interface InputGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InputGuideModal: React.FC<InputGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'tags' | 'tips'>('basic');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 transition-all">
      {/* Container chính */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="bg-blue-600 text-white p-1.5 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </span>
              Hướng dẫn Định dạng Đề thi
            </h2>
            <p className="text-sm text-slate-500 mt-1">Hệ thống hỗ trợ nhập liệu thông minh từ Word/Excel</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body Layout: Sidebar (Tabs) + Content */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar Tabs */}
          <div className="w-1/4 bg-slate-50 border-r border-slate-200 p-2 flex flex-col gap-1 overflow-y-auto">
            <TabButton 
              active={activeTab === 'basic'} 
              onClick={() => setActiveTab('basic')}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>}
              title="Cấu trúc cơ bản"
              desc="Cách viết câu hỏi & đáp án"
            />
            <TabButton 
              active={activeTab === 'tags'} 
              onClick={() => setActiveTab('tags')}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              title="Thẻ nâng cao"
              desc="Hình ảnh, Bảng, Thơ"
            />
            <TabButton 
              active={activeTab === 'tips'} 
              onClick={() => setActiveTab('tips')}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              title="Lưu ý quan trọng"
              desc="Các lỗi thường gặp"
            />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-white scroll-smooth">
            
            {/* Tab 1: Cấu trúc cơ bản */}
            {activeTab === 'basic' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                  <div className="text-blue-600 mt-1"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                  <div>
                    <h4 className="font-bold text-blue-900">Bắt đầu nhanh</h4>
                    <p className="text-sm text-blue-800">Để tạo một câu hỏi mới, bắt buộc phải có từ khóa <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold text-blue-600">QUESTION + Số</code> ở đầu dòng.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-3">Mẫu câu hỏi chuẩn</h3>
                  <CodeBlock 
                    title="Ví dụ mẫu"
                    content={`QUESTION + (Số thứ tự câu hỏi)
# Nội dung văn bản
[TEXT]
...
(Thêm thẻ này nếu đoạn này là văn bản)
(Có thể bỏ qua nếu câu hỏi đó chỉ có dạng Text)
[TABLE]
... (Thêm thẻ này nếu đoạn này là bảng)
[IMG] (Thêm thẻ này nếu đoạn này là ảnh)
[POEM] (Thêm thẻ này nếu đoạn sau là thơ)
# Nhớ cách dòng ở đây
# Phần câu hỏi
A. Đáp án 1
B. Đáp án 2
C. Đáp án 3
D. Đáp án 4
Answer: A
Explanation (Optional): Phần giải thích`} 
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Thẻ nâng cao */}
            {activeTab === 'tags' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                 <h3 className="text-lg font-bold text-slate-800">Các loại thẻ hỗ trợ</h3>
                 
                 <div className="grid grid-cols-1 gap-4">
                    {/* Thẻ Bảng */}
                    <div className="border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-colors group">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-indigo-100 text-indigo-700 font-mono font-bold px-2 py-1 rounded text-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">[TABLE]</span>
                        <span className="font-semibold text-slate-700">Chèn bảng từ Excel</span>
                      </div>
                      <p className="text-sm text-slate-500 mb-3">Copy vùng dữ liệu từ Excel và Paste ngay bên dưới thẻ này.</p>
                      <div className="bg-slate-900 rounded-lg p-3 overflow-hidden">
                        <code className="text-xs text-indigo-300 block">[TABLE]</code>
                        <code className="text-xs text-slate-300 block">Name    Age    Class</code>
                        <code className="text-xs text-slate-300 block">John    18     12A</code>
                      </div>
                    </div>

                    {/* Thẻ Ảnh */}
                    <div className="border border-slate-200 rounded-xl p-4 hover:border-green-300 transition-colors group">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-green-100 text-green-700 font-mono font-bold px-2 py-1 rounded text-sm group-hover:bg-green-600 group-hover:text-white transition-colors">[IMG]</span>
                        <span className="font-semibold text-slate-700">Giữ chỗ cho Hình ảnh</span>
                      </div>
                      <p className="text-sm text-slate-500 mb-3">Chỉ cần đặt thẻ này, hệ thống sẽ tạo một ô upload ảnh tại vị trí đó sau khi lưu.</p>
                    </div>

                    {/* Thẻ Thơ */}
                    <div className="border border-slate-200 rounded-xl p-4 hover:border-pink-300 transition-colors group">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-pink-100 text-pink-700 font-mono font-bold px-2 py-1 rounded text-sm group-hover:bg-pink-600 group-hover:text-white transition-colors">[POEM]</span>
                        <span className="font-semibold text-slate-700">Định dạng Thơ</span>
                      </div>
                      <p className="text-sm text-slate-500 mb-3">Giữ nguyên định dạng xuống dòng của đoạn văn bản bên dưới.</p>
                    </div>
                 </div>
              </div>
            )}

            {/* Tab 3: Lưu ý */}
            {activeTab === 'tips' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                <h3 className="text-lg font-bold text-slate-800">Quy tắc vàng để không bị lỗi</h3>
                
                <ul className="space-y-3">
                  <TipItem type="success" title="Định dạng Đáp án đúng">
                    Chấp nhận các dạng: <code className="bg-slate-100 px-1 rounded">A.</code>, <code className="bg-slate-100 px-1 rounded">A)</code>, hoặc <code className="bg-slate-100 px-1 rounded">(A)</code>.
                  </TipItem>
                  <TipItem type="error" title="Lỗi khoảng trắng phổ biến">
                    Không được viết <code className="bg-red-50 text-red-600 px-1 rounded">A [Nội dung]</code> (thiếu dấu chấm). Ngoài ra giữa văn bản và câu hỏi phải có cách dòng
                  </TipItem>
                  <TipItem type="warning" title="Phân chia Module">
                    Nếu đề thi có nhiều hơn 1 Module, dùng dòng <code className="bg-amber-50 text-amber-600 px-1 rounded">=== MODULE 1 ===</code> để ngắt module.
                  </TipItem>
                  <TipItem type="info" title="Giải thích (Optional)">
                    Dòng <code className="bg-blue-50 text-blue-600 px-1 rounded">Explanation:</code> phải nằm cuối cùng của câu hỏi đó.
                  </TipItem>
                </ul>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-8 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-300 hover:bg-blue-600 hover:shadow-blue-200 hover:-translate-y-0.5 transition-all active:scale-95"
          >
            Đã hiểu, bắt đầu làm!
          </button>
        </div>

      </div>
    </div>
  );
};

// --- Sub Components cho gọn code ---

const TabButton = ({ active, onClick, icon, title, desc }: any) => (
  <button 
    onClick={onClick}
    className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex items-start gap-3 ${
      active 
        ? 'bg-white shadow-sm ring-1 ring-slate-200' 
        : 'hover:bg-slate-100 text-slate-500'
    }`}
  >
    <div className={`${active ? 'text-blue-600' : 'text-slate-400'}`}>{icon}</div>
    <div>
      <div className={`text-sm font-bold ${active ? 'text-slate-800' : 'text-slate-600'}`}>{title}</div>
      <div className="text-xs text-slate-400 line-clamp-1">{desc}</div>
    </div>
  </button>
);

const CodeBlock = ({ title, content }: {title: string, content: string}) => (
  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm">
    <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
      <span className="text-xs font-mono text-slate-400">{title}</span>
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
      </div>
    </div>
    <div className="p-4 overflow-x-auto">
      <pre className="font-mono text-sm leading-relaxed text-slate-300 whitespace-pre">
        {content.split('\n').map((line, i) => (
           <div key={i} className={`${line.startsWith('QUESTION') ? 'text-yellow-400 font-bold' : line.startsWith('Answer') ? 'text-green-400 font-bold' : ''}`}>
             {line}
           </div>
        ))}
      </pre>
    </div>
  </div>
);

const TipItem = ({ type, title, children }: any) => {
  const colors = {
    success: 'bg-green-50 text-green-700 border-green-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  // @ts-ignore
  const colorClass = colors[type] || colors.info;

  return (
    <li className={`p-3 rounded-lg border text-sm ${colorClass} flex gap-3 items-start`}>
      <div className="mt-0.5 shrink-0">
        {type === 'success' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
        {type === 'error' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
        {type === 'warning' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        {type === 'info' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      </div>
      <div>
        <span className="font-bold block mb-0.5 text-xs uppercase tracking-wide opacity-80">{title}</span>
        <span className="opacity-90 leading-relaxed">{children}</span>
      </div>
    </li>
  )
}

export default InputGuideModal;