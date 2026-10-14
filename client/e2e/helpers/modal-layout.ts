import { expect, type Locator } from '@playwright/test';

export async function expectViewportModal(dialog: Locator) {
  await expect(dialog).toBeVisible();
  // One browser frame avoids mixing bounds while a dialog opens or the sidebar animates.
  await expect.poll(() => dialog.evaluate(element => {
    const box = element.getBoundingClientRect();
    return {
      centeredX: Math.abs(box.x + box.width / 2 - innerWidth / 2) < 1,
      centeredY: Math.abs(box.y + box.height / 2 - innerHeight / 2) < 1,
      withinViewport: box.x >= 0 && box.y >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
    };
  })).toEqual({ centeredX: true, centeredY: true, withinViewport: true });
}
