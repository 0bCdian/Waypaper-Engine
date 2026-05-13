import { useRef, useImperativeHandle, useCallback, type Ref, type ReactNode } from "react";
import { CloseButton } from "./ui";
import { cn } from "@/utils/cn";

export interface ModalHandle {
  showModal: () => void;
  close: () => void;
}

export type ModalHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /**
   * When true (default), header overlaps the padded modal rim (Load Playlist).
   * Set false for full-width boxed modals (`p-0`) like the filter cheatsheet.
   */
  bleedInsetDefault?: boolean;
  headerExtraClass?: string;
  /** Extra Tailwind classes appended to the title `<h2>`. */
  titleDefaultExtra?: string;
  /** Extra Tailwind classes appended to the subtitle `<p>`. */
  subtitleDefaultExtra?: string;
};

/** @deprecated Use `ModalHeaderProps` */
export type ModalStripedHeaderProps = ModalHeaderProps;

export function ModalHeader(props: ModalHeaderProps & { onClose: () => void }) {
  const {
    title,
    subtitle,
    onClose,
    bleedInsetDefault = true,
    headerExtraClass,
    titleDefaultExtra,
    subtitleDefaultExtra,
  } = props;

  return (
    <header
      className={cn(
        "wp-modal__header--bar flex shrink-0 items-start justify-between gap-4 text-left",
        "px-6 pb-5 pt-6",
        bleedInsetDefault && "-mx-6 -mt-6",
        !bleedInsetDefault && "md:px-10",
        headerExtraClass,
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <h2
          className={cn(
            "select-none font-bold uppercase leading-none tracking-[-0.02em]",
            "font-[family-name:var(--font-display)] text-2xl text-base-content md:text-3xl",
            titleDefaultExtra,
          )}
        >
          {title}
        </h2>
        {subtitle !== undefined ? (
          <p
            className={cn(
              "max-w-xl text-sm leading-[1.6] md:text-base text-base-content/75",
              subtitleDefaultExtra,
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      <CloseButton onClick={onClose} />
    </header>
  );
}

interface ModalProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  /** When false, omit the floating close control unless `stripedHeader` supplies an in-header close */
  showCloseButton?: boolean;
  stripedHeader?: ModalHeaderProps;
  /** Passthrough native `dialog.draggable`; useful for kiosk-style shell */
  draggable?: boolean;
}

function ModalInner({
  id,
  children,
  className,
  onClose,
  showCloseButton = true,
  stripedHeader,
  draggable,
  ref,
}: ModalProps & { ref?: Ref<ModalHandle> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useImperativeHandle(ref, () => ({
    showModal: () => {
      const el = dialogRef.current;
      if (el && typeof el.showModal === "function") {
        el.showModal();
      }
    },
    close: () => {
      const el = dialogRef.current;
      if (el && typeof el.close === "function") {
        el.close();
      }
    },
  }));

  const handleClose = useCallback(() => {
    dialogRef.current?.close();
    onClose?.();
  }, [onClose]);

  const floatingClose =
    Boolean(showCloseButton) && stripedHeader === undefined ? (
      <CloseButton onClick={handleClose} className="absolute right-3 top-3" />
    ) : null;

  return (
    <dialog draggable={draggable} id={id} className="modal" ref={dialogRef}>
      <div className={className ?? "modal-box"}>
        {stripedHeader !== undefined ? (
          <ModalHeader {...stripedHeader} onClose={handleClose} />
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
}

const Modal = Object.assign(ModalInner, { Header: ModalHeader });

export default Modal;
