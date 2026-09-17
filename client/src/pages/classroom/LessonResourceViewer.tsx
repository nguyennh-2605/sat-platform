import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Image as ImageIcon, LoaderCircle, TriangleAlert, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import axiosClient from '@/lib/axios';

type ResourceKind = 'FILE' | 'VIDEO' | 'LINK' | 'EMBED';

export interface ViewerResource {
  id: string;
  name: string;
  url: string;
  kind: ResourceKind;
  mimeType: string | null;
  fileAssetId: string | null;
}

export interface ViewerBlock {
  id: string;
  resource: ViewerResource;
  completed: boolean;
}

interface FileAccess {
  url: string;
  expiresInSeconds: number;
  asset: { id: string; name: string; mimeType: string; sizeBytes: number; status: string };
}

const errorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return data?.error || data?.message || fallback;
};

const videoEmbedUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) {
      const id = url.searchParams.get('v') || (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/') ? url.pathname.split('/').filter(Boolean).at(-1) : null);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (url.hostname === 'vimeo.com' || url.hostname.endsWith('.vimeo.com')) {
      const id = url.pathname.split('/').filter(Boolean).find(part => /^\d+$/.test(part));
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (url.hostname === 'loom.com' || url.hostname.endsWith('.loom.com')) {
      const id = url.pathname.split('/').filter(Boolean).at(-1);
      return id ? `https://www.loom.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
};

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const isInlineDocument = (mimeType: string) => mimeType === 'application/pdf' || mimeType === 'text/plain' || mimeType === 'text/csv';

export function LessonResourceViewer({ block, canManage, onClose, onProgress }: {
  block: ViewerBlock | null;
  canManage: boolean;
  onClose: () => void;
  onProgress: (blockId: string, completed: boolean) => Promise<void>;
}) {
  const [access, setAccess] = useState<FileAccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progressSaving, setProgressSaving] = useState(false);

  useEffect(() => {
    if (!block) return;
    let active = true;
    setAccess(null);
    setLoadError(null);
    if (!block.resource.fileAssetId) return;
    setLoading(true);
    axiosClient.get<{ success: boolean; data: FileAccess }>(`/api/files/${block.resource.fileAssetId}/access`)
      .then(response => { if (active) setAccess(response.data); })
      .catch(error => { if (active) setLoadError(errorMessage(error, 'Unable to prepare this file for preview.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [block]);

  useEffect(() => {
    if (!block || canManage) return;
    void onProgress(block.id, false);
  }, [block, canManage, onProgress]);

  if (!block) return null;
  const resource = block.resource;
  const sourceUrl = access?.url || (!resource.fileAssetId ? resource.url : '');
  const mimeType = access?.asset.mimeType || resource.mimeType || '';
  const embedUrl = resource.kind === 'VIDEO' || resource.kind === 'EMBED' ? videoEmbedUrl(resource.url) : null;
  const canPreviewImage = mimeType.startsWith('image/');
  const canPreviewDocument = isInlineDocument(mimeType);
  const unsupportedFile = resource.kind === 'FILE' && !loading && !loadError && sourceUrl && !canPreviewImage && !canPreviewDocument;
  const externalOnly = (resource.kind === 'LINK' || resource.kind === 'EMBED') && !embedUrl;

  const openOriginal = () => {
    if (!sourceUrl) return;
    window.open(sourceUrl, '_blank', 'noopener,noreferrer');
    if (!canManage && resource.kind === 'LINK' && !block.completed) void onProgress(block.id, true);
  };

  const download = async () => {
    if (!resource.fileAssetId) return;
    try {
      const response = await axiosClient.get<{ success: boolean; data: FileAccess }>(`/api/files/${resource.fileAssetId}/access?download=1`);
      window.location.assign(response.data.url);
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to download this file.'));
    }
  };

  const markDone = async () => {
    setProgressSaving(true);
    try {
      await onProgress(block.id, true);
      onClose();
    } finally {
      setProgressSaving(false);
    }
  };

  return <Modal
    open
    closeOnBackdrop
    presentation="content-dialog"
    className="h-[min(820px,calc(100vh-2rem))] max-w-5xl"
    onClose={onClose}
    title={resource.name}
    subtitle={[resource.kind === 'VIDEO' ? 'Video' : resource.kind === 'LINK' ? 'External link' : resource.kind === 'EMBED' ? 'Embedded activity' : mimeType || 'File', access?.asset.sizeBytes ? formatBytes(access.asset.sizeBytes) : null].filter(Boolean).join(' · ')}
    footer={<>
      {resource.fileAssetId && <Button variant="outline" onClick={() => void download()}><Download />Download</Button>}
      {sourceUrl && <Button variant="outline" onClick={openOriginal}><ExternalLink />Open original</Button>}
      {!canManage && !block.completed && resource.kind !== 'LINK' && <Button disabled={progressSaving || Boolean(loadError)} onClick={() => void markDone()}>{progressSaving ? <LoaderCircle className="animate-spin" /> : null}Mark as done</Button>}
      <Button variant={canManage || block.completed || resource.kind === 'LINK' ? 'default' : 'ghost'} onClick={onClose}>Close</Button>
    </>}
  >
    <div className="flex h-full min-h-0 items-center justify-center overflow-hidden rounded-control border border-ui-border bg-muted/25">
      {loading ? <ViewerMessage icon={<LoaderCircle className="animate-spin" />} title="Preparing preview…" description="Creating a secure, temporary viewer link." />
        : loadError ? <ViewerMessage icon={<TriangleAlert />} title="Preview unavailable" description={loadError} />
          : embedUrl ? <div className="aspect-video w-full max-w-5xl overflow-hidden bg-black"><iframe src={embedUrl} title={resource.name} className="size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" referrerPolicy="strict-origin-when-cross-origin" /></div>
            : canPreviewImage ? <img src={sourceUrl} alt={resource.name} className="max-h-full max-w-full object-contain" />
              : canPreviewDocument ? <iframe src={sourceUrl} title={resource.name} className="size-full bg-white" />
                : unsupportedFile ? <ViewerMessage icon={<FileText />} title="Preview is not available for this file type" description="Download the file or open the original to view it in a compatible app." />
                  : externalOnly ? <ViewerMessage icon={<ExternalLink />} title="This resource opens on another website" description="For security, general links are not embedded inside the learning workspace." />
                    : <ViewerMessage icon={resource.kind === 'VIDEO' ? <Video /> : <ImageIcon />} title="Preview unavailable" description="Open the original resource to continue." />}
    </div>
  </Modal>;
}

function ViewerMessage({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="flex max-w-md flex-col items-center px-6 py-12 text-center"><span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden="true">{icon}</span><h3 className="mt-4 text-title font-semibold text-foreground">{title}</h3><p className="mt-1 text-body leading-6 text-muted-foreground">{description}</p></div>;
}
