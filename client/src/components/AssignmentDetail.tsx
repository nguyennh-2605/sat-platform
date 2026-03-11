import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Clock, Link as LinkIcon, ArrowLeft, Send, Github, Globe, YoutubeIcon, Edit, MoreVertical, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import axiosClient from '../api/axiosClient';
import FullScreenPostCreator from './CreateAssignmentSection';
import { type AssignmentProps } from '../types/quiz';

const getLinkIcon = (url: string) => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) 
    return <YoutubeIcon size={20} className="text-red-500" />;
  if (lowerUrl.includes('github.com')) 
    return <Github size={20} className="text-slate-800" />;
  if (lowerUrl.includes('drive.google.com') || lowerUrl.includes('docs.google.com')) 
    return <FileText size={20} className="text-blue-500" />;
  return <Globe size={20} className="text-blue-400" />; // Web thông thường
};

const getFileTypeName = (fileName: string) => {
  const name = fileName.toLowerCase();
  if (name.includes('.pdf')) return 'Tài liệu PDF';
  if (name.match(/\.(doc|docx)$/)) return 'Tài liệu Word';
  if (name.match(/\.(xls|xlsx|csv)$/)) return 'Bảng tính Excel';
  if (name.match(/\.(ppt|pptx)$/)) return 'Bài trình chiếu';
  if (name.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'Hình ảnh';
  if (name.match(/\.(mp4|avi|mov|mkv)$/)) return 'Video';
  if (name.match(/\.(zip|rar|7z)$/)) return 'Tệp nén';
  return 'Google Drive'; // Mặc định nếu không nhận diện được
};

interface APIResponse {
  success: boolean;
  data: AssignmentProps;
}

const AssignmentDetail = () => {
  const { classId, assignmentId } = useParams();
  const navigate = useNavigate();
  
  const userRole = localStorage.getItem('userRole');

  // State cho phần nộp bài của học sinh
  const [assignment, setAssignment] = useState<AssignmentProps | null>(null);
  const [loading, setLoading] = useState(false);

  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submissionType, setSubmissionType] = useState<'TEXT' | 'FILE'>('TEXT');
  const [submissionContent, setSubmissionContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAssignmentDetail = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get<any, APIResponse>(`/api/assignments/${assignmentId}`);
      setAssignment(res.data);
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải thông tin bài tập");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assignmentId) {
      fetchAssignmentDetail();
    }
  }, [assignmentId]);

  // Hàm nộp bài của bạn (đã được tinh chỉnh xíu cho mượt)
  const handleSubmitAssignment = async () => {
    if (!submissionContent.trim()) {
      toast.error("Vui lòng nhập nội dung hoặc đường dẫn file!");
      return;
    }

    try {
      setIsSubmitting(true);
      await axiosClient.post('/api/classes/submissions', {
        assignmentId,
        textResponse: submissionType === 'TEXT' ? submissionContent : undefined,
        fileUrl: submissionType === 'FILE' ? submissionContent : undefined,
      });
      
      toast.success("Nộp bài thành công!");
      // Nộp xong có thể reset form hoặc gọi API cập nhật lại trạng thái (Đã nộp)
      setSubmissionContent('');
    } catch (error) {
      toast.error("Lỗi nộp bài!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axiosClient.delete(`/api/assignments/${assignmentId}`);
      toast.success("Xóa bài tập thành công!");
      setShowDeleteModal(false);
      navigate(`/dashboard/class/${classId}`);
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi xóa bài tập!");
    }
  };

  const handleUpdateAssignment = async (updatedData: Partial<AssignmentProps>) => {
    try {
      await axiosClient.put(`/api/assignments/${assignmentId}`, updatedData);
      toast.success("Cập nhật bài thành công!");
      setShowEditModal(false);
      fetchAssignmentDetail();
    } catch (error) {
      console.log(error);
      toast.error("Lỗi khi cập nhật bài tập");
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6 md:p-8 animate-pulse bg-white min-h-screen">
        {/* Khung Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4 w-full">
            {/* Vòng tròn icon */}
            <div className="w-12 h-12 bg-slate-200 rounded-full flex-shrink-0"></div>
            <div className="w-full max-w-2xl">
              {/* Tiêu đề */}
              <div className="h-8 bg-slate-200 rounded-lg w-3/4 mb-3"></div>
              {/* Ngày tháng */}
              <div className="h-4 bg-slate-200 rounded-md w-1/4"></div>
            </div>
          </div>
        </div>

        {/* Đường kẻ ngang */}
        <div className="h-px w-full bg-slate-100 mb-8"></div>

        {/* Khung Nội dung */}
        <div className="space-y-4 mb-10">
          <div className="h-4 bg-slate-200 rounded w-full"></div>
          <div className="h-4 bg-slate-200 rounded w-full"></div>
          <div className="h-4 bg-slate-200 rounded w-5/6"></div>
          <div className="h-4 bg-slate-200 rounded w-4/6"></div>
        </div>

        {/* Khung File đính kèm (nếu có) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-16 bg-slate-100 rounded-xl border border-slate-200"></div>
          <div className="h-16 bg-slate-100 rounded-xl border border-slate-200"></div>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        <p className="text-lg font-medium">Không tìm thấy bài tập!</p>
        <p className="text-sm">Bài tập này có thể đã bị xóa hoặc đường dẫn không hợp lệ.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* Nút Back */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition mb-6 font-medium"
      >
        <ArrowLeft size={20} /> Quay lại lớp học
      </button>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          {/* Header Bài tập */}
          <div className="flex justify-between items-start mb-6 border-b border-slate-300 pb-6 relative">
            
            {/* --- Phần bên trái: Icon và Thông tin bài tập --- */}
            <div className="flex gap-4 items-start flex-1">
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                <FileText size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">{assignment.title}</h1>
                <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                  <span>Đăng ngày: {format(parseISO(assignment.createdAt), 'dd/MM/yyyy')}</span>

                  {/* 2. HIỂN THỊ HẠN NỘP */}
                  {/* Code của bạn hơi bị lặp điều kiện, chỉ cần viết ngắn gọn thế này thôi: */}
                  {assignment.deadline ? (
                    <span className="flex items-center gap-1 text-red-500">
                      <Clock size={16} /> 
                      Hạn nộp: {format(parseISO(assignment.deadline), 'dd/MM/yyyy HH:mm')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-500 italic">
                      <Clock size={16} /> 
                      Không có hạn nộp
                    </span>
                  )}
                </div>
              </div>
            </div>

            {userRole !== 'STUDENT' && (
              <div className="relative mt-7">
                <button 
                  onClick={() => setShowActionMenu(!showActionMenu)}
                  className="p-2 text-slate-700 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors focus:outline-none"
                >
                  <MoreVertical size={22} />
                </button>
                {showActionMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowActionMenu(false)}
                    ></div>
                    
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 z-20 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                      <button 
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowEditModal(true);
                        }}
                        className="w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-colors text-left font-medium"
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                      
                      <div className="h-px bg-slate-100 my-1"></div>
                      
                      <button 
                        onClick={() => {
                          setShowActionMenu(false);
                          setShowDeleteModal(true);
                        }}
                        className="w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors text-left font-medium"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                      
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* =========== KHU VỰC NỘI DUNG & TÀI LIỆU ĐÍNH KÈM =========== */}
          {(() => {
            const hasAttachments = (assignment.fileUrls && assignment.fileUrls.length > 0) || 
                                   (assignment.links && assignment.links.length > 0);
            
            const isStudent = userRole === 'STUDENT';

            return (
              <div className={`flex flex-col ${hasAttachments && !isStudent ? 'lg:flex-row gap-8' : 'gap-6'} mb-8`}>
                
                {/* 1. Phần Text nội dung */}
                <div 
                  className={`prose max-w-none text-slate-700 ${hasAttachments && !isStudent ? 'flex-1' : 'w-full'}`}
                  dangerouslySetInnerHTML={{ __html: assignment.content || '' }} 
                />

                {/* 2. Phần Tài liệu đính kèm */}
                {hasAttachments && (
                  <div className={`${!isStudent ? 'w-full lg:w-80 flex-shrink-0' : 'w-full mt-4'} space-y-4`}>
                    <h3 className="font-semibold text-slate-800 border-b border-slate-300 pb-2 uppercase text-sm tracking-wider">
                      Tài liệu đính kèm
                    </h3>
                    
                    {/* Dàn layout file: Dọc cho giáo viên, Lưới (Grid) 2 cột cho học sinh */}
                    <div className={isStudent ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "flex flex-col gap-3"}>
                      
                      {/* Render File Drive */}
                      {assignment.fileUrls?.map((url: string, idx: number) => {
                        let fileName = `Tài liệu đính kèm ${idx + 1}`;
                        let cleanUrl = url;
                        let fileTypeLabel = 'Google Drive';

                        try {
                          const urlObj = new URL(url);
                          const nameFromQuery = urlObj.searchParams.get('name');
                          if (nameFromQuery) {
                            fileName = nameFromQuery;
                            urlObj.searchParams.delete('name');
                            cleanUrl = urlObj.toString();
                          } else {
                            const extractedName = urlObj.pathname.split('/').pop();
                            if (extractedName && extractedName !== 'view') {
                              fileName = decodeURIComponent(extractedName);
                            }
                          }
                          fileTypeLabel = getFileTypeName(fileName);
                        } catch (e) {}

                        return (
                          <a key={`file-${idx}`} href={cleanUrl} target="_blank" rel="noreferrer" 
                             className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition group">
                            <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                              <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" 
                                alt="Google Drive" 
                                className="w-6 h-6 object-contain"
                              />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="font-semibold text-sm text-slate-700 truncate group-hover:text-indigo-600 underline underline-offset-4 transition-all">
                                {fileName}
                              </span>
                              <span className="text-[12px] font-medium text-slate-500 mt-0.5 uppercase tracking-wide">
                                {fileTypeLabel}
                              </span>
                            </div>
                          </a>
                        );
                      })}
                      
                      {/* Render Link Web */}
                      {assignment.links?.map((link: string, idx: number) => {
                        return (
                          <a key={`link-${idx}`} href={link} target="_blank" rel="noreferrer" 
                             className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition group">
                            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                              {getLinkIcon(link)}
                            </div>
                            <div className="flex flex-col overflow-hidden justify-center">
                              <div className="flex flex-col overflow-hidden justify-center">
                                <span className="font-medium text-sm text-slate-700 underline underline-offset-2">
                                  Link
                                </span>
                                <span className="text-[12px] font-medium text-slate-500 mt-0.5 tracking-wide truncate">
                                  {link}
                                </span>
                              </div>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* ============ CỘT PHẢI: KHU VỰC NỘP BÀI (Chỉ dành cho Học sinh) ============ */}
        {userRole === 'STUDENT' && assignment.deadline && (
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800">Bài tập của bạn</h2>
                <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                  Đã giao
                </span>
              </div>

              {/* Tabs chọn kiểu nộp */}
              <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                <button 
                  onClick={() => setSubmissionType('TEXT')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${submissionType === 'TEXT' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Nhập văn bản
                </button>
                <button 
                  onClick={() => setSubmissionType('FILE')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${submissionType === 'FILE' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Gửi Link/File
                </button>
              </div>

              {/* Form nhập liệu */}
              {submissionType === 'TEXT' ? (
                <textarea 
                  rows={5}
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm mb-4"
                  placeholder="Nhập câu trả lời của bạn vào đây..."
                  value={submissionContent}
                  onChange={(e) => setSubmissionContent(e.target.value)}
                />
              ) : (
                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon size={16} className="text-slate-400" />
                  </div>
                  <input 
                    type="text"
                    className="w-full pl-10 p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm"
                    placeholder="Dán đường dẫn (Google Drive, Docs...)"
                    value={submissionContent}
                    onChange={(e) => setSubmissionContent(e.target.value)}
                  />
                  {/* Gợi ý: Sau này bạn có thể thay cái input này bằng nút mở Google Picker y hệt lúc giáo viên đăng bài! */}
                </div>
              )}

              {/* Nút Submit */}
              <button 
                onClick={handleSubmitAssignment}
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-70"
              >
                {isSubmitting ? 'Đang nộp...' : (
                  <> <Send size={18} /> Nộp bài </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl scale-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Xóa bài tập?</h3>
            <p className="text-slate-500 mb-6 text-sm">
              Bạn có chắc chắn muốn xóa bài tập <span className="font-semibold text-slate-700">"{assignment.title}"</span> không? Toàn bộ bài nộp của học sinh sẽ bị xóa vĩnh viễn và không thể khôi phục.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditModal && (
        <FullScreenPostCreator
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdateAssignment}
          initialData={assignment}
        />
      )}
    </div>
  );
};

export default AssignmentDetail;