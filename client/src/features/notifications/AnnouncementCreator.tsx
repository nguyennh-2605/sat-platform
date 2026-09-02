import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import useDrivePicker from 'react-google-drive-picker';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { type AssignmentProps } from '../../types/quiz';
import { DateTimePicker } from '../../components/ui/DateTimePicker';
import { Button, Card, Input } from '../../components/ui/AppUI';

interface AnnouncementCreatorProps {
  onClose: () => void;
  onSubmit: (data: { title: string; content: string; deadline: string | null; fileUrls: string[]; links: string[]; type?: 'assignment' | 'announcement' }) => void;
  initialData?: AssignmentProps;
  kind?: 'post' | 'homework';
}

const AnnouncementCreator = ({ onClose, onSubmit, initialData, kind = 'post' }: AnnouncementCreatorProps) => {
  const [links, setLinks] = useState<string[]>([]);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const [driveFiles, setDriveFiles] = useState<{ name: string, url: string }[]>([]);
  const [openPicker, authResponse] = useDrivePicker();

  const [form, setForm] = useState({ title: '', content: '', deadline: '' });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title || '',
        content: initialData.content || '',
        deadline: initialData.deadline ? new Date(initialData.deadline).toISOString() : ''
      });

      setLinks(initialData.links || []);

      if (initialData.fileUrls && initialData.fileUrls.length > 0) {
        const recoveredFiles = initialData.fileUrls.map((urlStr: string) => {
          try {
            const urlObj = new URL(urlStr);
            const filename = urlObj.searchParams.get('name');
            return {
              name: filename ? decodeURIComponent(filename) : 'Attachment',
              url: urlStr
            };
          } catch {
            return { name: 'Attachment', url: urlStr };
          }
        });
        setDriveFiles(recoveredFiles);
      }
    }
  }, [initialData]);

  const handleOpenDrivePicker = () => {
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
          setDriveFiles((prev) => [...prev, ...pickedFiles]);
        }
      },
    });
  };

  const removeDriveFile = (indexToRemove: number) => {
    setDriveFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleAddLink = () => {
    if (linkUrl.trim() !== '') {
      setLinks((prev) => [...prev, linkUrl.trim()]);
      setLinkUrl('');
      setShowLinkInput(false);
    }
  };

  const removeLink = (indexToRemove: number) => {
    setLinks((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error("Enter a title");
    if (!form.content || form.content === '<p><br></p>') return toast.error("Enter content");

    const formattedFileUrls = driveFiles.map(f => {
      try {
        setIsSubmitting(true);
        const urlObj = new URL(f.url);
        urlObj.searchParams.set('name', f.name);
        return urlObj.toString();
      } catch {
        return `${f.url}${f.url.includes('?') ? '&' : '?'}name=${encodeURIComponent(f.name)}`;
      } finally {
        setIsSubmitting(false);
      }
    });

    onSubmit({
      ...form,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      fileUrls: formattedFileUrls,
      links: links,
      type: kind === 'homework' ? 'assignment' : undefined,
    });
  };

  return (
    <div className="absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden bg-background animate-in slide-in-from-bottom-4 duration-300">

      {/* HEADER SECTION */}
      <header className="z-30 flex h-12 w-full flex-none items-center justify-between border-b border-ui-border bg-surface px-4 md:px-6">
        <div className="flex items-center gap-2 md:gap-4">
          <Button onClick={onClose} variant="ghost" size="icon" className="h-8 w-8" aria-label="Close post editor"><X size={18} /></Button>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {isEditMode ? 'Edit post' : kind === 'homework' ? 'New assignment' : 'New post'}
          </h2>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="sm"
        >
          <span className="hidden sm:inline">{isEditMode ? 'Save changes' : 'Publish'}</span>
        </Button>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-screen-2xl p-4 pb-20 md:p-6">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CỘT TRÁI: Nhập văn bản */}
            <div className="lg:col-span-2 space-y-6">

              {/* 1. Ô NHẬP TIÊU ĐỀ */}
              <label className="block"><span className="mb-2 block text-sm font-medium text-foreground">Post title</span>
                  <Input
                    type="text"
                    id="post-title"
                    placeholder={kind === 'homework' ? 'Assignment title…' : 'Post title…'}
                    className="w-full"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                  />
              </label>

              {/* 2. KHU VỰC NỘI DUNG */}
              <div>
                <label className="mb-3 ml-1 block text-sm font-medium text-foreground">
                  Content
                </label>
                <div className="
                  overflow-hidden rounded-card border border-ui-border bg-surface shadow-xs transition-colors focus-within:border-primary
                  [&_.ql-container.ql-snow]:border-none
                  [&_.ql-toolbar.ql-snow]:border-b [&_.ql-toolbar.ql-snow]:border-ui-border
                  [&_.ql-editor]:font-sans [&_.ql-editor]:text-base [&_.ql-editor]:text-foreground
                ">
                  <ReactQuill
                    theme="snow"
                    value={form.content}
                    onChange={(content) => setForm({ ...form, content })}
                    placeholder="Add details or instructions…"
                    className="mb-12"
                    modules={{
                      toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['clean']
                      ],
                    }}
                  />
                </div>
              </div>

            </div>

            {/* CỘT PHẢI: Cài đặt & Đính kèm */}
            <div className="space-y-6">

              <Card className="p-5">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  Due date
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">{kind === 'homework' ? 'Choose a deadline or leave it open-ended.' : 'Leave blank for an announcement without a due date.'}</p>
                <DateTimePicker
                  value={form.deadline}
                  onChange={deadline => setForm({ ...form, deadline })}
                  placeholder="Choose a due date…"
                  ariaLabel="Post due date"
                />
              </Card>

              <Card className="p-5">
                <h3 className="mb-6 flex items-center gap-2 text-sm font-semibold text-foreground">
                  Attach resources
                </h3>

                <div className="flex items-center justify-center gap-8 mb-6">
                  <button
                    type="button"
                    onClick={handleOpenDrivePicker}
                    className="flex h-[72px] w-[72px] cursor-pointer flex-col items-center justify-center rounded-full border border-ui-border transition-colors hover:bg-muted"
                  >
                    <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span className="mt-1 text-xs font-medium text-muted-foreground">Drive</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLinkInput(!showLinkInput)}
                    className="flex h-[72px] w-[72px] cursor-pointer flex-col items-center justify-center rounded-full border border-ui-border transition-colors hover:bg-muted"
                  >
                    <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    <span className="mt-1 text-xs font-medium text-muted-foreground">Link</span>
                  </button>
                </div>

                {showLinkInput && (
                  <div className="flex gap-2 mb-4 animate-in slide-in-from-top-2">
                    <Input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="Paste a link…"
                      className="min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleAddLink}
                      variant="outline"
                    >
                      Add
                    </Button>
                  </div>
                )}

                {/* DANH SÁCH FILE ĐÃ CHỌN */}
                {driveFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attachments ({driveFiles.length})</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {driveFiles.map((file, index) => (
                        <div key={index} className="group flex items-center justify-between rounded-lg border border-ui-border bg-muted p-2.5">
                          <div className="flex items-center space-x-2 overflow-hidden">
                            <svg className="h-4 w-4 shrink-0 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                            <a href={file.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate">{file.name}</a>
                          </div>
                          <button type="button" onClick={() => removeDriveFile(index)} className="text-muted-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DANH SÁCH LINK ĐÃ CHỌN */}
                {links.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attached links ({links.length})</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {links.map((link, index) => (
                        <div key={index} className="group flex items-center justify-between rounded-lg border border-ui-border bg-muted p-2.5">
                          <div className="flex items-center space-x-2 overflow-hidden">
                            <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate">{link}</a>
                          </div>
                          <button type="button" onClick={() => removeLink(index)} className="text-muted-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default AnnouncementCreator;
