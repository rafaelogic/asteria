import { useEffect, useRef } from "react";
import { CopyIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";

export interface DialogModel {
  title: string;
  detail: string;
  tone?: "default" | "danger";
  confirmLabel?: string;
  cancelLabel?: string;
  copyable?: boolean;
  onConfirm?: () => void;
}

export function AppDialog({ model, onClose }: { model: DialogModel | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!model) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    node?.querySelector<HTMLElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== "Tab" || !node) return;
      const controls = [...node.querySelectorAll<HTMLElement>("button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])")];
      if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [model]);
  if (!model) return null;
  return <div className="modal-backdrop dialog-backdrop" onMouseDown={onClose}>
    <section ref={dialogRef} className="app-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-detail" onMouseDown={(event) => event.stopPropagation()}>
      <header><span className={`dialog-symbol ${model.tone === "danger" ? "danger" : ""}`}><WarningCircleIcon weight="duotone" /></span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><XIcon /></button></header>
      <h2 id="app-dialog-title">{model.title}</h2>
      <p id="app-dialog-detail">{model.detail}</p>
      <div className="dialog-actions">
        {model.copyable && <button className="button ghost" onClick={() => void navigator.clipboard.writeText(model.detail)}><CopyIcon /> Copy error</button>}
        <span />
        <button className="button secondary" onClick={onClose}>{model.cancelLabel ?? "Close"}</button>
        {model.onConfirm && <button className={model.tone === "danger" ? "danger-button" : "button primary"} onClick={() => { model.onConfirm?.(); onClose(); }}>{model.confirmLabel ?? "Continue"}</button>}
      </div>
    </section>
  </div>;
}
