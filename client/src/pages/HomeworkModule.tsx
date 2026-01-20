import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BookOpen, Upload, FileText, CheckCircle, 
  Users, Plus, Clock, ChevronRight, Paperclip,
  X, LayoutDashboard, ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';

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
      alert("Lỗi tạo lớp học!");
    }
  };

  const handleCreateAssignment = async (assignmentData: any) => {
    if (!selectedClassId) return;
    try {
      await axios.post(`${API_URL}/api/classes/assignments`, {
        ...assignmentData,
        classId: selectedClassId
      }, getAuthHeader());
      
      alert("Đã giao bài tập thành công!");
      fetchClassDetail(selectedClassId);
    } catch (error) {
      alert("Lỗi khi tạo bài tập");
    }
  };

  const handleAddStudent = async (email: string) => {
    if (!selectedClassId) return;
    try {
      await axios.post(`${API_URL}/api/classes/${selectedClassId}/students`, { email }, getAuthHeader());
      alert("Thêm học sinh thành công!");
      fetchClassDetail(selectedClassId);
    } catch (error: any) {
      alert(error.response?.data?.error || "Không tìm thấy email này!");
    }
  };

  const handleSubmitAssignment = async (assignmentId: string, content: string, type: 'FILE' | 'TEXT') => {
    try {
      await axios.post(`${API_URL}/api/classes/submissions`, {
        assignmentId,
        textResponse: type === 'TEXT' ? content : undefined,
        fileUrl: type === 'FILE' ? content : undefined,
      }, getAuthHeader());
      
      alert("Nộp bài thành công!");
      if (selectedClassId) fetchClassDetail(selectedClassId);
    } catch (error) {
      alert("Lỗi nộp bài!");
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

// ==========================================
// A. GIAO DIỆN GIÁO VIÊN (TEACHER MODE)
// ==========================================
const TeacherDashboard = ({ 
    classes, selectedClassId, setSelectedClassId, onAddClass, classDetail, onCreateAssignment, onAddStudent 
}: any) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  
  // Form State
  const [newClassName, setNewClassName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [newAssignment, setNewAssignment] = useState({ title: '', content: '', deadline: '', fileUrl: '' });
  const [activeTab, setActiveTab] = useState('ASSIGNMENTS');

  const submitNewClass = () => {
    if (!newClassName.trim()) return alert("Vui lòng nhập tên lớp!");
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

  const submitAssignment = () => {
      if(!newAssignment.title || !newAssignment.deadline) return alert("Thiếu thông tin!");
      onCreateAssignment({
          ...newAssignment,
          deadline: new Date(newAssignment.deadline).toISOString()
      });
      setShowCreateForm(false);
      setNewAssignment({ title: '', content: '', deadline: '', fileUrl: '' });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 relative">
      {/* --- MODAL ADD CLASS --- */}
      {isAddClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Thêm lớp học mới</h3>
              <button onClick={() => setIsAddClassModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <input 
              autoFocus type="text" value={newClassName} onChange={(e) => setNewClassName(e.target.value)}
              placeholder="VD: SAT Reading K15..." 
              className="w-full p-3 border border-gray-200 rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50"
            />
            <button onClick={submitNewClass} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">Tạo lớp ngay</button>
          </div>
        </div>
      )}

      {/* --- MODAL ADD STUDENT --- */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Thêm học sinh</h3>
              <button onClick={() => setIsAddStudentModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <p className="text-sm text-gray-500 mb-2">Nhập email học sinh:</p>
            <input 
              autoFocus type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="student@example.com" 
              className="w-full p-3 border border-gray-200 rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50"
            />
            <button onClick={submitAddStudent} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition shadow-lg shadow-green-200">Thêm vào lớp</button>
          </div>
        </div>
      )}
      
      {/* 1. SIDEBAR */}
      <div className="w-full lg:w-64 flex-shrink-0 space-y-2">
        <div className="flex justify-between items-center mb-2 px-1">
          <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider">Lớp học của bạn</h3>
          <button onClick={() => setIsAddClassModalOpen(true)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded transition"><Plus size={16} /></button>
        </div>
        {classes.map((cls: any) => (
          <button
            key={cls.id}
            onClick={() => setSelectedClassId(cls.id)}
            className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all duration-200 ${
              selectedClassId === cls.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 translate-x-1' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100 hover:border-indigo-100'
            }`}
          >
            <span className="font-medium text-sm truncate">{cls.name}</span>
            {selectedClassId === cls.id && <ChevronRight size={16} />}
          </button>
        ))}
        {classes.length === 0 && <div className="text-xs text-center text-gray-400 py-4 italic border border-dashed rounded-lg">Chưa có lớp nào</div>}
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="flex-1 space-y-6">
        {classDetail ? (
           <>
            {/* Header Lớp */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{classDetail.name}</h2>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                    <Users size={14} className="text-gray-400"/> {classDetail.students?.length || 0} học sinh 
                    <span className="text-gray-300">|</span>
                    <BookOpen size={14} className="text-gray-400"/> {classDetail.assignments?.length || 0} bài tập
                  </p>
                </div>
                <div className="flex gap-3">
                   <button 
                      onClick={() => setIsAddStudentModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition"
                   >
                      <Users size={16} /> Thêm HS
                   </button>
                   <button 
                      onClick={() => setShowCreateForm(!showCreateForm)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-100 font-medium text-sm transition"
                   >
                      <Plus size={16} /> Tạo bài tập
                   </button>
                </div>
            </div>

            {/* 👉 THÊM ĐOẠN CODE NÀY ĐỂ HIỂN THỊ TAB: */}
            <div className="flex gap-6 border-b border-gray-200 mb-6">
              <button 
                onClick={() => setActiveTab('ASSIGNMENTS')}
                className={`pb-2 border-b-2 font-bold transition ${activeTab === 'ASSIGNMENTS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'}`}
              >
                📚 Bài tập
              </button>
              <button 
                onClick={() => setActiveTab('MEMBERS')}
                className={`pb-2 border-b-2 font-bold transition ${activeTab === 'MEMBERS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'}`}
              >
                👥 Thành viên ({classDetail.students?.length || 0})
              </button>
            </div>

            {/* Form Tạo Bài tập */}
            {showCreateForm && (
              <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-4 duration-300">
                  <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2"><FileText size={18}/> Soạn bài tập mới</h3>
                  <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm">
                    <input 
                        type="text" placeholder="Tiêu đề bài tập (VD: Homework #4)" 
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                        value={newAssignment.title}
                        onChange={e => setNewAssignment({...newAssignment, title: e.target.value})}
                    />
                    <textarea 
                        rows={3} placeholder="Nội dung, yêu cầu chi tiết..." 
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={newAssignment.content}
                        onChange={e => setNewAssignment({...newAssignment, content: e.target.value})}
                    ></textarea>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-gray-500 block mb-1 uppercase">Hạn nộp (Deadline)</label>
                          <input 
                              type="datetime-local" className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 text-sm" 
                              value={newAssignment.deadline}
                              onChange={e => setNewAssignment({...newAssignment, deadline: e.target.value})}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-bold text-gray-500 block mb-1 uppercase">Link File đề (URL)</label>
                          <input 
                              type="text" className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 text-sm" 
                              placeholder="https://..."
                              value={newAssignment.fileUrl}
                              onChange={e => setNewAssignment({...newAssignment, fileUrl: e.target.value})}
                          />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Hủy bỏ</button>
                        <button onClick={submitAssignment} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition text-sm">Đăng bài tập</button>
                    </div>
                  </div>
              </div>
            )}

            {/* Danh sách bài tập & Tracking */}
              {activeTab === 'ASSIGNMENTS' && (
                <div className="space-y-6">
                  {classDetail.assignments && classDetail.assignments.map((assignment: any) => (
                    <AssignmentTracker 
                      key={assignment.id} 
                      assignment={assignment} 
                      classStudents={classDetail.students || []} 
                    />
                  ))}

                  {(!classDetail.assignments || classDetail.assignments.length === 0) && !showCreateForm && (
                    <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                      <BookOpen size={48} className="mx-auto mb-3 opacity-20 text-indigo-500" />
                      <p>Lớp này chưa có bài tập nào.</p>
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="text-indigo-600 font-bold hover:underline mt-2 text-sm"
                      >
                        Tạo bài tập đầu tiên
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'MEMBERS' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="p-4">Tên học sinh</th>
                        <th className="p-4">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {classDetail.students && classDetail.students.length > 0 ? (
                        classDetail.students.map((st: any) => (
                          <tr key={st.id} className="hover:bg-gray-50">
                            <td className="p-4 font-medium text-gray-800 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                {st.name ? st.name.charAt(0) : 'S'}
                              </div>
                              {st.name || "Chưa cập nhật tên"}
                            </td>
                            <td className="p-4 text-gray-600">{st.email}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="p-8 text-center text-gray-400 italic">
                            Lớp chưa có thành viên nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

           </>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 shadow-sm">
             <div className="bg-indigo-50 p-4 rounded-full mb-4">
                 <LayoutDashboard size={32} className="text-indigo-300"/>
             </div>
             <p className="font-medium">Vui lòng chọn một lớp học để bắt đầu.</p>
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
                            <div className="bg-white/20 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10">
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
       if(!content.trim()) return alert("Vui lòng nhập nội dung!");
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