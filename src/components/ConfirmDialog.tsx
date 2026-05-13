import { useEffect, useRef, useState } from "react";
import { create } from "zustand";

import Modal, { type ModalHandle } from "./Modal";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  show: (options: ConfirmOptions) => Promise<boolean>;
  respond: (value: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  isOpen: false,
  options: null,
  resolve: null,

  show: (options) =>
    new Promise<boolean>((resolve) => {
      set({ isOpen: true, options, resolve });
    }),

  respond: (value) => {
    const { resolve } = get();
    resolve?.(value);
    set({ isOpen: false, options: null, resolve: null });
  },
}));

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().show(options);
}

function ConfirmDialog() {
  const { isOpen, options, respond } = useConfirmStore();
  const modalRef = useRef<ModalHandle>(null);
  const [display, setDisplay] = useState<ConfirmOptions | null>(options);

  if (options !== null && display !== options) {
    setDisplay(options);
  }

  // Bridges global zustand `isOpen` (flipped by `confirmDialog()` callers and `respond()`) to imperative <dialog>.
  // oxlint-disable-next-line react-doctor/no-effect-event-handler
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.showModal();
    } else {
      modalRef.current?.close();
    }
  }, [isOpen]);

  const confirmClass = display?.danger ? "btn btn-error" : "btn btn-primary";
  const cancelClass = "btn";

  return (
    <Modal ref={modalRef} onClose={() => respond(false)} className="modal-box">
      {display && (
        <>
          <h3 className="text-lg font-semibold">{display.title}</h3>
          <p className="py-4 text-base-content/80">{display.message}</p>
          <div className="modal-action">
            <button type="button" className={cancelClass} onClick={() => respond(false)}>
              {display.cancelLabel ?? "Cancel"}
            </button>
            <button type="button" className={confirmClass} onClick={() => respond(true)}>
              {display.confirmLabel ?? "Confirm"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default ConfirmDialog;
