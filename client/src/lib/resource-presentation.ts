export type LinkIconKey =
  | 'box'
  | 'canva'
  | 'dropbox'
  | 'figma'
  | 'github'
  | 'google-docs'
  | 'google-drive'
  | 'google-sheets'
  | 'google-slides'
  | 'khan-academy'
  | 'loom'
  | 'notion'
  | 'onedrive'
  | 'quizlet'
  | 'vimeo'
  | 'youtube'
  | 'website';

export type FileIconKey = 'archive' | 'code' | 'document' | 'file' | 'image' | 'presentation' | 'spreadsheet';

export interface LinkPresentation {
  label: string;
  icon: LinkIconKey;
}

const providerRules: Array<{ matches: (url: URL) => boolean; presentation: LinkPresentation }> = [
  { matches: url => url.hostname === 'docs.google.com' && url.pathname.startsWith('/document/'), presentation: { label: 'Google Docs', icon: 'google-docs' } },
  { matches: url => url.hostname === 'docs.google.com' && url.pathname.startsWith('/spreadsheets/'), presentation: { label: 'Google Sheets', icon: 'google-sheets' } },
  { matches: url => url.hostname === 'docs.google.com' && url.pathname.startsWith('/presentation/'), presentation: { label: 'Google Slides', icon: 'google-slides' } },
  { matches: url => url.hostname === 'drive.google.com' || url.hostname === 'docs.google.com', presentation: { label: 'Google Drive', icon: 'google-drive' } },
  { matches: url => ['youtube.com', 'www.youtube.com', 'youtu.be'].includes(url.hostname), presentation: { label: 'YouTube', icon: 'youtube' } },
  { matches: url => ['github.com', 'www.github.com'].includes(url.hostname), presentation: { label: 'GitHub', icon: 'github' } },
  { matches: url => url.hostname === 'figma.com' || url.hostname.endsWith('.figma.com'), presentation: { label: 'Figma', icon: 'figma' } },
  { matches: url => url.hostname === 'dropbox.com' || url.hostname.endsWith('.dropbox.com'), presentation: { label: 'Dropbox', icon: 'dropbox' } },
  { matches: url => url.hostname === 'notion.so' || url.hostname.endsWith('.notion.so') || url.hostname === 'notion.site' || url.hostname.endsWith('.notion.site'), presentation: { label: 'Notion', icon: 'notion' } },
  { matches: url => url.hostname === 'box.com' || url.hostname.endsWith('.box.com'), presentation: { label: 'Box', icon: 'box' } },
  { matches: url => url.hostname === 'khanacademy.org' || url.hostname.endsWith('.khanacademy.org'), presentation: { label: 'Khan Academy', icon: 'khan-academy' } },
  { matches: url => url.hostname === 'quizlet.com' || url.hostname.endsWith('.quizlet.com'), presentation: { label: 'Quizlet', icon: 'quizlet' } },
  { matches: url => url.hostname === 'vimeo.com' || url.hostname.endsWith('.vimeo.com'), presentation: { label: 'Vimeo', icon: 'vimeo' } },
  { matches: url => url.hostname === 'loom.com' || url.hostname.endsWith('.loom.com'), presentation: { label: 'Loom', icon: 'loom' } },
  { matches: url => url.hostname === 'canva.com' || url.hostname.endsWith('.canva.com'), presentation: { label: 'Canva', icon: 'canva' } },
  { matches: url => url.hostname === '1drv.ms' || url.hostname.endsWith('.sharepoint.com') || url.hostname.endsWith('.onedrive.com'), presentation: { label: 'OneDrive', icon: 'onedrive' } },
];

function safeUrl(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function getLinkPresentation(value?: string | null): LinkPresentation {
  const url = safeUrl(value);
  if (!url) return { label: 'External link', icon: 'website' };
  return providerRules.find(rule => rule.matches(url))?.presentation || { label: displayHost(value || ''), icon: 'website' };
}

export function displayHost(value: string) {
  const url = safeUrl(value);
  return url ? url.hostname.replace(/^www\./, '') : value;
}

export function fileNameFromUrl(value: string, index: number) {
  const url = safeUrl(value);
  if (!url) return `File ${index + 1}`;
  const encodedName = url.searchParams.get('name') || url.pathname.split('/').filter(Boolean).at(-1) || `File ${index + 1}`;
  try {
    return decodeURIComponent(encodedName);
  } catch {
    return encodedName;
  }
}

export function fileTypeLabel(mimeType: string, fileName = '') {
  const extension = fileName.split('.').at(-1)?.toUpperCase();
  const labels: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-powerpoint': 'PPT',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/webp': 'WEBP',
  };
  return labels[mimeType] || extension || 'File';
}

export function getFileIconKey(mimeType = '', fileName = ''): FileIconKey {
  const extension = fileName.split('.').at(-1)?.toLowerCase() || '';
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extension)) return 'image';
  if (mimeType === 'application/pdf' || ['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension)) return 'document';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || ['xls', 'xlsx', 'csv'].includes(extension)) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || ['ppt', 'pptx'].includes(extension)) return 'presentation';
  if (mimeType.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'archive';
  if (mimeType.includes('javascript') || mimeType.includes('json') || ['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py'].includes(extension)) return 'code';
  return 'file';
}
