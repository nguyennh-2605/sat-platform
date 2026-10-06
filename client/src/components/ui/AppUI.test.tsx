import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './AppUI';

afterEach(cleanup);

describe('Modal outside dismissal', () => {
  it.each(['dialog', 'content-dialog'] as const)('closes %s by default and restores focus and scrolling', presentation => {
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open modal</button>
          <Modal open={open} title="Example" presentation={presentation} onClose={() => setOpen(false)}>
            <input aria-label="Name" />
          </Modal>
        </>
      );
    }

    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Open modal' });
    trigger.focus();
    const previousOverflow = document.body.style.overflow;
    fireEvent.click(trigger);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.pointerDown(screen.getByRole('dialog').parentElement!);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe(previousOverflow);
  });

  it('does not dismiss when interacting inside the dialog', () => {
    const onClose = vi.fn();
    render(<Modal open title="Example" onClose={onClose}><input aria-label="Name" /></Modal>);

    fireEvent.pointerDown(screen.getByRole('dialog'));
    fireEvent.pointerDown(screen.getByRole('textbox', { name: 'Name' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses the same guarded close callback as Escape and the close button', () => {
    const onClose = vi.fn();
    render(<Modal open title="Unsaved changes" onClose={onClose}>Draft</Modal>);

    fireEvent.pointerDown(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('resumes outside dismissal once an in-flight operation finishes', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Modal open title="Saving" onClose={onClose} closeOnBackdrop={false}>Draft</Modal>);
    fireEvent.pointerDown(screen.getByRole('dialog').parentElement!);
    expect(onClose).not.toHaveBeenCalled();

    rerender(<Modal open title="Saved" onClose={onClose} closeOnBackdrop>Draft</Modal>);
    fireEvent.pointerDown(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
