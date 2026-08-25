import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronRight, Edit2, Folder, Plus, Search, X, File as FileIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { DateTimePicker } from '../../components/ui/DateTimePicker';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { type TestItem } from '../../types/quiz';
import axiosClient from '../../lib/axios';
import { capitalizeFirstLetter } from '../../utils/text';
import { Badge, Button, Card, Input } from '../../components/ui/AppUI';

interface TestAssignmentManagerProps {
  onClose: () => void;
  onSubmit: (data: { title: string; content: string; deadline: string | null; testIds: number[] }) => void;
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

interface BankTestItem {
  id: number;
  title: string;
  subject: TestItem['subject'];
  mode: TestItem['mode'];
  duration: number;
  questionCount: number;
  folderId?: number | null;
}

interface BankResponse {
  success: boolean;
  data: { folders: FolderItem[]; tests: BankTestItem[] };
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
        const res = await axiosClient.get<BankResponse, BankResponse>('/api/bank', {
          params: {
            folderId: currentFolderId || null
          }
        });
        if (res.success) {
          const { folders, tests } = res.data;
          const formattedFolders: FolderItem[] = folders.map(f => ({
            id: f.id,
            name: f.name,
            parentId: f.parentId
          }));
          const formattedTests: TestItem[] = tests.map(t => ({
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
    <div className="absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden bg-background animate-in slide-in-from-bottom-4 duration-300">

      {/* HEADER SECTION */}
      <header className="z-30 flex h-12 w-full flex-none items-center justify-between border-b border-ui-border bg-surface px-4 md:px-6">
        <div className="flex items-center gap-2 md:gap-4">
          <Button onClick={onClose} variant="ghost" size="icon" className="h-8 w-8" aria-label="Close assignment editor"><X size={18} /></Button>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {isEditMode ? 'Edit assignment' : 'Create assignment'}
          </h2>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="sm"
        >
          <span className="hidden sm:inline">{isEditMode ? 'Save changes' : 'Assign'}</span>
        </Button>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-screen-2xl p-4 pb-20 md:p-6">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CỘT TRÁI: Nhập văn bản */}
            <div className="lg:col-span-2 space-y-6">

              {/* 1. Ô NHẬP TIÊU ĐỀ */}
              <label className="block"><span className="mb-2 block text-sm font-medium text-foreground">Assignment title</span>
                  <Input
                    type="text"
                    id="test-title"
                    placeholder="Assignment title…"
                    className="w-full"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                  />
              </label>

              {/* 2. KHU VỰC NỘI DUNG */}
              <div>
                <label className="mb-3 ml-1 block text-sm font-medium text-foreground">
                  Instructions
                </label>
                <div className="
                  overflow-hidden rounded-card border border-ui-border bg-surface shadow-xs transition-colors focus-within:border-primary
                  [&_.ql-container.ql-snow]:border-none
                  [&_.ql-toolbar.ql-snow]:border-b [&_.ql-toolbar.ql-snow]:border-ui-border
                  [&_.ql-editor]:font-sans [&_.ql-editor]:text-base [&_.ql-editor]:text-foreground
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
                <label className="mb-3 ml-1 block text-sm font-medium text-foreground">Tests</label>
                {selectedTests.length === 0 ? (
                  <button type="button" onClick={openTestModal} className="group w-full rounded-card border border-dashed border-ui-border bg-surface p-6 text-center transition hover:bg-muted">
                    <Plus className="mx-auto mb-2 text-muted-foreground transition group-hover:text-primary" size={28} />
                    <span className="text-sm font-medium text-muted-foreground">Select tests from Practice Center</span>
                  </button>
                ) : (
                  <button type="button" onClick={openTestModal} className="flex w-full items-center justify-between rounded-card border border-ui-border bg-surface p-4 text-left transition hover:bg-muted">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                        {selectedTests.length}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{selectedTests.length} selected tests</p>
                        <p className="text-sm text-muted-foreground">Open to review or change the selection</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-2 rounded-control border border-ui-border bg-surface px-3 py-2 text-sm font-medium text-primary">
                      <Edit2 size={16} /> Edit
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* CỘT PHẢI: Cài đặt */}
            <div className="space-y-6">

              <Card className="p-5">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  Due date
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">Choose when this assignment is due.</p>
                <DateTimePicker
                  value={form.deadline}
                  onChange={deadline => setForm({ ...form, deadline })}
                  placeholder="Choose a due date…"
                  ariaLabel="Assignment due date"
                />
              </Card>

            </div>
          </div>

        </div>
      </main>

      {/* TEST MODAL */}
      {isTestModalOpen && (
        <div className="absolute inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4 md:p-8 animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-labelledby="select-tests-title" className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-card border border-ui-border bg-surface shadow-overlay animate-in zoom-in-95 duration-200">

            {/* Modal Header & Breadcrumb */}
            <div className="z-10 flex flex-col gap-4 border-b border-ui-border bg-surface px-6 pb-3 pt-5">
              <div className="flex items-center justify-between">
                <h3 id="select-tests-title" className="text-xl font-semibold text-foreground">Select tests</h3>
                <Button onClick={() => setIsTestModalOpen(false)} variant="ghost" size="icon" className="h-8 w-8" aria-label="Close test selector"><X size={18} /></Button>
              </div>

              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-sm font-medium text-muted-foreground custom-scrollbar">
                {folderPath.map((folder, index) => (
                  <div key={folder.id || null} className="flex items-center gap-1">
                    <button
                      onClick={() => jumpToBreadcrumb(index)}
                      className={`whitespace-nowrap rounded-md px-2 py-1 transition hover:bg-muted hover:text-primary ${index === folderPath.length - 1 ? 'font-semibold text-foreground' : ''}`}
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
                <Input
                  type="text"
                  placeholder="Search tests or folders…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11"
                />
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto bg-surface custom-scrollbar">

              {/* Table Header */}
              <div className="sticky top-0 z-10 flex items-center border-b border-ui-border bg-muted/95 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                      className="group flex cursor-pointer items-center border-b border-ui-border px-6 py-3 transition hover:bg-muted"
                    >
                      <div className="flex w-10 justify-center"><Folder size={20} className="text-muted-foreground group-hover:text-primary" fill="currentColor" fillOpacity={0.2} /></div>
                      <div className="flex-1 font-medium text-foreground group-hover:text-primary">{folder.name}</div>
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
                        className={`flex cursor-pointer items-center border-b border-ui-border px-6 py-3 transition ${isSelected ? 'bg-primary-soft/60' : 'hover:bg-muted'}`}
                      >
                        <div className="w-10 flex justify-center">
                          <div className={`flex h-5 w-5 items-center justify-center rounded-sm border transition ${isSelected ? 'border-primary bg-primary' : 'border-ui-border bg-surface'}`}>
                            {isSelected && <Check size={14} className="text-white" />}
                          </div>
                        </div>

                        <div className="flex-1 flex items-center gap-3 overflow-hidden">
                          <FileIcon size={18} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                          <span className="truncate font-medium text-foreground">{capitalizeFirstLetter(test.title)}</span>
                        </div>

                        <div className="w-28 text-center hidden md:flex justify-center">
                          <Badge>{test.subject}</Badge>
                        </div>

                        <div className="w-24 text-center hidden sm:flex justify-center">
                          <Badge tone={test.mode === 'EXAM' ? 'danger' : 'green'}>{test.mode}</Badge>
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
            <div className="z-10 flex items-center justify-between border-t border-ui-border bg-surface p-5">
              <span className="text-sm font-medium text-muted-foreground">
                Selecting <span className="px-1 text-base font-semibold text-primary">{tempSelectedTestIds.length}</span> tests
              </span>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => { setTempSelectedTestIds([]); setFolderPath([{ id: null, name: 'All tests' }]); setIsTestModalOpen(false); }}>Cancel</Button>
                <Button onClick={saveTestSelection}>Confirm</Button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default TestAssignmentManager;
