import axiosClient from '../../lib/axios';
import type { ContentBlock } from '../../types/quiz';

interface ImageAccessResponse {
  success: boolean;
  data: { url: string; expiresInSeconds: number };
}

interface CachedImageAccess {
  url: string;
  expiresAt: number;
}

const EXPIRY_SAFETY_MS = 30_000;
const MAX_CACHE_ENTRIES = 256;
const accessCache = new Map<string, CachedImageAccess>();
const pendingAccess = new Map<string, Promise<string>>();

const pruneAccessCache = (now: number) => {
  for (const [assetId, entry] of accessCache) {
    if (entry.expiresAt <= now) accessCache.delete(assetId);
  }
  while (accessCache.size >= MAX_CACHE_ENTRIES) {
    const oldestAssetId = accessCache.keys().next().value as string | undefined;
    if (!oldestAssetId) break;
    accessCache.delete(oldestAssetId);
  }
};

export const getManagedImageUrl = async (assetId: string) => {
  const now = Date.now();
  const cached = accessCache.get(assetId);
  if (cached && cached.expiresAt > now) return cached.url;

  const pending = pendingAccess.get(assetId);
  if (pending) return pending;

  const request = axiosClient
    .get<ImageAccessResponse, ImageAccessResponse>(`/api/test-images/${encodeURIComponent(assetId)}/access`)
    .then(response => {
      const ttlMs = Math.max(0, response.data.expiresInSeconds * 1_000 - EXPIRY_SAFETY_MS);
      pruneAccessCache(Date.now());
      accessCache.set(assetId, { url: response.data.url, expiresAt: Date.now() + ttlMs });
      return response.data.url;
    })
    .finally(() => pendingAccess.delete(assetId));

  pendingAccess.set(assetId, request);
  return request;
};

export const preloadManagedImageAssets = async (blocks: ContentBlock[]) => {
  const assetIds = [...new Set(blocks.flatMap(block => (
    block.type === 'image' && block.assetId ? [block.assetId] : []
  )))];

  await Promise.all(assetIds.map(async assetId => {
    try {
      const url = await getManagedImageUrl(assetId);
      if (typeof Image !== 'undefined') {
        const image = new Image();
        image.decoding = 'async';
        image.src = url;
      }
    } catch {
      // The visible image keeps its own retry/error state.
    }
  }));
};

export const clearManagedImageAccessCache = () => {
  accessCache.clear();
  pendingAccess.clear();
};
