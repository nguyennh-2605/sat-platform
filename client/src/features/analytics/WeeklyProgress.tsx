import { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronRight, MoreVertical, Trash2, Edit2, FileText, Link as LinkIcon, Calendar, Clock, Upload, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import TestAssignmentManager from '../assignment/TestAssignmentManager';
import { format } from 'date-fns';
import useDrivePicker from 'react-google-drive-picker';
import axiosClient from '../../lib/axios';

interface Assignment {
  id: string;
  title: string;
  dueDate?: string;
  testIds?: number[];
}

interface Lesson {
  id: string;
  title: string;
  files: { id: string; name: string; url: string }[];
  assignments: Assignment[];
}

interface Week {
  id: string;
  title: string;
  lessons: Lesson[];
  isExpanded: boolean;
}

const WeeklyProgress = () => {
  const navigate = useNavigate();
  const { classId } = useParams();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);

  const [showWeekModal, setShowWeekModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingWeek, setEditingWeek] = useState<Week | null>(null);
  const [selectedWeekForLesson, setSelectedWeekForLesson] = useState<string | null>(null);
  const [newWeekTitle, setNewWeekTitle] = useState('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [weekMenuOpen, setWeekMenuOpen] = useState<string | null>(null);
  const [lessonMenuOpen, setLessonMenuOpen] = useState<string | null>(null);
  const [showAssignmentManager, setShowAssignmentManager] = useState(false);
  const [currentLessonForAssignment, setCurrentLessonForAssignment] = useState<{ weekId: string; lessonId: string } | null>(null);
  const [currentLessonForFile, setCurrentLessonForFile] = useState<{ weekId: string; lessonId: string } | null>(null);

  const [openPicker, authResponse] = useDrivePicker();

  // Fetch weeks on component mount
  useEffect(() => {
    fetchWeeks();
  }, [classId]);

  const fetchWeeks = async () => {
    try {
      setLoading(true);
      const response = await axiosClient.get(`/api/progress/class/${classId}/weeks`);
      if (response.success) {
        setWeeks(response.data);
      }
    } catch (error) {
      console.error('Error fetching weeks:', error);
      toast.error('Lỗi khi tải danh sách tuần học');
    } finally {
      setLoading(false);
    }
  };

  const toggleWeek = async (weekId: string) => {
    const week = weeks.find(w => w.id === weekId);
    if (!week) return;

    const newExpandedState = !week.isExpanded;

    // Optimistic update
    setWeeks(weeks.map(w =>
      w.id === weekId ? { ...w, isExpanded: newExpandedState } : w
    ));

    try {
      await axiosClient.put(`/api/progress/weeks/${weekId}`,
        { isExpanded: newExpandedState }
      );
    } catch (error) {
      console.error('Error updating week:', error);
      // Revert on error
      setWeeks(weeks.map(w =>
        w.id === weekId ? { ...w, isExpanded: !newExpandedState } : w
      ));
    }
  };

  const openAddWeekModal = () => {
    setEditingWeek(null);
    setNewWeekTitle('');
    setShowWeekModal(true);
  };

  const openEditWeekModal = (week: Week) => {
    setEditingWeek(week);
    setNewWeekTitle(week.title);
    setShowWeekModal(true);
    setWeekMenuOpen(null);
  };

  const handleSaveWeek = async () => {
    if (!newWeekTitle.trim()) {
      toast.error('Vui lòng nhập tiêu đề tuần!');
      return;
    }

    try {
      if (editingWeek) {
        // Edit existing week
        const response = await axiosClient.put(
          `/api/progress/weeks/${editingWeek.id}`,
          { title: newWeekTitle }
        );
        if (response.success) {
          setWeeks(weeks.map(week =>
            week.id === editingWeek.id ? { ...week, title: newWeekTitle } : week
          ));
          toast.success('Đã cập nhật tuần học!');
        }
      } else {
        // Add new week
        const response = await axiosClient.post(
          `/api/progress/class/${classId}/weeks`,
          { title: newWeekTitle }
        );
        if (response.success) {
          const newWeek: Week = {
            ...response.data,
            lessons: [],
            isExpanded: true
          };
          setWeeks([...weeks, newWeek]);
          toast.success('Đã thêm tuần học mới!');
        }
      }
      setShowWeekModal(false);
      setNewWeekTitle('');
    } catch (error) {
      console.error('Error saving week:', error);
      toast.error('Lỗi khi lưu tuần học');
    }
  };

  const handleDeleteWeek = async (weekId: string) => {
    if (window.confirm('Bạn có chắc muốn xóa tuần học này? Tất cả buổi học trong tuần cũng sẽ bị xóa.')) {
      try {
        const response = await axiosClient.delete(
          `/api/progress/weeks/${weekId}`
        );
        if (response.success) {
          setWeeks(weeks.filter(week => week.id !== weekId));
          toast.success('Đã xóa tuần học!');
        }
      } catch (error) {
        console.error('Error deleting week:', error);
        toast.error('Lỗi khi xóa tuần học');
      }
    }
    setWeekMenuOpen(null);
  };

  const openAddLessonModal = (weekId: string) => {
    setSelectedWeekForLesson(weekId);
    setNewLessonTitle('');
    setShowLessonModal(true);
  };

  const handleSaveLesson = async () => {
    if (!newLessonTitle.trim()) {
      toast.error('Vui lòng nhập tiêu đề buổi học!');
      return;
    }

    if (!selectedWeekForLesson) return;

    try {
      const response = await axiosClient.post(
        `/api/progress/weeks/${selectedWeekForLesson}/lessons`,
        { title: newLessonTitle }
      );

      if (response.success) {
        const newLesson: Lesson = {
          ...response.data,
          files: [],
          assignments: []
        };

        setWeeks(weeks.map(week =>
          week.id === selectedWeekForLesson
            ? { ...week, lessons: [...week.lessons, newLesson] }
            : week
        ));

        toast.success('Đã thêm buổi học mới!');
      }
    } catch (error) {
      console.error('Error creating lesson:', error);
      toast.error('Lỗi khi thêm buổi học');
    }

    setShowLessonModal(false);
    setNewLessonTitle('');
    setSelectedWeekForLesson(null);
  };

  const handleDeleteLesson = async (weekId: string, lessonId: string) => {
    if (window.confirm('Bạn có chắc muốn xóa buổi học này?')) {
      try {
        const response = await axiosClient.delete(
          `/api/progress/lessons/${lessonId}`
        );

        if (response.success) {
          setWeeks(weeks.map(week =>
            week.id === weekId
              ? { ...week, lessons: week.lessons.filter(lesson => lesson.id !== lessonId) }
              : week
          ));
          toast.success('Đã xóa buổi học!');
        }
      } catch (error) {
        console.error('Error deleting lesson:', error);
        toast.error('Lỗi khi xóa buổi học');
      }
    }
    setLessonMenuOpen(null);
  };

  const handleAssignmentClick = (assignmentId: string) => {
    navigate(`/dashboard/class/${classId}/assignment/${assignmentId}`);
  };

  const openAssignmentManager = (weekId: string, lessonId: string) => {
    setCurrentLessonForAssignment({ weekId, lessonId });
    setShowAssignmentManager(true);
  };

  const handleAssignmentSubmit = async (data: any) => {
    if (!currentLessonForAssignment) return;

    const { weekId, lessonId } = currentLessonForAssignment;

    try {
      const response = await axiosClient.post(
        `/api/progress/lessons/${lessonId}/assignment`,
        {
          title: data.title,
          content: data.content,
          dueDate: data.deadline,
          testIds: data.testIds
        }
      );

      if (response.success) {
        const newAssignment: Assignment = {
          id: response.data.id,
          title: response.data.title,
          dueDate: response.data.dueDate,
          testIds: response.data.testIds
        };

        setWeeks(weeks.map(week =>
          week.id === weekId
            ? {
                ...week,
                lessons: week.lessons.map(lesson =>
                  lesson.id === lessonId
                    ? { ...lesson, assignments: [newAssignment] }
                    : lesson
                )
              }
            : week
        ));

        toast.success('Đã giao bài tập thành công!');
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error('Lỗi khi giao bài tập');
    }

    setShowAssignmentManager(false);
    setCurrentLessonForAssignment(null);
  };

  const handleOpenFilePicker = (weekId: string, lessonId: string) => {
    setCurrentLessonForFile({ weekId, lessonId });
    openPicker({
      clientId: import.meta.env.VITE_DRIVE_CLIENT_ID,
      developerKey: import.meta.env.VITE_DRIVE_API_KEY,
      viewId: "DOCS",
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: true,
      appId: import.meta.env.VITE_DRIVE_APP_ID,
      customScopes: ['https://www.googleapis.com/auth/drive.file'],
      callbackFunction: async (data) => {
        if (data.action === 'picked') {
          const token = authResponse?.access_token;
          if (token) {
            try {
              await Promise.all(data.docs.map(doc =>
                fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}/permissions`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ role: 'reader', type: 'anyone' }),
                })
              ));
              console.log("Đã mở Public cho tất cả file!");
            } catch (error) {
              console.error(`Lỗi khi set Public cho file:`, error);
            }
          }

          const pickedFiles = data.docs.map(doc => ({
            name: doc.name,
            url: doc.url
          }));

          if (currentLessonForFile) {
            const { weekId, lessonId } = currentLessonForFile;

            try {
              const response = await axiosClient.post(
                `/api/progress/lessons/${lessonId}/files`,
                { files: pickedFiles }
              );

              if (response.success) {
                setWeeks(weeks.map(week =>
                  week.id === weekId
                    ? {
                        ...week,
                        lessons: week.lessons.map(lesson =>
                          lesson.id === lessonId
                            ? { ...lesson, files: [...lesson.files, ...response.data] }
                            : lesson
                        )
                      }
                    : week
                ));
                toast.success(`Đã thêm ${pickedFiles.length} tài liệu!`);
              }
            } catch (error) {
              console.error('Error adding files:', error);
              toast.error('Lỗi khi thêm tài liệu');
            }
          }
        }
      },
    });
  };

  const handleRemoveFile = async (weekId: string, lessonId: string, fileId: string) => {
    try {
      const response = await axiosClient.delete(
        `/api/progress/files/${fileId}`
      );

      if (response.success) {
        setWeeks(weeks.map(week =>
          week.id === weekId
            ? {
                ...week,
                lessons: week.lessons.map(lesson =>
                  lesson.id === lessonId
                    ? { ...lesson, files: lesson.files.filter(f => f.id !== fileId) }
                    : lesson
                )
              }
            : week
        ));
        toast.success('Đã xóa tài liệu!');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Lỗi khi xóa tài liệu');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header with Add Week Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Tiến độ học tập</h2>
        <button
          onClick={openAddWeekModal}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-md flex items-center gap-2"
        >
          <Plus size={20} /> Thêm tuần học
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12">
          <div className="text-center text-gray-500">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="font-medium">Đang tải...</p>
          </div>
        </div>
      ) : weeks.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12">
          <div className="text-center text-gray-500">
            <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="font-medium text-lg">Chưa có tuần học nào</p>
            <p className="text-sm mt-2">Nhấn nút "Thêm tuần học" để bắt đầu tạo lộ trình</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {weeks.map((week) => (
            <div key={week.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Week Header */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => toggleWeek(week.id)}
                      className="p-1 hover:bg-white/50 rounded transition"
                    >
                      {week.isExpanded ? (
                        <ChevronDown size={20} className="text-indigo-600" />
                      ) : (
                        <ChevronRight size={20} className="text-indigo-600" />
                      )}
                    </button>
                    <h3 className="text-lg font-bold text-indigo-900">{week.title}</h3>
                    <span className="text-sm text-indigo-600 bg-white px-3 py-1 rounded-full font-medium">
                      {week.lessons.length} buổi học
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openAddLessonModal(week.id)}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition flex items-center gap-1"
                    >
                      <Plus size={16} /> Thêm buổi học
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setWeekMenuOpen(weekMenuOpen === week.id ? null : week.id)}
                        className="p-2 hover:bg-white/50 rounded-lg transition"
                      >
                        <MoreVertical size={20} className="text-gray-600" />
                      </button>
                      {weekMenuOpen === week.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
                          <button
                            onClick={() => openEditWeekModal(week)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit2 size={16} className="text-blue-600" />
                            <span>Sửa tên tuần</span>
                          </button>
                          <button
                            onClick={() => handleDeleteWeek(week.id)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                          >
                            <Trash2 size={16} />
                            <span>Xóa tuần</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lessons */}
              {week.isExpanded && (
                <div className="p-4">
                  {week.lessons.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">Chưa có buổi học nào trong tuần này</p>
                      <button
                        onClick={() => openAddLessonModal(week.id)}
                        className="mt-3 text-indigo-600 text-sm font-medium hover:text-indigo-700"
                      >
                        + Thêm buổi học đầu tiên
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {week.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="ml-8 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition"
                        >
                          {/* Lesson Header */}
                          <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                            <h4 className="font-bold text-slate-800">{lesson.title}</h4>
                            <div className="relative">
                              <button
                                onClick={() => setLessonMenuOpen(lessonMenuOpen === lesson.id ? null : lesson.id)}
                                className="p-1 hover:bg-gray-100 rounded transition"
                              >
                                <MoreVertical size={18} className="text-gray-600" />
                              </button>
                              {lessonMenuOpen === lesson.id && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
                                  <button
                                    onClick={() => handleDeleteLesson(week.id, lesson.id)}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                  >
                                    <Trash2 size={16} />
                                    <span>Xóa buổi học</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Lesson Content */}
                          <div className="p-4 space-y-4">
                            {/* Files Section - Always Displayed */}
                            <div>
                              <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <FileText size={16} />
                                Tài liệu
                              </h5>
                              {lesson.files.length === 0 ? (
                                <button
                                  onClick={() => handleOpenFilePicker(week.id, lesson.id)}
                                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-center group"
                                >
                                  <Upload className="mx-auto text-gray-400 group-hover:text-blue-600 transition mb-1" size={20} />
                                  <p className="text-sm font-medium text-gray-500 group-hover:text-blue-700">Tải lên tài liệu</p>
                                </button>
                              ) : (
                                <div className="space-y-2">
                                  {lesson.files.map((file) => (
                                    <div
                                      key={file.id}
                                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition group"
                                    >
                                      <a
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 flex-1 min-w-0"
                                      >
                                        <FileText size={18} className="text-blue-600 flex-shrink-0" />
                                        <span className="text-sm text-gray-700 truncate font-medium">{file.name}</span>
                                      </a>
                                      <button
                                        onClick={() => handleRemoveFile(week.id, lesson.id, file.id)}
                                        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => handleOpenFilePicker(week.id, lesson.id)}
                                    className="w-full p-2 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-center group"
                                  >
                                    <p className="text-sm font-medium text-gray-500 group-hover:text-blue-700 flex items-center justify-center gap-1">
                                      <Plus size={16} />
                                      Thêm tài liệu
                                    </p>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Assignments Section - Always Displayed */}
                            <div>
                              <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <LinkIcon size={16} />
                                Bài tập
                              </h5>
                              {lesson.assignments.length === 0 ? (
                                <button
                                  onClick={() => openAssignmentManager(week.id, lesson.id)}
                                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition text-center group"
                                >
                                  <Plus className="mx-auto text-gray-400 group-hover:text-indigo-600 transition mb-1" size={20} />
                                  <p className="text-sm font-medium text-gray-500 group-hover:text-indigo-700">Giao bài tập</p>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAssignmentClick(lesson.assignments[0].id)}
                                  className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 transition text-left shadow-sm"
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <FileText size={18} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-gray-800 truncate">{lesson.assignments[0].title}</p>
                                      {lesson.assignments[0].dueDate && (
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                          <Clock size={12} />
                                          Hạn: {format(new Date(lesson.assignments[0].dueDate), 'dd/MM/yyyy HH:mm')}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <ChevronRight size={20} className="text-gray-400 flex-shrink-0" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Week Modal */}
      {showWeekModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {editingWeek ? 'Sửa tên tuần học' : 'Thêm tuần học mới'}
            </h3>
            <input
              type="text"
              value={newWeekTitle}
              onChange={(e) => setNewWeekTitle(e.target.value)}
              placeholder="VD: Tuần 1: Giới thiệu khóa học"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowWeekModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveWeek}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition"
              >
                {editingWeek ? 'Cập nhật' : 'Thêm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      {showLessonModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Thêm buổi học mới</h3>
            <input
              type="text"
              value={newLessonTitle}
              onChange={(e) => setNewLessonTitle(e.target.value)}
              placeholder="VD: Buổi 1: Làm quen với SAT"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLessonModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveLesson}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition"
              >
                Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Assignment Manager Modal */}
      {showAssignmentManager && (
        <TestAssignmentManager
          onClose={() => {
            setShowAssignmentManager(false);
            setCurrentLessonForAssignment(null);
          }}
          onSubmit={handleAssignmentSubmit}
        />
      )}
    </div>
  );
};

export default WeeklyProgress;
