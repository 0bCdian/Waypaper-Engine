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
}

const Modal = forwardRef<ModalHandle, ModalProps>(({ id, children, className, onClose }, ref) => {
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
        <NeoCloseButton onClick={handleClose} />
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={handleClose}>
          close
        </button>
      </form>
    </dialog>
  );
});

Modal.displayName = "Modal";

export default Modal;
