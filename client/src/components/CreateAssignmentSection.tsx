import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronRight, Edit2, Folder, Plus, Search, X, File as FileIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import useDrivePicker from 'react-google-drive-picker';
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/light.css";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { type AssignmentProps, type TestItem } from '../types/quiz';
import axiosClient from '../api/axiosClient';

interface PostCreatorProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: AssignmentProps;
}

interface FolderItem {
  id: number;
  name: string;
  parentId: number | null;
}

const FullScreenPostCreator = ({ onClose, onSubmit, initialData }: PostCreatorProps) => {
  const [links, setLinks] = useState<string[]>([]); // Mảng chứa các đường link
  const [showLinkInput, setShowLinkInput] = useState(false); // Bật/tắt ô nhập link
  const [linkUrl, setLinkUrl] = useState(''); // Lưu trữ tạm thời link đang gõ

  const [driveFiles, setDriveFiles] = useState<{ name: string, url: string }[]>([]);
  const [openPicker, authResponse] = useDrivePicker();

  const [form, setForm] = useState({ title: '', content: '', deadline: '' });

  const [selectedTests, setSelectedTests] = useState<TestItem[]>([]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [tempSelectedTestIds, setTempSelectedTestIds] = useState<number[]>([]); // Lưu state tạm khi đang mở Modal
  const [searchQuery, setSearchQuery] = useState('');

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State that manage folder path
  const [folderPath, setFolderPath] = useState<{ id: number | null, name: string }[]>([{ id: null, name: 'Tất cả tài liệu' }]);

  const isEditMode = !!initialData;
  const currentFolderId = folderPath[folderPath.length - 1].id;

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title || '',
        content: initialData.content || '',
        deadline: initialData.deadline ? new Date(initialData.deadline).toISOString() : ''
      });

      setLinks(initialData.links || []);

      if (initialData.selectedTests && initialData.selectedTests.length > 0) {
        setSelectedTests(initialData.selectedTests);
        setTempSelectedTestIds(initialData.selectedTests.map(t => t.id));
      }

      if (initialData.fileUrls && initialData.fileUrls.length > 0) {
        const recoveredFiles = initialData.fileUrls.map((urlStr: string) => {
          try {
            const urlObj = new URL(urlStr);
            let filename = urlObj.searchParams.get('name');
            return {
              name: filename ? decodeURIComponent(filename) : 'Tệp đính kèm',
              url: urlStr
            };
          } catch (e) {
            return { name: 'Tệp đính kèm', url: urlStr };
          }
        });
        setDriveFiles(recoveredFiles);
      }
    }
  }, [initialData]);

  useEffect(() => {
    const fetchFolderContent = async () => {
      if (!isTestModalOpen) return;

      setIsLoading(true);
      try {
        const res = await axiosClient.get('/api/bank', {
          params: {
            folderId: currentFolderId || null
          }
        }) as any;
        console.log("Du lieu nhan duoc", res);
        if (res.success) {
          const { folders, tests } = res.data;
          const formattedFolders: FolderItem[] = folders.map((f: any) => ({
            id: f.id,
            name: f.name,
            parentId: f.parentId
          }));
          const formattedTests: TestItem[] = tests.map((t: any) => ({
            id: t.id,
            title: t.title,
            subject: t.subject,
            mode: t.mode,
            duration: t.duration,
            questionCount: t.questionCount,
            folderId: t.folderId || null
          }));
          console.log("Dữ liệu chuẩn bị lên màn hình:", { formattedFolders, formattedTests });
          setFolders(formattedFolders);
          setTests(formattedTests);
        }
      } catch (error) {
        console.error("Lỗi tải nội dung thư mục:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFolderContent();
  }, [currentFolderId, isTestModalOpen]);

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
              console.error(`Lỗi khi set Public cho file:`, error);
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

  const navigateToFolder = (folder: { id: number | null, name: string }) => {
    if (folder.id === currentFolderId) return;
    setFolderPath(prev => [...prev, folder]);
    setSearchQuery(''); // Reset search khi đổi thư mục
  };

  const jumpToBreadcrumb = (index: number) => {
    setFolderPath(prev => prev.slice(0, index + 1));
    setSearchQuery('');
  };

  const displayedFolders = useMemo(() => {
    let displayFolders = folders.filter(f => f.parentId === currentFolderId);

    if (searchQuery.trim()) {
      displayFolders = displayFolders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return displayFolders;
  }, [currentFolderId, searchQuery, folders]);

  const displayedTests = useMemo(() => {
    let displayTests = tests.filter(t => t.folderId === currentFolderId);

    if (searchQuery.trim()) {
      displayTests = displayTests.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return displayTests;
  }, [currentFolderId, searchQuery, tests]);

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error("Vui lòng nhập tiêu đề!");
    if (!form.content || form.content === '<p><br></p>') return toast.error("Vui lòng nhập nội dung!");

    const formattedFileUrls = driveFiles.map(f => {
      try {
        setIsSubmitting(true);
        const urlObj = new URL(f.url);
        urlObj.searchParams.set('name', f.name); // Nó sẽ tự biết chèn ? hay &
        return urlObj.toString();
      } catch (e) {
        return `${f.url}${f.url.includes('?') ? '&' : '?'}name=${encodeURIComponent(f.name)}`;
      } finally {
        setIsSubmitting(false);
      }
    });

    onSubmit({
      ...form,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      fileUrls: formattedFileUrls,
      links: links,  // Đây là mảng string[] chứa các link
      testIds: selectedTests.map(t => t.id)
    });
  };

  const openTestModal = () => {
    setTempSelectedTestIds(selectedTests.map(t => t.id));
    setIsTestModalOpen(true);
  };

  const toggleTestSelection = (testId: number) => {
    setTempSelectedTestIds(prev =>
      prev.includes(testId) ? prev.filter(id => id !== testId) : [...prev, testId]
    );
  };

  const saveTestSelection = () => {
    // Lọc ra các object test từ MOCK_TESTS (Sau này thay bằng biến chứa data get từ API)
    const newSelected = tests.filter(t => tempSelectedTestIds.includes(t.id));
    setSelectedTests(newSelected);
    setIsTestModalOpen(false);
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
            {isEditMode ? 'Chỉnh sửa bài đăng' : 'Bài đăng mới'}
          </h2>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-4 py-2 md:px-6 md:py-2.5 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 shadow-md transition flex items-center gap-2 text-sm md:text-base"
        >
          <span className="hidden sm:inline">{isEditMode ? 'Lưu thay đổi' : 'Đăng bài'}</span>
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
                    onChange={e => setForm({ ...form, title: e.target.value })}
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
                    onChange={(content) => setForm({ ...form, content })}
                    placeholder="Nhập nội dung chi tiết hoặc hướng dẫn..."
                    className="mb-12" /* Cần set height và margin-bottom để chừa chỗ cho thanh kéo */
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],        // Các nút in đậm, nghiêng, gạch chân, gạch ngang
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],     // Nút danh sách số và chấm tròn
                        ['clean']                                         // Nút xóa định dạng
                      ],
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-base font-bold text-gray-700 mb-3 ml-1">Bài kiểm tra đính kèm</label>
                {selectedTests.length === 0 ? (
                  // Chưa có test: Nút to mời gọi
                  <div onClick={openTestModal} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-white hover:bg-gray-50 transition cursor-pointer group">
                    <Plus className="mx-auto text-gray-400 group-hover:text-indigo-500 transition mb-2" size={28} />
                    <p className="text-sm font-medium text-gray-600">Thêm bài kiểm tra từ Test Bank</p>
                  </div>
                ) : (
                  // Đã có test: Chỉ hiện Summary + Nút sửa
                  <div onClick={openTestModal} className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-xl cursor-pointer hover:bg-indigo-100/70 transition">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                        {selectedTests.length}
                      </div>
                      <div>
                        <p className="font-bold text-indigo-900">Đã chọn {selectedTests.length} bài kiểm tra</p>
                        <p className="text-sm text-indigo-600/80">Nhấn vào đây để xem chi tiết hoặc thay đổi</p>
                      </div>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 text-sm font-bold rounded-lg border border-indigo-200 shadow-sm hover:bg-gray-50">
                      <Edit2 size={16} /> Chỉnh sửa
                    </button>
                  </div>
                )}
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
      {isTestModalOpen && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 md:p-8 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl flex flex-col h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Modal Header & Breadcrumb */}
            <div className="px-6 pt-5 pb-3 border-b border-gray-200 bg-white z-10 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">Chọn bài kiểm tra</h3>
                <button onClick={() => setIsTestModalOpen(false)} className="text-gray-400 hover:bg-gray-100 p-1.5 rounded-full transition"><X size={24} /></button>
              </div>

              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-1 text-sm font-medium text-gray-500 overflow-x-auto custom-scrollbar pb-1">
                {folderPath.map((folder, index) => (
                  <div key={folder.id || null} className="flex items-center gap-1">
                    <button
                      onClick={() => jumpToBreadcrumb(index)}
                      className={`hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-md transition whitespace-nowrap ${index === folderPath.length - 1 ? 'text-slate-800 font-bold' : ''}`}
                    >
                      {folder.name}
                    </button>
                    {index < folderPath.length - 1 && <ChevronRight size={16} className="text-gray-400" />}
                  </div>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Tìm kiếm tên bài test hoặc thư mục..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm"
                />
              </div>
            </div>

            {/* Bảng Dữ Liệu Ngang (Table-like List) */}
            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">

              {/* Table Header */}
              <div className="sticky top-0 bg-gray-50/95 border-b border-gray-200 flex items-center px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider z-10">
                <div className="w-10"></div> {/* Checkbox col */}
                <div className="flex-1">Tên mục</div>
                <div className="w-28 text-center hidden md:block">Phân loại</div>
                <div className="w-24 text-center hidden sm:block">Chế độ</div>
                <div className="w-24 text-center hidden sm:block">Thời lượng</div>
                <div className="w-24 text-center">Số câu</div>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
                  <p>Đang tải dữ liệu...</p>
                </div>
              ) : displayedFolders.length === 0 && displayedTests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <Folder size={48} className="mb-3 opacity-20" />
                  <p>Thư mục này trống hoặc không tìm thấy kết quả.</p>
                </div>
              ) : (
                <>
                  {displayedFolders.map(folder => (
                    <div
                      key={folder.id}
                      onClick={() => navigateToFolder(folder)}
                      className="flex items-center px-6 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition group"
                    >
                      <div className="w-10 flex justify-center"><Folder size={20} className="text-gray-400 group-hover:text-indigo-500" fill="currentColor" fillOpacity={0.2} /></div>
                      <div className="flex-1 font-medium text-slate-700 group-hover:text-indigo-700">{folder.name}</div>
                      <div className="w-28 text-center hidden md:block text-sm text-gray-400">-</div>
                      <div className="w-24 text-center hidden sm:block text-sm text-gray-400">-</div>
                      <div className="w-24 text-center hidden sm:block text-sm text-gray-400">-</div>
                      <div className="w-24 text-center text-sm text-gray-400">-</div>
                    </div>
                  ))}

                  {displayedTests.map(test => {
                    const isSelected = tempSelectedTestIds.includes(test.id);
                    return (
                      <div
                        key={test.id}
                        onClick={() => toggleTestSelection(test.id)}
                        className={`flex items-center px-6 py-3 border-b transition cursor-pointer ${isSelected ? 'bg-indigo-50/50 border-indigo-100' : 'border-gray-100 hover:bg-gray-50'}`}
                      >
                        {/* Checkbox custom */}
                        <div className="w-10 flex justify-center">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>
                            {isSelected && <Check size={14} className="text-white" />}
                          </div>
                        </div>

                        {/* Title */}
                        <div className="flex-1 flex items-center gap-3 overflow-hidden">
                          <FileIcon size={18} className={isSelected ? 'text-indigo-500' : 'text-gray-400'} />
                          <span className={`font-medium truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>{test.title}</span>
                        </div>

                        {/* Columns info */}
                        <div className="w-28 text-center hidden md:flex justify-center">
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">{test.subject}</span>
                        </div>

                        <div className="w-24 text-center hidden sm:flex justify-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${test.mode === 'EXAM' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{test.mode}</span>
                        </div>

                        <div className="w-24 text-center hidden sm:block text-sm text-gray-600">{test.duration}p</div>
                        <div className="w-24 text-center text-sm font-medium text-slate-700">{test.questionCount}</div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-200 bg-white flex items-center justify-between z-10">
              <span className="text-sm font-medium text-gray-600">
                Đang chọn <span className="text-indigo-600 font-bold text-base px-1">{tempSelectedTestIds.length}</span> bài test
              </span>
              <div className="flex gap-3">
                <button onClick={() => setIsTestModalOpen(false)} className="px-6 py-2 rounded-full font-medium text-gray-600 hover:bg-gray-100 transition">Hủy</button>
                <button onClick={saveTestSelection} className="px-8 py-2 rounded-full font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-md">Xác nhận</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default FullScreenPostCreator;