type Props = {
  open: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
};

export function UndoBanner({ open, message, onUndo, onDismiss }: Props) {
  if (!open) return null;
  return (
    <div className="undo-pop" role="status">
      <p className="undo-pop-message">{message}</p>
      <div className="undo-pop-actions">
        <button type="button" className="btn btn-sm secondary" onClick={onUndo}>
          Undo
        </button>
        <button type="button" className="btn btn-sm linkish" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
