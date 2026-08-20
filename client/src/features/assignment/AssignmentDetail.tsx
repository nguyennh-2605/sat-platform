import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Clock, Link as LinkIcon, ArrowLeft, Send, Github, Globe, YoutubeIcon, Edit, MoreVertical, Trash2, ClipboardList, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import AnnouncementCreator from '../notifications/AnnouncementCreator';
import { type AssignmentProps } from '../../types/quiz';
  
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
  if (name.includes('.pdf')) return 'PDF document';
  if (name.match(/\.(doc|docx)$/)) return 'Word document';
  if (name.match(/\.(xls|xlsx|csv)$/)) return 'Excel spreadsheet';
  if (name.match(/\.(ppt|pptx)$/)) return 'Presentation';
  if (name.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'Image';
  if (name.match(/\.(mp4|avi|mov|mkv)$/)) return 'Video';
  if (name.match(/\.(zip|rar|7z)$/)) return 'Archive';
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
  const [showTestsModal, setShowTestsModal] = useState(false);
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
      toast.error("Unable to load assignment");
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
      toast.error("Enter content or a file link");
      return;
    }

    try {
      setIsSubmitting(true);
      await axiosClient.post('/api/classes/submissions', {
        assignmentId,
        textResponse: submissionType === 'TEXT' ? submissionContent : undefined,
        fileUrl: submissionType === 'FILE' ? submissionContent : undefined,
      });
      
      toast.success("Test submitted");
      // Nộp xong có thể reset form hoặc gọi API cập nhật lại trạng thái (Đã nộp)
      setSubmissionContent('');
    } catch (error) {
      toast.error("Unable to submit assignment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axiosClient.delete(`/api/assignments/${assignmentId}`);
      toast.success("Assignment deleted");
      setShowDeleteModal(false);
      navigate(`/dashboard/class/${classId}`);
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete assignment");
    }
  };

  const handleUpdateAssignment = async (updatedData: Partial<AssignmentProps>) => {
    try {
      await axiosClient.put(`/api/assignments/${assignmentId}`, updatedData);
      toast.success("Assignment updated");
      setShowEditModal(false);
      fetchAssignmentDetail();
    } catch (error) {
      console.log(error);
      toast.error("Unable to update assignment");
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
        <p className="text-lg font-medium">Assignment not found</p>
        <p className="text-sm">This assignment may have been deleted or the link is invalid.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* Nút Back */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-500 hover:text-[#1B7A5A] transition mb-6 font-medium"
      >
        <ArrowLeft size={20} /> Back to class
      </button>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          {/* Header Assignments */}
          <div className="flex justify-between items-start mb-6 border-b border-slate-300 pb-6 relative">
            
            {/* --- Phần bên trái: Icon và Thông tin bài tập --- */}
            <div className="flex gap-4 items-start flex-1">
              <div className="w-12 h-12 rounded-full bg-[#C2DDD4] text-[#1B7A5A] flex items-center justify-center flex-shrink-0 mt-1">
                <FileText size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">{assignment.title}</h1>
                <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                  <span>Posted: {format(parseISO(assignment.createdAt), 'MMM d, yyyy')}</span>

                  {/* 2. HIỂN THỊ HẠN NỘP */}
                  {/* Code của bạn hơi bị lặp điều kiện, chỉ cần viết ngắn gọn thế này thôi: */}
                  {assignment.deadline ? (
                    <span className="flex items-center gap-1 text-red-500">
                      <Clock size={16} /> 
                      Due: {format(parseISO(assignment.deadline), 'dd/MM/yyyy HH:mm')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-500 italic">
                      <Clock size={16} /> 
                      No due date
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
                        className="w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-[#E8F5EF] hover:text-[#1B7A5A] flex items-center gap-3 transition-colors text-left font-medium"
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
                  className={`prose marker:text-black marker:font-bold max-w-none text-slate-700 ${hasAttachments && !isStudent ? 'flex-1' : 'w-full'}`}
                  dangerouslySetInnerHTML={{ __html: assignment.content || '' }} 
                />

                {/* 2. Phần Attachments */}
                {hasAttachments && (
                  <div className={`${!isStudent ? 'w-full lg:w-80 flex-shrink-0' : 'w-full mt-4'} space-y-4`}>
                    <h3 className="font-semibold text-slate-800 border-b border-slate-300 pb-2 uppercase text-sm tracking-wider">
                      Attachments
                    </h3>
                    
                    {/* Dàn layout file: Dọc cho giáo viên, Lưới (Grid) 2 cột cho học sinh */}
                    <div className={isStudent ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "flex flex-col gap-3"}>
                      
                      {/* Render File Drive */}
                      {assignment.fileUrls?.map((url: string, idx: number) => {
                        let fileName = `Attachments ${idx + 1}`;
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
                             className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-[#A9CFC1] hover:shadow-sm transition group">
                            <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                              <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" 
                                alt="Google Drive" 
                                className="w-6 h-6 object-contain"
                              />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="font-semibold text-sm text-slate-700 truncate group-hover:text-[#1B7A5A] underline underline-offset-4 transition-all">
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
                             className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-[#A9CFC1] hover:shadow-sm transition group">
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

          {assignment.selectedTests && assignment.selectedTests.length > 0 && (
            <div className="mb-8">
              <button
                onClick={() => setShowTestsModal(true)}
                className="w-full flex items-center justify-between p-4 md:p-5 rounded-xl border border-[#C2DDD4] bg-[#E8F5EF] hover:bg-[#C2DDD4]/70 transition text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#1B7A5A] text-white flex items-center justify-center">
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-[#1A1A1A]">
                      Attached tests ({assignment.selectedTests.length})
                    </p>
                    <p className="text-sm text-[#1B7A5A]/90">
                      View the full list of assigned tests
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-[#1B7A5A]" />
              </button>
            </div>
          )}
        </div>

        {/* ============ CỘT PHẢI: KHU VỰC NỘP BÀI (Chỉ dành cho Học sinh) ============ */}
        {userRole === 'STUDENT' && assignment.deadline && (
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800">Your assignment</h2>
                <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                  Assigned
                </span>
              </div>

              {/* Tabs chọn kiểu nộp */}
              <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                <button 
                  onClick={() => setSubmissionType('TEXT')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${submissionType === 'TEXT' ? 'bg-white shadow text-[#1B7A5A]' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Write response
                </button>
                <button 
                  onClick={() => setSubmissionType('FILE')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${submissionType === 'FILE' ? 'bg-white shadow text-[#1B7A5A]' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Share link or file
                </button>
              </div>

              {/* Form nhập liệu */}
              {submissionType === 'TEXT' ? (
                <textarea 
                  rows={5}
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1B7A5A]/20 outline-none transition text-sm mb-4"
                  placeholder="Write your response here…"
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
                    className="w-full pl-10 p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1B7A5A]/20 outline-none transition text-sm"
                    placeholder="Paste a Google Drive or Docs link…"
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
                className="w-full bg-[#1B7A5A] hover:bg-[#145F47] text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-70"
              >
                {isSubmitting ? 'Submitting…' : (
                  <> <Send size={18} /> Submit test </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl scale-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Delete assignment?</h3>
            <p className="text-slate-500 mb-6 text-sm">
              Are you sure you want to delete assignment <span className="font-semibold text-slate-700">"{assignment.title}"</span>? All student submissions will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditModal && (
        <AnnouncementCreator
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdateAssignment}
          initialData={assignment}
        />
      )}
      {showTestsModal && assignment.selectedTests && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                Attached tests
              </h3>
              <button
                onClick={() => setShowTestsModal(false)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Close
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(80vh-72px)] space-y-3">
              {assignment.selectedTests.map((test) => (
                <div
                  key={test.id}
                  className="border border-slate-200 rounded-xl p-4 bg-white hover:border-[#C2DDD4] transition"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-semibold text-slate-800">{test.title}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${test.mode === 'EXAM' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {test.mode}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Subject: {test.subject}</span>
                    <span>Duration: {test.duration} min</span>
                    <span>Questions: {test.questionCount}</span>
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => navigate(`/test/${test.id}?assignmentId=${assignment.id}`)}
                      className="px-3 py-2 text-sm font-semibold text-white bg-[#1B7A5A] hover:bg-[#145F47] rounded-lg transition"
                    >
                      Start this test
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentDetail;
