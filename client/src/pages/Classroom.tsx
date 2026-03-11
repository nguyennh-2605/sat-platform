import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  FileText, 
  Users, Plus, ChevronRight,
  X, LayoutDashboard,CheckCircle2,
  BarChart3,
  LayoutList,
  Copy
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import StudentAnalytics from '../components/StudentAnalytics';
import NotificationBell from '../components/NotificationBell';
import FullScreenPostCreator from '../components/CreateAssignmentSection';

const API_URL = import.meta.env.VITE_API_URL;

const Classroom = () => {
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

  if (!currentUser) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Đang tải thông tin...</div>;

  // --- RENDER GIAO DIỆN MỚI ---
  return (
    <div className="h-screen w-full bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden">
      <StudentAndTeacherDashBoard 
        classDetail={classDetail}
        onCreateAssignment={handleCreateAssignment}
        onAddStudent={handleAddStudent}
        currentUser={currentUser}
      />
    </div>
  );
};

// A. GIAO DIỆN GIÁO VIÊN (TEACHER MODE)
const StudentAndTeacherDashBoard = ({ 
  classDetail, onCreateAssignment, onAddStudent, currentUser
}: any) => {
  const { classId } = useParams();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  
  const [studentEmail, setStudentEmail] = useState("");
  const [activeTab, setActiveTab] = useState('STREAM'); // Mặc định là 'STREAM' (Bảng tin)

  const navigate = useNavigate();

  useEffect(() => {
    setActiveTab('STREAM');
    setShowCreateForm(false);
    setIsAddStudentModalOpen(false);
  }, [classId]);

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
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-gray-900/60 transition-opacity">
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
                {currentUser.role === 'TEACHER' && (
                  <TabButton id="SCORES" label="Score Report" icon={BarChart3} active={activeTab === 'SCORES'} />
                )}
              </div>

              {/* Right: Notification & Actions */}
              <div className="flex-1 flex items-center justify-end gap-2">
                <NotificationBell currentUserId={currentUser.id} />
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
                        {currentUser.role === 'TEACHER' && (
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all group" onClick={() => setShowCreateForm(true)}>
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                              <Plus size={20} />
                            </div>
                            <span className="text-sm font-medium text-slate-500 group-hover:text-slate-800">Thông báo nội dung nào đó cho lớp học của bạn...</span>
                          </div>
                        )}

                        {/* Danh sách bài tập */}
                        <div className="flex flex-col gap-4">
                          {classDetail.assignments?.length > 0 ? (
                            classDetail.assignments.map((assignment: any) => (
                              <div 
                                key={assignment.id} 
                                onClick={() => navigate(`/dashboard/class/${classId}/assignment/${assignment.id}`)} 
                                className="group bg-white p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md cursor-pointer flex items-center gap-4"
                              >
                                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                                  <FileText size={24} />
                                </div>  
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
                                <div className="text-gray-300 group-hover:text-indigo-500 px-2 transition-colors">
                                  <ChevronRight size={20} />
                                </div>
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
                {activeTab === 'SCORES' && currentUser.role === 'TEACHER' && (
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

export default Classroom;