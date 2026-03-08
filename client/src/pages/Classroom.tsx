import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  BookOpen, Upload, FileText, CheckCircle, 
  Users, Plus, Clock, ChevronRight, Paperclip,
  X, LayoutDashboard, ArrowLeft,CheckCircle2,
  BarChart3,
  LayoutList,
  Copy
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import StudentAnalytics from '../components/StudentAnalytics';
import NotificationBell from '../components/NotificationBell';
import FullScreenPostCreator from '../components/CreateAssignmentSection';

// Cấu hình URL Backend
const API_URL = import.meta.env.VITE_API_URL;

// --- COMPONENT NHỎ: BADGE TRẠNG THÁI ---
const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'SUBMITTED') return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold border border-green-200">Đã nộp</span>;
  if (status === 'LATE') return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold border border-yellow-200">Nộp muộn</span>;
  return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold border border-red-200">Chưa nộp</span>;
};

const Classroom = () => {
  // --- STATE & LOGIC CŨ GIỮ NGUYÊN ---
  const { classId } = useParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [classDetail, setClassDetail] = useState(null);

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

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchClassDetail =  useCallback(async () => {
    if (!classId) return;
    try {
      const res = await axios.get(`${API_URL}/api/classes/${classId}`, getAuthHeader());
      setClassDetail(res.data);
    } catch (error) {
      console.error("Lỗi tải chi tiết lớp:", error);
      toast.error("Không thể tải thông tin lớp học");
    } finally {
    }
  }, [classId]);

  useEffect(() => {
    fetchClassDetail();
  }, [classId]);

  const handleCreateAssignment = async (data: any) => {
    try {
      const payload = {
        classId: classId as string,
        title: data.title,
        content: data.content,
        type: data.type,
        deadline: data.deadline || null,
        driveFiles: data.driveFiles || [], 
        externalLinks: data.externalLinks || [] 
      };

      await axios.post(`${API_URL}/api/classes/posts`, payload, getAuthHeader());
      
      toast.success(data.type === 'assignment' ? "Đã giao bài tập!" : "Đã đăng thông báo!");
      fetchClassDetail();
    } catch (error) {
      toast.error("Lỗi khi đăng bài");
    }
  };

  const handleAddStudent = async (email: string) => {
    try {
      await axios.post(`${API_URL}/api/classes/${classId}/students`, { email }, getAuthHeader());
      toast.success("Thêm học sinh thành công!");
      fetchClassDetail();
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
      fetchClassDetail();
    } catch (error) {
      toast.error("Lỗi nộp bài!");
    }
  };

  if (!currentUser) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Đang tải thông tin...</div>;

  // --- RENDER GIAO DIỆN MỚI ---
  return (
    <div className="h-screen w-full bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden">
      {/* Logic Switching Views */}
      {currentUser.role === 'TEACHER' ? (
        <TeacherDashboard 
          classDetail={classDetail}
          onCreateAssignment={handleCreateAssignment}
          onAddStudent={handleAddStudent}
          teacherId={currentUser.id}
        />
      ) : (
        <StudentDashboard 
          classDetail={classDetail}
          currentUser={currentUser}
          onSubmit={handleSubmitAssignment}
        />
      )}
    </div>
  );
};

// A. GIAO DIỆN GIÁO VIÊN (TEACHER MODE)
const TeacherDashboard = ({ 
  classDetail, onCreateAssignment, onAddStudent, teacherId
}: any) => {
  const { classId } = useParams();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  
  const [studentEmail, setStudentEmail] = useState("");
  const [activeTab, setActiveTab] = useState('STREAM'); // Mặc định là 'STREAM' (Bảng tin)

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

  // --- UI COMPONENTS ---

  // 1. Tab Button Component (để code gọn hơn)
  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`relative py-4 px-6 text-sm font-bold flex items-center gap-2 transition-colors ${
        activeTab === id 
        ? 'text-indigo-700' 
        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon size={18} />
      {label}
      {/* Active Indicator (Gạch chân) */}
      {activeTab === id && (
        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-indigo-700 rounded-t-full" />
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#F8FAFC] relative">
      
      {/* --- MODAL THÊM HỌC SINH (Giữ nguyên logic cũ) --- */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
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

      {/* --- MAIN CONTENT --- */}
        {classDetail ? (
          <>
            <header className="flex-none h-16 bg-white border-b border-gray-300 px-4 md:px-8 flex items-center z-30 shadow-sm">
              {/* Left: Tên lớp (Ẩn trên mobile để ưu tiên Tabs) */}
              <div className="flex-1 hidden lg:flex items-center">
                <h1 className="text-sm font-bold text-slate-800 truncate max-w-[200px]">
                  {classDetail.name}
                </h1>
              </div>

              {/* Center: Tabs (Căn giữa tuyệt đối) */}
              <div className="flex items-center justify-center gap-1 md:gap-4 overflow-x-auto no-scrollbar">
                <TabButton id="STREAM" label="Bảng tin" icon={LayoutList} active={activeTab === 'STREAM'} />
                <TabButton id="MEMBERS" label="Thành viên" icon={Users} active={activeTab === 'MEMBERS'} />
                <TabButton id="SCORES" label="Score Report" icon={BarChart3} active={activeTab === 'SCORES'} />
              </div>

              {/* Right: Notification & Actions */}
              <div className="flex-1 flex items-center justify-end gap-2">
                <NotificationBell currentUserId={teacherId} />
              </div>
            </header>

            {/* 2. TAB CONTENT AREA */}
            <main className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50">
              <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in-up">

                {/* --- TAB 1: BẢNG TIN (STREAM) --- */}
                {activeTab === 'STREAM' && (
                  <div className="space-y-6 animate-fade-in-up">
                    
                    {/* Banner ảnh bìa (Full width trong container) */}
                    <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-700 p-8 rounded-2xl shadow-md text-white relative overflow-hidden min-h-[180px] flex flex-col justify-end">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
                      <div className="relative z-10">
                        <h2 className="text-4xl font-black mb-1">{classDetail.name}</h2>
                        <p className="text-indigo-100 font-medium opacity-90">Học kỳ Fall 2024 • SAT Master Course</p>
                      </div>
                    </div>

                    {/* Bố cục 2 cột: Trái (Mã lớp) - Phải (Nội dung) */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      
                      {/* CỘT TRÁI: THÔNG TIN NHANH (Mã lớp) */}
                      <div className="lg:col-span-1 space-y-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Mã lớp học</h3>
                          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-2xl font-black text-indigo-600 tracking-widest">
                              {classDetail.id?.substring(0, 6).toUpperCase() || "ABCXYZ"}
                            </span>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(classDetail.id || "");
                                toast.success("Đã sao chép mã lớp!");
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-md transition-all shadow-sm"
                              title="Sao chép mã"
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                            Gửi mã này cho học sinh để họ có thể tham gia vào lớp học ngay lập tức.
                          </p>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sắp tới</h3>
                          <p className="text-xs text-slate-500">Tuyệt vời! Không có bài tập nào sắp đến hạn.</p>
                        </div>
                      </div>

                      {/* CỘT PHẢI: FEED (Nội dung chính) */}
                      <div className="lg:col-span-3 space-y-6">
                        {/* Thanh tạo bài tập nhanh */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all group" onClick={() => setShowCreateForm(true)}>
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <Plus size={20} />
                          </div>
                          <span className="text-sm font-medium text-slate-500 group-hover:text-slate-800">Thông báo nội dung nào đó cho lớp học của bạn...</span>
                        </div>

                        {/* Danh sách bài tập */}
                        <div className="space-y-4">
                          {classDetail.assignments?.length > 0 ? (
                            classDetail.assignments.map((assignment: any) => (
                              <div key={assignment.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all p-1">
                                <AssignmentTracker 
                                  assignment={assignment} 
                                  classStudents={classDetail.students || []} 
                                />
                              </div>
                            ))
                          ) : (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <LayoutList size={32} className="text-slate-300" />
                              </div>
                              <p className="text-slate-500 font-medium">Chưa có bài đăng nào trong lớp học này.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- TAB 2: THÀNH VIÊN (MEMBERS) --- */}
                {activeTab === 'MEMBERS' && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                          <h3 className="text-lg font-bold text-indigo-900">Danh sách học sinh</h3>
                          <button onClick={() => setIsAddStudentModalOpen(true)} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-100 flex items-center gap-2">
                            <Plus size={16}/> Thêm học sinh
                          </button>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                              <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase">
                                  <tr>
                                      <th className="p-5 pl-8">Họ và tên</th>
                                      <th className="p-5">Email</th>
                                      <th className="p-5 text-right pr-8">Trạng thái</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                              {classDetail.students && classDetail.students.length > 0 ? (
                                  classDetail.students.map((st: any) => (
                                  <tr key={st.id} className="hover:bg-gray-50/80 transition">
                                      <td className="p-5 pl-8">
                                          <div className="flex items-center gap-3">
                                              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                                  {st.name ? st.name.charAt(0).toUpperCase() : 'S'}
                                              </div>
                                              <span className="font-semibold text-gray-700">{st.name || "Unknown"}</span>
                                          </div>
                                      </td>
                                      <td className="p-5 text-gray-600 text-sm">{st.email}</td>
                                      <td className="p-5 text-right pr-8">
                                          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Đã tham gia</span>
                                      </td>
                                  </tr>
                                  ))
                              ) : (
                                  <tr>
                                      <td colSpan={3} className="py-12 text-center text-gray-400 text-sm">Chưa có thành viên nào.</td>
                                  </tr>
                              )}
                              </tbody>
                          </table>
                      </div>
                  </div>
                )}

                {/* --- TAB 3: SCORE REPORT (NEW) --- */}
                {activeTab === 'SCORES' && (
                  <StudentAnalytics classId={classId || '1'}/>
                )}
              </div>
            </main>
            {/* Form Tạo (Nếu mở) */}
            {showCreateForm && (
              <FullScreenPostCreator 
                onClose={() => setShowCreateForm(false)}
                onSubmit={handleCreateAssignment}
              />
            )}
          </>
        ) : (
            // EMPTY STATE KHI CHƯA CHỌN LỚP
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 p-8 text-center min-h-[600px]">
                <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm relative">
                     <LayoutDashboard size={64} className="text-indigo-300"/>
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Chưa chọn lớp học</h2>
                <p className="text-gray-500 text-sm">Vui lòng chọn một lớp từ menu bên trái.</p>
            </div>
        )}
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
const StudentDashboard = ({ classDetail, currentUser, onSubmit }: any) => {
   
  // 1. Thêm State để quản lý việc đang xem bài nào
  const [viewingAssignment, setViewingAssignment] = useState<any>(null);

   return (
      <div className="max-w-4xl mx-auto">

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

export default Classroom;