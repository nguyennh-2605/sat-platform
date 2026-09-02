import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Clock, Link as LinkIcon, Send, Github, Globe, YoutubeIcon, Edit, MoreHorizontal, Trash2, ClipboardList, ChevronRight, TriangleAlert, CheckCircle2, CircleDashed, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import { capitalizeFirstLetter } from '../../utils/text';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Tabs } from '../../components/ui/AppUI';
import { useDashboardBack } from '../navigation/DashboardBackContext';
import { Textarea } from '../../components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
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

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTestsModal, setShowTestsModal] = useState(false);
  const [submissionType, setSubmissionType] = useState<'TEXT' | 'FILE'>('TEXT');
  const [submissionContent, setSubmissionContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  useDashboardBack(() => navigate(`/dashboard/class/${classId}`));

  const fetchAssignmentDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get<unknown, APIResponse>(`/api/assignments/${assignmentId}`);
      setAssignment(res.data);
    } catch (error) {
      console.error(error);
      toast.error("Unable to load assignment");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    if (assignmentId) {
      fetchAssignmentDetail();
    }
  }, [assignmentId, fetchAssignmentDetail]);

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
    } catch {
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

  if (loading) return <div className="mx-auto max-w-screen-2xl space-y-4 p-4 md:p-6" aria-label="Loading assignment"><div className="h-24 animate-pulse rounded-card bg-muted" /><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="h-72 animate-pulse rounded-card bg-muted" /><div className="h-64 animate-pulse rounded-card bg-muted" /></div></div>;

  if (!assignment) {
    return <div className="mx-auto max-w-screen-2xl p-4 md:p-6"><EmptyState icon={<TriangleAlert size={24} />} title="Assignment not found" description="This assignment may have been deleted or the link is invalid." /></div>;
  }

  const hasAttachments = Boolean(assignment.fileUrls?.length || assignment.links?.length);
  const isStudent = userRole === 'STUDENT';

  return (
    <div className="h-full overflow-y-auto bg-background">
      <main className="mx-auto flex max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
        <PageHeader
          title={assignment.title}
          description={<span className="flex flex-wrap items-center gap-x-4 gap-y-1"><span>Posted {format(parseISO(assignment.createdAt), 'MMM d, yyyy')}</span><span className="inline-flex items-center gap-1"><Clock size={14} />{assignment.deadline ? `Due ${format(parseISO(assignment.deadline), 'MMM d, yyyy · HH:mm')}` : 'No due date'}</span></span>}
          actions={userRole !== 'STUDENT' ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Assignment actions"><MoreHorizontal size={17} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setShowEditModal(true)}><Edit />Edit assignment</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => setShowDeleteModal(true)}><Trash2 />Delete assignment</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : undefined}
        />

        <div className={`grid gap-4 ${isStudent ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
          <div className="min-w-0 space-y-4">
            <Card className="p-5 md:p-6">
              <div className="prose max-w-none text-foreground marker:text-foreground" dangerouslySetInnerHTML={{ __html: assignment.content || '' }} />
            </Card>

            {hasAttachments && <Card className="p-5 md:p-6"><h2 className="text-base font-semibold text-foreground">Attachments</h2><p className="mt-1 text-sm text-muted-foreground">Files and links shared with this assignment.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                        } catch {
                          // Keep the original URL and fallback label when metadata cannot be parsed.
                        }

                        return (
                          <a key={`file-${idx}`} href={cleanUrl} target="_blank" rel="noreferrer" 
                             className="group flex items-start gap-3 rounded-control border border-ui-border p-3 transition-colors hover:bg-muted">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-muted">
                              <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" 
                                alt="Google Drive" 
                                className="w-6 h-6 object-contain"
                              />
                            </div>
                            <div className="min-w-0"><span className="block truncate text-sm font-medium text-foreground group-hover:underline">{fileName}</span><span className="mt-0.5 block text-xs text-muted-foreground">{fileTypeLabel}</span></div>
                          </a>
                        );
                      })}
              {assignment.links?.map((link: string, idx: number) => (
                          <a key={`link-${idx}`} href={link} target="_blank" rel="noreferrer" 
                             className="group flex items-start gap-3 rounded-control border border-ui-border p-3 transition-colors hover:bg-muted">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-muted">
                              {getLinkIcon(link)}
                            </div>
                            <div className="min-w-0"><span className="block text-sm font-medium text-foreground group-hover:underline">External link</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{link}</span></div>
                          </a>
              ))}
            </div></Card>}

            {!isStudent && assignment.studentWork && <Card className="overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-ui-border px-5 py-4"><div><h2 className="text-base font-semibold text-foreground">Student work</h2><p className="mt-0.5 text-xs text-muted-foreground">{assignment.studentWork.filter(item => item.submitted).length} of {assignment.studentWork.length} submitted</p></div><Badge tone="neutral">Teacher check</Badge></div><div className="divide-y divide-ui-border">{assignment.studentWork.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No students are enrolled in this class.</p> : assignment.studentWork.map(item => <div key={item.student.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center"><span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${item.submitted ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{item.submitted ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{item.student.name || item.student.email}</p><p className="truncate text-xs text-muted-foreground">{item.student.email}</p></div><div className="flex items-center justify-between gap-3 sm:justify-end"><span className="text-xs text-muted-foreground">{item.submittedAt ? format(parseISO(item.submittedAt), 'MMM d, yyyy · HH:mm') : 'Not submitted'}</span>{item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Open work<ExternalLink size={12} /></a>}</div>{item.textResponse && <p className="rounded-control bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground sm:max-w-sm">{item.textResponse}</p>}</div>)}</div></Card>}

          {assignment.selectedTests && assignment.selectedTests.length > 0 && (
            <button onClick={() => setShowTestsModal(true)} className="flex w-full items-center gap-3 rounded-card border border-ui-border bg-surface p-4 text-left transition-colors hover:bg-muted"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary"><ClipboardList size={18} /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-foreground">Attached tests ({assignment.selectedTests.length})</span><span className="block text-sm text-muted-foreground">View the full list of assigned tests</span></span><ChevronRight size={18} className="text-muted-foreground" /></button>
          )}
          </div>

          {isStudent && <Card className="h-fit p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-foreground">Your assignment</h2><Badge tone="warning">Assigned</Badge></div><Tabs className="mt-4 grid w-full grid-cols-2" items={[{ value: 'TEXT' as const, label: 'Write response' }, { value: 'FILE' as const, label: 'Share link' }]} value={submissionType} onValueChange={setSubmissionType} ariaLabel="Submission type" tabClassName="w-full" /><div className="mt-4">{submissionType === 'TEXT' ? <Textarea rows={6} placeholder="Write your response here…" value={submissionContent} onChange={event => setSubmissionContent(event.target.value)} /> : <div className="relative"><LinkIcon size={16} className="pointer-events-none absolute left-3 top-3 text-muted-foreground" /><Input className="w-full pl-9" placeholder="Paste a Google Drive or Docs link…" value={submissionContent} onChange={event => setSubmissionContent(event.target.value)} /></div>}<Button className="mt-4 w-full" onClick={handleSubmitAssignment} disabled={isSubmitting || !submissionContent.trim()}>{isSubmitting ? 'Submitting…' : <><Send size={16} />Submit assignment</>}</Button></div></Card>}
        </div>
      </main>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} closeOnBackdrop title="Delete assignment?" subtitle="This also permanently deletes all student submissions." footer={<><Button variant="ghost" onClick={() => setShowDeleteModal(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete}>Delete permanently</Button></>}><p className="text-sm text-muted-foreground">You are about to delete <span className="font-medium text-foreground">{assignment.title}</span>. This action cannot be undone.</p></Modal>
      {showEditModal && (
        <AnnouncementCreator
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdateAssignment}
          initialData={assignment}
        />
      )}
      <Modal open={showTestsModal && Boolean(assignment.selectedTests)} onClose={() => setShowTestsModal(false)} closeOnBackdrop presentation="content-dialog" title="Attached tests" subtitle="Tests included in this assignment." footer={<Button variant="ghost" onClick={() => setShowTestsModal(false)}>Close</Button>}>
            <div className="space-y-3">
              {assignment.selectedTests?.map((test) => (
                <Card key={test.id} className="p-4"><div className="flex items-start justify-between gap-3"><h4 className="font-semibold text-foreground">{capitalizeFirstLetter(test.title)}</h4><Badge tone={test.mode === 'EXAM' ? 'danger' : 'green'}>{test.mode}</Badge></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>Subject: {test.subject}</span>
                    <span>Duration: {test.duration} min</span>
                    <span>Questions: {test.questionCount}</span>
                  </div><Button size="sm" className="mt-3" onClick={() => navigate(`/test/${test.id}?${test.deliveryId ? `deliveryId=${test.deliveryId}` : `assignmentId=${assignment.id}`}`)}>Start this test</Button></Card>
              ))}
            </div>
      </Modal>
    </div>
  );
};

export default AssignmentDetail;
