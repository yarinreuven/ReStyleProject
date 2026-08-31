import useDialogFocus from "../hooks/useDialogFocus";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  icon = "fa-triangle-exclamation",
  busy = false,
  onCancel,
  onConfirm
}) {
  const dialogRef = useDialogFocus(open, onCancel, !busy);
  if (!open) return null;

  return (
    <div
      className="confirm-dialog-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="confirm-dialog-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <span className="confirm-dialog-icon"><i className={`fa-solid ${icon}`} /></span>
        <small>PLEASE CONFIRM</small>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-description">{description}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="confirm-dialog-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="confirm-dialog-submit" onClick={onConfirm} disabled={busy}>
            {busy ? <><span className="confirm-dialog-spinner" /> Please wait…</> : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
