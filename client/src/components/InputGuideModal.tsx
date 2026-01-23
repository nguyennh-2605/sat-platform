import React from 'react';

interface InputGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InputGuideModal: React.FC<InputGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-600 p-4 flex justify-between items-center text-white shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Hướng dẫn Upload Test
          </h2>
          <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="p-6 overflow-y-auto text-gray-700 leading-relaxed space-y-6">
          
          {/* Section 1: Intro */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <p className="font-medium text-blue-800"> Chào bạn!</p>
            <p className="text-sm mt-1 text-blue-700">
              Công cụ này được thiết kế để bạn có thể copy-paste đề thi từ Word/Excel vào đây một cách nhanh nhất. 
              Hệ thống sẽ tự động nhận diện câu hỏi, bảng biểu và hình ảnh.
            </p>
          </div>

          {/* Section 2: Cấu trúc cơ bản */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 border-b pb-1">1. Cấu trúc một câu hỏi</h3>
            <p className="mb-2">Bạn chỉ cần gõ <code className="bg-gray-100 px-1 rounded text-red-600 font-bold">QUESTION + Số</code> để bắt đầu một câu mới.</p>
            <div className="bg-gray-800 text-gray-100 p-3 rounded-md text-sm font-mono overflow-x-auto">
              QUESTION ... (số thứ tự câu hỏi) <br/>
              # Phần nội dung bài đọc <br/>
              [TEXT] <br/>
              ... <br/>
              [POEM] <br/>
              ... <br/>
              [IMG] <br/>
              ... <br/>
              [TABLE] <br/>
              ... <br/>
              <br/>
              # Phần nội dung câu hỏi <br/>
              # Phần nội dung đáp án <br/>
              A. Đáp án 1<br/>
              B. Đáp án 2<br/>
              C. Đáp án 3<br/>
              D. Đáp án 4<br/>
              Answer: B <br/>
              Explanation: ... (Có thể có hoặc không) <br/>
            </div>
          </div>

          {/* Section 3: Các loại nội dung đặc biệt */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 border-b pb-1">2. Chèn Bảng, Hình ảnh & Thơ</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Table Guide */}
              <div className="border p-3 rounded bg-gray-50">
                <span className="font-bold text-indigo-600">[TABLE]</span> - Chèn bảng
                <p className="text-xs text-gray-500 mt-1 mb-2">Copy trực tiếp từ Excel dán vào dưới thẻ này.</p>
                <pre className="bg-white border p-2 text-xs rounded">
                  [TABLE]<br/>
                  Cột 1  Cột 2<br/>
                  A      10<br/>
                  B      20
                </pre>
              </div>

              {/* Poem Guide */}
              <div className="border p-3 rounded bg-gray-50">
                <span className="font-bold text-pink-600">[POEM]</span> - Chèn thơ
                <p className="text-xs text-gray-500 mt-1 mb-2">Giữ nguyên xuống dòng để hiển thị thơ đẹp hơn.</p>
                <pre className="bg-white border p-2 text-xs rounded">
                  [POEM]<br/>
                  Đầu lòng hai ả tố nga,<br/>
                  Thúy Kiều là chị em là Thúy Vân.
                </pre>
              </div>

              {/* Image Guide */}
              <div className="border p-3 rounded bg-gray-50">
                <span className="font-bold text-green-600">[IMG]</span> - Giữ chỗ ảnh
                <p className="text-xs text-gray-500 mt-1 mb-2">Hệ thống sẽ tạo khung để bạn upload ảnh sau.</p>
                <pre className="bg-white border p-2 text-xs rounded">
                  [IMG]<br/>
                  (Chỉ cần thẻ này là đủ)
                </pre>
              </div>

               {/* Text Guide */}
               <div className="border p-3 rounded bg-gray-50">
                <span className="font-bold text-gray-600">[TEXT]</span> - Văn bản thường
                <p className="text-xs text-gray-500 mt-1 mb-2"> Có thể không ghi thẻ này, hệ thống tự hiểu.</p>
                <pre className="bg-white border p-2 text-xs rounded">
                  [TEXT]<br/>
                  Đoạn văn bình thường...
                </pre>
              </div>
            </div>
          </div>

          {/* Section 4: Mẹo thông minh */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 border-b pb-1">3. Chú ý </h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><b>Lưu ý về format đáp án:</b> Bạn có thể viết <code>A.</code>, <code>A)</code>, hay <code>(A)</code> đều được. Nhưng không được <code> A[khoảng trống]</code></li>
              <li><b>Phân chia Module:</b> Dùng <code>=== MODULE 1 ===</code> để tách các phần thi khác nhau.</li>
              <li><b>Cú pháp:</b> Lưu ý rằng có cách dòng giữa nội dung bài đọc và câu hỏi. Ngoài ra có khoảng cách giữa đáp án và nội dung đáp án (A[nội dung đáp án] như này là sai)</li>
              <li><b>Giải thích đáp án:</b> Thêm dòng <code>Explanation: ...</code> ở cuối câu hỏi nếu muốn lưu lời giải.</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-gray-100 p-4 border-t flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition"
          >
            Đã hiểu!
          </button>
        </div>

      </div>
    </div>
  );
};

export default InputGuideModal;