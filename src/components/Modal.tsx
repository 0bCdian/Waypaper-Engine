import { forwardRef, useRef, useImperativeHandle, useCallback } from "react";
import NeoCloseButton from "./NeoCloseButton";

export interface ModalHandle {
  showModal: () => void;
  close: () => void;
}

interface ModalProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  /** When false, omit the floating close control (caller supplies one in content). */
  showCloseButton?: boolean;
}

const Modal = forwardRef<ModalHandle, ModalProps>(
  ({ id, children, className, onClose, showCloseButton = true }, ref) => {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useImperativeHandle(ref, () => ({
      showModal: () => dialogRef.current?.showModal(),
      close: () => dialogRef.current?.close(),
    }));

    const handleClose = useCallback(() => {
      dialogRef.current?.close();
      onClose?.();
    }, [onClose]);

    return (
      <dialog id={id} className="modal" ref={dialogRef}>
        <div className={className ?? "modal-box"}>
          {showCloseButton ? <NeoCloseButton onClick={handleClose} /> : null}
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
