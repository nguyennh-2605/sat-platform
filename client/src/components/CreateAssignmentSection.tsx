import { useState } from 'react';
import { X, Link as CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useDrivePicker from 'react-google-drive-picker';
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/light.css";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const FullScreenPostCreator = ({ onClose, onSubmit }: any) => {
  const [links, setLinks] = useState<string[]>([]); // Mảng chứa các đường link
  const [showLinkInput, setShowLinkInput] = useState(false); // Bật/tắt ô nhập link
  const [linkUrl, setLinkUrl] = useState(''); // Lưu trữ tạm thời link đang gõ

  const [driveFiles, setDriveFiles] = useState<{name: string, url: string}[]>([]);
  const [openPicker, authResponse] = useDrivePicker();

  const [form, setForm] = useState({ title: '', content: '', deadline: '' });

  const handleOpenDrivePicker = () => {
    openPicker({
      clientId: import.meta.env.VITE_DRIVE_CLIENT_ID,
      developerKey: import.meta.env.VITE_DRIVE_API_KEY,
      viewId: "DOCS",
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: true,
      appId: import.meta.env.VITE_DRIVE_APP_ID,
      customScopes: ['https://www.googleapis.com/auth/drive.file'],
      callbackFunction: async (data) => {
        if (data.action === 'picked') {
          const token = authResponse?.access_token;
          for (const doc of data.docs) {
            if (token) {
              try {
                await Promise.all(data.docs.map(doc => 
                  fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}/permissions`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
                  })
                ));
                console.log("Đã mở Public cho tất cả file!");
              } catch (error) {
                console.error(`Lỗi khi set Public cho file ${doc.name}:`, error);
              }
            }
          }
          // Lấy tên và link của các file vừa chọn/upload trên Drive
          const pickedFiles = data.docs.map(doc => ({
            name: doc.name,
            url: doc.url
          }));
          setDriveFiles((prev) => [...prev, ...pickedFiles]);
        }
      },
    });
  };


  const removeDriveFile = (indexToRemove: number) => {
    setDriveFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleAddLink = () => {
    if (linkUrl.trim() !== '') {
      setLinks((prev) => [...prev, linkUrl.trim()]);
      setLinkUrl(''); // Xóa trắng ô nhập sau khi thêm
      setShowLinkInput(false); // Ẩn ô nhập đi
    }
  };

  const removeLink = (indexToRemove: number) => {
    setLinks((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error("Vui lòng nhập tiêu đề!");
    if (!form.content || form.content === '<p><br></p>') return toast.error("Vui lòng nhập nội dung!");

    const postType = form.deadline ? 'assignment' : 'announcement';

    // Gửi toàn bộ dữ liệu lên hàm handleCreateAssignment ở file cha
    onSubmit({
      ...form,
      type: postType,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      driveFiles: driveFiles.map(f => f.url),   // Đây là mảng File[]
      externalLinks: links  // Đây là mảng string[] chứa các link
    });
  };

  return (
    // THAY ĐỔI QUAN TRỌNG: Dùng "absolute inset-0" thay vì "fixed"
    <div className="absolute inset-0 z-[50] flex flex-col h-full w-full bg-[#F8FAFC] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      
      {/* HEADER SECTION */}
      <header className="flex-none h-16 bg-white border-b border-gray-300 px-4 md:px-8 flex items-center justify-between z-30 shadow-sm w-full">
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X size={24} className="text-gray-500" />
          </button>
          <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">
            Tạo bài đăng mới
          </h2>
        </div>
        
        <button 
          onClick={handleSubmit} 
          className="px-4 py-2 md:px-6 md:py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md transition flex items-center gap-2 text-sm md:text-base"
        >
          <CheckCircle size={18}/> <span className="hidden sm:inline">Đăng bài</span>
        </button>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto p-6 md:p-8 pb-20">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CỘT TRÁI: Nhập văn bản */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* 1. Ô NHẬP TIÊU ĐỀ */}
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-300 focus-within:border-indigo-600 font-['Helvetica',Arial,sans-serif]">
                <div className="relative w-full">
                  <input 
                    type="text" 
                    id="post-title"
                    placeholder=" " /* Bắt buộc có dấu cách */
                    className="block w-full pt-4 pb-1 text-base text-gray-700 bg-transparent border-none appearance-none focus:outline-none focus:ring-0 peer" 
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                  />
                  <label 
                    htmlFor="post-title"
                    className="absolute text-base text-gray-500 italic font-medium duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] 
                               peer-focus:text-indigo-600 
                               peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 
                               peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-0 cursor-text"
                  >
                    Tiêu đề bài viết...
                  </label>
                </div>
              </div>

              {/* 2. KHU VỰC NỘI DUNG */}
              <div>
                <label className="block text-base font-bold text-gray-700 mb-3 ml-1">
                  Nội dung
                </label>
                <div className="
                  bg-white rounded-lg shadow-sm border border-gray-300 focus-within:border-indigo-600 transition-colors overflow-hidden
                  /* Xóa viền mặc định bao quanh của Quill */
                  [&_.ql-container.ql-snow]:border-none 
                  /* Thêm một vạch kẻ nhẹ để ngăn cách thanh công cụ và chỗ gõ chữ */
                  [&_.ql-toolbar.ql-snow]:border-b [&_.ql-toolbar.ql-snow]:border-gray-200
                  /* Ép font chữ của editor giống với font website (kế thừa) và chỉnh size chữ */
                  [&_.ql-editor]:font-sans [&_.ql-editor]:text-base [&_.ql-editor]:text-gray-700
                ">
                  <ReactQuill 
                    theme="snow"
                    value={form.content}
                    onChange={(content) => setForm({...form, content})}
                    placeholder="Nhập nội dung chi tiết hoặc hướng dẫn..."
                    className="h-64 mb-12" /* Cần set height và margin-bottom để chừa chỗ cho thanh kéo */
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],        // Các nút in đậm, nghiêng, gạch chân, gạch ngang
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],     // Nút danh sách số và chấm tròn
                        ['clean']                                         // Nút xóa định dạng
                      ],
                    }}
                  />
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: Cài đặt & Đính kèm */}
            <div className="space-y-6">
              
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-300">
                <h3 className="text-base font-bold text-gray-700 mb-2 flex items-center gap-2">
                  Hạn nộp bài
                </h3>
                <p className="text-sm text-gray-400 mb-4">Để trống nếu đây chỉ là thông báo.</p>
                <Flatpickr
                  data-enable-time
                  value={form.deadline}
                  onChange={([date]) => {
                    // Kiểm tra nếu có date thì mới chuyển sang String
                    if (date) {
                      setForm({ ...form, deadline: date.toISOString() });
                    }
                  }}
                  options={{
                    enableTime: true,
                    dateFormat: "d/m/Y H:i",
                    time_24hr: true,
                  }}
                  placeholder="Chọn hạn nộp bài..."
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-300">
                <h3 className="text-base font-bold text-gray-700 mb-6 flex items-center gap-2">
                  Đính kèm tài liệu
                </h3>

                <div className="flex items-center justify-center gap-8 mb-6">
                  <button 
                    type="button"
                    onClick={handleOpenDrivePicker}
                    className="flex flex-col items-center justify-center w-[72px] h-[72px] rounded-full border border-gray-300 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span className="text-xs font-medium text-gray-600 mt-1">Drive</span>
                  </button>

                  {/* Nút Link */}
                  <button 
                    type="button"
                    onClick={() => setShowLinkInput(!showLinkInput)}
                    className="flex flex-col items-center justify-center w-[72px] h-[72px] rounded-full border border-gray-300 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    {/* Icon Link */}
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    <span className="text-xs font-medium text-gray-600 mt-1">Link</span>
                  </button>
                </div>

                {showLinkInput && (
                  <div className="flex gap-2 mb-4 animate-in slide-in-from-top-2">
                    <input 
                      type="url" 
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="Dán đường dẫn vào đây..." 
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                    />
                    <button 
                      type="button" 
                      onClick={handleAddLink}
                      className="px-4 py-2 bg-indigo-50 text-indigo-600 text-sm font-medium rounded-full hover:bg-indigo-100 transition-colors"
                    >
                      Thêm
                    </button>
                  </div>
                )}

                {/* DANH SÁCH FILE ĐÃ CHỌN */}
                {driveFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tệp đính kèm ({driveFiles.length})</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {driveFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg border border-gray-100 group">
                          <div className="flex items-center space-x-2 overflow-hidden">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                            <a href={file.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate">{file.name}</a>
                          </div>
                          <button type="button" onClick={() => removeDriveFile(index)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DANH SÁCH LINK ĐÃ CHỌN */}
                {links.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Liên kết đính kèm ({links.length})</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {links.map((link, index) => (
                        <div key={index} className="flex items-center justify-between bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 group">
                          <div className="flex items-center space-x-2 overflow-hidden">
                            <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate">{link}</a>
                          </div>
                          {/* Nút Xóa Link (dấu X) */}
                          <button type="button" onClick={() => removeLink(index)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
};

export default FullScreenPostCreator;