import type React from "react";
import { useEffect, useRef } from "react";

import Modal, { type ModalHandle } from "./Modal";

interface WallhavenDisclaimerModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const WallhavenDisclaimerModal: React.FC<WallhavenDisclaimerModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const modalRef = useRef<ModalHandle>(null);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.showModal();
    } else {
      modalRef.current?.close();
    }
  }, [isOpen]);

  return (
    <Modal ref={modalRef} onClose={onCancel} className="modal-box max-w-lg">
      <h3 className="font-bold text-lg flex items-center gap-2 text-warning">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        Enable Wallhaven Integration
      </h3>

      <div className="py-4 space-y-3 text-sm text-base-content/80">
        <p>
          By enabling this feature you are connecting to <strong>wallhaven.cc</strong>, a
          third-party service that is not operated, controlled, or audited by the developer of this
          application.
        </p>

        <p>Please be aware of the following:</p>

        <ul className="list-disc list-inside space-y-1.5 pl-1">
          <li>
            Search queries and your API key (if provided) are transmitted over the network to
            Wallhaven&apos;s servers.
          </li>
          <li>
            Wallhaven hosts <strong>user-uploaded content</strong> including NSFW material. Content
            safety is not guaranteed even with purity filters enabled.
          </li>
          <li>
            Wallpaper images are downloaded from external URLs that the developer does not control
            or verify.
          </li>
          <li>
            Standard internet risks apply: your network traffic may be visible to your ISP, network
            administrator, or Wallhaven itself, and downloaded files could theoretically be
            malicious.
          </li>
        </ul>

        <p className="font-semibold text-base-content/90 pt-1">
          The developer of this application is not responsible for any damages, data exposure, or
          objectionable content encountered through this feature. Use at your own risk.
        </p>
      </div>

      <div className="modal-action">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-warning" onClick={onConfirm}>
          I Understand, Enable Wallhaven
        </button>
      </div>
    </Modal>
  );
};
