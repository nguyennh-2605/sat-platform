import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronRight, Edit2, Folder, Plus, Search, X, File as FileIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/light.css";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { type TestItem } from '../../types/quiz';
import axiosClient from '../../lib/axios';
import { capitalizeFirstLetter } from '../../utils/text';

interface TestAssignmentManagerProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: {
    title?: string;
    content?: string;
    deadline?: string;
    selectedTests?: TestItem[];
  };
}

interface FolderItem {
  id: number;
  name: string;
  parentId: number | null;
}

const TestAssignmentManager = ({ onClose, onSubmit, initialData }: TestAssignmentManagerProps) => {
  const [form, setForm] = useState({ title: '', content: '', deadline: '' });

  const [selectedTests, setSelectedTests] = useState<TestItem[]>([]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [tempSelectedTestIds, setTempSelectedTestIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [folderPath, setFolderPath] = useState<{ id: number | null, name: string }[]>([{ id: null, name: 'All tests' }]);

  const isEditMode = !!initialData;
  const currentFolderId = folderPath[folderPath.length - 1].id;

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title || '',
        content: initialData.content || '',
        deadline: initialData.deadline ? new Date(initialData.deadline).toISOString() : ''
      });

      if (initialData.selectedTests && initialData.selectedTests.length > 0) {
        setSelectedTests(initialData.selectedTests);
        setTempSelectedTestIds(initialData.selectedTests.map(t => t.id));
      }
    }
  }, [initialData]);

  useEffect(() => {
    const fetchFolderContent = async () => {
      if (!isTestModalOpen) return;

      setIsLoading(true);
      try {
        console.log("currentFolderId", currentFolderId);
        const res = await axiosClient.get('/api/bank', {
          params: {
            folderId: currentFolderId || null
          }
        }) as any;
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

  const navigateToFolder = (folder: { id: number | null, name: string }) => {
    if (folder.id === currentFolderId) return;
    setFolderPath(prev => [...prev, folder]);
    setSearchQuery('');
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
    if (!form.title.trim()) return toast.error("Enter a title");
    if (!form.content || form.content === '<p><br></p>') return toast.error("Enter content");
    if (selectedTests.length === 0) return toast.error("Select at least one test");

    setIsSubmitting(true);
    onSubmit({
      ...form,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      testIds: selectedTests.map(t => t.id)
    });
    setIsSubmitting(false);
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
    const knownTestsMap = new Map<number, TestItem>(
      [...selectedTests, ...tests].map(test => [test.id, test])
    );
    const newSelected = tempSelectedTestIds
      .map(testId => knownTestsMap.get(testId))
      .filter((test): test is TestItem => !!test);

    setSelectedTests(newSelected);
    setIsTestModalOpen(false);
  };

  return (
    <div className="absolute inset-0 z-[50] flex flex-col h-full w-full bg-[#F8FAFC] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">

      {/* HEADER SECTION */}
      <header className="flex-none h-16 bg-white border-b border-gray-300 px-4 md:px-8 flex items-center justify-between z-30 shadow-sm w-full">
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X size={24} className="text-gray-500" />
          </button>
          <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">
            {isEditMode ? 'Edit assignment' : 'Create assignment'}
          </h2>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-4 py-2 md:px-6 md:py-2.5 bg-[#1B7A5A] text-white rounded-full font-bold hover:bg-[#145F47] shadow-md transition flex items-center gap-2 text-sm md:text-base"
        >
          <span className="hidden sm:inline">{isEditMode ? 'Save changes' : 'Assign'}</span>
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
                    id="test-title"
                    placeholder=" "
                    className="block w-full pt-4 pb-1 text-base text-gray-700 bg-transparent border-none appearance-none focus:outline-none focus:ring-0 peer"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                  />
                  <label
                    htmlFor="test-title"
                    className="absolute text-base text-gray-500 italic font-medium duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0]
                               peer-focus:text-[#1B7A5A]
                               peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2
                               peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-0 cursor-text"
                  >
                    Assignment title…
                  </label>
                </div>
              </div>

              {/* 2. KHU VỰC NỘI DUNG */}
              <div>
                <label className="block text-base font-bold text-gray-700 mb-3 ml-1">
                  Instructions
                </label>
                <div className="
                  bg-white rounded-lg shadow-sm border border-gray-300 focus-within:border-indigo-600 transition-colors overflow-hidden
                  [&_.ql-container.ql-snow]:border-none
                  [&_.ql-toolbar.ql-snow]:border-b [&_.ql-toolbar.ql-snow]:border-gray-200
                  [&_.ql-editor]:font-sans [&_.ql-editor]:text-base [&_.ql-editor]:text-gray-700
                ">
                  <ReactQuill
                    theme="snow"
                    value={form.content}
                    onChange={(content) => setForm({ ...form, content })}
                    placeholder="Add instructions for students…"
                    className="mb-12"
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['clean']
                      ],
                    }}
                  />
                </div>
              </div>

              {/* 3. CHỌN BÀI KIỂM TRA */}
              <div>
                <label className="block text-base font-bold text-gray-700 mb-3 ml-1">Tests</label>
                {selectedTests.length === 0 ? (
                  <div onClick={openTestModal} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-white hover:bg-gray-50 transition cursor-pointer group">
                    <Plus className="mx-auto text-gray-400 group-hover:text-[#1B7A5A] transition mb-2" size={28} />
                    <p className="text-sm font-medium text-gray-600">Select tests from Practice Center</p>
                  </div>
                ) : (
                  <div onClick={openTestModal} className="flex items-center justify-between p-4 bg-[#E8F5EF] border border-[#C2DDD4] rounded-xl cursor-pointer hover:bg-[#C2DDD4]/70 transition">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#1B7A5A] rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                        {selectedTests.length}
                      </div>
                      <div>
                        <p className="font-semibold text-[#1A1A1A]">{selectedTests.length} selected tests</p>
                        <p className="text-sm text-[#1B7A5A]/80">Open to review or change the selection</p>
                      </div>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white text-[#1B7A5A] text-sm font-bold rounded-lg border border-[#C2DDD4] shadow-sm hover:bg-gray-50">
                      <Edit2 size={16} /> Edit
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* CỘT PHẢI: Cài đặt */}
            <div className="space-y-6">

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-300">
                <h3 className="text-base font-bold text-gray-700 mb-2 flex items-center gap-2">
                  Due date
                </h3>
                <p className="text-sm text-gray-400 mb-4">Choose when this assignment is due.</p>
                <Flatpickr
                  data-enable-time
                  value={form.deadline}
                  onChange={([date]) => {
                    if (date) {
                      setForm({ ...form, deadline: date.toISOString() });
                    }
                  }}
                  options={{
                    enableTime: true,
                    dateFormat: "d/m/Y H:i",
                    time_24hr: true,
                  }}
                  placeholder="Choose a due date…"
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#1B7A5A]/20 outline-none transition"
                />
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* TEST MODAL */}
      {isTestModalOpen && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 md:p-8 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Modal Header & Breadcrumb */}
            <div className="px-6 pt-5 pb-3 border-b border-gray-200 bg-white z-10 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-800">Select tests</h3>
                <button onClick={() => setIsTestModalOpen(false)} className="text-gray-400 hover:bg-gray-100 p-1.5 rounded-full transition"><X size={24} /></button>
              </div>

              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-1 text-sm font-medium text-gray-500 overflow-x-auto custom-scrollbar pb-1">
                {folderPath.map((folder, index) => (
                  <div key={folder.id || null} className="flex items-center gap-1">
                    <button
                      onClick={() => jumpToBreadcrumb(index)}
                      className={`hover:text-[#1B7A5A] hover:bg-[#E8F5EF] px-2 py-1 rounded-md transition whitespace-nowrap ${index === folderPath.length - 1 ? 'text-slate-800 font-bold' : ''}`}
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
                  placeholder="Search tests or folders…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#1B7A5A]/20 outline-none transition text-sm"
                />
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">

              {/* Table Header */}
              <div className="sticky top-0 bg-gray-50/95 border-b border-gray-200 flex items-center px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider z-10">
                <div className="w-10"></div>
                <div className="flex-1">Name</div>
                <div className="w-28 text-center hidden md:block">Category</div>
                <div className="w-24 text-center hidden sm:block">Mode</div>
                <div className="w-24 text-center hidden sm:block">Duration</div>
                <div className="w-24 text-center">Questions</div>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
                  <p>Loading data…</p>
                </div>
              ) : displayedFolders.length === 0 && displayedTests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <Folder size={48} className="mb-3 opacity-20" />
                  <p>This folder is empty or no results were found.</p>
                </div>
              ) : (
                <>
                  {displayedFolders.map(folder => (
                    <div
                      key={folder.id}
                      onClick={() => navigateToFolder(folder)}
                      className="flex items-center px-6 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition group"
                    >
                      <div className="w-10 flex justify-center"><Folder size={20} className="text-gray-400 group-hover:text-[#1B7A5A]" fill="currentColor" fillOpacity={0.2} /></div>
                      <div className="flex-1 font-medium text-slate-700 group-hover:text-[#1B7A5A]">{folder.name}</div>
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
                        className={`flex items-center px-6 py-3 border-b transition cursor-pointer ${isSelected ? 'bg-[#E8F5EF]/50 border-indigo-100' : 'border-gray-100 hover:bg-gray-50'}`}
                      >
                        <div className="w-10 flex justify-center">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition ${isSelected ? 'bg-[#1B7A5A] border-indigo-600' : 'bg-white border-gray-300'}`}>
                            {isSelected && <Check size={14} className="text-white" />}
                          </div>
                        </div>

                        <div className="flex-1 flex items-center gap-3 overflow-hidden">
                          <FileIcon size={18} className={isSelected ? 'text-[#1B7A5A]' : 'text-gray-400'} />
                          <span className={`font-medium truncate ${isSelected ? 'text-[#1A1A1A]' : 'text-slate-800'}`}>{capitalizeFirstLetter(test.title)}</span>
                        </div>

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
                Selecting <span className="text-[#1B7A5A] font-semibold text-base px-1">{tempSelectedTestIds.length}</span> tests
              </span>
              <div className="flex gap-3">
                <button onClick={() => {
                  setTempSelectedTestIds([]);
                  setFolderPath([{ id: null, name: 'All tests' }]);
                  setIsTestModalOpen(false);
                }} className="px-6 py-2 rounded-full font-medium text-gray-600 hover:bg-gray-100 transition">Cancel</button>
                <button onClick={saveTestSelection} className="app-button app-button-primary px-8">Confirm</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default TestAssignmentManager;
