import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { UnloadAction } from '../electron/capture-types';

export function ConfirmDialog({
  message,
  action,
  onAnswer,
}: {
  message: string;
  action?: UnloadAction;
  onAnswer(confirmed: boolean): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  if (typeof document === 'undefined') return null;
  // The form stays mounted inside hidden routes; its confirmation must remain visible.
  return createPortal(
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onCancel={(event) => {
        event.preventDefault();
        onAnswer(false);
      }}
    >
      <span className="preview-badge">Unsaved changes</span>
      <h2 id="confirm-title">{action ? 'Keep your setup?' : 'Replace your current draft?'}</h2>
      <p id="confirm-message">{message}</p>
      <div className="confirm-actions">
        <button
          className="secondary-button"
          type="button"
          autoFocus
          onClick={() => onAnswer(false)}
        >
          Keep editing
        </button>
        <button className="discard-button" type="button" onClick={() => onAnswer(true)}>
          {action === 'close'
            ? 'Discard and close'
            : action === 'reload'
              ? 'Discard and reload'
              : 'Replace draft'}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
