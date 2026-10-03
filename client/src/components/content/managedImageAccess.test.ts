import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../lib/axios', () => ({ default: { get } }));

import {
  clearManagedImageAccessCache,
  getManagedImageUrl,
  preloadManagedImageAssets,
} from './managedImageAccess';

describe('managed image access', () => {
  beforeEach(() => {
    clearManagedImageAccessCache();
    get.mockReset();
    get.mockResolvedValue({
      success: true,
      data: { url: 'https://images.example.test/graph.png', expiresInSeconds: 300 },
    });
  });

  it('deduplicates concurrent access requests and reuses the unexpired URL', async () => {
    const [first, second] = await Promise.all([
      getManagedImageUrl('asset-1'),
      getManagedImageUrl('asset-1'),
    ]);

    expect(first).toBe('https://images.example.test/graph.png');
    expect(second).toBe(first);
    expect(await getManagedImageUrl('asset-1')).toBe(first);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('prefetches each managed asset only once', async () => {
    await preloadManagedImageAssets([
      { type: 'image', assetId: 'asset-1', alt: 'Graph' },
      { type: 'image', assetId: 'asset-1', alt: 'Graph duplicate' },
      { type: 'text', content: 'Passage' },
    ]);

    expect(get).toHaveBeenCalledTimes(1);
  });
});
