import { useState, useEffect } from 'react';
import { 
  Plus, Search, Trash2, Edit3, 
  XCircle, Save, FileText, ChevronLeft, ChevronRight, AlertCircle, Loader2
} from 'lucide-react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';

interface ErrorEntry {
  id: string; // Prisma UUID
  source: string;
  category: string;
  userAnswer: string;
  correctAnswer: string;
  whyWrong: string;
  whyRight: string;
  createdAt?: string; 
}

// --- HELPER: MODERN BADGE COLORS ---
const getCategoryStyle = (category: string) => {
  const norm = category.toLowerCase();
  if (norm.includes("word") || norm.includes("vocab")) 
    return "bg-amber-50 text-amber-700 border-amber-200"; 
  if (norm.includes("reading") || norm.includes("structure") || norm.includes("inference")) 
    return "bg-rose-50 text-rose-700 border-rose-200"; 
  if (norm.includes("grammar") || norm.includes("convention")) 
    return "bg-emerald-50 text-emerald-700 border-emerald-200"; 
  if (norm.includes("math") || norm.includes("logic")) 
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
};

const ErrorLog = () => {
  
  // -- STATE --
  const [logs, setLogs] = useState<ErrorEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Loading thật từ server
  const [isSaving, setIsSaving] = useState(false);  // Loading khi bấm nút Save
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; 

  // Form State
  const [formData, setFormData] = useState<Partial<ErrorEntry>>({
    source: '', category: '', userAnswer: '', correctAnswer: '', whyWrong: '', whyRight: '',
  });

  // -- 1. LOAD DATA TỪ API --
  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const data = await axiosClient.get<ErrorEntry[], ErrorEntry[]>(`/api/error-logs`);
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      toast.error("Không thể tải dữ liệu từ server!");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(); // Gọi API khi vào trang
  }, []);

  // -- 2. ACTIONS (CREATE / UPDATE) --
  const handleSave = async () => {
    if (!formData.source || !formData.userAnswer || !formData.correctAnswer) {
      toast.error("Vui lòng điền thông tin cơ bản!");
      return;
    }

    // Chuẩn bị payload (loại bỏ id nếu là create)
    const payload = {
      source: formData.source,
      category: formData.category || 'General',
      userAnswer: formData.userAnswer,
      correctAnswer: formData.correctAnswer,
      whyWrong: formData.whyWrong || '',
      whyRight: formData.whyRight || '',
    };

    try {
      setIsSaving(true);
      
      if (formData.id) {
          // --- UPDATE ---
        await axiosClient.put(`/api/error-logs/${formData.id}`, payload);
        toast.success("Đã cập nhật dữ liệu!");
      } else {
          // --- CREATE ---
        await axiosClient.post(`/api/error-logs`, payload);
        toast.success("Đã lưu vào Database!");
      }
      
      // Reset form & Reload data
      setShowModal(false);
      resetForm();
      await fetchLogs(); // Tải lại danh sách mới nhất từ server

    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra khi lưu!");
    } finally {
      setIsSaving(false);
    }
  };

  // -- 3. DELETE --
  const handleDelete = async (id: string) => {
    if (confirm("Bạn chắc chắn muốn xóa dòng này vĩnh viễn?")) {
      try {
        // Optimistic Update: Xóa trên UI trước cho nhanh
        setLogs(prev => prev.filter(l => l.id !== id));
        await axiosClient.delete(`/api/error-logs/${id}`);
        toast.success("Đã xóa!");
        if (currentItems.length === 1 && currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        }
      } catch (error) {
        toast.error("Lỗi khi xóa!");
        fetchLogs(); // Rollback lại data nếu lỗi
      }
    }
  };

  const handleEdit = (entry: ErrorEntry) => {
    setFormData(entry);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      source: '', category: '', userAnswer: '', correctAnswer: '', whyWrong: '', whyRight: '',
    });
  };

  // -- FILTER & PAGINATION (Giữ nguyên logic) --
  const filteredLogs = logs.filter(log => 
    (log.source?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (log.category?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (log.whyWrong?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] space-y-4 pb-4">
      
      {/* --- HEADER CONTROL --- */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
             <AlertCircle className="text-rose-500" /> Error Log
          </h2>
          <p className="text-xs text-slate-500 font-medium">
             {isLoading ? "Đang đồng bộ..." : `Hiện tại có ${logs.length} bản ghi`}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Tìm kiếm..." 
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
             </div>
             <button 
                onClick={() => { resetForm(); setShowModal(true); }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-md transition-all whitespace-nowrap"
             >
                <Plus size={16} /> Thêm mới
             </button>
        </div>
      </div>

      {/* --- TABLE CONTAINER --- */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden relative">
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-white/80 flex items-center justify-center">
             <div className="flex flex-col items-center gap-2 text-indigo-600">
                <Loader2 size={32} className="animate-spin" />
                <span className="text-xs font-semibold">Đang tải dữ liệu...</span>
             </div>
          </div>
        )}

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse min-w-[1000px]">
            {/* STICKY HEADER */}
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 font-bold sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 w-48 tracking-wider">Category</th>
                <th className="px-6 py-4 w-56 tracking-wider">Source</th>
                <th className="px-4 py-4 w-24 text-center tracking-wider">Your Ans</th>
                <th className="px-4 py-4 w-24 text-center tracking-wider">Correct</th>
                <th className="px-6 py-4 min-w-[280px] tracking-wider">Analysis (Why Wrong)</th>
                <th className="px-6 py-4 min-w-[280px] tracking-wider">Solution (Why Right)</th>
                <th className="px-4 py-4 w-20 text-center">Action</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100">
              {!isLoading && currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                      {logs.length === 0 ? "Chưa có dữ liệu nào." : "Không tìm thấy dữ liệu phù hợp."}
                  </td>
                </tr>
              ) : (
                currentItems.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                    
                    {/* Category */}
                    <td className="px-6 py-4 align-top">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold border ${getCategoryStyle(log.category)}`}>
                        {log.category}
                      </span>
                    </td>

                    {/* Source */}
                    <td className="px-6 py-4 align-top font-medium text-slate-700">
                        <div className="flex items-start gap-2">
                           <FileText size={14} className="mt-1 text-slate-300 shrink-0"/>
                           <span className="line-clamp-2" title={log.source}>{log.source}</span>
                        </div>
                    </td>

                    {/* User Answer (Red style) */}
                    <td className="px-4 py-4 align-top text-center">
                      <div className="w-8 h-8 mx-auto rounded-lg bg-red-50 text-red-600 font-bold flex items-center justify-center border border-red-100">
                        {log.userAnswer === 'Omitted' ? 'X' : log.userAnswer}
                      </div>
                    </td>

                    {/* Correct Answer (Green style) */}
                    <td className="px-4 py-4 align-top text-center">
                      <div className="w-8 h-8 mx-auto rounded-lg bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center border border-emerald-100">
                        {log.correctAnswer}
                      </div>
                    </td>

                    {/* Why Wrong */}
                    <td className="px-6 py-4 align-top">
                      <p className="text-slate-600 leading-relaxed line-clamp-3 hover:line-clamp-none cursor-help transition-all duration-300">
                          {log.whyWrong}
                      </p>
                    </td>

                    {/* Why Right */}
                    <td className="px-6 py-4 align-top">
                        <p className="text-slate-600 leading-relaxed line-clamp-3 hover:line-clamp-none cursor-help transition-all duration-300">
                          {log.whyRight}
                        </p>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 align-top text-center">
                      <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(log)} 
                            className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Sửa"
                          >
                             <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(log.id)} 
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                            title="Xóa"
                          >
                             <Trash2 size={16} />
                          </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* --- PAGINATION FOOTER --- */}
        {filteredLogs.length > 0 && (
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                <div className="text-xs text-slate-500">
                    Hiển thị <b>{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredLogs.length)}</b> trong số <b>{filteredLogs.length}</b> lỗi
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => paginate(currentPage - 1)} 
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    {/* Simple Pagination Display to save space */}
                    <span className="text-xs font-bold px-2 text-slate-600">Trang {currentPage} / {totalPages}</span>

                    <button 
                        onClick={() => paginate(currentPage + 1)} 
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* --- MODAL FORM --- */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
             
             {/* Modal Header */}
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                   {formData.id ? <Edit3 size={18}/> : <Plus size={18}/>}
                   {formData.id ? "Chỉnh sửa phân tích" : "Ghi lại lỗi sai mới"}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                    <XCircle size={22}/>
                </button>
             </div>

             {/* Modal Body */}
             <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">Nguồn đề (Source)</label>
                      <input 
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                        placeholder="VD: Test 1 - Module 2 - Câu 15"
                        value={formData.source}
                        onChange={e => setFormData({...formData, source: e.target.value})}
                      />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">Dạng bài (Category)</label>
                      <input 
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                        placeholder="VD: Words in Context..."
                        list="cat-suggestions"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      />
                      <datalist id="cat-suggestions">
                          <option value="Words in Context"/>
                          <option value="Text Structure and Purpose"/>
                          <option value="Cross-Text Connections"/>
                          <option value="Inferences"/>
                          <option value="Standard English Conventions"/>
                      </datalist>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-8 p-5 bg-slate-50 rounded-xl border border-slate-100">
                   <div className="text-center">
                      <label className="block text-xs font-bold text-rose-500 uppercase tracking-wide mb-3">Bạn chọn (Wrong)</label>
                      <div className="flex justify-center gap-2">
                         {['A','B','C','D'].map(opt => (
                            <button 
                                key={opt}
                                onClick={() => setFormData({...formData, userAnswer: opt})}
                                className={`w-10 h-10 rounded-lg font-bold border-2 transition-all ${
                                    formData.userAnswer === opt 
                                    ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-200 scale-110' 
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-rose-300'
                                }`}
                            >{opt}</button>
                         ))}
                      </div>
                   </div>
                   <div className="text-center border-l border-slate-200 pl-8">
                      <label className="block text-xs font-bold text-emerald-600 uppercase tracking-wide mb-3">Đáp án đúng (Correct)</label>
                      <div className="flex justify-center gap-2">
                         {['A','B','C','D'].map(opt => (
                            <button 
                                key={opt}
                                onClick={() => setFormData({...formData, correctAnswer: opt})}
                                className={`w-10 h-10 rounded-lg font-bold border-2 transition-all ${
                                    formData.correctAnswer === opt 
                                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200 scale-110' 
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300'
                                }`}
                            >{opt}</button>
                         ))}
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-5">
                   <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-rose-600 flex items-center gap-2">
                          <AlertCircle size={14}/> Tại sao bạn chọn sai? (Tư duy sai)
                      </label>
                      <textarea 
                         rows={3}
                         className="w-full px-3 py-2.5 border border-rose-100 rounded-lg bg-rose-50/30 focus:bg-white focus:ring-2 focus:ring-rose-200 outline-none text-sm leading-relaxed"
                         placeholder="Phân tích lỗi sai của bản thân..."
                         value={formData.whyWrong}
                         onChange={e => setFormData({...formData, whyWrong: e.target.value})}
                      />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-emerald-600 flex items-center gap-2">
                          <Save size={14}/> Tại sao đáp án kia đúng? (Bài học)
                      </label>
                      <textarea 
                         rows={3}
                         className="w-full px-3 py-2.5 border border-emerald-100 rounded-lg bg-emerald-50/30 focus:bg-white focus:ring-2 focus:ring-emerald-200 outline-none text-sm leading-relaxed"
                         placeholder="Giải thích logic đúng hoặc kiến thức cần nhớ..."
                         value={formData.whyRight}
                         onChange={e => setFormData({...formData, whyRight: e.target.value})}
                      />
                   </div>
                </div>
             </div>

             {/* Modal Footer */}
             <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
                <button 
                    onClick={() => setShowModal(false)} 
                    disabled={isSaving}
                    className="px-5 py-2.5 text-slate-500 hover:bg-slate-200 rounded-xl font-medium transition-colors"
                >
                    Hủy
                </button>
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-indigo-600 shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                   {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} />} 
                   {isSaving ? 'Đang lưu...' : 'Lưu lại'}
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ErrorLog;