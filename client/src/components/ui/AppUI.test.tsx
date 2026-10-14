import { useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './AppUI';

afterEach(cleanup);

describe('Modal outside dismissal', () => {
  it.each(['dialog', 'content-dialog'] as const)('restores the opener when a field autoFocuses in %s', presentation => {
    function Example() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open form</button><Modal open={open} title="Form" presentation={presentation} onClose={() => setOpen(false)}><input autoFocus aria-label="Name" /></Modal></>;
    }
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Open form' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    fireEvent.pointerDown(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('focuses a requested field and restores the trigger on Escape', async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      const inputRef = useRef<HTMLTextAreaElement>(null);
      return <><button onClick={() => setOpen(true)}>Open note</button><Modal open={open} title="Note" onClose={() => setOpen(false)} initialFocusRef={inputRef}><textarea ref={inputRef} aria-label="Note" /></Modal></>;
    }
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Open note' });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Note' })).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it.each(['dialog', 'content-dialog'] as const)('portals %s outside the sidebar and transformed page container', presentation => {
    const { container } = render(<div data-slot="sidebar-inset" style={{ transform: 'translateX(0)', overflow: 'hidden', marginLeft: '256px' }}>
      <Modal open title="Viewport centered" presentation={presentation} onClose={() => {}}>Content</Modal>
    </div>);
    const overlay = screen.getByRole('dialog').parentElement!;
    expect(overlay.parentElement).toBe(document.body);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(overlay).toHaveClass('fixed', 'inset-0', 'items-center', 'justify-center');
    expect(overlay.style.left).toBe('');
    expect(screen.getByRole('dialog')).toHaveClass('max-h-[calc(100dvh-2rem)]');
  });

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
