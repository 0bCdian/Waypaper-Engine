import { forwardRef, useRef, useImperativeHandle, useCallback } from "react";
import NeoCloseButton from "./NeoCloseButton";
import { ModalStripedHeader } from "./ModalStripedHeader";
import type { ModalStripedHeaderProps } from "./ModalStripedHeader";

export interface ModalHandle {
  showModal: () => void;
  close: () => void;
}

interface ModalProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  /** When false, omit the floating close control unless `stripedHeader` supplies an in-header close */
  showCloseButton?: boolean;
  stripedHeader?: ModalStripedHeaderProps;
  /** Passthrough native `dialog.draggable`; useful for kiosk-style shell */
  draggable?: boolean;
}

const Modal = forwardRef<ModalHandle, ModalProps>(
  (
    {
      id,
      children,
      className,
      onClose,
      showCloseButton = true,
      stripedHeader,
      draggable,
    },
    ref,
  ) => {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useImperativeHandle(ref, () => ({
      showModal: () => dialogRef.current?.showModal(),
      close: () => dialogRef.current?.close(),
    }));

    const handleClose = useCallback(() => {
      dialogRef.current?.close();
      onClose?.();
    }, [onClose]);

    const floatingClose =
      Boolean(showCloseButton) && stripedHeader === undefined ? (
        <NeoCloseButton onClick={handleClose} />
      ) : null;

    return (
      <dialog draggable={draggable} id={id} className="modal" ref={dialogRef}>
        <div className={className ?? "modal-box"}>
          {stripedHeader !== undefined ? (
            <ModalStripedHeader {...stripedHeader} onClose={handleClose} />
          ) : null}
          {floatingClose}
          {children}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={handleClose}>
            close
          </button>
        </form>
      </dialog>
    );
  },
);

Modal.displayName = "Modal";

export default Modal;
export type { ModalStripedHeaderProps } from "./ModalStripedHeader";
