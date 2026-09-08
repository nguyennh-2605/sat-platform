import type { SVGProps } from 'react';
import { Cloud, File, FileArchive, FileCode2, FileImage, FileSpreadsheet, FileText, Globe2, Palette, Presentation, type LucideIcon } from 'lucide-react';
import { siBox, siDropbox, siFigma, siGithub, siGoogledocs, siGoogledrive, siGooglesheets, siGoogleslides, siKhanacademy, siLoom, siNotion, siQuizlet, siVimeo, siYoutube, type SimpleIcon } from 'simple-icons';

import { getFileIconKey, getLinkPresentation, type FileIconKey, type LinkIconKey } from '@/lib/resource-presentation';
import { cn } from '@/lib/utils';

const brandIcons: Partial<Record<LinkIconKey, SimpleIcon>> = {
  box: siBox,
  dropbox: siDropbox,
  figma: siFigma,
  github: siGithub,
  'google-docs': siGoogledocs,
  'google-drive': siGoogledrive,
  'google-sheets': siGooglesheets,
  'google-slides': siGoogleslides,
  'khan-academy': siKhanacademy,
  loom: siLoom,
  notion: siNotion,
  quizlet: siQuizlet,
  vimeo: siVimeo,
  youtube: siYoutube,
};

const fallbackLinkIcons: Partial<Record<LinkIconKey, LucideIcon>> = {
  canva: Palette,
  onedrive: Cloud,
  website: Globe2,
};

const fileIcons: Record<FileIconKey, LucideIcon> = {
  archive: FileArchive,
  code: FileCode2,
  document: FileText,
  file: File,
  image: FileImage,
  presentation: Presentation,
  spreadsheet: FileSpreadsheet,
};

interface ResourceIconProps extends SVGProps<SVGSVGElement> {
  url?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
}

export function ResourceIcon({ url, mimeType, fileName, className, ...props }: ResourceIconProps) {
  if (url) {
    const presentation = getLinkPresentation(url);
    const brandIcon = brandIcons[presentation.icon];
    if (brandIcon) {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn('size-4 fill-current', className)} {...props}>
          <path d={brandIcon.path} />
        </svg>
      );
    }
    const LinkIcon = fallbackLinkIcons[presentation.icon] || Globe2;
    return <LinkIcon aria-hidden="true" className={className} {...props} />;
  }

  const FileIcon = fileIcons[getFileIconKey(mimeType || '', fileName || '')];
  return <FileIcon aria-hidden="true" className={className} {...props} />;
}
