import { useState, useEffect, useCallback, memo } from 'react';
import axios from 'axios';
import { 
  BookOpen, Upload, FileText, CheckCircle, 
  Users, Plus, Clock, ChevronRight, Paperclip,
  X, LayoutDashboard, ArrowLeft, Link, Calendar, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Cấu hình URL Backend
const API_URL = import.meta.env.VITE_API_URL;

// --- COMPONENT NHỎ: BADGE TRẠNG THÁI ---
const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'SUBMITTED') return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold border border-green-200">Đã nộp</span>;
  if (status === 'LATE') return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold border border-yellow-200">Nộp muộn</span>;
  return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold border border-red-200">Chưa nộp</span>;
};

// --- 1. MAIN MODULE ---

const HomeworkModule = () => {
  // --- STATE & LOGIC CŨ GIỮ NGUYÊN ---
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassDetail, setSelectedClassDetail] = useState<any>(null);

  // Auth & Init Logic
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const userId = localStorage.getItem('userId');
    const userName = localStorage.getItem('userName');
    const userRole = localStorage.getItem('userRole'); // Lấy role từ login

    if (userId) {
      setCurrentUser({
        id: userId,
        name: userName || 'Người dùng',
        role: userRole || 'STUDENT'
      });
    }
  }, []);

  useEffect(() => {
    if (currentUser) fetchClasses();
  }, [currentUser]);

  useEffect(() => {
    if (selectedClassId) fetchClassDetail(selectedClassId);
  }, [selectedClassId]);

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchClasses = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/classes`, getAuthHeader());
      setClasses(res.data);
      if (res.data.length > 0 && !selectedClassId) {
        setSelectedClassId(res.data[0].id);
      }
    } catch (error) {
      console.error("Lỗi tải lớp:", error);
    }
  };

  const fetchClassDetail = async (classId: string) => {
    try {
      const res = await axios.get(`${API_URL}/api/classes/${classId}`, getAuthHeader());
      setSelectedClassDetail(res.data);
    } catch (error) {
      console.error("Lỗi tải chi tiết lớp:", error);
    } finally {
    }
  };

  // Actions
  const handleAddClass = async (newClassName: string) => {
    try {
      const res = await axios.post(`${API_URL}/api/classes`, { name: newClassName }, getAuthHeader());
      setClasses([res.data, ...classes]);
      setSelectedClassId(res.data.id);
    } catch (error) {
      toast.error("Lỗi tạo lớp học!");
    }
  };

  const handleCreateAssignment = async (assignmentData: any) => {
    if (!selectedClassId) return;
    try {
      await axios.post(`${API_URL}/api/classes/assignments`, {
        ...assignmentData,
        classId: selectedClassId
      }, getAuthHeader());
      
      toast.success("Đã giao bài tập thành công!");
      fetchClassDetail(selectedClassId);
    } catch (error) {
      toast.error("Lỗi khi tạo bài tập");
    }
  };

  const handleAddStudent = async (email: string) => {
    if (!selectedClassId) return;
    try {
      await axios.post(`${API_URL}/api/classes/${selectedClassId}/students`, { email }, getAuthHeader());
      toast.success("Thêm học sinh thành công!");
      fetchClassDetail(selectedClassId);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Không tìm thấy email này!");
    }
  };

  const handleSubmitAssignment = async (assignmentId: string, content: string, type: 'FILE' | 'TEXT') => {
    try {
      await axios.post(`${API_URL}/api/classes/submissions`, {
        assignmentId,
        textResponse: type === 'TEXT' ? content : undefined,
        fileUrl: type === 'FILE' ? content : undefined,
      }, getAuthHeader());
      
      toast.success("Nộp bài thành công!");
      if (selectedClassId) fetchClassDetail(selectedClassId);
    } catch (error) {
      toast.error("Lỗi nộp bài!");
    }
  };

  if (!currentUser) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Đang tải thông tin...</div>;

  // --- RENDER GIAO DIỆN MỚI ---
  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-slate-800">
      {/* Logic Switching Views */}
      {currentUser.role === 'TEACHER' ? (
        <TeacherDashboard 
          classes={classes}
          selectedClassId={selectedClassId} 
          setSelectedClassId={setSelectedClassId} 
          onAddClass={handleAddClass}
          classDetail={selectedClassDetail}
          onCreateAssignment={handleCreateAssignment}
          onAddStudent={handleAddStudent}
        />
      ) : (
        <StudentDashboard 
          classes={classes}
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          classDetail={selectedClassDetail}
          currentUser={currentUser}
          onSubmit={handleSubmitAssignment}
        />
      )}
    </div>
  );
};

const ClassSidebarItem = memo(({ cls, isSelected, onClick }: any) => {
  return (
    <button
      onClick={() => onClick(cls.id)}
      className={`w-full text-left px-4 py-4 rounded-2xl group border transition-all duration-200 flex items-center justify-between ${
        isSelected 
          ? 'bg-white border-indigo-600 ring-1 ring-indigo-600 shadow-md z-10' 
          : 'bg-white border-transparent hover:border-gray-200 hover:bg-gray-50 text-gray-600'
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className={`w-2 h-10 rounded-full flex-shrink-0 transition-colors ${isSelected ? 'bg-indigo-600' : 'bg-gray-200 group-hover:bg-gray-300'}`}></div>
        <span className={`font-semibold text-sm truncate ${isSelected ? 'text-indigo-900' : ''}`}>{cls.name}</span>
      </div>
      {isSelected && <ChevronRight size={18} className="text-indigo-600" />}
    </button>
  );
});

const CreateAssignmentSection = memo(({ onClose, onSubmit }: any) => {
  const [form, setForm] = useState({ title: '', content: '', deadline: '', fileUrl: '' });

  const handleSubmit = () => {
    if (!form.title || !form.deadline) return toast.error("Thiếu thông tin!");
    onSubmit({
      ...form,
      deadline: new Date(form.deadline).toISOString()
    });
    // Reset form local
    setForm({ title: '', content: '', deadline: '', fileUrl: '' });
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-100/50 mb-6 animate-fade-in-down">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><FileText size={20}/></div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-800">Soạn bài tập mới</h3>
          <p className="text-xs text-gray-500">Điền thông tin chi tiết bên dưới</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={18} className="text-gray-400"/></button>
      </div>
      
      <div className="space-y-5">
        <div className="space-y-4">
          <input 
            type="text" placeholder="Tiêu đề bài tập (VD: Homework #4)" 
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-medium text-gray-800 placeholder-gray-400" 
            value={form.title}
            onChange={e => setForm({...form, title: e.target.value})}
          />
          <textarea 
            rows={4} placeholder="Nội dung, yêu cầu chi tiết..." 
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm text-gray-700"
            value={form.content}
            onChange={e => setForm({...form, content: e.target.value})}
          ></textarea>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
              <Calendar size={14}/> Hạn nộp
            </label>
            <input 
              type="datetime-local" className="w-full p-3 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              value={form.deadline}
              onChange={e => setForm({...form, deadline: e.target.value})}
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
              <Link size={14}/> Link File đề
            </label>
            <input 
              type="text" className="w-full p-3 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="https://..."
              value={form.fileUrl}
              onChange={e => setForm({...form, fileUrl: e.target.value})}
            />
          </div>
        </div>
        <div className="flex justify-end pt-2 gap-2">
            <button onClick={onClose} className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium transition">Hủy bỏ</button>
            <button onClick={handleSubmit} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition text-sm flex items-center gap-2">
                <Plus size={18}/> Đăng bài tập
            </button>
        </div>
      </div>
    </div>
  );
});

// ==========================================
// A. GIAO DIỆN GIÁO VIÊN (TEACHER MODE)
// ==========================================
const TeacherDashboard = ({ 
    classes, selectedClassId, setSelectedClassId, onAddClass, classDetail, onCreateAssignment, onAddStudent 
}: any) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  
  const [newClassName, setNewClassName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [activeTab, setActiveTab] = useState('ASSIGNMENTS');

  // UseCallback để function không bị tạo lại mỗi lần render -> Giúp ClassSidebarItem không bị re-render
  const handleClassSelect = useCallback((id: string) => {
    setSelectedClassId(id);
  }, [setSelectedClassId]);

  const submitNewClass = () => {
    if (!newClassName.trim()) return toast("Vui lòng nhập tên lớp!");
    onAddClass(newClassName);
    setNewClassName("");
    setIsAddClassModalOpen(false);
  };

  const submitAddStudent = () => {
      if(!studentEmail.trim()) return;
      onAddStudent(studentEmail);
      setStudentEmail("");
      setIsAddStudentModalOpen(false);
  }

  const handleCreateAssignment = useCallback((data: any) => {
    onCreateAssignment(data);
    setShowCreateForm(false);
  }, [onCreateAssignment]);

  return (
    <div className="flex flex-col lg:flex-row gap-8 relative min-h-[600px] bg-gray-50/50 p-2 lg:p-0">
      {isAddClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 border border-gray-100">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-gray-800">Tạo lớp mới</h3>
               <button onClick={() => setIsAddClassModalOpen(false)} className='p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition'><X/></button>
             </div>
             <input autoFocus value={newClassName} onChange={(e) => setNewClassName(e.target.value)} className="w-full p-3 border rounded-xl mb-4" placeholder="VD: SAT Reading K15..."  />
             <button onClick={submitNewClass} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex justify-center items-center gap-2">Tạo lớp</button>
          </div>
        </div>
      )}

      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">Thêm học sinh</h3>
              <button onClick={() => setIsAddStudentModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition"><X size={18}/></button>
            </div>
            <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                    <div className="bg-blue-100 p-1 rounded-full"><Users size={16} className="text-blue-600"/></div>
                    <p className="text-sm text-blue-800 leading-tight pt-0.5">Học sinh sẽ được thêm ngay lập tức vào danh sách lớp.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email học sinh</label>
                    <input 
                      autoFocus type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="student@example.com" 
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    />
                </div>
                <button onClick={submitAddStudent} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 flex justify-center items-center gap-2">
                    <CheckCircle2 size={20}/> Xác nhận thêm
                </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 1. SIDEBAR (Đã tối ưu scroll với content-visibility) */}
      <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><LayoutDashboard size={20} className="text-indigo-600"/> Lớp học</h3>
          <button onClick={() => setIsAddClassModalOpen(true)} className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100 transition flex items-center gap-1"><Plus size={16} /> Mới</button>
        </div>

        {/* contentVisibility: 'auto' giúp trình duyệt chỉ render những item đang nhìn thấy */}
        <div 
          className="space-y-2 overflow-y-auto max-h-[calc(100vh-150px)] pr-2 custom-scrollbar" 
          style={{ contentVisibility: 'auto', containIntrinsicSize: '60px' }}
        >
            {classes.map((cls: any) => (
                <ClassSidebarItem 
                    key={cls.id} 
                    cls={cls} 
                    isSelected={selectedClassId === cls.id} 
                    onClick={handleClassSelect} 
                />
            ))}
            {classes.length === 0 && <div className="text-center p-8 border-2 border-dashed rounded-xl text-gray-400">Chưa có lớp nào</div>}
        </div>
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="flex-1 min-w-0">
        {classDetail ? (
            <div className="flex flex-col h-full space-y-6 animate-fade-in-up">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 p-8 rounded-3xl shadow-lg text-white relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-indigo-200 mb-2 text-sm uppercase tracking-wider"><BookOpen size={16}/> Lớp học đang chọn</div>
                              <h2 className="text-3xl font-bold">{classDetail.name}</h2>
                                                      <div className="flex gap-4 mt-4">
                              <div className="flex items-center gap-2 bg-indigo-800/50 px-3 py-1.5 rounded-lg border border-indigo-500/30">
                                  <Users size={16} className="text-indigo-300"/> 
                                  <span className="font-semibold">{classDetail.students?.length || 0}</span> <span className="text-indigo-300 text-sm">học sinh</span>
                              </div>
                              <div className="flex items-center gap-2 bg-indigo-800/50 px-3 py-1.5 rounded-lg border border-indigo-500/30">
                                  <FileText size={16} className="text-indigo-300"/> 
                                  <span className="font-semibold">{classDetail.assignments?.length || 0}</span> <span className="text-indigo-300 text-sm">bài tập</span>
                              </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setIsAddStudentModalOpen(true)} className="px-4 py-2 bg-indigo-600/50 rounded-xl border border-indigo-400 text-sm font-bold hover:bg-indigo-600">Thêm HS</button>
                             <button onClick={() => setShowCreateForm(!showCreateForm)} className="px-4 py-2 bg-white text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-50">
                                 {showCreateForm ? 'Đóng' : 'Tạo bài tập'}
                             </button>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-gray-100/80 p-1.5 rounded-xl inline-flex gap-1 self-start">
                  <button 
                    onClick={() => setActiveTab('ASSIGNMENTS')}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'ASSIGNMENTS' 
                        ? 'bg-white text-indigo-700 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                    }`}
                  >
                    <BookOpen size={16}/> Bài tập
                  </button>
                  <button 
                    onClick={() => setActiveTab('MEMBERS')}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'MEMBERS' 
                        ? 'bg-white text-indigo-700 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                    }`}
                  >
                    <Users size={16}/> Thành viên
                  </button>
                </div>

                {/* Form Tạo (Đã tách ra Component riêng để tránh lag) */}
                {showCreateForm && (
                    <CreateAssignmentSection 
                        onClose={() => setShowCreateForm(false)}
                        onSubmit={handleCreateAssignment}
                    />
                )}

                {/* Content Area */}
                <div className="flex-1">
                {activeTab === 'ASSIGNMENTS' && (
                <div className="space-y-6">
                    {classDetail.assignments && classDetail.assignments.length > 0 ? (
                      <div className="grid gap-4">
                        {classDetail.assignments.map((assignment: any) => (
                          <div key={assignment.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                            <AssignmentTracker 
                              assignment={assignment} 
                              classStudents={classDetail.students || []} 
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                        !showCreateForm && (
                          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-300 text-gray-400">
                            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                                <FileText size={40} className="text-indigo-300 opacity-80" />
                            </div>
                            <h4 className="text-lg font-bold text-gray-700 mb-1">Chưa có bài tập nào</h4>
                            <p className="text-sm text-gray-500 mb-6">Hãy bắt đầu tạo bài tập đầu tiên cho lớp học này.</p>
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-md"
                            >
                                Tạo bài tập mới
                            </button>
                          </div>
                        )
                    )}
                </div>
                )}
                {activeTab === 'MEMBERS' && (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="p-5">Học sinh</th>
                                    <th className="p-5">Thông tin liên hệ</th>
                                    <th className="p-5 text-right">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                            {classDetail.students && classDetail.students.length > 0 ? (
                                classDetail.students.map((st: any) => (
                                <tr key={st.id} className="hover:bg-indigo-50/30 transition group">
                                    <td className="p-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 flex items-center justify-center font-bold text-sm shadow-sm border border-white">
                                                {st.name ? st.name.charAt(0).toUpperCase() : 'S'}
                                            </div>
                                            <span className="font-semibold text-gray-800 group-hover:text-indigo-700 transition">
                                                {st.name || "Chưa cập nhật tên"}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-5 text-gray-600 text-sm">{st.email}</td>
                                    <td className="p-5 text-right">
                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Active</span>
                                    </td>
                                </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="py-16 text-center">
                                        <div className="inline-block p-4 rounded-full bg-gray-50 mb-3"><Users size={32} className="text-gray-300"/></div>
                                        <p className="text-gray-500 font-medium">Lớp chưa có thành viên nào.</p>
                                        <button onClick={() => setIsAddStudentModalOpen(true)} className="text-indigo-600 font-bold text-sm hover:underline mt-2">Thêm học sinh ngay</button>
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
                    
                </div>
            </div>
        ) : (
            // EMPTY STATE KHI CHƯA CHỌN LỚP
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
                <div className="w-64 h-64 bg-indigo-50 rounded-full flex items-center justify-center mb-6 relative">
                     <div className="absolute inset-0 border-4 border-indigo-100 rounded-full animate-pulse"></div>
                     <LayoutDashboard size={80} className="text-indigo-400"/>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Chào mừng trở lại!</h2>
                <p className="text-gray-500 max-w-md mb-8">
                    Chọn một lớp học từ danh sách bên trái để xem chi tiết, quản lý học sinh và giao bài tập.
                </p>
                <button onClick={() => setIsAddClassModalOpen(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2">
                    <Plus size={20}/> Tạo lớp học đầu tiên
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

// Component con: Theo dõi nộp bài
const AssignmentTracker = ({ assignment, classStudents }: any) => {
   const submissions = assignment.submissions || [];
   const submittedCount = submissions.length;
   const [previewText, setPreviewText] = useState<any> (null)
   
   return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition hover:shadow-md">
         <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
            <div>
               <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><FileText size={16} /></span> 
                  {assignment.title}
               </h3>
               <p className="text-sm text-gray-500 mt-2 pl-9 line-clamp-1">{assignment.content || "Không có mô tả"}</p>
            </div>
            <div className="text-right">
               <div className="text-xs font-bold text-gray-400 uppercase mb-1">Deadline</div>
               <div className="text-sm font-bold text-red-500 flex items-center justify-end gap-1 bg-red-50 px-2 py-1 rounded border border-red-100">
                  <Clock size={14} /> {assignment.deadline ? format(new Date(assignment.deadline), 'dd/MM HH:mm') : 'None'}
               </div>
            </div>
         </div>

         {/* Thống kê nhanh */}
         <div className="bg-indigo-50/30 px-6 py-3 flex justify-between items-center text-xs font-medium text-gray-600 border-b border-gray-100">
            <span className="font-bold text-indigo-900">Tiến độ nộp bài: <span className="text-indigo-600">{submittedCount}/{classStudents.length}</span></span>
            <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
               <div className="h-full bg-indigo-500 transition-all duration-500 ease-out" style={{ width: `${classStudents.length > 0 ? (submittedCount/classStudents.length)*100 : 0}%` }}></div>
            </div>
         </div>

         {/* Bảng chi tiết học sinh */}
         <div className="overflow-x-auto max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
            <table className="w-full text-sm text-left">
               <thead className="text-xs text-gray-400 uppercase bg-gray-50 sticky top-0 z-10">
                  <tr>
                     <th className="px-6 py-3 font-semibold">Học sinh</th>
                     <th className="px-6 py-3 font-semibold">Trạng thái</th>
                     <th className="px-6 py-3 font-semibold">Bài nộp</th>
                     <th className="px-6 py-3 font-semibold">Thời gian</th>
                  </tr>
               </thead>
               <tbody>
                  {classStudents.map((student: any) => {
                     const sub = submissions.find((s: any) => s.studentId === student.id);
                     const status = sub ? sub.status : 'MISSING';

                     return (
                        <tr key={student.id} className="border-b border-gray-50 last:border-0 hover:bg-indigo-50/30 transition">
                           <td className="px-6 py-3 font-medium flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                                  {student.name ? student.name.charAt(0) : 'U'}
                              </div>
                              <div>
                                  <div className="font-bold text-gray-700">{student.name || "Unknown"}</div>
                                  <div className="text-xs text-gray-400">{student.email}</div>
                              </div>
                           </td>
                           <td className="px-6 py-3">
                              <StatusBadge status={status} />
                           </td>
                           <td className="px-6 py-3 text-gray-500">
                              {sub ? (
                                sub.fileUrl ? (
                                  <a 
                                    href={sub.fileUrl} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="flex items-center gap-1 text-indigo-600 hover:underline font-medium"
                                  >
                                    <Paperclip size={14} /> 
                                    Xem File
                                  </a>
                                ) : (
                                  <button 
                                    onClick={() => setPreviewText({
                                        name: student.name,
                                        content: sub.textResponse
                                    })}
                                    className="flex items-center gap-1 text-purple-600 hover:underline font-medium hover:bg-purple-50 px-2 py-1 rounded transition"
                                  >
                                    <FileText size={14} /> 
                                    Xem Bài Làm
                                  </button>
                                )
                              ) : '-'}
                           </td>
                           <td className="px-6 py-3 text-gray-400 text-xs font-mono">
                              {sub ? format(new Date(sub.submittedAt), 'dd/MM HH:mm') : '-'}
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
         {previewText && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
              
              {/* Header Modal */}
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-800">Bài làm của {previewText.name}</h3>
                <button 
                  onClick={() => setPreviewText(null)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-full transition"
                >
                  ✕
                </button>
              </div>

              {/* Nội dung bài làm */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-700 whitespace-pre-wrap font-sans text-sm">
                  {previewText.content || "Học sinh không nhập nội dung text."}
                </div>
              </div>

              {/* Footer Modal */}
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => setPreviewText(null)}
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition font-medium text-sm"
                >
                  Đóng
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
   );
};

// ==========================================
// B. GIAO DIỆN HỌC SINH (STUDENT MODE)
// ==========================================
const StudentDashboard = ({ classes, selectedClassId, setSelectedClassId, classDetail, currentUser, onSubmit }: any) => {
   
  // 1. Thêm State để quản lý việc đang xem bài nào
  const [viewingAssignment, setViewingAssignment] = useState<any>(null);

  // Khi người dùng chuyển sang lớp khác -> Reset về xem danh sách
  useEffect(() => {
    setViewingAssignment(null);
  }, [selectedClassId]);

  if (!classes || classes.length === 0) return <div className="text-center p-10 text-gray-500">Bạn chưa được thêm vào lớp học nào.</div>;

   return (
      <div className="max-w-4xl mx-auto">
         {/* --- 1. PHẦN CHỌN LỚP (GIỮ NGUYÊN) --- */}
         <div className="flex overflow-x-auto gap-3 mb-8 pb-2 scrollbar-hide">
            {classes.map((c: any) => (
               <button 
                  key={c.id} 
                  onClick={() => setSelectedClassId(c.id)}
                  className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold transition shadow-sm border text-sm ${
                     selectedClassId === c.id 
                     ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200' 
                     : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
               >
                  {c.name}
               </button>
            ))}
         </div>

         {classDetail ? (
             <>
                {/* --- 2. BANNER LỚP HỌC (GIỮ NGUYÊN) --- */}
                {/* Chỉ hiện Banner khi đang ở màn hình danh sách để đỡ rối mắt khi vào chi tiết (hoặc giữ lại tùy bạn) */}
                {!viewingAssignment && (
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-xl shadow-indigo-200 mb-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-10 transform translate-x-10 -translate-y-10">
                            <BookOpen size={150} color="white" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2 relative z-10">Thông tin lớp học</h2>
                        <p className="opacity-90 relative z-10">Lớp đang chọn: <span className="font-bold bg-white/20 px-2 py-0.5 rounded">{classDetail.name}</span></p>
                        <div className="mt-6 flex gap-4 relative z-10">
                            <div className="bg-white/20 px-5 py-3 rounded-xl border border-white/10">
                               <span className="block text-3xl font-bold">{classDetail.assignments?.length || 0}</span>
                               <span className="text-xs opacity-80 uppercase tracking-wider">Bài tập</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- 3. LOGIC HIỂN THỊ CHÍNH --- */}
                
                {viewingAssignment ? (
                    // === TRƯỜNG HỢP A: ĐANG XEM CHI TIẾT BÀI TẬP (FORM NỘP) ===
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <button 
                            onClick={() => setViewingAssignment(null)}
                            className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 font-bold mb-6 transition group"
                        >
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-indigo-100 transition">
                                <ArrowLeft size={18} />
                            </div>
                            Quay lại danh sách
                        </button>

                        {/* Gọi component hiển thị chi tiết bài tập ở đây */}
                        {/* Lưu ý: Đây là nơi bạn đặt cái component StudentAssignmentCard cũ (hoặc code nộp bài) */}
                        <StudentAssignmentCard 
                             assignment={viewingAssignment} 
                             studentId={currentUser.id} 
                             onSubmit={onSubmit}
                             isDetailView={true} // Báo cho component con biết là đang hiển thị chế độ full
                        />
                    </div>

                ) : (
                    // === TRƯỜNG HỢP B: DANH SÁCH BÀI TẬP (STYLE GOOGLE CLASSROOM) ===
                    <div className="space-y-4">
                        {/* Tiêu đề list */}
                        <h3 className="font-bold text-gray-700 mb-4 text-lg flex items-center gap-2">
                             <LayoutDashboard size={18}/> Bảng tin lớp học
                        </h3>

                        {classDetail.assignments && classDetail.assignments.length > 0 ? (
                           classDetail.assignments.map((assignment: any) => (
                              <div 
                                 key={assignment.id} 
                                 onClick={() => setViewingAssignment(assignment)}
                                 className="group bg-white p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all flex items-center gap-4"
                              >
                                 {/* Icon tròn xanh đặc trưng */}
                                 <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                     <FileText size={24} />
                                 </div>

                                 {/* Thông tin bài tập */}
                                 <div className="flex-1">
                                     <h4 className="font-medium text-gray-800 text-base mb-1 group-hover:text-indigo-700 transition">
                                         Giáo viên đã đăng một bài tập mới: <span className="font-bold">{assignment.title}</span>
                                     </h4>
                                     <div className="text-xs text-gray-400 font-medium">
                                         {assignment.createdAt 
                                            ? format(new Date(assignment.createdAt), 'dd/MM/yyyy') 
                                            : format(new Date(), 'dd/MM/yyyy')}
                                     </div>
                                 </div>

                                 {/* Nút 3 chấm hoặc mũi tên (để trang trí) */}
                                 <div className="text-gray-300 group-hover:text-indigo-500 px-2">
                                     <ChevronRight size={20} />
                                 </div>
                              </div>
                           ))
                        ) : (
                           <div className="text-center py-16 bg-white rounded-xl border border-dashed text-gray-400 italic">
                               <BookOpen size={40} className="mx-auto mb-2 opacity-20"/>
                               Lớp này hiện chưa có bài tập nào.
                           </div>
                        )}
                    </div>
                )}
             </>
         ) : (
             <div className="text-center py-20 bg-white rounded-2xl border border-dashed flex flex-col items-center gap-2">
                 <Clock className="animate-spin text-indigo-500" />
                 <span className="text-gray-400">Đang tải dữ liệu lớp...</span>
             </div>
         )}
      </div>
   );
};

// Card bài tập cho học sinh
const StudentAssignmentCard = ({ assignment, studentId, onSubmit }: any) => {
   const mySubmission = assignment.submissions?.find((s: any) => s.studentId === studentId);
   const isSubmitted = !!mySubmission;
   const [activeTab, setActiveTab] = useState<'TEXT' | 'FILE'>('FILE');
   const [content, setContent] = useState("");

   const handleSubmit = () => {
       if(!content.trim()) return toast("Vui lòng nhập nội dung!");
       onSubmit(assignment.id, content, activeTab);
   };

   return (
      <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${isSubmitted ? 'border-green-200' : 'border-gray-200 hover:shadow-md'}`}>
         {/* Header */}
         <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-3">
               <h4 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                   {assignment.title}
               </h4>
               {isSubmitted ? (
                  <span className="flex items-center gap-1 text-green-700 bg-green-50 px-3 py-1 rounded-full text-xs font-bold border border-green-200 shadow-sm self-start">
                     <CheckCircle size={14} /> Đã nộp
                  </span>
               ) : (
                  <span className="flex items-center gap-1 text-red-600 bg-red-50 px-3 py-1 rounded-full text-xs font-bold border border-red-100 shadow-sm self-start">
                     <Clock size={14} /> Deadline: {assignment.deadline ? format(new Date(assignment.deadline), 'HH:mm - dd/MM') : 'None'}
                  </span>
               )}
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-700 text-sm leading-relaxed whitespace-pre-line">
               {assignment.content}
            </div>
            {assignment.fileUrl && (
                <div className="mt-3">
                    <a href={assignment.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition">
                        <Paperclip size={14}/> Tải xuống đề bài
                    </a>
                </div>
            )}
         </div>

         {/* Submission Area */}
         {!isSubmitted ? (
            <div className="p-6 bg-gray-50/50">
               <h5 className="font-bold text-gray-700 text-sm mb-3 uppercase tracking-wide">Nộp bài của bạn</h5>
               
               {/* Tabs */}
               <div className="flex gap-2 mb-4 bg-gray-200 p-1 rounded-lg w-fit">
                  <button 
                     onClick={() => setActiveTab('FILE')}
                     className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'FILE' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                     <Upload size={14} /> Link File/Ảnh
                  </button>
                  <button 
                     onClick={() => setActiveTab('TEXT')}
                     className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'TEXT' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                     <FileText size={14} /> Nhập văn bản
                  </button>
               </div>

               {/* Input Area */}
               <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  {activeTab === 'FILE' ? (
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase">Dán link bài làm (Google Drive / Docs...)</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                className="flex-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-gray-50 focus:bg-white transition"
                                placeholder="https://drive.google.com/..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                            />
                        </div>
                     </div>
                  ) : (
                     <textarea 
                        className="w-full h-32 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-gray-50 focus:bg-white transition"
                        placeholder="Nhập nội dung bài làm hoặc câu trả lời trực tiếp tại đây..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                     ></textarea>
                  )}
                  
                  <button onClick={handleSubmit} className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition transform active:scale-95">
                     Gửi bài ngay
                  </button>
               </div>
            </div>
         ) : (
            <div className="p-4 bg-green-50 text-center text-sm text-green-800 border-t border-green-100 flex flex-col items-center justify-center gap-1">
               <div className="flex items-center gap-1 font-bold">
                   <CheckCircle size={16}/> Bạn đã nộp bài thành công!
               </div>
               <span className="text-xs opacity-70">Thời gian nộp: {format(new Date(mySubmission.submittedAt), 'HH:mm dd/MM/yyyy')}</span>
               {mySubmission.fileUrl && <a href={mySubmission.fileUrl} target="_blank" rel="noreferrer" className="text-xs underline text-green-700 mt-1 hover:text-green-900">Xem bài đã nộp</a>}
            </div>
         )}
      </div>
   );
}

export default HomeworkModule;