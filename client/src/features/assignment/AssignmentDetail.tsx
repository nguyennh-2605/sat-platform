import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, Clock, Link as LinkIcon, ArrowLeft, Send, Github, Globe,
  YoutubeIcon, Edit, MoreVertical, Trash2, ClipboardList, ChevronRight,
  Users, CheckCircle, XCircle, AlertCircle, Calendar, Download, Eye
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import AnnouncementCreator from '../notifications/AnnouncementCreator';
import { type AssignmentProps } from '../../types/quiz';

// Helper functions
const getLinkIcon = (url: string) => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be'))
    return <YoutubeIcon size={20} className="text-red-500" />;
  if (lowerUrl.includes('github.com'))
    return <Github size={20} className="text-slate-800" />;
  if (lowerUrl.includes('drive.google.com') || lowerUrl.includes('docs.google.com'))
    return <FileText size={20} className="text-blue-500" />;
  return <Globe size={20} className="text-blue-400" />;
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
  return 'Google Drive';
};

const getStatusBadge = (status: string) => {
  const badges = {
    COMPLETED: { label: 'Hoàn thành', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    IN_PROGRESS: { label: 'Đang thực hiện', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
    NOT_STARTED: { label: 'Chưa bắt đầu', color: 'bg-gray-100 text-gray-600', icon: XCircle },
    OVERDUE: { label: 'Quá hạn', color: 'bg-red-100 text-red-700', icon: AlertCircle },
    SUBMITTED: { label: 'Đã nộp', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  };
  const config = badges[status as keyof typeof badges] || badges.NOT_STARTED;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${config.color}`}>
      <Icon size={14} />
      {config.label}
    </span>
  );
};

// Types
interface StudentSubmission {
  id: string;
  studentId: number;
  studentName: string;
  studentEmail: string;
  fileUrl?: string;
  textResponse?: string;
  submittedAt: string;
  score?: number;
  feedback?: string;
  status: string;
}

interface TestCompletion {
  testId: number;
  testTitle: string;
  completed: boolean;
  completedAt?: string;
  score?: number;
}

interface AssignmentStats {
  totalStudents: number;
  submitted: number;
  notSubmitted: number;
  testsCompleted: number;
  totalTests: number;
}

interface APIResponse {
  success: boolean;
  data: AssignmentProps & {
    submissions?: StudentSubmission[];
    testCompletions?: TestCompletion[];
    stats?: AssignmentStats;
    isLessonAssignment?: boolean;
  };
}

const AssignmentDetail = () => {
  const { classId, assignmentId } = useParams();
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole');

  const [assignment, setAssignment] = useState<AssignmentProps | null>(null);
  const [loading, setLoading] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTestsModal, setShowTestsModal] = useState(false);
  const [submissionType, setSubmissionType] = useState<'TEXT' | 'FILE'>('TEXT');
  const [submissionContent, setSubmissionContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLessonAssignment, setIsLessonAssignment] = useState(false);

  // Teacher-specific states
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [stats, setStats] = useState<AssignmentStats | null>(null);
  const [testCompletions, setTestCompletions] = useState<TestCompletion[]>([]);

  const fetchAssignmentDetail = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get<any, APIResponse>(`/api/assignments/${assignmentId}`);
      setAssignment(res.data);
      setIsLessonAssignment(res.data.isLessonAssignment || false);

      // If teacher, fetch additional data
      if (userRole !== 'STUDENT') {
        setSubmissions(res.data.submissions || []);
        setStats(res.data.stats || null);
        setTestCompletions(res.data.testCompletions || []);
      }
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
      setSubmissionContent('');
      fetchAssignmentDetail();
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
      <div className="w-full max-w-6xl mx-auto p-6 md:p-8 animate-pulse bg-white min-h-screen">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4 w-full">
            <div className="w-12 h-12 bg-slate-200 rounded-full flex-shrink-0"></div>
            <div className="w-full max-w-2xl">
              <div className="h-8 bg-slate-200 rounded-lg w-3/4 mb-3"></div>
              <div className="h-4 bg-slate-200 rounded-md w-1/4"></div>
            </div>
          </div>
        </div>
        <div className="h-px w-full bg-slate-100 mb-8"></div>
        <div className="space-y-4 mb-10">
          <div className="h-4 bg-slate-200 rounded w-full"></div>
          <div className="h-4 bg-slate-200 rounded w-full"></div>
          <div className="h-4 bg-slate-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <p className="text-lg font-medium">Không tìm thấy bài tập!</p>
      </div>
    );
  }

  const isTeacher = userRole !== 'STUDENT';
  const hasDeadline = assignment.deadline;
  const isOverdue = hasDeadline && new Date(assignment.deadline!) < new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-8 pb-20">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition mb-6 font-medium group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Quay lại lớp học
        </button>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Assignment Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4 items-start flex-1">
                    <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                      <FileText size={28} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h1 className="text-2xl md:text-3xl font-bold mb-2">{assignment.title}</h1>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-white/90">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={16} />
                          {format(parseISO(assignment.createdAt), 'dd/MM/yyyy')}
                        </span>
                        {hasDeadline && (
                          <span className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-200' : ''}`}>
                            <Clock size={16} />
                            Hạn: {format(parseISO(assignment.deadline!), 'dd/MM/yyyy HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Menu for Teachers */}
                  {isTeacher && (
                    <div className="relative">
                      <button
                        onClick={() => setShowActionMenu(!showActionMenu)}
                        className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <MoreVertical size={22} />
                      </button>
                      {showActionMenu && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowActionMenu(false)}></div>
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden py-1">
                            <button
                              onClick={() => { setShowActionMenu(false); setShowEditModal(true); }}
                              className="w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-colors text-left font-medium"
                            >
                              <Edit size={16} /> Chỉnh sửa
                            </button>
                            <div className="h-px bg-slate-100 my-1"></div>
                            <button
                              onClick={() => { setShowActionMenu(false); setShowDeleteModal(true); }}
                              className="w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors text-left font-medium"
                            >
                              <Trash2 size={16} /> Xóa bài tập
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Content Section */}
              <div className="p-6">
                <div
                  className="prose prose-slate max-w-none"
                  dangerouslySetInnerHTML={{ __html: assignment.content || '<p class="text-slate-400 italic">Không có mô tả</p>' }}
                />
              </div>
            </div>

            {/* Attachments Card */}
            {((assignment.fileUrls && assignment.fileUrls.length > 0) ||
              (assignment.links && assignment.links.length > 0)) && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <FileText size={20} className="text-indigo-600" />
                  Tài liệu đính kèm
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      }
                      fileTypeLabel = getFileTypeName(fileName);
                    } catch (e) {}

                    return (
                      <a
                        key={`file-${idx}`}
                        href={cleanUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition group"
                      >
                        <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg"
                            alt="Google Drive"
                            className="w-6 h-6"
                          />
                        </div>
                        <div className="flex flex-col overflow-hidden flex-1">
                          <span className="font-semibold text-sm text-slate-700 truncate group-hover:text-indigo-600 transition">
                            {fileName}
                          </span>
                          <span className="text-xs text-slate-500 mt-0.5 uppercase tracking-wide">{fileTypeLabel}</span>
                        </div>
                      </a>
                    );
                  })}

                  {assignment.links?.map((link: string, idx: number) => (
                    <a
                      key={`link-${idx}`}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                        {getLinkIcon(link)}
                      </div>
                      <div className="flex flex-col overflow-hidden flex-1">
                        <span className="font-medium text-sm text-slate-700">Link</span>
                        <span className="text-xs text-slate-500 mt-0.5 truncate">{link}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Tests Card */}
            {assignment.selectedTests && assignment.selectedTests.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setShowTestsModal(true)}
                  className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      <ClipboardList size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">
                        Bài kiểm tra đính kèm ({assignment.selectedTests.length})
                      </p>
                      <p className="text-sm text-slate-600">Nhấn để xem chi tiết</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-400" />
                </button>
              </div>
            )}

                        {/* Teacher View: Student Submissions */}
            {isTeacher && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Users size={20} className="text-indigo-600" />
                    Bài nộp của học sinh
                  </h3>
                </div>
                <div className="p-6">
                  {submissions.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users size={32} className="text-slate-400" />
                      </div>
                      <p className="text-slate-500 font-medium">Chưa có học sinh nào nộp bài</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {submissions.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-start gap-4 p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition"
                        >
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold flex-shrink-0">
                            {sub.studentName?.charAt(0).toUpperCase() || 'S'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <p className="font-semibold text-slate-800">{sub.studentName}</p>
                                <p className="text-xs text-slate-500">{sub.studentEmail}</p>
                              </div>
                              {getStatusBadge(sub.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                              <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {format(parseISO(sub.submittedAt), 'dd/MM/yyyy HH:mm')}
                              </span>
                              {sub.score !== undefined && (
                                <span className="font-medium text-indigo-600">Điểm: {sub.score}</span>
                              )}
                            </div>
                            {sub.fileUrl && (
                              <a
                                href={sub.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                              >
                                <Download size={14} /> Xem file nộp
                              </a>
                            )}
                            {sub.textResponse && (
                              <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
                                {sub.textResponse}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Stats & Submission Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Teacher Stats Cards */}
            {isTeacher && stats && (
              <>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="font-bold text-slate-800 mb-4">Tổng quan</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                          <Users size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-blue-700 font-medium">Tổng học sinh</p>
                          <p className="text-2xl font-bold text-blue-900">{stats.totalStudents}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                          <CheckCircle size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-emerald-700 font-medium">Đã nộp bài</p>
                          <p className="text-2xl font-bold text-emerald-900">{stats.submitted}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
                          <AlertCircle size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-amber-700 font-medium">Chưa nộp</p>
                          <p className="text-2xl font-bold text-amber-900">{stats.notSubmitted}</p>
                        </div>
                      </div>
                    </div>

                    {stats.totalTests > 0 && (
                      <div className="pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700">Tiến độ bài kiểm tra</span>
                          <span className="text-sm font-bold text-indigo-600">
                            {stats.testsCompleted}/{stats.totalTests}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2.5 rounded-full transition-all"
                            style={{ width: `${(stats.testsCompleted / stats.totalTests) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Student Submission Panel */}
            {!isTeacher && hasDeadline && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-800">Bài tập của bạn</h2>
                  <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                    Đã giao
                  </span>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                  <button
                    onClick={() => setSubmissionType('TEXT')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      submissionType === 'TEXT'
                        ? 'bg-white shadow text-indigo-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Nhập văn bản
                  </button>
                  <button
                    onClick={() => setSubmissionType('FILE')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      submissionType === 'FILE'
                        ? 'bg-white shadow text-indigo-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Gửi Link/File
                  </button>
                </div>

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
                  </div>
                )}

                <button
                  onClick={handleSubmitAssignment}
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-70"
                >
                  {isSubmitting ? 'Đang nộp...' : (
                    <>
                      <Send size={18} /> Nộp bài
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Xóa bài tập?</h3>
            <p className="text-slate-500 mb-6 text-sm">
              Bạn có chắc chắn muốn xóa bài tập <span className="font-semibold text-slate-700">"{assignment.title}"</span> không?
              Toàn bộ bài nộp của học sinh sẽ bị xóa vĩnh viễn.
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

      {/* Edit Modal */}
      {showEditModal && (
        <AnnouncementCreator
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdateAssignment}
          initialData={assignment}
        />
      )}

      {/* Tests Modal */}
      {showTestsModal && assignment.selectedTests && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
              <h3 className="text-lg font-bold text-slate-800">
                Danh sách bài kiểm tra đính kèm
              </h3>
              <button
                onClick={() => setShowTestsModal(false)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white rounded-lg transition"
              >
                Đóng
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(80vh-72px)] space-y-3">
              {assignment.selectedTests.map((test) => (
                <div
                  key={test.id}
                  className="border border-slate-200 rounded-xl p-4 bg-white hover:border-indigo-200 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-semibold text-slate-800">{test.title}</h4>
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        test.mode === 'EXAM'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {test.mode}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Môn: {test.subject}</span>
                    <span>Thời lượng: {test.duration} phút</span>
                    <span>Số câu: {test.questionCount}</span>
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => navigate(`/test/${test.id}?assignmentId=${assignment.id}`)}
                      className="px-3 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
                    >
                      Làm bài kiểm tra này
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
